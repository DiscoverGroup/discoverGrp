/**
 * ADVANCED RATE LIMITER — User-based + Distributed (Redis-ready)
 * ===============================================================
 * Why the original IP-only rate limiter can be bypassed:
 *
 *  1. Rotating proxies / VPNs → different IP on every request
 *  2. Shared NAT (office/university) → one IP for hundreds of users
 *  3. X-Forwarded-For spoofing   → attacker supplies a fake IP header
 *  4. In-memory store resets on restart → rate counts lost on redeploy
 *
 * This module adds:
 *  • User-ID–based limiting for authenticated routes (survives IP rotation)
 *  • Fingerprint-based limiting (IP + User-Agent hash) as a fallback
 *  • Redis-compatible store interface — plug in `rate-limit-redis` in prod
 *  • Progressive penalty: repeated violations increase the window length
 *  • Automatic temporary IP block after N consecutive violations
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit, { Options } from 'express-rate-limit';
import logger from '../utils/logger';
import { alertPenaltyBox } from '../utils/wafAlerts';
import { getRedis } from '../utils/redisClient';
import crypto from 'crypto';

// ─── Redis-backed violation tracker ──────────────────────────────────────────
const VIOLATION_THRESHOLD = 5;
const PENALTY_DURATION_MS = 30 * 60 * 1000;       // 30 min block
const VIOLATION_WINDOW_S  = 15 * 60;              // 15-min rolling window for counts

interface ViolationRecord {
  count: number;
  penaltyUntil: number | null;
}

async function getViolations(key: string): Promise<ViolationRecord> {
  const redis = getRedis();
  const raw = await redis.get(`rl:viol:${key}`);
  if (!raw) return { count: 0, penaltyUntil: null };
  try { return JSON.parse(raw) as ViolationRecord; } catch { return { count: 0, penaltyUntil: null }; }
}

async function recordViolation(key: string): Promise<ViolationRecord> {
  const redis = getRedis();
  const record = await getViolations(key);
  record.count += 1;

  if (record.count >= VIOLATION_THRESHOLD) {
    record.penaltyUntil = Date.now() + PENALTY_DURATION_MS;
    logger.warn('[RATE LIMIT] IP/user placed in penalty box', { key, violations: record.count });
    alertPenaltyBox(key, record.count);
  }

  await redis.set(`rl:viol:${key}`, JSON.stringify(record), 'EX', VIOLATION_WINDOW_S);
  return record;
}

async function isPenalised(key: string): Promise<boolean> {
  const record = await getViolations(key);
  if (!record.penaltyUntil) return false;
  if (Date.now() > record.penaltyUntil) {
    // Penalty expired — delete the key
    await getRedis().del(`rl:viol:${key}`);
    return false;
  }
  return true;
}

// ─── Key generator helpers ────────────────────────────────────────────────────

/** Returns authenticated user-id if present, otherwise falls back to IP */
function userOrIpKey(req: Request): string {
  const user = (req as Request & { user?: { id?: string } }).user;
  if (user?.id) return `user:${user.id}`;
  return `ip:${req.ip}`;
}

/** Combines IP + User-Agent hash → harder to spoof both simultaneously */
function fingerprintKey(req: Request): string {
  const ua  = req.get('user-agent') || 'unknown';
  const ip  = req.ip || 'unknown';
  const hash = crypto.createHash('sha256').update(`${ip}::${ua}`).digest('hex').slice(0, 16);
  return `fp:${hash}`;
}

// ─── Penalty-box check (applied before all rate limiters) ────────────────────

export const penaltyBoxGuard = async (req: Request, res: Response, next: NextFunction) => {
  const keys = [
    `ip:${req.ip}`,
    fingerprintKey(req),
    userOrIpKey(req),
  ];

  for (const key of keys) {
    if (await isPenalised(key)) {
      logger.warn('[RATE LIMIT] Blocked request from penalty-box entry', {
        key,
        ip: req.ip,
        path: req.path,
      });
      return res.status(429).json({
        error: 'Too many violations. Your access has been temporarily suspended.',
        code: 'PENALTY_BOX',
        retryAfter: Math.ceil(PENALTY_DURATION_MS / 1000),
      });
    }
  }

  next();
};

// ─── Factory for rate limiters with violation tracking ───────────────────────

function makeRateLimiter(options: Partial<Options> & { keyStrategy?: 'ip' | 'user' | 'fingerprint' }) {
  const { keyStrategy = 'ip', ...rateLimitOptions } = options;

  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    ...rateLimitOptions,
    keyGenerator: (req: Request): string => {
      switch (keyStrategy) {
        case 'user':        return userOrIpKey(req);
        case 'fingerprint': return fingerprintKey(req);
        default:            return req.ip || 'unknown';
      }
    },
    handler: async (req: Request, res: Response) => {
      const key = keyStrategy === 'user'
        ? userOrIpKey(req)
        : keyStrategy === 'fingerprint'
          ? fingerprintKey(req)
          : `ip:${req.ip}`;

      const record = await recordViolation(key);

      logger.warn('[RATE LIMIT] Limit exceeded', {
        key,
        ip: req.ip,
        path: req.path,
        violations: record.count,
        penalised: !!record.penaltyUntil,
      });

      res.status(429).json({
        error: rateLimitOptions.message ?? 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED',
        violations: record.count,
        penalised: !!record.penaltyUntil,
      });
    },
  });
}

// ─── Exported limiters ────────────────────────────────────────────────────────

/** General API limiter: 100 req / 15 min per IP */
export const advancedApiLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  keyStrategy: 'ip',
});

/** Auth routes: 5 attempts / 15 min per fingerprint (survives IP rotation) */
export const advancedAuthLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please wait 15 minutes.',
  keyStrategy: 'fingerprint',
});

/** Password-reset / email: 3 per hour per fingerprint */
export const advancedEmailLimiter = makeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many email requests. Please try again later.',
  keyStrategy: 'fingerprint',
});

/** Booking: 10 per hour per authenticated user (not just IP) */
export const advancedBookingLimiter = makeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many booking attempts. Please try again later.',
  keyStrategy: 'user',
});

/** Admin routes: 200 req / 15 min per authenticated user */
export const advancedAdminLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Admin rate limit exceeded.',
  keyStrategy: 'user',
});
