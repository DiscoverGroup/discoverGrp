/**
 * TOTP / 2FA SERVICE
 * ==================
 * Implements RFC 6238 Time-based One-Time Passwords (TOTP) for admin accounts.
 *
 * How it works:
 *  1. Admin clicks "Enable 2FA" → server generates a secret + QR code URL
 *  2. Admin scans QR code with Google Authenticator / Authy
 *  3. Admin submits the first 6-digit code to confirm setup
 *  4. From now on, login requires: password + 6-digit TOTP code
 *
 * Security notes:
 *  - Secrets are stored ENCRYPTED in the database (see User model note below)
 *  - Each TOTP code is single-use (validated window ±1 step = ±30 seconds)
 *  - 10 backup codes are generated at setup for account recovery
 *
 * DB fields needed on User model (add manually or via migration):
 *   totpSecret?:      String  (base32 encrypted secret)
 *   totpEnabled:      Boolean (default: false)
 *   totpBackupCodes?: String[] (hashed backup codes)
 *   totpVerified:     Boolean (default: false — set true after first code confirm)
 */

// otplib exports differ between CJS and ESM / version to version.
// Namespace import then destructure is the most compatible pattern.
import * as otplib from 'otplib';
const { authenticator } = otplib;
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import logger from './logger';

// ─── TOTP Configuration ───────────────────────────────────────────────────────
authenticator.options = {
  window: 1,       // Accept 1 step before/after current (±30s tolerance)
  step: 30,        // 30-second steps (standard)
  digits: 6,       // 6-digit codes
};

const APP_NAME = process.env.TOTP_APP_NAME || 'DiscoverGroup';
const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-change-in-production';

// ─── Secret encryption (AES-256-GCM) ─────────────────────────────────────────

function deriveKey(rawKey: string): Buffer {
  return crypto.createHash('sha256').update(rawKey).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey(ENCRYPTION_KEY);
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(encryptedData: string): string {
  const [ivHex, tagHex, cipherHex] = encryptedData.split(':');
  if (!ivHex || !tagHex || !cipherHex) throw new Error('Invalid encrypted secret format');

  const key  = deriveKey(ENCRYPTION_KEY);
  const iv   = Buffer.from(ivHex, 'hex');
  const tag  = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(cipherHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString('utf8') + decipher.final('utf8');
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export interface TotpSetupResult {
  secret: string;          // Raw base32 secret — save encrypted to DB
  encryptedSecret: string; // AES-encrypted secret for DB storage
  otpAuthUrl: string;      // otpauth:// URI for QR code
  qrCodeDataUrl: string;   // Base64 PNG data URL
  backupCodes: string[];   // 10 plaintext codes — show once, save hashed
  hashedBackupCodes: string[]; // bcrypt-hashed codes — save to DB
}

export async function generateTotpSetup(userEmail: string): Promise<TotpSetupResult> {
  const secret = authenticator.generateSecret(32); // 160-bit secret
  const encryptedSecret = encryptSecret(secret);

  const otpAuthUrl = authenticator.keyuri(userEmail, APP_NAME, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, { width: 250, margin: 2 });

  // Generate 10 backup codes (8 alphanumeric chars each)
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  const hashedBackupCodes = await Promise.all(
    backupCodes.map(code => bcrypt.hash(code, 10))
  );

  logger.info('[TOTP] Setup initiated', { email: userEmail });

  return {
    secret,
    encryptedSecret,
    otpAuthUrl,
    qrCodeDataUrl,
    backupCodes,  // Show ONCE to the user, never again
    hashedBackupCodes,
  };
}

// ─── Verification ─────────────────────────────────────────────────────────────

export function verifyTotpCode(encryptedSecret: string, token: string): boolean {
  try {
    const secret = decryptSecret(encryptedSecret);
    return authenticator.verify({ token: token.replace(/\s/g, ''), secret });
  } catch (err) {
    logger.warn('[TOTP] Verification error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Verify a backup code against the stored hashed codes.
 * Returns the index of the matched code (for removal) or -1 if no match.
 * IMPORTANT: Caller must remove the matched code from DB after use (single-use).
 */
export async function verifyBackupCode(
  plainCode: string,
  hashedCodes: string[]
): Promise<number> {
  const cleanCode = plainCode.replace(/\s|-/g, '').toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(cleanCode, hashedCodes[i]);
    if (match) return i;
  }
  return -1;
}
