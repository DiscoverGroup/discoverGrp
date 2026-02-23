/**
 * PASSWORD SERVICE — Argon2id with automatic bcrypt migration
 * ============================================================
 * Why replace bcryptjs with Argon2?
 *
 *  bcrypt was designed in 1999 and has a hard 72-byte input limit —
 *  passwords longer than 72 characters are SILENTLY TRUNCATED, so
 *  "correctpassword" and "correctpassword" + 100 extra characters hash
 *  identically. Argon2 has no such limit.
 *
 *  Argon2 also won the Password Hashing Competition (2015) and is
 *  recommended by OWASP over bcrypt, scrypt, and PBKDF2 for new systems.
 *
 *  Argon2id combines:
 *    - Argon2i  (side-channel resistance)
 *    - Argon2d  (GPU resistance)
 *
 * MIGRATION STRATEGY (zero downtime):
 *  1. New passwords are hashed with Argon2id immediately.
 *  2. When a user with an OLD bcrypt hash successfully logs in, their password
 *     is re-hashed with Argon2id and saved — transparent to the user.
 *  3. `verify()` detects the hash algorithm by prefix ($2b$ = bcrypt, $argon2 = argon2)
 *     and uses the correct library for comparison.
 *  4. After all active users have logged in at least once, bcryptjs can be
 *     removed as a dependency (typically 3-6 months post-migration).
 */

import * as argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import logger from './logger';

// ─── Argon2id configuration (OWASP 2023 recommendations) ─────────────────────
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,   // 64 MB — resist GPU/ASIC attacks
  timeCost: 3,             // 3 iterations
  parallelism: 4,          // 4 threads
  hashLength: 32,          // 256-bit output
};

// ─── Exported API ─────────────────────────────────────────────────────────────

/**
 * Hash a plain-text password with Argon2id.
 * Drop-in replacement for bcrypt.hash(password, rounds).
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verify a password against a stored hash.
 * Automatically detects whether the stored hash is bcrypt ($2b$) or
 * Argon2 ($argon2id$) and uses the correct library.
 *
 * Returns: { valid: boolean; needsRehash: boolean }
 *   - `valid`       — password is correct
 *   - `needsRehash` — hash is bcrypt and should be upgraded to Argon2id
 *     (caller is responsible for saving the new hash: await hashPassword(plaintext))
 */
export async function verifyPassword(
  plaintext: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  try {
    // bcrypt hashes start with $2b$ or $2a$
    if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
      const valid = await bcrypt.compare(plaintext, storedHash);
      // Flag for re-hash after successful login
      return { valid, needsRehash: valid };
    }

    // Argon2 hashes start with $argon2
    if (storedHash.startsWith('$argon2')) {
      const valid = await argon2.verify(storedHash, plaintext, ARGON2_OPTIONS);
      // Check if config has changed (memory cost, time cost, type) and re-hash needed
      const needsRehash = valid && argon2.needsRehash(storedHash, ARGON2_OPTIONS);
      return { valid, needsRehash };
    }

    logger.warn('[PasswordService] Unrecognised hash format — rejecting', {
      prefix: storedHash.slice(0, 10),
    });
    return { valid: false, needsRehash: false };

  } catch (err) {
    logger.error('[PasswordService] Verification error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { valid: false, needsRehash: false };
  }
}

/**
 * Convenience: create a new Argon2id hash for use in seeding / tests.
 * Alias for hashPassword().
 */
export const hashForSeed = hashPassword;
