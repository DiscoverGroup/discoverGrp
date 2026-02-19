import Tour from '../models/Tour';

export type VisaRequirement = 'required' | 'not_required' | 'evisa';

export interface CountryVisaRule {
  country: string;
  passportValidityMonths: number;
  visaRequirement: VisaRequirement;
  visaLeadDays: number;
}

export interface VisaReadinessInput {
  tourSlug: string;
  departureDate: string;
  nationality: string;
  passportExpiryDate?: string;
  documents?: {
    hasPassport?: boolean;
    hasVisa?: boolean;
    hasSupportingDocuments?: boolean;
  };
}

export interface VisaReadinessIssue {
  code: string;
  message: string;
  level: 'critical' | 'high' | 'medium' | 'low';
  country?: string;
}

export interface VisaReadinessRuleSummary {
  countries: string[];
  strictestPassportValidityMonths: number;
  strictestVisaLeadDays: number;
  visaRequiredCountries: string[];
  evisaCountries: string[];
}

export interface VisaReadinessResult {
  score: number;
  status: 'ready' | 'attention' | 'not_ready';
  blockers: VisaReadinessIssue[];
  warnings: VisaReadinessIssue[];
  nextActions: string[];
  ruleSummary: VisaReadinessRuleSummary;
  evaluatedAt: string;
}

const DEFAULT_RULE: Omit<CountryVisaRule, 'country'> = {
  passportValidityMonths: 6,
  visaRequirement: 'required',
  visaLeadDays: 21,
};

const NORMALIZED_COUNTRY_RULES: Record<string, Omit<CountryVisaRule, 'country'>> = {
  france: { passportValidityMonths: 6, visaRequirement: 'required', visaLeadDays: 21 },
  italy: { passportValidityMonths: 6, visaRequirement: 'required', visaLeadDays: 21 },
  spain: { passportValidityMonths: 6, visaRequirement: 'required', visaLeadDays: 21 },
  germany: { passportValidityMonths: 6, visaRequirement: 'required', visaLeadDays: 21 },
  switzerland: { passportValidityMonths: 6, visaRequirement: 'required', visaLeadDays: 21 },
  netherlands: { passportValidityMonths: 6, visaRequirement: 'required', visaLeadDays: 21 },
  austria: { passportValidityMonths: 6, visaRequirement: 'required', visaLeadDays: 21 },
  greece: { passportValidityMonths: 6, visaRequirement: 'required', visaLeadDays: 21 },
  'united kingdom': { passportValidityMonths: 6, visaRequirement: 'required', visaLeadDays: 14 },
  japan: { passportValidityMonths: 6, visaRequirement: 'required', visaLeadDays: 14 },
  singapore: { passportValidityMonths: 6, visaRequirement: 'not_required', visaLeadDays: 0 },
  thailand: { passportValidityMonths: 6, visaRequirement: 'not_required', visaLeadDays: 0 },
  vietnam: { passportValidityMonths: 6, visaRequirement: 'evisa', visaLeadDays: 7 },
  philippines: { passportValidityMonths: 6, visaRequirement: 'not_required', visaLeadDays: 0 },
};

const normalizeCountryKey = (value: string): string => value.trim().toLowerCase();

const addMonths = (date: Date, months: number): Date => {
  const out = new Date(date.getTime());
  out.setMonth(out.getMonth() + months);
  return out;
};

export async function resolveTourCountries(tourSlug: string): Promise<string[]> {
  const tour = await Tour.findOne({ slug: tourSlug }).lean().exec();
  if (!tour) {
    return [];
  }

  const additionalInfo = (tour as { additionalInfo?: { countriesVisited?: unknown } }).additionalInfo;
  const countriesVisited = Array.isArray(additionalInfo?.countriesVisited)
    ? additionalInfo?.countriesVisited
    : [];

  const normalizedCountries = countriesVisited
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());

  return Array.from(new Set(normalizedCountries));
}

export function resolveRulesForCountries(countries: string[]): CountryVisaRule[] {
  return countries.map((country) => {
    const rule = NORMALIZED_COUNTRY_RULES[normalizeCountryKey(country)] || DEFAULT_RULE;
    return {
      country,
      ...rule,
    };
  });
}

export async function evaluateVisaReadiness(input: VisaReadinessInput): Promise<VisaReadinessResult> {
  const departureDate = new Date(input.departureDate);
  const today = new Date();

  const countries = await resolveTourCountries(input.tourSlug);
  const rules = resolveRulesForCountries(countries);

  const strictestPassportValidityMonths = rules.length > 0
    ? Math.max(...rules.map((rule) => rule.passportValidityMonths))
    : DEFAULT_RULE.passportValidityMonths;

  const strictestVisaLeadDays = rules.length > 0
    ? Math.max(...rules.map((rule) => rule.visaLeadDays))
    : DEFAULT_RULE.visaLeadDays;

  const visaRequiredCountries = rules
    .filter((rule) => rule.visaRequirement === 'required')
    .map((rule) => rule.country);

  const evisaCountries = rules
    .filter((rule) => rule.visaRequirement === 'evisa')
    .map((rule) => rule.country);

  let score = 100;
  const blockers: VisaReadinessIssue[] = [];
  const warnings: VisaReadinessIssue[] = [];

  const hasPassportDoc = input.documents?.hasPassport !== false;
  if (!hasPassportDoc || !input.passportExpiryDate) {
    blockers.push({
      code: 'PASSPORT_MISSING',
      message: 'Passport details are missing. Add passport expiry date to continue.',
      level: 'critical',
    });
    score -= 100;
  } else {
    const passportExpiryDate = new Date(input.passportExpiryDate);
    if (Number.isNaN(passportExpiryDate.getTime())) {
      blockers.push({
        code: 'PASSPORT_INVALID_DATE',
        message: 'Passport expiry date is invalid.',
        level: 'critical',
      });
      score -= 100;
    } else {
      const requiredValidUntil = addMonths(departureDate, strictestPassportValidityMonths);
      if (passportExpiryDate < requiredValidUntil) {
        blockers.push({
          code: 'PASSPORT_VALIDITY_LOW',
          message: `Passport validity should cover at least ${strictestPassportValidityMonths} months after departure period.`,
          level: 'critical',
        });
        score -= 70;
      }
    }
  }

  const hasVisaDoc = input.documents?.hasVisa === true;
  if (visaRequiredCountries.length > 0 && !hasVisaDoc) {
    blockers.push({
      code: 'VISA_REQUIRED_MISSING',
      message: `Visa required for: ${visaRequiredCountries.join(', ')}.`,
      level: 'high',
    });
    score -= 60;
  }

  if (evisaCountries.length > 0 && !hasVisaDoc) {
    warnings.push({
      code: 'EVISA_RECOMMENDED',
      message: `eVisa recommended for: ${evisaCountries.join(', ')}.`,
      level: 'medium',
    });
    score -= 20;
  }

  const diffMs = departureDate.getTime() - today.getTime();
  const leadDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (!Number.isNaN(leadDays) && leadDays < strictestVisaLeadDays) {
    warnings.push({
      code: 'SHORT_LEAD_TIME',
      message: `Departure is in ${leadDays} day(s); recommended visa lead time is ${strictestVisaLeadDays} day(s).`,
      level: 'high',
    });
    score -= 30;
  }

  if (input.documents?.hasSupportingDocuments === false) {
    warnings.push({
      code: 'SUPPORTING_DOCS_MISSING',
      message: 'Supporting documents are incomplete. This may delay visa processing.',
      level: 'low',
    });
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  const status: VisaReadinessResult['status'] = blockers.length > 0
    ? 'not_ready'
    : score >= 85
    ? 'ready'
    : 'attention';

  const nextActions: string[] = [];
  if (blockers.some((b) => b.code === 'PASSPORT_MISSING' || b.code === 'PASSPORT_INVALID_DATE' || b.code === 'PASSPORT_VALIDITY_LOW')) {
    nextActions.push('Update valid passport details and ensure validity meets destination requirements.');
  }
  if (blockers.some((b) => b.code === 'VISA_REQUIRED_MISSING')) {
    nextActions.push('Start visa application for required destinations before payment confirmation.');
  }
  if (warnings.some((w) => w.code === 'SHORT_LEAD_TIME')) {
    nextActions.push('Use priority processing or choose a later departure date if possible.');
  }
  if (warnings.some((w) => w.code === 'SUPPORTING_DOCS_MISSING')) {
    nextActions.push('Upload supporting documents to reduce approval delays.');
  }
  if (nextActions.length === 0) {
    nextActions.push('You are ready to proceed with booking.');
  }

  return {
    score,
    status,
    blockers,
    warnings,
    nextActions,
    ruleSummary: {
      countries,
      strictestPassportValidityMonths,
      strictestVisaLeadDays,
      visaRequiredCountries,
      evisaCountries,
    },
    evaluatedAt: new Date().toISOString(),
  };
}
