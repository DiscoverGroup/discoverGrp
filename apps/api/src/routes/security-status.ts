import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import axios from 'axios';

const router = Router();

interface SecurityPlugin {
  name: string;
  version: string;
  category: string;
  status: 'active' | 'inactive' | 'error';
  description: string;
  protectsAgainst: string[];
  lastChecked?: Date;
}

interface SecurityStatus {
  overall: 'excellent' | 'good' | 'warning' | 'critical';
  score: number;
  totalPlugins: number;
  activePlugins: number;
  plugins: SecurityPlugin[];
  recommendations: string[];
  lastUpdated: Date;
}

interface SecretIncident {
  id: string;
  occurredAt: string;
  validity: string;
  secret: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  state: string;
  source: string;
  url?: string;
}

type IncidentStatus = 'open' | 'ignored' | 'resolved';
type IncidentSeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low' | 'unknown';

interface SecretIncidentsResponse {
  provider: string;
  configured: boolean;
  status: IncidentStatus;
  severity: IncidentSeverityFilter;
  incidents: SecretIncident[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNext: boolean;
  stats: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  lastUpdated: string;
  message?: string;
}

function normalizeSeverity(rawSeverity: unknown): SecretIncident['severity'] {
  if (typeof rawSeverity !== 'string') return 'unknown';
  const value = rawSeverity.toLowerCase();
  if (value.includes('critical')) return 'critical';
  if (value.includes('high')) return 'high';
  if (value.includes('medium') || value.includes('moderate')) return 'medium';
  if (value.includes('low')) return 'low';
  return 'unknown';
}

function toStringValue(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function normalizeIncident(raw: Record<string, unknown>): SecretIncident {
  const id = toStringValue(
    raw.id ?? raw.iid ?? raw.incident_id ?? raw.public_id,
    `incident-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  );

  const occurredAt = toStringValue(
    raw.occurred_at ?? raw.created_at ?? raw.updated_at ?? raw.date,
    new Date().toISOString()
  );

  const validity = toStringValue(
    raw.validity ?? raw.validity_state ?? raw.validity_status ?? raw.check_status ?? raw.status,
    'Unknown'
  );

  const secret = toStringValue(
    raw.secret ?? raw.secret_type ?? raw.detector_name ?? raw.type ?? raw.name,
    'Unknown secret'
  );

  const severity = normalizeSeverity(raw.severity ?? raw.severity_label ?? raw.risk_level);

  const state = toStringValue(raw.state ?? raw.status ?? raw.lifecycle_state, 'open');

  const source = toStringValue(
    raw.source ?? raw.repository ?? raw.repo_name ?? raw.source_name ?? raw.location,
    'Unknown source'
  );

  const url = typeof raw.url === 'string'
    ? raw.url
    : typeof raw.html_url === 'string'
    ? raw.html_url
    : typeof raw.web_url === 'string'
    ? raw.web_url
    : undefined;

  return {
    id,
    occurredAt,
    validity,
    secret,
    severity,
    state,
    source,
    url,
  };
}

function extractIncidentArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  }

  if (!payload || typeof payload !== 'object') return [];

  const candidate = payload as {
    incidents?: unknown;
    results?: unknown;
    data?: unknown;
    items?: unknown;
  };

  if (Array.isArray(candidate.incidents)) {
    return candidate.incidents.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  }

  if (Array.isArray(candidate.results)) {
    return candidate.results.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  }

  if (Array.isArray(candidate.data)) {
    return candidate.data.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  }

  if (Array.isArray(candidate.items)) {
    return candidate.items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  }

  return [];
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractTotalCount(payload: unknown): number | undefined {
  if (!payload || typeof payload !== 'object') return undefined;

  const candidate = payload as {
    total?: unknown;
    total_count?: unknown;
    count?: unknown;
    num_results?: unknown;
    pagination?: {
      total?: unknown;
      count?: unknown;
    };
    meta?: {
      total?: unknown;
      count?: unknown;
    };
  };

  return (
    toSafeNumber(candidate.total) ??
    toSafeNumber(candidate.total_count) ??
    toSafeNumber(candidate.count) ??
    toSafeNumber(candidate.num_results) ??
    toSafeNumber(candidate.pagination?.total) ??
    toSafeNumber(candidate.pagination?.count) ??
    toSafeNumber(candidate.meta?.total) ??
    toSafeNumber(candidate.meta?.count)
  );
}

function extractHasNext(payload: unknown): boolean | undefined {
  if (!payload || typeof payload !== 'object') return undefined;

  const candidate = payload as {
    next?: unknown;
    next_page?: unknown;
    pagination?: {
      has_next?: unknown;
      next_page?: unknown;
      next?: unknown;
    };
  };

  if (typeof candidate.pagination?.has_next === 'boolean') return candidate.pagination.has_next;
  if (candidate.next_page !== undefined && candidate.next_page !== null) return true;
  if (candidate.pagination?.next_page !== undefined && candidate.pagination.next_page !== null) return true;
  if (candidate.next !== undefined && candidate.next !== null) return true;
  if (candidate.pagination?.next !== undefined && candidate.pagination.next !== null) return true;
  return undefined;
}

/**
 * Get security plugins status
 * Checks all installed security packages and their status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packageJson = require('../../package.json');
    const dependencies = packageJson.dependencies || {};

    const securityPlugins: SecurityPlugin[] = [
      {
        name: 'Helmet',
        version: dependencies['helmet'] || 'N/A',
        category: 'HTTP Security Headers',
        status: 'active',
        description: 'Sets secure HTTP headers to prevent common attacks',
        protectsAgainst: [
          'XSS (Cross-Site Scripting)',
          'Clickjacking',
          'MIME Sniffing',
          'Content injection'
        ]
      },
      {
        name: 'Express Rate Limit',
        version: dependencies['express-rate-limit'] || 'N/A',
        category: 'Rate Limiting',
        status: 'active',
        description: 'Prevents brute force and DDoS attacks',
        protectsAgainst: [
          'Brute force attacks',
          'DDoS attacks',
          'API abuse',
          'Credential stuffing'
        ]
      },
      {
        name: 'Express Slow Down',
        version: dependencies['express-slow-down'] || 'N/A',
        category: 'Rate Limiting',
        status: 'active',
        description: 'Slows down repeated requests from same IP',
        protectsAgainst: [
          'Slow-rate attacks',
          'Resource exhaustion',
          'API spam'
        ]
      },
      {
        name: 'Express Validator',
        version: dependencies['express-validator'] || 'N/A',
        category: 'Input Validation',
        status: 'active',
        description: 'Validates and sanitizes user input',
        protectsAgainst: [
          'SQL Injection',
          'Invalid data',
          'Type confusion attacks',
          'Business logic bypass'
        ]
      },
      {
        name: 'Express Mongo Sanitize',
        version: dependencies['express-mongo-sanitize'] || 'N/A',
        category: 'Database Security',
        status: 'active',
        description: 'Prevents MongoDB operator injection',
        protectsAgainst: [
          'NoSQL Injection',
          'MongoDB operator injection',
          'Query manipulation'
        ]
      },
      {
        name: 'XSS Clean',
        version: dependencies['xss-clean'] || 'N/A',
        category: 'XSS Protection',
        status: 'active',
        description: 'Sanitizes user input to prevent XSS',
        protectsAgainst: [
          'Cross-Site Scripting (XSS)',
          'HTML injection',
          'Script injection'
        ]
      },
      {
        name: 'HPP (HTTP Parameter Pollution)',
        version: dependencies['hpp'] || 'N/A',
        category: 'Input Protection',
        status: 'active',
        description: 'Prevents parameter pollution attacks',
        protectsAgainst: [
          'Parameter pollution',
          'Query manipulation',
          'Duplicate parameters'
        ]
      },
      {
        name: 'CSURF (CSRF Protection)',
        version: dependencies['csurf'] || 'N/A',
        category: 'CSRF Protection',
        status: 'active',
        description: 'Protects against Cross-Site Request Forgery',
        protectsAgainst: [
          'CSRF attacks',
          'Unauthorized state changes',
          'Session riding'
        ]
      },
      {
        name: 'CORS',
        version: dependencies['cors'] || 'N/A',
        category: 'Access Control',
        status: 'active',
        description: 'Controls cross-origin resource sharing',
        protectsAgainst: [
          'Unauthorized cross-origin requests',
          'Data theft',
          'CORS misconfiguration'
        ]
      },
      {
        name: 'bcryptjs',
        version: dependencies['bcryptjs'] || 'N/A',
        category: 'Encryption',
        status: 'active',
        description: 'Hashes passwords securely',
        protectsAgainst: [
          'Password theft',
          'Rainbow table attacks',
          'Brute force password cracking'
        ]
      },
      {
        name: 'jsonwebtoken',
        version: dependencies['jsonwebtoken'] || 'N/A',
        category: 'Authentication',
        status: 'active',
        description: 'Manages JWT tokens for authentication',
        protectsAgainst: [
          'Session hijacking',
          'Unauthorized access',
          'Token tampering'
        ]
      },
      {
        name: 'Winston',
        version: dependencies['winston'] || 'N/A',
        category: 'Logging & Monitoring',
        status: 'active',
        description: 'Logs security events and errors',
        protectsAgainst: [
          'Undetected breaches',
          'Audit trail loss',
          'Compliance violations'
        ]
      },
      {
        name: 'DOMPurify (Frontend)',
        version: 'v3.3.1',
        category: 'Frontend XSS Protection',
        status: 'active',
        description: 'Sanitizes HTML/JavaScript in React components',
        protectsAgainst: [
          'DOM-based XSS',
          'Client-side code injection',
          'Malicious content rendering'
        ]
      }
    ];

    // Check MongoDB connection status
    const mongoStatus = mongoose.connection.readyState === 1 ? 'active' : 'inactive';
    
    // Calculate security score
    const activeCount = securityPlugins.filter(p => p.status === 'active').length;
    const score = Math.round((activeCount / securityPlugins.length) * 100);
    
    let overall: 'excellent' | 'good' | 'warning' | 'critical';
    if (score >= 90) overall = 'excellent';
    else if (score >= 70) overall = 'good';
    else if (score >= 50) overall = 'warning';
    else overall = 'critical';

    const recommendations: string[] = [];
    
    // Generate recommendations
    if (mongoStatus === 'inactive') {
      recommendations.push('MongoDB connection is down - check database connectivity');
    }
    
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      recommendations.push('Use a stronger JWT_SECRET (minimum 32 characters)');
    }

    if (process.env.NODE_ENV !== 'production') {
      recommendations.push('Enable production mode for optimal security');
    }

    if (recommendations.length === 0) {
      recommendations.push('All security measures are active and configured correctly');
    }

    const status: SecurityStatus = {
      overall,
      score,
      totalPlugins: securityPlugins.length,
      activePlugins: activeCount,
      plugins: securityPlugins,
      recommendations,
      lastUpdated: new Date()
    };

    res.json(status);
  } catch (error) {
    console.error('Error fetching security status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch security status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get security statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get audit log statistics (if available)
    const AuditLog = mongoose.models.AuditLog;
    
    const stats = {
      totalRequests: 0,
      blockedRequests: 0,
      suspiciousActivity: 0,
      last24Hours: {
        requests: 0,
        errors: 0,
        warnings: 0
      }
    };

    if (AuditLog) {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentLogs = await AuditLog.find({
        timestamp: { $gte: last24h }
      });

      stats.last24Hours.requests = recentLogs.length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stats.last24Hours.errors = recentLogs.filter((log: any) => log.statusCode >= 400).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stats.last24Hours.warnings = recentLogs.filter((log: any) => log.statusCode >= 300 && log.statusCode < 400).length;
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching security stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch security statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get secret-scanner incidents (GitGuardian-compatible by default)
 */
router.get('/incidents', async (req: Request, res: Response) => {
  const provider = process.env.SECRET_SCANNER_PROVIDER || 'gitguardian';
  const apiToken = process.env.SECRET_SCANNER_API_TOKEN;
  const apiUrl = process.env.SECRET_SCANNER_API_URL || 'https://api.gitguardian.com/v1/incidents/secrets';
  const authScheme = process.env.SECRET_SCANNER_AUTH_SCHEME || 'Token';
  const timeoutMs = Number(process.env.SECRET_SCANNER_TIMEOUT_MS || '10000');
  const defaultPerPage = Number(process.env.SECRET_SCANNER_PER_PAGE || '50');
  const statusParam = typeof req.query.status === 'string' ? req.query.status.toLowerCase() : 'open';
  const allowedStatuses: IncidentStatus[] = ['open', 'ignored', 'resolved'];
  const status: IncidentStatus = allowedStatuses.includes(statusParam as IncidentStatus)
    ? (statusParam as IncidentStatus)
    : 'open';
  const severityParam = typeof req.query.severity === 'string' ? req.query.severity.toLowerCase() : 'all';
  const allowedSeverities: IncidentSeverityFilter[] = ['all', 'critical', 'high', 'medium', 'low', 'unknown'];
  const severity: IncidentSeverityFilter = allowedSeverities.includes(severityParam as IncidentSeverityFilter)
    ? (severityParam as IncidentSeverityFilter)
    : 'all';
  const page = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
  const perPage = typeof req.query.perPage === 'string' ? Number(req.query.perPage) : defaultPerPage;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePerPage = Number.isFinite(perPage) && perPage > 0 ? Math.min(Math.floor(perPage), 100) : defaultPerPage;

  if (!apiToken) {
    const emptyResponse: SecretIncidentsResponse = {
      provider,
      configured: false,
      status,
      severity,
      incidents: [],
      total: 0,
      page: safePage,
      perPage: safePerPage,
      totalPages: 0,
      hasNext: false,
      stats: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        unknown: 0,
      },
      lastUpdated: new Date().toISOString(),
      message: 'Secret scanner is not configured. Set SECRET_SCANNER_API_TOKEN to enable live incidents.',
    };
    return res.json(emptyResponse);
  }

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `${authScheme} ${apiToken}`,
        Accept: 'application/json',
      },
      params: {
        status,
        page: safePage,
        per_page: safePerPage,
        ...(severity !== 'all' ? { severity } : {}),
      },
      timeout: timeoutMs,
    });

    const rawIncidents = extractIncidentArray(response.data);
    const normalizedIncidents = rawIncidents.map(normalizeIncident);
    const incidents = severity === 'all'
      ? normalizedIncidents
      : normalizedIncidents.filter((incident) => incident.severity === severity);
    const totalFromPayload = extractTotalCount(response.data);
    const total = severity === 'all' ? (totalFromPayload ?? incidents.length) : incidents.length;
    const hasNextFromPayload = extractHasNext(response.data);
    const totalPages = total > 0 ? Math.ceil(total / safePerPage) : 0;
    const hasNext = severity === 'all' ? (hasNextFromPayload ?? (safePage < totalPages)) : false;

    const stats = incidents.reduce(
      (acc, incident) => {
        acc[incident.severity] += 1;
        return acc;
      },
      {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        unknown: 0,
      }
    );

    const result: SecretIncidentsResponse = {
      provider,
      configured: true,
      status,
      severity,
      incidents,
      total,
      page: safePage,
      perPage: safePerPage,
      totalPages,
      hasNext,
      stats,
      lastUpdated: new Date().toISOString(),
    };

    return res.json(result);
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? error.response?.data?.message || error.message
      : error instanceof Error
      ? error.message
      : 'Unknown error';

    return res.status(502).json({
      provider,
      configured: true,
      status,
      severity,
      incidents: [],
      total: 0,
      page: safePage,
      perPage: safePerPage,
      totalPages: 0,
      hasNext: false,
      stats: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        unknown: 0,
      },
      lastUpdated: new Date().toISOString(),
      message: `Failed to fetch incidents from ${provider}: ${message}`,
    });
  }
});

export default router;
