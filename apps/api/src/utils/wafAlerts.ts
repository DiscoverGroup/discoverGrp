/**
 * WAF ALERT SYSTEM — Slack + Email notifications for critical security events
 * ============================================================================
 * Sends real-time alerts when:
 *  - WAF blocks a request (score ≥ 10)
 *  - A honeypot trap is triggered
 *  - An IP is placed in the penalty box after repeated violations
 *  - AbuseIPDB flags a request as high-risk
 *  - Behavioural analysis auto-blocks an IP
 *
 * Configuration (add to .env):
 *   WAF_SLACK_WEBHOOK_URL   — Slack Incoming Webhook URL
 *   WAF_ALERT_EMAIL         — Email address to receive critical alerts
 *   WAF_ALERT_COOLDOWN_MS   — Min ms between duplicate alerts (default: 60000)
 *
 * Both channels are optional and independent — if neither is configured,
 * alerts are only written to the Winston logger (already in place).
 */

import logger from './logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityAlert {
  severity: AlertSeverity;
  event: string;           // e.g. 'WAF_BLOCKED', 'HONEYPOT_TRIGGERED'
  ip: string;
  path?: string;
  method?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// ─── Cooldown (prevent duplicate alerts flooding Slack/email) ─────────────────
interface CooldownEntry { lastSent: number; count: number }
const cooldownMap = new Map<string, CooldownEntry>();

function shouldSendAlert(key: string, cooldownMs: number): boolean {
  const now = Date.now();
  const entry = cooldownMap.get(key);
  if (!entry || now - entry.lastSent > cooldownMs) {
    cooldownMap.set(key, { lastSent: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return false;
}

// ─── Slack alert ─────────────────────────────────────────────────────────────

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  critical: '🚨',
  high:     '⚠️',
  medium:   '🔔',
  low:      'ℹ️',
};

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#3b82f6',
};

async function sendSlackAlert(alert: SecurityAlert): Promise<void> {
  const webhookUrl = process.env.WAF_SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const emoji   = SEVERITY_EMOJI[alert.severity];
  const color   = SEVERITY_COLOR[alert.severity];
  const envTag  = process.env.NODE_ENV === 'production' ? '[PROD]' : '[DEV]';

  const payload = {
    text: `${emoji} ${envTag} Security Alert: *${alert.event}*`,
    attachments: [
      {
        color,
        fields: [
          { title: 'Event',     value: alert.event,                          short: true },
          { title: 'Severity',  value: alert.severity.toUpperCase(),         short: true },
          { title: 'IP',        value: alert.ip,                             short: true },
          { title: 'Path',      value: alert.path ?? 'N/A',                  short: true },
          { title: 'Method',    value: alert.method ?? 'N/A',                short: true },
          { title: 'Time',      value: alert.timestamp.toISOString(),        short: true },
          ...(alert.details
            ? [{ title: 'Details', value: JSON.stringify(alert.details, null, 2), short: false }]
            : []),
        ],
        footer: 'DiscoverGroup Security Monitor',
        ts: Math.floor(alert.timestamp.getTime() / 1000).toString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn('[WAF Alerts] Slack webhook returned non-OK', { status: response.status });
    }
  } catch (err) {
    logger.warn('[WAF Alerts] Failed to send Slack alert', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Email alert ──────────────────────────────────────────────────────────────

async function sendEmailAlert(alert: SecurityAlert): Promise<void> {
  const alertEmail = process.env.WAF_ALERT_EMAIL;
  if (!alertEmail) return;

  // Use the existing email service if available
  try {
    // Dynamic import so this module doesn't fail if emailService is unavailable
    const emailModule = await import('../services/emailService').catch(() => null);
    if (!emailModule) return;

    const emailService = emailModule.default ?? emailModule;
    if (typeof emailService.sendEmail !== 'function' && typeof emailService.send !== 'function') return;

    const subject = `[${alert.severity.toUpperCase()}] Security Alert: ${alert.event}`;
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:${SEVERITY_COLOR[alert.severity]};color:#fff;padding:16px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">${SEVERITY_EMOJI[alert.severity]} Security Alert: ${alert.event}</h2>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:16px;border-radius:0 0 8px 8px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;font-weight:bold;color:#374151">Event</td><td style="padding:8px">${alert.event}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;font-weight:bold;color:#374151">Severity</td><td style="padding:8px">${alert.severity.toUpperCase()}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#374151">IP Address</td><td style="padding:8px">${alert.ip}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;font-weight:bold;color:#374151">Path</td><td style="padding:8px">${alert.path ?? 'N/A'}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#374151">Method</td><td style="padding:8px">${alert.method ?? 'N/A'}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px;font-weight:bold;color:#374151">Timestamp</td><td style="padding:8px">${alert.timestamp.toISOString()}</td></tr>
            ${alert.details ? `<tr><td style="padding:8px;font-weight:bold;color:#374151">Details</td><td style="padding:8px"><pre style="background:#f3f4f6;padding:8px;border-radius:4px;overflow-x:auto">${JSON.stringify(alert.details, null, 2)}</pre></td></tr>` : ''}
          </table>
          <p style="color:#6b7280;font-size:12px;margin-top:16px">DiscoverGroup Security Monitor — ${new Date().toUTCString()}</p>
        </div>
      </div>
    `;

    // Try both possible method shapes of the email service
    const send = emailService.sendEmail ?? emailService.send;
    await send({ to: alertEmail, subject, html }).catch(() => {
      // Best-effort — don't crash app on email failure
    });

  } catch {
    // Silent — never crash app on alert failure
  }
}

// ─── Main exported function ───────────────────────────────────────────────────

const COOLDOWN_MS = parseInt(process.env.WAF_ALERT_COOLDOWN_MS ?? '60000', 10);

/**
 * Send a security alert to all configured channels (Slack, email, logger).
 * Non-blocking — always returns immediately.
 * Includes cooldown to prevent alert fatigue for repeated events from the same IP.
 */
export function sendSecurityAlert(alert: Omit<SecurityAlert, 'timestamp'>): void {
  const full: SecurityAlert = { ...alert, timestamp: new Date() };

  // Always log via Winston (synchronous)
  const logFn = alert.severity === 'critical' || alert.severity === 'high'
    ? logger.error.bind(logger)
    : logger.warn.bind(logger);

  logFn(`[SECURITY ALERT] ${alert.event}`, {
    ip: alert.ip,
    path: alert.path,
    method: alert.method,
    severity: alert.severity,
    details: alert.details,
  });

  // Throttle external notifications per event+ip pair
  const cooldownKey = `${alert.event}:${alert.ip}`;
  if (!shouldSendAlert(cooldownKey, COOLDOWN_MS)) return;

  // Fire Slack + email in background without blocking the request
  setImmediate(() => {
    sendSlackAlert(full).catch(() => undefined);
    sendEmailAlert(full).catch(() => undefined);
  });
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export const alertWafBlocked = (ip: string, path: string, method: string, score: number, threats: string[]) =>
  sendSecurityAlert({ severity: 'critical', event: 'WAF_BLOCKED', ip, path, method, details: { score, threats } });

export const alertHoneypotTriggered = (ip: string, path: string, method: string, userAgent?: string) =>
  sendSecurityAlert({ severity: 'critical', event: 'HONEYPOT_TRIGGERED', ip, path, method, details: { userAgent } });

export const alertPenaltyBox = (ip: string, violations: number) =>
  sendSecurityAlert({ severity: 'high', event: 'PENALTY_BOX_PLACED', ip, details: { violations } });

export const alertBehaviourBlock = (ip: string, score: number, stats: Record<string, number>) =>
  sendSecurityAlert({ severity: 'high', event: 'BEHAVIOUR_AUTO_BLOCK', ip, details: { score, ...stats } });

export const alertAbuseIp = (ip: string, abuseScore: number) =>
  sendSecurityAlert({ severity: 'high', event: 'ABUSEIPDB_BLOCKED', ip, details: { abuseScore } });
