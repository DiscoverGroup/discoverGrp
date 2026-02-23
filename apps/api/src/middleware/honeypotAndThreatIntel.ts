/**
 * HONEYPOT & BEHAVIOURAL THREAT INTELLIGENCE
 * ===========================================
 * Why we need this on top of existing measures:
 *
 *  Skilled attackers do reconnaissance before launching an attack.
 *  They probe for hidden admin panels, backup files, config leaks, etc.
 *  The existing `suspiciousActivityLogger` only *logs* these — it does not
 *  penalise the requester or trap them.
 *
 *  This module adds:
 *  1. HONEYPOT ROUTES  — Fake endpoints that look juicy (/.env, /backup.sql,
 *     /admin/config) but should never be reached by legitimate traffic.
 *     Any request to these routes immediately flags the IP as hostile and
 *     starts a progressive block.
 *
 *  2. BEHAVIOURAL SCORING — Tracks per-IP signals across a rolling window:
 *     • 404 frequency (heavy scanning)
 *     • Auth failure frequency
 *     • Request diversity (hitting many endpoints quickly)
 *     • Unusual HTTP methods
 *     When the behavioural score exceeds a threshold the IP is blocked.
 *
 *  3. THREAT INTEL FEED HOOK — Placeholder to integrate with AbuseIPDB,
 *     Cloudflare Threat Intel, or any external IP reputation API without
 *     changing downstream code.
 *
 *  4. CANARY TOKENS — Reserved field names in forms (hidden fields).
 *     If a bot fills them in, we know it's automated.
 */

import { Request, Response, NextFunction, Router } from 'express';
import logger from '../utils/logger';
import { alertHoneypotTriggered, alertBehaviourBlock, alertAbuseIp } from '../utils/wafAlerts';

// ─── Behavioural score store (replace with Redis in production) ───────────────

interface BehaviourRecord {
  fourOhFours: number;
  authFailures: number;
  uniquePaths: Set<string>;
  unusualMethods: number;
  firstSeen: number;
  lastSeen: number;
  blocked: boolean;
}

const behaviourStore = new Map<string, BehaviourRecord>();
const BEHAVIOUR_WINDOW_MS  = 10 * 60 * 1000;   // 10-minute rolling window
const MAX_404S             = 20;
const MAX_AUTH_FAILURES    = 10;
const MAX_UNIQUE_PATHS     = 50;
const BEHAVIOUR_BLOCK_MS   = 60 * 60 * 1000;   // block for 1 hour

function getBehaviourRecord(ip: string): BehaviourRecord {
  const existing = behaviourStore.get(ip);
  const now = Date.now();

  if (!existing || now - existing.firstSeen > BEHAVIOUR_WINDOW_MS) {
    const fresh: BehaviourRecord = {
      fourOhFours: 0,
      authFailures: 0,
      uniquePaths: new Set(),
      unusualMethods: 0,
      firstSeen: now,
      lastSeen: now,
      blocked: false,
    };
    behaviourStore.set(ip, fresh);
    return fresh;
  }

  existing.lastSeen = now;
  return existing;
}

function isIpBlocked(ip: string): boolean {
  const record = behaviourStore.get(ip);
  return record?.blocked ?? false;
}

function evaluateBehaviourScore(record: BehaviourRecord): number {
  let score = 0;
  score += Math.min(record.fourOhFours, MAX_404S) / MAX_404S * 40;
  score += Math.min(record.authFailures, MAX_AUTH_FAILURES) / MAX_AUTH_FAILURES * 30;
  score += Math.min(record.uniquePaths.size, MAX_UNIQUE_PATHS) / MAX_UNIQUE_PATHS * 20;
  score += record.unusualMethods * 5;
  return score; // 0–100
}

// Prune old records every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of behaviourStore) {
    if (now - record.lastSeen > BEHAVIOUR_BLOCK_MS) {
      behaviourStore.delete(ip);
    }
  }
}, 30 * 60 * 1000);

// ─── Honeypot route builder ───────────────────────────────────────────────────

const HONEYPOT_PATHS = [
  // Config / credential leaks
  '/.env', '/.env.local', '/.env.production', '/.env.backup',
  '/config.json', '/config.yaml', '/config.yml', '/settings.json',
  '/secrets.json', '/credentials.json', '/database.yml',
  // Backup files
  '/backup.sql', '/backup.zip', '/dump.sql', '/db.sql',
  '/site.zip', '/website.zip', '/archive.tar.gz',
  // CMS probing
  '/wp-admin', '/wp-login.php', '/wp-config.php', '/xmlrpc.php',
  '/administrator', '/admin/config', '/admin/setup',
  // PHP / server info leaks
  '/phpinfo.php', '/info.php', '/test.php', '/debug.php',
  '/server-status', '/server-info',
  // Common vuln scanners look for these
  '/actuator/env', '/actuator/health', '/actuator/mappings',
  '/.git/config', '/.git/HEAD',
  '/api/swagger.json', '/api-docs', '/graphql/playground',
];

/**
 * Mounts honeypot routes onto a router.
 * Returns a 200 with fake-looking data to slow down the attacker,
 * records them in the behaviour store, and logs a high-priority alert.
 */
export function mountHoneypots(router: Router): void {
  for (const path of HONEYPOT_PATHS) {
    router.all(path, (req: Request, res: Response) => {
      const ip = req.ip || 'unknown';
      const record = getBehaviourRecord(ip);

      // Immediately max-score this IP
      record.fourOhFours += MAX_404S;
      record.blocked = true;

      logger.error('[HONEYPOT] Trap triggered — IP flagged as hostile', {
        ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('user-agent'),
        timestamp: new Date().toISOString(),
      });
      // Fire real-time alert (Slack/email)
      alertHoneypotTriggered(ip, req.path, req.method, req.get('user-agent'));

      // Return believable fake data so attacker wastes time
      // (a clean 403 tells them the honeypot exists)
      if (req.path.includes('.sql') || req.path.includes('.zip')) {
        return res.status(200).send('');  // empty "file"
      }
      if (req.path.includes('.env')) {
        return res.status(200).type('text/plain').send(
          `# Generated by deploy\nNODE_ENV=production\nSECRET=REDACTED`
        );
      }
      if (req.path.includes('wp-')) {
        return res.status(200).type('text/html').send(
          `<!DOCTYPE html><html><head><title>WordPress</title></head><body>Loading...</body></html>`
        );
      }

      res.status(200).json({ status: 'ok' });
    });
  }
}

// ─── Behavioural analysis middleware ─────────────────────────────────────────

/** Attach this AFTER your routes so it can see 404 responses */
export const behaviouralAnalysis = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown';

  // Hard block
  if (isIpBlocked(ip)) {
    logger.warn('[BEHAVIOUR] Blocked IP attempted access', { ip, path: req.path });
    return res.status(403).json({
      error: 'Access denied',
      code: 'BEHAVIOUR_BLOCKED',
    });
  }

  const record = getBehaviourRecord(ip);
  record.uniquePaths.add(req.path);

  const UNUSUAL_METHODS = new Set(['TRACE', 'TRACK', 'DEBUG', 'CONNECT']);
  if (UNUSUAL_METHODS.has(req.method)) {
    record.unusualMethods += 1;
  }

  // Hook into response to capture 401/404 counts
  const originalSend = res.send.bind(res);
  res.send = function (body) {
    const statusCode = res.statusCode;
    if (statusCode === 404) record.fourOhFours += 1;
    if (statusCode === 401) record.authFailures += 1;

    const score = evaluateBehaviourScore(record);
    if (score >= 80 && !record.blocked) {
      record.blocked = true;
      logger.error('[BEHAVIOUR] IP auto-blocked due to high threat score', {
        ip,
        score,
        fourOhFours: record.fourOhFours,
        authFailures: record.authFailures,
        uniquePaths: record.uniquePaths.size,
      });
      // Fire real-time alert
      alertBehaviourBlock(ip, score, {
        fourOhFours: record.fourOhFours,
        authFailures: record.authFailures,
        uniquePaths: record.uniquePaths.size,
      });
    }

    return originalSend(body);
  };

  next();
};

// ─── Canary token / hidden form-field detector ────────────────────────────────

/**
 * Add `honeypotFields` to your form validation.
 * The frontend must render these as hidden fields with empty values.
 * Bots that fill in all fields will be caught here.
 *
 * Usage: add `website` and `phone_number_2` as hidden inputs in your forms
 * with value="" and set them to display:none via CSS (NOT type="hidden",
 * which bots know to skip).
 */
export const canaryTokenGuard = (req: Request, res: Response, next: NextFunction) => {
  const CANARY_FIELDS = ['website', 'phone_number_2', 'full_address', 'url'];

  for (const field of CANARY_FIELDS) {
    const value = req.body?.[field];
    // Field exists in body AND is non-empty → bot filled it in
    if (value !== undefined && value !== '') {
      logger.warn('[CANARY] Bot detected via honeypot form field', {
        ip: req.ip,
        field,
        path: req.path,
        userAgent: req.get('user-agent'),
      });
      // Return 200 to avoid tipping off the bot
      return res.status(200).json({ message: 'Submitted successfully' });
    }
  }

  next();
};

// ─── Threat intel hook ────────────────────────────────────────────────────────

/**
 * Optional: integrate with AbuseIPDB or similar.
 * Set ABUSEIPDB_API_KEY in environment to enable.
 * This is async and non-blocking — failures are silently ignored
 * so a third-party outage cannot bring down your API.
 */
export async function checkIpReputation(ip: string): Promise<{ isAbusive: boolean; score: number }> {
  const apiKey = process.env.ABUSEIPDB_API_KEY;
  if (!apiKey) return { isAbusive: false, score: 0 };

  try {
    const response = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
      {
        headers: {
          'Key': apiKey,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(2000), // 2s timeout
      }
    );

    if (!response.ok) return { isAbusive: false, score: 0 };

    const data = await response.json() as { data?: { abuseConfidenceScore?: number } };
    const score = data?.data?.abuseConfidenceScore ?? 0;

    return { isAbusive: score >= 50, score };
  } catch {
    return { isAbusive: false, score: 0 };
  }
}

/** Middleware that checks AbuseIPDB asynchronously — blocks IPs with score ≥ 50 */
export const ipReputationGuard = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || '';
  // Skip private/local IPs
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return next();
  }

  const { isAbusive, score } = await checkIpReputation(ip);
  if (isAbusive) {
    logger.error('[THREAT INTEL] Blocked request from known abusive IP', { ip, score });
    alertAbuseIp(ip, score);
    return res.status(403).json({ error: 'Access denied', code: 'IP_REPUTATION' });
  }
  next();
};
