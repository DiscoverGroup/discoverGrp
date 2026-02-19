import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bug, CheckCircle2, RefreshCw, Sparkles, Wrench } from 'lucide-react';
import { buildAdminApiUrl } from '../config/apiBase';

type CheckType = 'code_error' | 'abnormality' | 'incorrect_output';
type CheckStatus = 'pass' | 'fail' | 'warn';
type QuickFixAction = 'fix_tour_slugs' | 'fix_country_slugs' | 'fix_all';

interface MonitoringCheck {
  id: string;
  title: string;
  type: CheckType;
  status: CheckStatus;
  target: string;
  message: string;
  durationMs: number;
}

interface MonitoringIssue {
  id: string;
  type: CheckType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  target: string;
  quickFixAction?: QuickFixAction;
}

interface MonitoringScanResult {
  scannedAt: string;
  status: 'healthy' | 'warning' | 'critical';
  stats: {
    checksTotal: number;
    checksPassed: number;
    checksFailed: number;
    checksWarn: number;
    issues: {
      codeErrors: number;
      abnormalities: number;
      incorrectOutput: number;
    };
  };
  checks: MonitoringCheck[];
  issues: MonitoringIssue[];
  quickFixActions: Array<{ action: QuickFixAction; label: string }>;
}

interface VisaMigrationStatus {
  generatedAt: string;
  featureEnabled: boolean;
  totals: {
    totalBookings: number;
    withSnapshot: number;
    withScore: number;
    withStatus: number;
    pendingMigration: number;
  };
  coverage: {
    percent: number;
    isComplete: boolean;
  };
  statusBreakdown: {
    ready: number;
    attention: number;
    not_ready: number;
  };
  latestEvaluated: {
    bookingId?: string;
    evaluatedAt?: string;
  } | null;
}

const typeLabel: Record<CheckType, string> = {
  code_error: 'Code Errors',
  abnormality: 'Abnormalities',
  incorrect_output: 'Incorrect Output',
};

const severityClass: Record<MonitoringIssue['severity'], string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const checkStatusClass: Record<CheckStatus, string> = {
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-700',
  warn: 'bg-yellow-100 text-yellow-700',
};

const statusHeaderClass: Record<MonitoringScanResult['status'], string> = {
  healthy: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  critical: 'bg-red-50 border-red-200 text-red-800',
};

const statusDotClass: Record<MonitoringScanResult['status'], string> = {
  healthy: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

export default function MonitoringCenter(): React.ReactElement {
  const [data, setData] = useState<MonitoringScanResult | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<VisaMigrationStatus | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationRunMessage, setMigrationRunMessage] = useState<string | null>(null);
  const [migrationRunOutput, setMigrationRunOutput] = useState<string[]>([]);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [runningFix, setRunningFix] = useState<QuickFixAction | null>(null);
  const [fixMessage, setFixMessage] = useState<string | null>(null);

  const scanNow = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildAdminApiUrl('/api/monitoring/scan'));
      if (!response.ok) {
        throw new Error(`Failed to run monitoring scan: ${response.status}`);
      }

      const payload = (await response.json()) as MonitoringScanResult;
      setData(payload);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Unknown scan error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMigrationStatus = React.useCallback(async () => {
    setMigrationError(null);
    try {
      const response = await fetch(buildAdminApiUrl('/api/visa-readiness/migration-status'));
      if (!response.ok) {
        throw new Error(`Failed to load migration status: ${response.status}`);
      }

      const payload = (await response.json()) as VisaMigrationStatus;
      setMigrationStatus(payload);
    } catch (statusError) {
      setMigrationError(statusError instanceof Error ? statusError.message : 'Unknown migration status error');
      setMigrationStatus(null);
    }
  }, []);

  const refreshAll = React.useCallback(async () => {
    await Promise.all([scanNow(), loadMigrationStatus()]);
  }, [scanNow, loadMigrationStatus]);

  const runMigration = React.useCallback(async (dryRun: boolean) => {
    if (!dryRun) {
      const confirmed = window.confirm('Run LIVE migration now? This will update MongoDB booking documents.');
      if (!confirmed) return;
    }

    setMigrationRunMessage(null);
    setMigrationRunOutput([]);
    setMigrationRunning(true);

    try {
      const response = await fetch(buildAdminApiUrl('/api/visa-readiness/migration/run'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun }),
      });

      const payload = await response.json();
      const lines = Array.isArray(payload?.output)
        ? payload.output.filter((line: unknown): line is string => typeof line === 'string')
        : [];

      setMigrationRunOutput(lines);

      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error || payload?.message || `Migration run failed (${response.status})`);
      }

      setMigrationRunMessage(dryRun ? 'Dry-run completed successfully.' : 'Migration completed successfully.');
      await loadMigrationStatus();
    } catch (runError) {
      setMigrationRunMessage(runError instanceof Error ? runError.message : 'Migration run failed');
    } finally {
      setMigrationRunning(false);
    }
  }, [loadMigrationStatus]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(() => {
      refreshAll();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  const runQuickFix = async (action: QuickFixAction) => {
    setRunningFix(action);
    setFixMessage(null);

    try {
      const response = await fetch(buildAdminApiUrl('/api/monitoring/quick-fix'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Quick fix failed');
      }

      const total = typeof payload?.fixed?.total === 'number' ? payload.fixed.total : 0;
      setFixMessage(`Quick fix completed. ${total} records updated.`);
      await refreshAll();
    } catch (quickFixError) {
      setFixMessage(quickFixError instanceof Error ? quickFixError.message : 'Quick fix failed');
    } finally {
      setRunningFix(null);
    }
  };

  const categorizedIssues = useMemo(() => {
    if (!data) {
      return {
        code_error: [] as MonitoringIssue[],
        abnormality: [] as MonitoringIssue[],
        incorrect_output: [] as MonitoringIssue[],
      };
    }

    return {
      code_error: data.issues.filter((issue) => issue.type === 'code_error'),
      abnormality: data.issues.filter((issue) => issue.type === 'abnormality'),
      incorrect_output: data.issues.filter((issue) => issue.type === 'incorrect_output'),
    };
  }, [data]);

  const migrationFeatureEnabled = migrationStatus?.featureEnabled === true;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" />
            Live Website Monitoring
          </h1>
          <p className="text-gray-600 mt-1">
            Scans for code errors, abnormalities, and incorrect output across the website.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={scanNow}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Scan Now
          </button>
          <button
            onClick={() => runQuickFix('fix_all')}
            disabled={runningFix !== null}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            Quick Fix All
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="auto-refresh"
          type="checkbox"
          checked={autoRefresh}
          onChange={(event) => setAutoRefresh(event.target.checked)}
          className="h-4 w-4 text-blue-600 rounded border-gray-300"
        />
        <label htmlFor="auto-refresh" className="text-sm text-gray-700">
          Enable live monitoring (refresh every 15 seconds)
        </label>
      </div>

      {fixMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {fixMessage}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-3 text-gray-700">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Running full website scan...
        </div>
      ) : null}

      {data && (
        <>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-indigo-900">Visa Readiness Migration Status</h2>
                <p className="text-sm text-indigo-800">
                  Tracks MongoDB backfill progress for visa readiness snapshots.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {migrationFeatureEnabled ? (
                  <>
                    <button
                      onClick={() => runMigration(true)}
                      disabled={migrationRunning}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white text-indigo-800 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-60"
                    >
                      <Sparkles className="w-4 h-4" />
                      Dry Run
                    </button>
                    <button
                      onClick={() => runMigration(false)}
                      disabled={migrationRunning}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white border border-amber-700 hover:bg-amber-700 disabled:opacity-60"
                    >
                      <Wrench className="w-4 h-4" />
                      Run Migration
                    </button>
                  </>
                ) : null}
                <button
                  onClick={loadMigrationStatus}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white text-indigo-800 border border-indigo-200 hover:bg-indigo-100"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Status
                </button>
              </div>
            </div>

            {migrationRunMessage && (
              <p className="mt-3 text-sm text-indigo-900">{migrationRunMessage}</p>
            )}

            {migrationStatus && !migrationStatus.featureEnabled && (
              <p className="mt-2 text-sm text-amber-800">
                Visa readiness feature is OFF. Migration actions are hidden until the feature flag is enabled.
              </p>
            )}

            {migrationError ? (
              <p className="mt-3 text-sm text-red-700">{migrationError}</p>
            ) : migrationStatus ? (
              <>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="rounded-lg border border-indigo-200 bg-white p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Bookings</p>
                    <p className="text-xl font-bold text-gray-900">{migrationStatus.totals.totalBookings}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-white p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Migrated</p>
                    <p className="text-xl font-bold text-emerald-700">{migrationStatus.totals.withSnapshot}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-white p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
                    <p className="text-xl font-bold text-amber-700">{migrationStatus.totals.pendingMigration}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-white p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Coverage</p>
                    <p className="text-xl font-bold text-indigo-700">{migrationStatus.coverage.percent}%</p>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-white p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Feature Flag</p>
                    <p className="text-xl font-bold text-gray-900">{migrationStatus.featureEnabled ? 'ON' : 'OFF'}</p>
                  </div>
                </div>

                <p className="mt-3 text-sm text-indigo-900">
                  Status breakdown — Ready: {migrationStatus.statusBreakdown.ready}, Attention: {migrationStatus.statusBreakdown.attention}, Not Ready: {migrationStatus.statusBreakdown.not_ready}
                </p>
                <p className="mt-1 text-xs text-indigo-700">
                  Last status update: {new Date(migrationStatus.generatedAt).toLocaleString()}
                  {migrationStatus.latestEvaluated?.evaluatedAt
                    ? ` • Latest evaluated booking: ${migrationStatus.latestEvaluated.bookingId || 'N/A'} at ${new Date(migrationStatus.latestEvaluated.evaluatedAt).toLocaleString()}`
                    : ''}
                </p>

                {migrationRunOutput.length > 0 && (
                  <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-indigo-700 mb-2">Migration Output</p>
                    <div className="max-h-40 overflow-auto space-y-1">
                      {migrationRunOutput.map((line, index) => (
                        <p key={`migration-line-${index}`} className="text-xs text-gray-700 font-mono">{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-indigo-800">Loading migration status...</p>
            )}
          </div>

          <div className={`rounded-xl border p-4 ${statusHeaderClass[data.status]}`}>
            <div className="flex items-center gap-2 font-semibold">
              {data.status === 'healthy' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              <span className={`inline-block w-2.5 h-2.5 rounded-full animate-pulse ${statusDotClass[data.status]}`}></span>
              Overall Status: {data.status.toUpperCase()}
            </div>
            <p className="text-sm mt-1">
              Last scanned: {new Date(data.scannedAt).toLocaleString()} • {data.stats.checksPassed}/{data.stats.checksTotal} checks passed
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span>
                Healthy
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                Warning
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span>
                Critical
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Code Errors</p>
              <p className="text-2xl font-bold text-red-600">{data.stats.issues.codeErrors}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Abnormalities</p>
              <p className="text-2xl font-bold text-yellow-600">{data.stats.issues.abnormalities}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Incorrect Output</p>
              <p className="text-2xl font-bold text-blue-600">{data.stats.issues.incorrectOutput}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Bug className="w-5 h-5 text-gray-700" />
              Scan Checks
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Check</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Message</th>
                    <th className="py-2 pr-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {data.checks.map((check) => (
                    <tr key={check.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium text-gray-900">{check.title}</td>
                      <td className="py-2 pr-3 text-gray-700">{typeLabel[check.type]}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${checkStatusClass[check.status]}`}>
                          {check.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-gray-700">{check.message}</td>
                      <td className="py-2 pr-3 text-gray-500">{check.durationMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detected Issues</h2>

            {(['code_error', 'abnormality', 'incorrect_output'] as const).map((type) => (
              <div key={type} className="mb-5 last:mb-0">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  {typeLabel[type]} ({categorizedIssues[type].length})
                </h3>

                {categorizedIssues[type].length === 0 ? (
                  <p className="text-sm text-gray-500">No issues detected.</p>
                ) : (
                  <div className="space-y-3">
                    {categorizedIssues[type].map((issue) => (
                      <div key={issue.id} className={`rounded-lg border p-3 ${severityClass[issue.severity]}`}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <p className="font-semibold">{issue.title}</p>
                            <p className="text-sm mt-1">{issue.description}</p>
                            <p className="text-xs mt-1 opacity-80">Target: {issue.target}</p>
                          </div>

                          {issue.quickFixAction ? (
                            <button
                              onClick={() => runQuickFix(issue.quickFixAction as QuickFixAction)}
                              disabled={runningFix !== null}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white/80 hover:bg-white text-gray-800 border border-gray-200 disabled:opacity-60"
                            >
                              <Wrench className="w-4 h-4" />
                              Quick Fix
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
