import { Router, Request, Response } from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import Tour from '../models/Tour';
import Country from '../models/Country';

const router = Router();
const CountryModel = Country as mongoose.Model<Record<string, unknown>>;

type CheckType = 'code_error' | 'abnormality' | 'incorrect_output';
type CheckStatus = 'pass' | 'fail' | 'warn';
type Severity = 'critical' | 'high' | 'medium' | 'low';

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
  severity: Severity;
  title: string;
  description: string;
  target: string;
  quickFixAction?: QuickFixAction;
}

type QuickFixAction = 'fix_tour_slugs' | 'fix_country_slugs' | 'fix_all';

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

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

async function runHttpCheck(
  id: string,
  title: string,
  type: CheckType,
  target: string,
  validator: (payload: unknown) => { status: CheckStatus; message: string }
): Promise<MonitoringCheck> {
  const started = Date.now();
  try {
    const response = await axios.get(target, {
      timeout: 7000,
      validateStatus: () => true,
      headers: {
        Accept: 'application/json, text/html;q=0.9,*/*;q=0.8',
      },
    });

    if (response.status >= 400) {
      return {
        id,
        title,
        type,
        status: response.status >= 500 ? 'fail' : 'warn',
        target,
        message: `HTTP ${response.status}`,
        durationMs: Date.now() - started,
      };
    }

    const result = validator(response.data);
    return {
      id,
      title,
      type,
      status: result.status,
      target,
      message: result.message,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      id,
      title,
      type,
      status: 'fail',
      target,
      message,
      durationMs: Date.now() - started,
    };
  }
}

function checkToIssue(check: MonitoringCheck): MonitoringIssue | null {
  if (check.status === 'pass') return null;

  const severity: Severity = check.status === 'fail' ? 'high' : 'medium';
  const titlePrefix = check.type === 'code_error'
    ? 'Code/API Error'
    : check.type === 'abnormality'
    ? 'Abnormal Behavior'
    : 'Incorrect Output';

  return {
    id: `issue-${check.id}`,
    type: check.type,
    severity,
    title: `${titlePrefix}: ${check.title}`,
    description: check.message,
    target: check.target,
  };
}

async function buildScanResult(req: Request): Promise<MonitoringScanResult> {
  const host = req.get('host') || 'localhost:4000';
  const protocol = req.protocol || 'http';
  const localBase = `${protocol}://${host}`;

  const checks: MonitoringCheck[] = [];
  const issues: MonitoringIssue[] = [];

  checks.push(
    {
      id: 'db-connection',
      title: 'MongoDB Connection',
      type: 'code_error',
      status: mongoose.connection.readyState === 1 ? 'pass' : 'fail',
      target: 'mongodb',
      message: mongoose.connection.readyState === 1 ? 'Connected' : `State ${mongoose.connection.readyState}`,
      durationMs: 0,
    }
  );

  checks.push(
    await runHttpCheck(
      'health-simple',
      'API Basic Health',
      'code_error',
      `${localBase}/health-simple`,
      (payload) => {
        const ok = !!payload && typeof payload === 'object' && (payload as { ok?: unknown }).ok === true;
        return {
          status: ok ? 'pass' : 'fail',
          message: ok ? 'API health-simple responded ok=true' : 'Missing or invalid ok flag',
        };
      }
    )
  );

  checks.push(
    await runHttpCheck(
      'public-tours',
      'Public Tours Output',
      'incorrect_output',
      `${localBase}/public/tours?limit=10`,
      (payload) => {
        if (!Array.isArray(payload)) {
          return { status: 'fail', message: 'Expected an array response' };
        }

        const invalid = payload.filter((item) => {
          if (!item || typeof item !== 'object') return true;
          const row = item as { id?: unknown; slug?: unknown; title?: unknown };
          return typeof row.slug !== 'string' || typeof row.title !== 'string' || typeof row.id !== 'string';
        });

        if (invalid.length > 0) {
          return { status: 'warn', message: `${invalid.length} tours missing id/slug/title` };
        }

        return { status: 'pass', message: `${payload.length} tours returned with valid shape` };
      }
    )
  );

  checks.push(
    await runHttpCheck(
      'countries-output',
      'Countries Output',
      'incorrect_output',
      `${localBase}/api/countries`,
      (payload) => {
        if (!Array.isArray(payload)) {
          return { status: 'fail', message: 'Expected array of countries' };
        }

        const invalid = payload.filter((item) => {
          if (!item || typeof item !== 'object') return true;
          const row = item as { name?: unknown; slug?: unknown; description?: unknown };
          return typeof row.name !== 'string' || typeof row.slug !== 'string' || typeof row.description !== 'string';
        });

        if (invalid.length > 0) {
          return { status: 'warn', message: `${invalid.length} countries missing name/slug/description` };
        }

        return { status: 'pass', message: `${payload.length} countries returned with valid shape` };
      }
    )
  );

  checks.push(
    await runHttpCheck(
      'security-output',
      'Security Status Output',
      'incorrect_output',
      `${localBase}/api/security/status`,
      (payload) => {
        const data = payload as { overall?: unknown; score?: unknown; plugins?: unknown };
        const valid = !!data && typeof data === 'object' && typeof data.overall === 'string' && typeof data.score === 'number' && Array.isArray(data.plugins);
        return {
          status: valid ? 'pass' : 'warn',
          message: valid ? 'Security payload shape is valid' : 'Security payload is incomplete',
        };
      }
    )
  );

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    checks.push(
      await runHttpCheck(
        'frontend-reachability',
        'Client Website Reachability',
        'abnormality',
        frontendUrl,
        () => ({ status: 'pass', message: 'Client site is reachable' })
      )
    );
  }

  const adminUrl = process.env.ADMIN_URL;
  if (adminUrl) {
    checks.push(
      await runHttpCheck(
        'admin-reachability',
        'Admin Website Reachability',
        'abnormality',
        adminUrl,
        () => ({ status: 'pass', message: 'Admin site is reachable' })
      )
    );
  }

  const tourStarted = Date.now();
  const tours = await Tour.find({}, { _id: 1, title: 1, slug: 1, durationDays: 1, regularPricePerPerson: 1, promoPricePerPerson: 1 }).lean().exec();
  const toursWithMissingSlug = tours.filter((tour) => typeof tour.slug !== 'string' || tour.slug.trim().length === 0);
  const toursWithInvalidDuration = tours.filter((tour) => typeof tour.durationDays !== 'number' || tour.durationDays <= 0);
  const toursWithPricingMismatch = tours.filter((tour) => {
    const regular = typeof tour.regularPricePerPerson === 'number' ? tour.regularPricePerPerson : null;
    const promo = typeof tour.promoPricePerPerson === 'number' ? tour.promoPricePerPerson : null;
    return regular !== null && promo !== null && promo > regular;
  });

  checks.push({
    id: 'tour-data-integrity',
    title: 'Tour Data Integrity',
    type: 'abnormality',
    status: toursWithMissingSlug.length > 0 || toursWithInvalidDuration.length > 0 || toursWithPricingMismatch.length > 0 ? 'warn' : 'pass',
    target: 'tours',
    message: `missingSlug=${toursWithMissingSlug.length}, invalidDuration=${toursWithInvalidDuration.length}, pricingMismatch=${toursWithPricingMismatch.length}`,
    durationMs: Date.now() - tourStarted,
  });

  if (toursWithMissingSlug.length > 0) {
    issues.push({
      id: 'tour-missing-slugs',
      type: 'abnormality',
      severity: 'medium',
      title: 'Tours with missing slugs',
      description: `${toursWithMissingSlug.length} tours are missing slugs and may break route outputs.`,
      target: 'tours.slug',
      quickFixAction: 'fix_tour_slugs',
    });
  }

  if (toursWithInvalidDuration.length > 0) {
    issues.push({
      id: 'tour-invalid-duration',
      type: 'incorrect_output',
      severity: 'medium',
      title: 'Tours with invalid duration',
      description: `${toursWithInvalidDuration.length} tours have durationDays <= 0.`,
      target: 'tours.durationDays',
    });
  }

  if (toursWithPricingMismatch.length > 0) {
    issues.push({
      id: 'tour-pricing-mismatch',
      type: 'incorrect_output',
      severity: 'low',
      title: 'Tours with promo price above regular price',
      description: `${toursWithPricingMismatch.length} tours have promoPricePerPerson > regularPricePerPerson.`,
      target: 'tours.pricing',
    });
  }

  const countryStarted = Date.now();
  const countries = await CountryModel.find({}, { _id: 1, name: 1, slug: 1, description: 1 }).lean().exec();
  const countriesWithMissingSlug = countries.filter((country) => typeof country.slug !== 'string' || country.slug.trim().length === 0);
  const countriesWithMissingDescription = countries.filter((country) => typeof country.description !== 'string' || country.description.trim().length === 0);

  checks.push({
    id: 'country-data-integrity',
    title: 'Country Data Integrity',
    type: 'abnormality',
    status: countriesWithMissingSlug.length > 0 || countriesWithMissingDescription.length > 0 ? 'warn' : 'pass',
    target: 'countries',
    message: `missingSlug=${countriesWithMissingSlug.length}, missingDescription=${countriesWithMissingDescription.length}`,
    durationMs: Date.now() - countryStarted,
  });

  if (countriesWithMissingSlug.length > 0) {
    issues.push({
      id: 'country-missing-slugs',
      type: 'abnormality',
      severity: 'medium',
      title: 'Countries with missing slugs',
      description: `${countriesWithMissingSlug.length} countries are missing slugs and may break URL outputs.`,
      target: 'countries.slug',
      quickFixAction: 'fix_country_slugs',
    });
  }

  if (countriesWithMissingDescription.length > 0) {
    issues.push({
      id: 'country-missing-description',
      type: 'incorrect_output',
      severity: 'low',
      title: 'Countries missing description',
      description: `${countriesWithMissingDescription.length} countries have empty descriptions.`,
      target: 'countries.description',
    });
  }

  checks.forEach((check) => {
    const mapped = checkToIssue(check);
    if (mapped) issues.push(mapped);
  });

  const checksPassed = checks.filter((check) => check.status === 'pass').length;
  const checksFailed = checks.filter((check) => check.status === 'fail').length;
  const checksWarn = checks.filter((check) => check.status === 'warn').length;

  const codeErrors = issues.filter((issue) => issue.type === 'code_error').length;
  const abnormalities = issues.filter((issue) => issue.type === 'abnormality').length;
  const incorrectOutput = issues.filter((issue) => issue.type === 'incorrect_output').length;

  const status: MonitoringScanResult['status'] = checksFailed > 0
    ? 'critical'
    : checksWarn > 0
    ? 'warning'
    : 'healthy';

  return {
    scannedAt: new Date().toISOString(),
    status,
    stats: {
      checksTotal: checks.length,
      checksPassed,
      checksFailed,
      checksWarn,
      issues: {
        codeErrors,
        abnormalities,
        incorrectOutput,
      },
    },
    checks,
    issues,
    quickFixActions: [
      { action: 'fix_tour_slugs', label: 'Fix missing tour slugs' },
      { action: 'fix_country_slugs', label: 'Fix missing country slugs' },
      { action: 'fix_all', label: 'Run all safe quick fixes' },
    ],
  };
}

async function fixMissingTourSlugs(): Promise<{ fixed: number }> {
  const tours = await Tour.find({
    $or: [
      { slug: { $exists: false } },
      { slug: null },
      { slug: '' },
    ],
  }).lean().exec();

  const existingSlugs = new Set<string>(
    (await Tour.find({}, { slug: 1 }).lean().exec())
      .map((row) => (typeof row.slug === 'string' ? row.slug.trim() : ''))
      .filter(Boolean)
  );

  let fixed = 0;

  for (const tour of tours) {
    const base = slugify(typeof tour.title === 'string' && tour.title.trim().length > 0 ? tour.title : String(tour._id));
    if (!base) continue;

    let nextSlug = base;
    let suffix = 2;
    while (existingSlugs.has(nextSlug)) {
      nextSlug = `${base}-${suffix}`;
      suffix += 1;
    }

    await Tour.updateOne({ _id: tour._id }, { $set: { slug: nextSlug } }).exec();
    existingSlugs.add(nextSlug);
    fixed += 1;
  }

  return { fixed };
}

async function fixMissingCountrySlugs(): Promise<{ fixed: number }> {
  const countries = await CountryModel.find({
    $or: [
      { slug: { $exists: false } },
      { slug: null },
      { slug: '' },
    ],
  }).lean().exec();

  const existingSlugs = new Set<string>(
    (await CountryModel.find({}, { slug: 1 }).lean().exec())
      .map((row) => (typeof row.slug === 'string' ? row.slug.trim() : ''))
      .filter(Boolean)
  );

  let fixed = 0;

  for (const country of countries) {
    const base = slugify(typeof country.name === 'string' && country.name.trim().length > 0 ? country.name : String(country._id));
    if (!base) continue;

    let nextSlug = base;
    let suffix = 2;
    while (existingSlugs.has(nextSlug)) {
      nextSlug = `${base}-${suffix}`;
      suffix += 1;
    }

    await CountryModel.updateOne({ _id: country._id }, { $set: { slug: nextSlug } }).exec();
    existingSlugs.add(nextSlug);
    fixed += 1;
  }

  return { fixed };
}

router.get('/scan', async (req: Request, res: Response) => {
  try {
    const result = await buildScanResult(req);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      error: 'Failed to run monitoring scan',
      message,
      scannedAt: new Date().toISOString(),
    });
  }
});

router.post('/quick-fix', async (req: Request, res: Response) => {
  try {
    const action = req.body?.action as QuickFixAction | undefined;

    if (!action) {
      return res.status(400).json({ error: 'Missing action' });
    }

    let tourResult = { fixed: 0 };
    let countryResult = { fixed: 0 };

    if (action === 'fix_tour_slugs' || action === 'fix_all') {
      tourResult = await fixMissingTourSlugs();
    }

    if (action === 'fix_country_slugs' || action === 'fix_all') {
      countryResult = await fixMissingCountrySlugs();
    }

    return res.json({
      ok: true,
      action,
      fixed: {
        tours: tourResult.fixed,
        countries: countryResult.fixed,
        total: tourResult.fixed + countryResult.fixed,
      },
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: 'Quick fix failed',
      message,
    });
  }
});

export default router;
