const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const isDryRun = process.argv.includes('--dry-run');

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Add it to apps/api/.env or root .env first.');
  process.exit(1);
}

const DEFAULT_RULE = {
  passportValidityMonths: 6,
  visaRequirement: 'required',
  visaLeadDays: 21,
};

const COUNTRY_RULES = {
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

const normalizeCountry = (value) => String(value || '').trim().toLowerCase();

const addMonths = (date, months) => {
  const out = new Date(date.getTime());
  out.setMonth(out.getMonth() + months);
  return out;
};

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
};

const dedupeStrings = (values) => Array.from(new Set(values.filter((v) => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())));

const getRulesForCountries = (countries) => countries.map((country) => ({
  country,
  ...(COUNTRY_RULES[normalizeCountry(country)] || DEFAULT_RULE),
}));

function evaluateFromBooking(booking, countries) {
  const rules = getRulesForCountries(countries);
  const strictestPassportValidityMonths = rules.length > 0
    ? Math.max(...rules.map((rule) => rule.passportValidityMonths))
    : DEFAULT_RULE.passportValidityMonths;
  const strictestVisaLeadDays = rules.length > 0
    ? Math.max(...rules.map((rule) => rule.visaLeadDays))
    : DEFAULT_RULE.visaLeadDays;

  const visaRequiredCountries = rules.filter((rule) => rule.visaRequirement === 'required').map((rule) => rule.country);
  const evisaCountries = rules.filter((rule) => rule.visaRequirement === 'evisa').map((rule) => rule.country);

  const blockers = [];
  const warnings = [];
  let score = 100;

  const departureDate = toDate(booking.selectedDate);
  const passportExpiryDate = toDate(booking.customerPassport);
  const hasPassportDoc = Boolean(booking.customerPassport);
  const hasVisaDoc = Boolean(booking.visaDocumentsProvided);
  const hasSupportingDocuments = Boolean(booking.visaDocumentsProvided);

  if (!hasPassportDoc || !passportExpiryDate) {
    blockers.push({
      code: 'PASSPORT_MISSING',
      message: 'Passport details are missing. Add passport expiry date to continue.',
      level: 'critical',
    });
    score -= 100;
  } else if (departureDate) {
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

  if (departureDate) {
    const leadDays = Math.floor((departureDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (!Number.isNaN(leadDays) && leadDays < strictestVisaLeadDays) {
      warnings.push({
        code: 'SHORT_LEAD_TIME',
        message: `Departure is in ${leadDays} day(s); recommended visa lead time is ${strictestVisaLeadDays} day(s).`,
        level: 'high',
      });
      score -= 30;
    }
  }

  if (!hasSupportingDocuments) {
    warnings.push({
      code: 'SUPPORTING_DOCS_MISSING',
      message: 'Supporting documents are incomplete. This may delay visa processing.',
      level: 'low',
    });
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  const status = blockers.length > 0 ? 'not_ready' : (score >= 85 ? 'ready' : 'attention');

  const nextActions = [];
  if (blockers.some((b) => b.code === 'PASSPORT_MISSING' || b.code === 'PASSPORT_VALIDITY_LOW')) {
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

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const bookingsCollection = mongoose.connection.collection('bookings');
  const toursCollection = mongoose.connection.collection('tours');

  const query = {
    $or: [
      { visaReadinessScore: { $exists: false } },
      { visaReadinessStatus: { $exists: false } },
      { visaReadinessSnapshot: { $exists: false } },
    ],
  };

  const bookingsToMigrate = await bookingsCollection.find(query).toArray();
  console.log(`📦 Bookings needing migration: ${bookingsToMigrate.length}`);

  if (bookingsToMigrate.length === 0) {
    await mongoose.disconnect();
    console.log('✅ No migration needed.');
    return;
  }

  const tourCountriesCache = new Map();
  const bulkOps = [];

  for (const booking of bookingsToMigrate) {
    let countries = dedupeStrings(Array.isArray(booking.visaDestinationCountries) ? booking.visaDestinationCountries : []);

    if (countries.length === 0 && typeof booking.tourSlug === 'string' && booking.tourSlug.trim().length > 0) {
      const slug = booking.tourSlug.trim();
      if (!tourCountriesCache.has(slug)) {
        const tour = await toursCollection.findOne({ slug }, { projection: { additionalInfo: 1 } });
        const visited = Array.isArray(tour?.additionalInfo?.countriesVisited)
          ? tour.additionalInfo.countriesVisited
          : [];
        tourCountriesCache.set(slug, dedupeStrings(visited));
      }
      countries = tourCountriesCache.get(slug) || [];
    }

    const snapshot = evaluateFromBooking(booking, countries);

    bulkOps.push({
      updateOne: {
        filter: { _id: booking._id },
        update: {
          $set: {
            visaReadinessScore: snapshot.score,
            visaReadinessStatus: snapshot.status,
            visaReadinessSnapshot: snapshot,
          },
        },
      },
    });
  }

  if (isDryRun) {
    console.log(`🧪 Dry run complete. Would update ${bulkOps.length} booking(s).`);
  } else {
    const result = await bookingsCollection.bulkWrite(bulkOps, { ordered: false });
    console.log(`✅ Migration complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

run().catch(async (error) => {
  console.error('❌ Visa readiness migration failed:', error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('⚠️ Disconnect error:', disconnectError);
  }
  process.exit(1);
});
