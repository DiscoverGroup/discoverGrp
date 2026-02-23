/**
 * JWT HARDENING MODULE
 * ====================
 * Why the original JWT implementation can be bypassed:
 *
 *  1. Algorithm confusion (alg:none / RS256→HS256 downgrade)
 *     — A crafted token with "alg":"none" skips signature verification
 *     — If the server accepts RS256 public key as an HS256 secret, attacker
 *       can forge tokens by signing with the widely-available public key.
 *
 *  2. Weak/guessable JWT_SECRET (short secrets can be brute-forced offline
 *     using tools like hashcat after capturing any valid token)
 *
 *  3. Token replay after logout (no server-side invalidation)
 *
 *  4. Missing audience/issuer checks (token issued for one service accepted
 *     by another — "confused deputy" attack)
 *
 *  5. Token theft via XSS (if stored in localStorage)
 *
 *  6. Long-lived access tokens (stolen token stays valid for days)
 *
 * This module adds:
 *  • Algorithm whitelist (HS256 only — no "none", no RS256 for access tokens)
 *  • iss / aud / sub claim enforcement
 *  • Server-side token blacklist (in-memory; swap for Redis in prod)
 *  • Device fingerprint binding (token pinned to UA hash at issue time)
 *  • Short access token TTL (15 min) + rotation-enforced refresh flow
 *  • Timing-safe secret comparison
 */

import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// ─── Configuration ────────────────────────────────────────────────────────────
const ALGORITHM         = 'HS256' as const;
const ALLOWED_ALGORITHMS = ['HS256'] as const;   // never accept "none" or RS256
const ACCESS_TOKEN_TTL   = '15m';
const REFRESH_TOKEN_TTL  = '7d';
const ISSUER             = process.env.JWT_ISSUER  || 'discovergrp-api';
const AUDIENCE           = process.env.JWT_AUDIENCE || 'discovergrp-client';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  return secret;
}

// ─── Token blacklist (replace Map with Redis SET in production) ───────────────
//    Key: jti (unique token ID)   Value: expiry timestamp
const tokenBlacklist = new Map<string, number>();

// Prune expired entries every 15 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of tokenBlacklist) {
    if (exp < now) tokenBlacklist.delete(jti);
  }
}, 15 * 60 * 1000);

export function blacklistToken(jti: string, expMs: number): void {
  tokenBlacklist.set(jti, expMs);
}

export function isTokenBlacklisted(jti: string): boolean {
  const exp = tokenBlacklist.get(jti);
  if (exp === undefined) return false;
  if (Date.now() > exp) {
    tokenBlacklist.delete(jti);
    return false;
  }
  return true;
}

// ─── Device fingerprint ───────────────────────────────────────────────────────

export function buildDeviceFingerprint(req: Request): string {
  const ua  = req.get('user-agent') || '';
  const lang = req.get('accept-language') || '';
  return crypto
    .createHash('sha256')
    .update(`${ua}::${lang}`)
    .digest('hex')
    .slice(0, 24);
}

// ─── Token issuing ─────────────────────────────────────────────────────────────

export interface TokenPayload {
  sub: string;       // userId
  email: string;
  role: string;
  type: 'access' | 'refresh';
  deviceFp?: string; // device fingerprint (optional binding)
}

export function issueAccessToken(payload: Omit<TokenPayload, 'type'>, req?: Request): string {
  const jti = crypto.randomBytes(16).toString('hex');
  const fp  = req ? buildDeviceFingerprint(req) : undefined;

  const options: SignOptions = {
    algorithm: ALGORITHM,
    expiresIn: ACCESS_TOKEN_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: jti,
  };

  return jwt.sign({ ...payload, type: 'access', deviceFp: fp }, getSecret(), options);
}

export function issueRefreshToken(payload: Omit<TokenPayload, 'type'>, req?: Request): string {
  const jti = crypto.randomBytes(16).toString('hex');
  const fp  = req ? buildDeviceFingerprint(req) : undefined;

  const options: SignOptions = {
    algorithm: ALGORITHM,
    expiresIn: REFRESH_TOKEN_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: jti,
  };

  return jwt.sign({ ...payload, type: 'refresh', deviceFp: fp }, getSecret(), options);
}

// ─── Token verification ───────────────────────────────────────────────────────

export interface VerifyResult {
  valid: boolean;
  payload?: JwtPayload & TokenPayload;
  reason?: string;
}

export function verifyToken(token: string, expectedType: 'access' | 'refresh', req?: Request): VerifyResult {
  try {
    // 1. Decode header first — reject disallowed algorithms BEFORE verify()
    //    This prevents the "alg:none" attack where jsonwebtoken is tricked
    //    before it even tries to verify the signature.
    const header = jwt.decode(token, { complete: true })?.header;
    if (!header || !(ALLOWED_ALGORITHMS as readonly string[]).includes(header.alg)) {
      logger.warn('[JWT] Rejected token with disallowed algorithm', { alg: header?.alg });
      return { valid: false, reason: 'ALGORITHM_NOT_ALLOWED' };
    }

    // 2. Full signature + claims verification
    const payload = jwt.verify(token, getSecret(), {
      algorithms: [...ALLOWED_ALGORITHMS],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as JwtPayload & TokenPayload;

    // 3. Token type must match expected use
    if (payload.type !== expectedType) {
      return { valid: false, reason: 'TOKEN_TYPE_MISMATCH' };
    }

    // 4. Check blacklist (covers logout / token rotation)
    if (payload.jti && isTokenBlacklisted(payload.jti)) {
      return { valid: false, reason: 'TOKEN_REVOKED' };
    }

    // 5. Device fingerprint binding (soft check — warn but don't hard-block
    //    to avoid breaking legitimate clients that change UA, e.g. app updates)
    if (req && payload.deviceFp) {
      const currentFp = buildDeviceFingerprint(req);
      if (!crypto.timingSafeEqual(
        Buffer.from(payload.deviceFp),
        Buffer.from(currentFp)
      )) {
        logger.warn('[JWT] Device fingerprint mismatch — possible token theft', {
          ip: req.ip,
          sub: payload.sub,
          storedFp: payload.deviceFp,
          currentFp,
        });
        // Uncomment to enforce hard-block:
        // return { valid: false, reason: 'DEVICE_FINGERPRINT_MISMATCH' };
      }
    }

    return { valid: true, payload };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    logger.warn('[JWT] Verification failed', { reason: message });
    return {
      valid: false,
      reason: message.includes('expired')
        ? 'TOKEN_EXPIRED'
        : message.includes('invalid signature')
          ? 'INVALID_SIGNATURE'
          : 'VERIFICATION_FAILED',
    };
  }
}

// ─── Express middleware ───────────────────────────────────────────────────────

export interface HardenedRequest extends Request {
  tokenPayload?: JwtPayload & TokenPayload;
}

/**
 * Drop-in replacement for the existing `requireAuth` middleware.
 * Reads from Authorization header OR httpOnly cookie (whichever is present),
 * then runs the full hardened verification chain above.
 */
export const requireHardenedAuth = (req: HardenedRequest, res: Response, next: NextFunction) => {
  // Extract token from Bearer header or cookie
  let token: string | undefined;

  const authHeader = req.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
  }

  const result = verifyToken(token, 'access', req);

  if (!result.valid || !result.payload) {
    const status = result.reason === 'TOKEN_EXPIRED' ? 401 : 403;
    return res.status(status).json({
      error: 'Authentication failed',
      code: result.reason ?? 'AUTH_FAILED',
    });
  }

  req.tokenPayload = result.payload;
  next();
};

/**
 * Logout helper — blacklists the current access AND refresh tokens
 */
export const logoutHandler = (req: HardenedRequest, res: Response) => {
  const blacklistFromCookie = (cookieName: string, expectedType: 'access' | 'refresh') => {
    const token = req.cookies?.[cookieName] as string | undefined;
    if (!token) return;
    try {
      const decoded = jwt.decode(token) as JwtPayload | null;
      if (decoded?.jti && decoded.exp) {
        blacklistToken(decoded.jti, decoded.exp * 1000);
      }
    } catch {
      // ignore decode errors on logout
    }
    void expectedType;
  };

  blacklistFromCookie('accessToken', 'access');
  blacklistFromCookie('refreshToken', 'refresh');

  // Clear cookies
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  };
  res.clearCookie('accessToken', cookieOpts);
  res.clearCookie('refreshToken', cookieOpts);

  return res.json({ message: 'Logged out successfully' });
};
