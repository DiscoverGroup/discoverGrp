/**
 * TOTP / 2FA ROUTES
 * =================
 * POST /auth/2fa/setup        — Generate secret + QR code (requires auth)
 * POST /auth/2fa/verify-setup — Confirm first code to activate 2FA (requires auth)
 * POST /auth/2fa/verify       — Submit code during login (pre-auth step)
 * POST /auth/2fa/disable      — Disable 2FA (requires auth + password confirm)
 * GET  /auth/2fa/status       — Check if 2FA is enabled for current user (requires auth)
 */

import { Router, Response } from 'express';
import {
  generateTotpSetup,
  verifyTotpCode,
  verifyBackupCode,
} from '../../utils/totpService';
import { verifyPassword } from '../../utils/passwordService';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import User from '../../models/User';
import logger from '../../utils/logger';

const router = Router();

// ─── GET /auth/2fa/status ─────────────────────────────────────────────────────
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('totpEnabled totpVerified');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      enabled: (user as unknown as { totpEnabled?: boolean }).totpEnabled ?? false,
      verified: (user as unknown as { totpVerified?: boolean }).totpVerified ?? false,
    });
  } catch {
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

// ─── POST /auth/2fa/setup ─────────────────────────────────────────────────────
router.post('/setup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userDoc = user as unknown as {
      totpEnabled?: boolean;
      totpSecret?: string;
      totpVerified?: boolean;
      totpBackupCodes?: string[];
      save(): Promise<void>;
    };

    if (userDoc.totpEnabled && userDoc.totpVerified) {
      return res.status(400).json({ error: '2FA is already enabled and verified.' });
    }

    const setup = await generateTotpSetup(user.email);

    // Save encrypted secret (NOT verified yet — user must confirm first code)
    userDoc.totpSecret = setup.encryptedSecret;
    userDoc.totpEnabled = false;   // not fully enabled until confirmed
    userDoc.totpVerified = false;
    userDoc.totpBackupCodes = setup.hashedBackupCodes;
    await userDoc.save();

    logger.info('[2FA] Setup initiated', { userId: user._id, email: user.email });

    // Return QR code + backup codes (shown ONCE)
    res.json({
      message: 'Scan the QR code with your authenticator app, then submit a code to confirm.',
      qrCode: setup.qrCodeDataUrl,
      backupCodes: setup.backupCodes,  // Shown ONCE — user must save these
    });
  } catch (err) {
    logger.error('[2FA] Setup failed', { error: err instanceof Error ? err.message : err });
    res.status(500).json({ error: 'Failed to initiate 2FA setup' });
  }
});

// ─── POST /auth/2fa/verify-setup ──────────────────────────────────────────────
// Confirms 2FA setup by verifying the first code from the authenticator app.
router.post('/verify-setup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code } = req.body as { code?: string };
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userDoc = user as unknown as {
      totpSecret?: string;
      totpEnabled?: boolean;
      totpVerified?: boolean;
      save(): Promise<void>;
    };

    if (!userDoc.totpSecret) {
      return res.status(400).json({ error: '2FA setup not initiated. Call /setup first.' });
    }

    const valid = verifyTotpCode(userDoc.totpSecret, code);
    if (!valid) {
      logger.warn('[2FA] Invalid setup verification code', { userId: user._id });
      return res.status(400).json({ error: 'Invalid code. Please try again.' });
    }

    // Mark as verified and enabled
    userDoc.totpEnabled = true;
    userDoc.totpVerified = true;
    await userDoc.save();

    logger.info('[2FA] Successfully enabled', { userId: user._id, email: user.email });
    res.json({ message: '2FA has been successfully enabled on your account.' });
  } catch (err) {
    logger.error('[2FA] Verify-setup failed', { error: err instanceof Error ? err.message : err });
    res.status(500).json({ error: 'Failed to verify 2FA code' });
  }
});

// ─── POST /auth/2fa/verify ────────────────────────────────────────────────────
// Called during the login flow AFTER password is correct.
// Expects { userId, code } | { userId, backupCode }
router.post('/verify', async (req, res: Response) => {
  try {
    const { userId, code, backupCode } = req.body as {
      userId?: string;
      code?: string;
      backupCode?: string;
    };

    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!code && !backupCode) return res.status(400).json({ error: 'code or backupCode is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userDoc = user as unknown as {
      totpSecret?: string;
      totpEnabled?: boolean;
      totpBackupCodes?: string[];
      save(): Promise<void>;
    };

    if (!userDoc.totpEnabled || !userDoc.totpSecret) {
      return res.status(400).json({ error: '2FA is not enabled for this account.' });
    }

    // Verify TOTP code
    if (code) {
      const valid = verifyTotpCode(userDoc.totpSecret, code);
      if (!valid) {
        logger.warn('[2FA] Invalid login code', { userId });
        return res.status(401).json({ error: 'Invalid 2FA code. Please try again.' });
      }
    }

    // Verify backup code
    if (backupCode && !code) {
      const matchIndex = await verifyBackupCode(backupCode, userDoc.totpBackupCodes ?? []);
      if (matchIndex === -1) {
        logger.warn('[2FA] Invalid backup code', { userId });
        return res.status(401).json({ error: 'Invalid backup code.' });
      }
      // Remove used backup code (single-use)
      userDoc.totpBackupCodes!.splice(matchIndex, 1);
      await userDoc.save();
      logger.info('[2FA] Backup code used', { userId, remaining: userDoc.totpBackupCodes!.length });
    }

    res.json({ verified: true });
  } catch (err) {
    logger.error('[2FA] Verify failed', { error: err instanceof Error ? err.message : err });
    res.status(500).json({ error: 'Failed to verify 2FA code' });
  }
});

// ─── POST /auth/2fa/disable ───────────────────────────────────────────────────
router.post('/disable', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password, code } = req.body as { password?: string; code?: string };
    if (!password) return res.status(400).json({ error: 'Password is required to disable 2FA' });

    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userDoc = user as unknown as {
      password: string;
      totpSecret?: string;
      totpEnabled?: boolean;
      totpVerified?: boolean;
      totpBackupCodes?: string[];
      save(): Promise<void>;
    };

    // Verify password first
    const { valid: pwValid } = await verifyPassword(password, userDoc.password);
    if (!pwValid) return res.status(401).json({ error: 'Incorrect password.' });

    // Optionally require TOTP code confirmation before disabling
    if (code && userDoc.totpSecret) {
      const totpValid = verifyTotpCode(userDoc.totpSecret, code);
      if (!totpValid) return res.status(401).json({ error: 'Invalid 2FA code.' });
    }

    // Clear all 2FA fields
    userDoc.totpSecret = undefined;
    userDoc.totpEnabled = false;
    userDoc.totpVerified = false;
    userDoc.totpBackupCodes = [];
    await userDoc.save();

    logger.info('[2FA] Disabled', { userId: user._id, email: user.email });
    res.json({ message: '2FA has been disabled on your account.' });
  } catch (err) {
    logger.error('[2FA] Disable failed', { error: err instanceof Error ? err.message : err });
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

export default router;
