import { Router, Request, Response } from 'express';
import Booking from '../models/Booking';
import { spawn } from 'child_process';
import path from 'path';
import {
  evaluateVisaReadiness,
  resolveRulesForCountries,
  resolveTourCountries,
  VisaReadinessInput,
} from '../services/visa-readiness';

const router = Router();
let migrationRunning = false;
const MIGRATION_STATUS_CACHE_TTL_MS = 15_000;

type MigrationStatusPayload = {
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
};

let migrationStatusCache: {
  expiresAt: number;
  payload: MigrationStatusPayload;
} | null = null;

const clearMigrationStatusCache = (): void => {
  migrationStatusCache = null;
};

const isFeatureEnabled = (): boolean => {
  const raw = String(process.env.VISA_READINESS_ENABLED || 'true').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
};

const runMigrationScript = async (dryRun: boolean): Promise<{
  ok: boolean;
  exitCode: number;
  output: string[];
}> => {
  const scriptPath = path.resolve(__dirname, '../../scripts/migrate-visa-readiness.cjs');
  const apiRoot = path.resolve(__dirname, '../..');

  return await new Promise((resolve) => {
    const args = [scriptPath, ...(dryRun ? ['--dry-run'] : [])];
    const child = spawn(process.execPath, args, {
      cwd: apiRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const output: string[] = [];
    let finished = false;

    const pushLines = (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      output.push(...lines);
      if (output.length > 200) {
        output.splice(0, output.length - 200);
      }
    };

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      resolve({
        ok: false,
        exitCode: -1,
        output: [...output, 'Migration timed out after 10 minutes.'],
      });
    }, 10 * 60 * 1000);

    child.stdout.on('data', pushLines);
    child.stderr.on('data', pushLines);

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({
        ok: code === 0,
        exitCode: typeof code === 'number' ? code : -1,
        output,
      });
    });

    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({
        ok: false,
        exitCode: -1,
        output: [...output, `Failed to start migration process: ${error.message}`],
      });
    });
  });
};

router.post('/migration/run', async (req: Request, res: Response) => {
  if (!isFeatureEnabled()) {
    return res.status(503).json({
      ok: false,
      error: 'Visa readiness feature is disabled',
    });
  }

  if (migrationRunning) {
    return res.status(409).json({
      ok: false,
      error: 'Migration is already running',
    });
  }

  try {
    const dryRun = req.body?.dryRun !== false;
    migrationRunning = true;
    clearMigrationStatusCache();
    const result = await runMigrationScript(dryRun);

    return res.status(result.ok ? 200 : 500).json({
      ok: result.ok,
      dryRun,
      exitCode: result.exitCode,
      output: result.output,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: 'Failed to execute migration',
      message,
    });
  } finally {
    migrationRunning = false;
    clearMigrationStatusCache();
  }
});

router.get('/migration-status', async (_req: Request, res: Response) => {
  try {
    if (migrationStatusCache && migrationStatusCache.expiresAt > Date.now()) {
      return res.json({
        ...migrationStatusCache.payload,
        cache: {
          hit: true,
          ttlMs: Math.max(migrationStatusCache.expiresAt - Date.now(), 0),
        },
      });
    }

    const [facetResult] = await Booking.aggregate([
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                withSnapshot: {
                  $sum: {
                    $cond: [
                      { $ne: [{ $ifNull: ['$visaReadinessSnapshot', null] }, null] },
                      1,
                      0,
                    ],
                  },
                },
                withScore: {
                  $sum: {
                    $cond: [
                      { $ne: [{ $ifNull: ['$visaReadinessScore', null] }, null] },
                      1,
                      0,
                    ],
                  },
                },
                withStatus: {
                  $sum: {
                    $cond: [
                      { $ne: [{ $ifNull: ['$visaReadinessStatus', null] }, null] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          statusBreakdown: [
            { $match: { visaReadinessStatus: { $in: ['ready', 'attention', 'not_ready'] } } },
            { $group: { _id: '$visaReadinessStatus', count: { $sum: 1 } } },
          ],
          latestEvaluated: [
            { $match: { 'visaReadinessSnapshot.evaluatedAt': { $exists: true, $ne: null } } },
            { $sort: { 'visaReadinessSnapshot.evaluatedAt': -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                bookingId: 1,
                evaluatedAt: '$visaReadinessSnapshot.evaluatedAt',
              },
            },
          ],
        },
      },
    ]).exec();

    const totals = Array.isArray(facetResult?.totals) && facetResult.totals.length > 0
      ? facetResult.totals[0]
      : {
          totalBookings: 0,
          withSnapshot: 0,
          withScore: 0,
          withStatus: 0,
        };

    const totalBookings = Number(totals.totalBookings || 0);
    const bookingsWithSnapshot = Number(totals.withSnapshot || 0);
    const bookingsWithScore = Number(totals.withScore || 0);
    const bookingsWithStatus = Number(totals.withStatus || 0);

    const statusGroups = Array.isArray(facetResult?.statusBreakdown)
      ? facetResult.statusBreakdown
      : [];

    const latestSnapshotBooking = Array.isArray(facetResult?.latestEvaluated) && facetResult.latestEvaluated.length > 0
      ? facetResult.latestEvaluated[0]
      : null;

    const statusBreakdown = {
      ready: 0,
      attention: 0,
      not_ready: 0,
    };

    statusGroups.forEach((group) => {
      if (group?._id === 'ready' || group?._id === 'attention' || group?._id === 'not_ready') {
        statusBreakdown[group._id] = group.count;
      }
    });

    const coveragePercent = totalBookings > 0
      ? Number(((bookingsWithSnapshot / totalBookings) * 100).toFixed(2))
      : 100;

    const payload: MigrationStatusPayload = {
      generatedAt: new Date().toISOString(),
      featureEnabled: isFeatureEnabled(),
      totals: {
        totalBookings,
        withSnapshot: bookingsWithSnapshot,
        withScore: bookingsWithScore,
        withStatus: bookingsWithStatus,
        pendingMigration: Math.max(totalBookings - bookingsWithSnapshot, 0),
      },
      coverage: {
        percent: coveragePercent,
        isComplete: bookingsWithSnapshot >= totalBookings,
      },
      statusBreakdown,
      latestEvaluated: latestSnapshotBooking
        ? {
            bookingId: latestSnapshotBooking.bookingId,
            evaluatedAt: latestSnapshotBooking.evaluatedAt,
          }
        : null,
    };

    migrationStatusCache = {
      expiresAt: Date.now() + MIGRATION_STATUS_CACHE_TTL_MS,
      payload,
    };

    return res.json({
      ...payload,
      cache: {
        hit: false,
        ttlMs: MIGRATION_STATUS_CACHE_TTL_MS,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      error: 'Failed to fetch migration status',
      message,
    });
  }
});

router.post('/evaluate', async (req: Request, res: Response) => {
  if (!isFeatureEnabled()) {
    return res.status(503).json({ error: 'Visa readiness feature is disabled' });
  }

  try {
    const body = req.body as VisaReadinessInput;

    if (!body?.tourSlug || !body?.departureDate || !body?.nationality) {
      return res.status(400).json({
        error: 'Missing required fields: tourSlug, departureDate, nationality',
      });
    }

    const result = await evaluateVisaReadiness(body);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      error: 'Failed to evaluate visa readiness',
      message,
    });
  }
});

router.get('/rules/:tourSlug', async (req: Request, res: Response) => {
  if (!isFeatureEnabled()) {
    return res.status(503).json({ error: 'Visa readiness feature is disabled' });
  }

  try {
    const tourSlug = req.params.tourSlug;
    if (!tourSlug) {
      return res.status(400).json({ error: 'tourSlug is required' });
    }

    const countries = await resolveTourCountries(tourSlug);
    const rules = resolveRulesForCountries(countries);

    return res.json({
      tourSlug,
      nationality: typeof req.query.nationality === 'string' ? req.query.nationality : undefined,
      countries,
      rules,
      resolvedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      error: 'Failed to resolve visa rules',
      message,
    });
  }
});

export default router;
