import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, AlertTriangle, Activity, Lock, Server, KeyRound, ExternalLink, Link2 } from 'lucide-react';
import { getAdminApiBaseUrl } from '../config/apiBase';

interface SecurityPlugin {
  name: string;
  version: string;
  category: string;
  status: 'active' | 'inactive' | 'error';
  description: string;
  protectsAgainst: string[];
}

interface SecurityStatus {
  overall: 'excellent' | 'good' | 'warning' | 'critical';
  score: number;
  totalPlugins: number;
  activePlugins: number;
  plugins: SecurityPlugin[];
  recommendations: string[];
  lastUpdated: string;
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

interface SecretIncidentsData {
  provider: string;
  configured: boolean;
  status: 'open' | 'ignored' | 'resolved';
  severity: 'all' | 'critical' | 'high' | 'medium' | 'low' | 'unknown';
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

type IncidentStatusFilter = 'open' | 'ignored' | 'resolved';
type IncidentSeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low' | 'unknown';

const INCIDENT_STATUS_VALUES: IncidentStatusFilter[] = ['open', 'ignored', 'resolved'];
const INCIDENT_SEVERITY_VALUES: IncidentSeverityFilter[] = ['all', 'critical', 'high', 'medium', 'low', 'unknown'];
const INCIDENT_PER_PAGE_VALUES = [10, 25, 50] as const;

const parseIncidentStatus = (value: string | null): IncidentStatusFilter => {
  if (value && INCIDENT_STATUS_VALUES.includes(value as IncidentStatusFilter)) {
    return value as IncidentStatusFilter;
  }
  return 'open';
};

const parseIncidentSeverity = (value: string | null): IncidentSeverityFilter => {
  if (value && INCIDENT_SEVERITY_VALUES.includes(value as IncidentSeverityFilter)) {
    return value as IncidentSeverityFilter;
  }
  return 'all';
};

const parseIncidentPage = (value: string | null): number => {
  if (!value) return 1;
  const page = Number(value);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
};

const parseIncidentPerPage = (value: string | null): number => {
  if (!value) return 10;
  const perPage = Number(value);
  if ((INCIDENT_PER_PAGE_VALUES as readonly number[]).includes(perPage)) return perPage;
  return 10;
};

const QUERY_KEYS = {
  status: 'is',
  severity: 'sev',
  page: 'p',
  perPage: 'pp',
} as const;

const API_URL = getAdminApiBaseUrl();

const SecurityStatus: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [securityData, setSecurityData] = useState<SecurityStatus | null>(null);
  const [incidentsData, setIncidentsData] = useState<SecretIncidentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [copyLinkState, setCopyLinkState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [incidentStatus, setIncidentStatus] = useState<IncidentStatusFilter>(() => parseIncidentStatus(searchParams.get(QUERY_KEYS.status) ?? searchParams.get('incidentStatus')));
  const [incidentSeverity, setIncidentSeverity] = useState<IncidentSeverityFilter>(() => parseIncidentSeverity(searchParams.get(QUERY_KEYS.severity) ?? searchParams.get('incidentSeverity')));
  const [incidentPage, setIncidentPage] = useState<number>(() => parseIncidentPage(searchParams.get(QUERY_KEYS.page) ?? searchParams.get('incidentPage')));
  const [incidentPerPage, setIncidentPerPage] = useState<number>(() => parseIncidentPerPage(searchParams.get(QUERY_KEYS.perPage) ?? searchParams.get('incidentPerPage')));

  useEffect(() => {
    fetchSecurityStatus();
    // Refresh every 5 minutes
    const interval = setInterval(() => {
      fetchSecurityStatus();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchSecretIncidents();
    const interval = setInterval(() => {
      fetchSecretIncidents();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSecretIncidents]);

  useEffect(() => {
    const nextStatus = parseIncidentStatus(searchParams.get(QUERY_KEYS.status) ?? searchParams.get('incidentStatus'));
    const nextSeverity = parseIncidentSeverity(searchParams.get(QUERY_KEYS.severity) ?? searchParams.get('incidentSeverity'));
    const nextPage = parseIncidentPage(searchParams.get(QUERY_KEYS.page) ?? searchParams.get('incidentPage'));
    const nextPerPage = parseIncidentPerPage(searchParams.get(QUERY_KEYS.perPage) ?? searchParams.get('incidentPerPage'));

    setIncidentStatus(nextStatus);
    setIncidentSeverity(nextSeverity);
    setIncidentPage(nextPage);
    setIncidentPerPage(nextPerPage);
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.delete('incidentStatus');
    nextParams.delete('incidentSeverity');
    nextParams.delete('incidentPage');
    nextParams.delete('incidentPerPage');

    if (incidentStatus !== 'open') {
      nextParams.set(QUERY_KEYS.status, incidentStatus);
    } else {
      nextParams.delete(QUERY_KEYS.status);
    }

    if (incidentSeverity !== 'all') {
      nextParams.set(QUERY_KEYS.severity, incidentSeverity);
    } else {
      nextParams.delete(QUERY_KEYS.severity);
    }

    if (incidentPage !== 1) {
      nextParams.set(QUERY_KEYS.page, String(incidentPage));
    } else {
      nextParams.delete(QUERY_KEYS.page);
    }

    if (incidentPerPage !== 10) {
      nextParams.set(QUERY_KEYS.perPage, String(incidentPerPage));
    } else {
      nextParams.delete(QUERY_KEYS.perPage);
    }

    const currentSerialized = searchParams.toString();
    const nextSerialized = nextParams.toString();

    if (currentSerialized !== nextSerialized) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [incidentStatus, incidentSeverity, incidentPage, incidentPerPage, searchParams, setSearchParams]);

  const fetchSecurityStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/security/status`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch security status');
      }
      
      const data = await response.json();
      setSecurityData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSecretIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    try {
      const params = new URLSearchParams({
        status: incidentStatus,
        severity: incidentSeverity,
        page: String(incidentPage),
        perPage: String(incidentPerPage),
      });

      const response = await fetch(`${API_URL}/api/security/incidents?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch secret incidents');
      }

      const data = await response.json();
      setIncidentsData(data);
      setIncidentsError(null);
    } catch (err) {
      setIncidentsError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIncidentsLoading(false);
    }
  }, [incidentStatus, incidentSeverity, incidentPage, incidentPerPage]);

  const getOverallColor = (overall: string) => {
    switch (overall) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category.includes('HTTP') || category.includes('Headers')) return Shield;
    if (category.includes('Rate')) return Activity;
    if (category.includes('Auth') || category.includes('Encryption')) return Lock;
    if (category.includes('Database')) return Server;
    return CheckCircle;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'HTTP Security Headers': 'bg-blue-100 text-blue-700',
      'Rate Limiting': 'bg-purple-100 text-purple-700',
      'Input Validation': 'bg-green-100 text-green-700',
      'Database Security': 'bg-indigo-100 text-indigo-700',
      'XSS Protection': 'bg-red-100 text-red-700',
      'Input Protection': 'bg-yellow-100 text-yellow-700',
      'CSRF Protection': 'bg-orange-100 text-orange-700',
      'Access Control': 'bg-pink-100 text-pink-700',
      'Encryption': 'bg-cyan-100 text-cyan-700',
      'Authentication': 'bg-teal-100 text-teal-700',
      'Logging & Monitoring': 'bg-gray-100 text-gray-700',
      'Frontend XSS Protection': 'bg-rose-100 text-rose-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const getSeverityBadgeClass = (severity: SecretIncident['severity']) => {
    const classes: Record<SecretIncident['severity'], string> = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
      unknown: 'bg-gray-100 text-gray-700',
    };
    return classes[severity];
  };

  const getValidityBadgeClass = (validity: string) => {
    const value = validity.toLowerCase();
    if (value.includes('failed') || value.includes('invalid')) return 'bg-red-100 text-red-700';
    if (value.includes('check') || value.includes('pending')) return 'bg-yellow-100 text-yellow-700';
    if (value.includes('valid') || value.includes('active')) return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateValue: string) => {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return dateValue;
    return parsed.toLocaleString();
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyLinkState('copied');
      window.setTimeout(() => setCopyLinkState('idle'), 1800);
    } catch {
      setCopyLinkState('failed');
      window.setTimeout(() => setCopyLinkState('idle'), 2200);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading security status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Security Status</h3>
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchSecurityStatus}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!securityData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Security Status</h1>
              <p className="text-gray-600">
                Monitor all security plugins protecting your website
              </p>
            </div>
            <button
              onClick={() => {
                fetchSecurityStatus();
                fetchSecretIncidents();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Overall Status Card */}
        <div className={`rounded-xl p-6 mb-8 ${getOverallColor(securityData.overall)} border`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="w-12 h-12" />
              <div>
                <h2 className="text-2xl font-bold capitalize">{securityData.overall} Security</h2>
                <p className="text-sm opacity-80">
                  {securityData.activePlugins} of {securityData.totalPlugins} plugins active
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold">{securityData.score}%</div>
              <p className="text-sm opacity-80">Security Score</p>
            </div>
          </div>
          
          {/* Recommendations */}
          {securityData.recommendations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-current border-opacity-20">
              <h3 className="font-semibold mb-2">Recommendations:</h3>
              <ul className="space-y-1">
                {securityData.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Secret Incidents */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-red-600" />
                Secret Incidents
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Monitor leaked credentials and high-entropy secrets from your scanner
              </p>
            </div>
            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              title={copyLinkState === 'copied' ? 'Link copied' : copyLinkState === 'failed' ? 'Copy failed' : 'Copy share link'}
              aria-label={copyLinkState === 'copied' ? 'Link copied' : copyLinkState === 'failed' ? 'Copy failed' : 'Copy share link'}
            >
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">
                {copyLinkState === 'copied' ? 'Link copied' : copyLinkState === 'failed' ? 'Copy failed' : 'Copy share link'}
              </span>
            </button>
          </div>

          {incidentsLoading ? (
            <p className="text-sm text-gray-500">Loading secret incidents...</p>
          ) : incidentsError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{incidentsError}</p>
            </div>
          ) : incidentsData && !incidentsData.configured ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-medium">Scanner not configured</p>
              <p className="text-sm text-yellow-700 mt-1">
                {incidentsData.message || 'Set SECRET_SCANNER_API_TOKEN in API environment variables to enable this section.'}
              </p>
            </div>
          ) : incidentsData ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Status</label>
                  <select
                    value={incidentStatus}
                    onChange={(e) => {
                      const nextStatus = e.target.value as IncidentStatusFilter;
                      setIncidentStatus(nextStatus);
                      setIncidentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
                  >
                    <option value="open">Open</option>
                    <option value="ignored">Ignored</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Severity</label>
                  <select
                    value={incidentSeverity}
                    onChange={(e) => {
                      const nextSeverity = e.target.value as IncidentSeverityFilter;
                      setIncidentSeverity(nextSeverity);
                      setIncidentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
                  >
                    <option value="all">All</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Rows</label>
                  <select
                    value={incidentPerPage}
                    onChange={(e) => {
                      setIncidentPerPage(Number(e.target.value));
                      setIncidentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  onClick={() => {
                    setIncidentStatus('open');
                    setIncidentSeverity('critical');
                    setIncidentPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-red-300 text-red-700 bg-red-50 hover:bg-red-100"
                >
                  Open Critical
                </button>
                <button
                  onClick={() => {
                    setIncidentStatus('open');
                    setIncidentSeverity('high');
                    setIncidentPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100"
                >
                  Open High
                </button>
                <button
                  onClick={() => {
                    setIncidentStatus('resolved');
                    setIncidentSeverity('all');
                    setIncidentPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                >
                  Resolved
                </button>
                <button
                  onClick={() => {
                    setIncidentStatus('open');
                    setIncidentSeverity('all');
                    setIncidentPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100"
                >
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
                  <p className="text-xl font-bold text-gray-900">{incidentsData.total}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-red-700">Critical</p>
                  <p className="text-xl font-bold text-red-800">{incidentsData.stats.critical}</p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-orange-700">High</p>
                  <p className="text-xl font-bold text-orange-800">{incidentsData.stats.high}</p>
                </div>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-yellow-700">Medium</p>
                  <p className="text-xl font-bold text-yellow-800">{incidentsData.stats.medium}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-700">Unknown</p>
                  <p className="text-xl font-bold text-gray-800">{incidentsData.stats.unknown}</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Occurred</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Validity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Secret</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {incidentsData.incidents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                          No incidents found.
                        </td>
                      </tr>
                    ) : (
                      incidentsData.incidents.map((incident) => (
                        <tr key={incident.id}>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(incident.occurredAt)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getValidityBadgeClass(incident.validity)}`}>
                              {incident.validity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{incident.secret}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium uppercase ${getSeverityBadgeClass(incident.severity)}`}>
                              {incident.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[240px]" title={incident.source}>{incident.source}</span>
                              {incident.url && (
                                <a
                                  href={incident.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Open incident"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                <span>Provider: {incidentsData.provider}</span>
                <span>Updated: {formatDate(incidentsData.lastUpdated)}</span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Page {incidentsData.page} of {Math.max(incidentsData.totalPages, 1)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIncidentPage((prev) => Math.max(1, prev - 1))}
                    disabled={incidentsData.page <= 1 || incidentsLoading}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setIncidentPage((prev) => prev + 1)}
                    disabled={(!incidentsData.hasNext && incidentsData.page >= incidentsData.totalPages) || incidentsLoading}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-2 text-sm text-gray-700">
              <AlertTriangle className="w-4 h-4" />
              Secret incidents data unavailable.
            </div>
          )}
        </div>

        {/* Category Filters */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Security Plugins by Category</h3>
        </div>

        {/* Security Plugins Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {securityData.plugins.map((plugin, index) => {
            const Icon = getCategoryIcon(plugin.category);
            
            return (
              <div
                key={index}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                {/* Plugin Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(plugin.category)}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{plugin.name}</h3>
                      <p className="text-xs text-gray-500">{plugin.version}</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    plugin.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {plugin.status}
                  </div>
                </div>

                {/* Category Badge */}
                <div className="mb-3">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(plugin.category)}`}>
                    {plugin.category}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4">
                  {plugin.description}
                </p>

                {/* Protections */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                    Protects Against:
                  </h4>
                  <ul className="space-y-1">
                    {plugin.protectsAgainst.map((threat, idx) => (
                      <li key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="text-green-600 font-bold">•</span>
                        <span>{threat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Last updated: {new Date(securityData.lastUpdated).toLocaleString()}
          </p>
          <p className="mt-2">
            All security plugins are open-source and free to use
          </p>
        </div>
      </div>
    </div>
  );
};

export default SecurityStatus;
