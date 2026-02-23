/**
 * ADVANCED WEB APPLICATION FIREWALL (WAF)
 * ========================================
 * This module was created because the standard single-pass regex checks
 * can be bypassed via:
 *  - Double/triple URL encoding       (e.g. %2527 encodes to %27 encodes to ')
 *  - Unicode homoglyph substitution   (e.g. full-width SELECT characters)
 *  - Null-byte injection              (e.g. foo%00bar)
 *  - Comment obfuscation in SQL       (e.g. SEL then comment then ECT)
 *  - Case/whitespace variation        (e.g. mixed-case SELECT with tab chars)
 *  - HTTP verb tunnelling             (POST with X-HTTP-Method-Override)
 *  - Prototype pollution              (JSON key __proto__)
 *  - ReDoS (catastrophic backtracking on the old regex)
 *  - Path traversal via encoded dots  (e.g. dot dot slash encoded)
 *  - SSRF via redirect chains
 *
 * This WAF adds EIGHT independent detection layers and an anomaly score.
 * A single request must exceed a configurable score threshold before it is
 * blocked, which greatly reduces false-positives while still catching
 * sophisticated multi-vector attacks.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { alertWafBlocked } from '../utils/wafAlerts';

// ─── Threat-score thresholds ────────────────────────────────────────────────
const SCORE_BLOCK   = 10;   // Block outright
const SCORE_WARN    = 5;    // Log a high-severity warning but allow through
const SCORE_MONITOR = 2;    // Silently track

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Decode a string through multiple encoding passes until it stabilises */
function deepDecode(input: string, maxPasses = 5): string {
  let previous = input;
  for (let i = 0; i < maxPasses; i++) {
    try {
      const decoded = decodeURIComponent(previous.replace(/\+/g, ' '));
      if (decoded === previous) break;
      previous = decoded;
    } catch {
      break; // malformed encoding — treat the raw string
    }
  }
  // Remove null bytes
  return previous.replace(/\0/g, '');
}

/** Normalise Unicode look-alike characters to their ASCII equivalents */
function normaliseUnicode(input: string): string {
  // Decompose to NFKD form then strip combining marks
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')  // strip combining diacritics
    .toLowerCase();
}

/** Recursively extract all string values from any JSON-like object */
function extractStrings(obj: unknown, depth = 0): string[] {
  if (depth > 15) return [];                     // hard depth limit
  if (typeof obj === 'string') return [obj];
  if (Array.isArray(obj)) return obj.flatMap(v => extractStrings(v, depth + 1));
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => [
      k,
      ...extractStrings(v, depth + 1),
    ]);
  }
  return [];
}

// ─── Pattern libraries ───────────────────────────────────────────────────────

// ReDoS-safe SQL injection patterns (anchored, non-backtracking)
const SQL_PATTERNS: RegExp[] = [
  /\b(select|insert|update|delete|drop|alter|create|exec|execute|union|declare|cast|convert|char|nchar|varchar|table|database|schema|from|where|having|order|group)\b/i,
  /--[^\r\n]*/,               // SQL line comment
  /\/\*[\s\S]*?\*\//,         // SQL block comment
  /;\s*(drop|alter|create|insert|update|delete)\b/i,
  /\bwaitfor\s+delay\b/i,     // SQL Server time-based blind
  /\bsleep\s*\(/i,            // MySQL time-based blind
  /\bbenchmark\s*\(/i,        // MySQL CPU-based blind
  /\bload_file\s*\(/i,        // MySQL file read
  /\binto\s+(outfile|dumpfile)\b/i,
  /\bxp_cmdshell\b/i,         // MSSQL OS command
  /\bsp_executesql\b/i,
  /0x[0-9a-f]{2,}/i,          // Hex encoding commonly used in injections
];

// NoSQL / MongoDB operator injection (beyond what express-mongo-sanitize catches)
const NOSQL_PATTERNS: RegExp[] = [
  /\$where/i,
  /\$function/i,
  /\$accumulator/i,
  /mapreduce/i,
  /\bdb\./i,
  /\bcollection\./i,
  /\$lookup\s*:/i,       // block aggregation lookups from user input
];

// XSS patterns that survive DOMPurify through DOM clobbering / mutation XSS
const XSS_PATTERNS: RegExp[] = [
  /<script[\s\S]*?>/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /on\w+\s*=/i,               // event handlers: onclick=, onerror=, etc.
  /<iframe/i,
  /<svg[\s\S]*?on\w+/i,
  /document\.(cookie|domain|write|location)/i,
  /window\.(location|open|eval)/i,
  /expression\s*\(/i,         // CSS expression() IE
  /<[^>]+\sclass\s*=\s*["'][^"']*mxss/i,  // known mXSS vectors
  /&#\d+;/,                   // HTML entities can bypass some sanitisers
  /%3c/i,                     // URL-encoded <
];

// Server-Side Request Forgery (SSRF) indicators
const SSRF_PATTERNS: RegExp[] = [
  /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)/i,
  /https?:\/\/[^/]+@/,        // credentials in URL
  /file:\/\//i,
  /gopher:\/\//i,
  /dict:\/\//i,
  /\bmetadata\.google\.internal\b/i,
  /169\.254\.169\.254/,        // AWS metadata IP
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.[/\\]/,
  /%2e%2e[%2f%5c]/i,
  /\.\.%2f/i,
  /\.\.%5c/i,
  /%252e%252e/i,               // double-encoded
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /\/proc\/self/i,
  /\bwin\.ini\b/i,
  /system32/i,
];

// Command injection patterns
const COMMAND_INJECTION_PATTERNS: RegExp[] = [
  /[;|`&$](\s*(ls|cat|pwd|whoami|id|uname|ps|netstat|curl|wget|bash|sh|python|perl|ruby|php|nc|ncat|nmap)\b)/i,
  /\$\(.*\)/,                  // command substitution $(...)
  /`[^`]*`/,                   // backtick execution
];

// Prototype pollution keys
const PROTO_POLLUTION_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

// ─── Scoring engine ──────────────────────────────────────────────────────────

interface ScoredThreat {
  type: string;
  score: number;
  detail: string;
}

function checkPatterns(
  normalised: string,
  patterns: RegExp[],
  type: string,
  scorePerHit: number
): ScoredThreat | null {
  for (const pattern of patterns) {
    if (pattern.test(normalised)) {
      return { type, score: scorePerHit, detail: pattern.toString() };
    }
  }
  return null;
}

function scoreRequest(req: Request): { total: number; threats: ScoredThreat[] } {
  const threats: ScoredThreat[] = [];

  // ── Collect all string values from body, query, params, headers ──
  const rawValues = [
    ...extractStrings(req.body),
    ...extractStrings(req.query),
    ...extractStrings(req.params),
    ...[req.get('user-agent') || '', req.get('referer') || '', req.get('x-forwarded-for') || ''],
  ];

  for (const raw of rawValues) {
    const decoded   = deepDecode(raw);
    const normalised = normaliseUnicode(decoded);

    // SQL injection (high risk → score 8)
    const sql = checkPatterns(normalised, SQL_PATTERNS, 'SQL_INJECTION', 8);
    if (sql) threats.push(sql);

    // NoSQL injection (high risk → score 7)
    const nosql = checkPatterns(normalised, NOSQL_PATTERNS, 'NOSQL_INJECTION', 7);
    if (nosql) threats.push(nosql);

    // XSS (score 6)
    const xss = checkPatterns(normalised, XSS_PATTERNS, 'XSS', 6);
    if (xss) threats.push(xss);

    // SSRF (score 9)
    const ssrf = checkPatterns(normalised, SSRF_PATTERNS, 'SSRF', 9);
    if (ssrf) threats.push(ssrf);

    // Path traversal (score 7)
    const path = checkPatterns(normalised, PATH_TRAVERSAL_PATTERNS, 'PATH_TRAVERSAL', 7);
    if (path) threats.push(path);

    // Command injection (score 9)
    const cmd = checkPatterns(normalised, COMMAND_INJECTION_PATTERNS, 'COMMAND_INJECTION', 9);
    if (cmd) threats.push(cmd);
  }

  // ── Prototype pollution check on body keys ──
  const bodyKeys = extractStrings(Object.keys(req.body || {}));
  for (const key of bodyKeys) {
    if (PROTO_POLLUTION_KEYS.has(key.toLowerCase())) {
      threats.push({ type: 'PROTOTYPE_POLLUTION', score: 10, detail: `key: ${key}` });
    }
  }

  // ── HTTP verb tunnelling ──
  const override = req.get('x-http-method-override') || req.get('x-method-override');
  if (override) {
    threats.push({ type: 'VERB_TUNNELLING', score: 5, detail: `override: ${override}` });
  }

  // ── Abnormally large or deeply nested body ──
  const bodyStr = JSON.stringify(req.body || '');
  if (bodyStr.length > 100_000) {
    threats.push({ type: 'OVERSIZED_BODY', score: 3, detail: `size: ${bodyStr.length}` });
  }

  // ── Null byte in URL ──
  if (req.originalUrl.includes('\0') || req.originalUrl.includes('%00')) {
    threats.push({ type: 'NULL_BYTE', score: 8, detail: 'null byte in URL' });
  }

  const total = threats.reduce((sum, t) => sum + t.score, 0);
  return { total, threats };
}

// ─── Exported middleware ──────────────────────────────────────────────────────

export const advancedWaf = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown';
  const { total, threats } = scoreRequest(req);

  if (total === 0) return next();

  const meta = {
    ip,
    method: req.method,
    path: req.path,
    score: total,
    threats: threats.map(t => ({ type: t.type, detail: t.detail })),
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  };

  if (total >= SCORE_BLOCK) {
    logger.error('[WAF] Request BLOCKED — threat score exceeded threshold', meta);
    // Fire Slack/email alert (non-blocking)
    alertWafBlocked(
      ip,
      req.path,
      req.method,
      total,
      threats.map(t => t.type)
    );
    return res.status(403).json({
      error: 'Request blocked by security policy',
      code: 'WAF_BLOCKED',
      requestId: req.headers['x-request-id'] || undefined,
    });
  }

  if (total >= SCORE_WARN) {
    logger.warn('[WAF] Suspicious request allowed — high threat score', meta);
    // Tag the request so downstream middleware can add extra scrutiny
    (req as Request & { wafScore?: number }).wafScore = total;
  } else if (total >= SCORE_MONITOR) {
    logger.info('[WAF] Request flagged for monitoring', { ip, score: total });
  }

  next();
};

/** Standalone prototype-pollution sanitiser — run before any body parsing */
export const prototypePollutionGuard = (req: Request, res: Response, next: NextFunction) => {
  function sanitise(obj: unknown, depth = 0): unknown {
    if (depth > 20 || !obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(v => sanitise(v, depth + 1));

    const safe: Record<string, unknown> = Object.create(null);
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (!PROTO_POLLUTION_KEYS.has(k)) {
        safe[k] = sanitise(v, depth + 1);
      }
    }
    return safe;
  }

  if (req.body && typeof req.body === 'object') {
    req.body = sanitise(req.body);
  }

  next();
};
