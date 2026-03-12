/**
 * migrate-country-continents.cjs
 *
 * Idempotent migration — safe to re-run on every deploy.
 *
 * What it does:
 *   1. Connects to MongoDB via MONGODB_URI
 *   2. Sets the `continent` field on every Country document that is missing it,
 *      based on a built-in country → continent mapping.
 *   3. Upserts foundation countries that are required by the destination menu
 *      but may be absent in the database (e.g. fresh deployments).
 *   4. Exits 0 on success, exits 1 on unrecoverable error.
 *
 * Run standalone:
 *   node apps/api/scripts/migrate-country-continents.cjs
 *
 * Called automatically by:
 *   npm run migrate:continents   (added to apps/api/package.json)
 *   railway.json startCommand    (runs before the API server starts)
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

// ─── Country → Continent mapping ──────────────────────────────────────────────
// Keys are lowercase slugs; values are the canonical continent string.
const CONTINENT_MAP = {
  // Europe
  france:            'Europe',
  italy:             'Europe',
  switzerland:       'Europe',
  'vatican-city':    'Europe',
  spain:             'Europe',
  germany:           'Europe',
  austria:           'Europe',
  netherlands:       'Europe',
  belgium:           'Europe',
  portugal:          'Europe',
  greece:            'Europe',
  'czech-republic':  'Europe',
  czechia:           'Europe',
  hungary:           'Europe',
  poland:            'Europe',
  croatia:           'Europe',
  slovakia:          'Europe',
  slovenia:          'Europe',
  romania:           'Europe',
  bulgaria:          'Europe',
  denmark:           'Europe',
  sweden:            'Europe',
  norway:            'Europe',
  finland:           'Europe',
  ireland:           'Europe',
  'united-kingdom':  'Europe',
  'uk':              'Europe',
  luxembourg:        'Europe',
  monaco:            'Europe',
  liechtenstein:     'Europe',
  'san-marino':      'Europe',
  malta:             'Europe',
  cyprus:            'Europe',
  russia:            'Europe',
  ukraine:           'Europe',
  // Asia
  japan:             'Asia',
  'south-korea':     'Asia',
  korea:             'Asia',
  china:             'Asia',
  thailand:          'Asia',
  vietnam:           'Asia',
  philippines:       'Asia',
  singapore:         'Asia',
  malaysia:          'Asia',
  indonesia:         'Asia',
  india:             'Asia',
  turkey:            'Asia',
  'united-arab-emirates': 'Asia',
  uae:               'Asia',
  dubai:             'Asia',
  qatar:             'Asia',
  'saudi-arabia':    'Asia',
  israel:            'Asia',
  jordan:            'Asia',
  cambodia:          'Asia',
  laos:              'Asia',
  'sri-lanka':       'Asia',
  nepal:             'Asia',
  bhutan:            'Asia',
  'hong-kong':       'Asia',
  taiwan:            'Asia',
  macau:             'Asia',
  mongolia:          'Asia',
  myanmar:           'Asia',
  bangladesh:        'Asia',
  pakistan:          'Asia',
  // North America
  usa:               'North America',
  'united-states':   'North America',
  canada:            'North America',
  mexico:            'North America',
  'costa-rica':      'North America',
  cuba:              'North America',
  jamaica:           'North America',
  'dominican-republic': 'North America',
  // South America
  brazil:            'South America',
  argentina:         'South America',
  chile:             'South America',
  peru:              'South America',
  colombia:          'South America',
  ecuador:           'South America',
  bolivia:           'South America',
  uruguay:           'South America',
  venezuela:         'South America',
  // Africa
  'south-africa':    'Africa',
  egypt:             'Africa',
  morocco:           'Africa',
  kenya:             'Africa',
  tanzania:          'Africa',
  ethiopia:          'Africa',
  ghana:             'Africa',
  nigeria:           'Africa',
  // Oceania
  australia:         'Oceania',
  'new-zealand':     'Oceania',
  fiji:              'Oceania',
  'papua-new-guinea':'Oceania',
};

// ─── Foundation countries to upsert on fresh deployments ─────────────────────
// Minimal required data — the admin panel can enrich these later.
const FOUNDATION_COUNTRIES = [
  {
    name: 'France', slug: 'france', continent: 'Europe',
    description: 'Experience the romance and elegance of France.',
    heroImages: ['https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920'],
    heroQuery: 'paris france eiffel tower',
    bestTime: 'April to October', currency: 'EUR (€)', language: 'French',
    visaInfo: 'Schengen visa required for most nationalities.',
    attractions: [], testimonials: [], isActive: true,
  },
  {
    name: 'Italy', slug: 'italy', continent: 'Europe',
    description: 'Immerse yourself in the timeless beauty of Italy.',
    heroImages: ['https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=1920'],
    heroQuery: 'rome italy colosseum',
    bestTime: 'April to June, September to October', currency: 'EUR (€)', language: 'Italian',
    visaInfo: 'Schengen visa required for most nationalities.',
    attractions: [], testimonials: [], isActive: true,
  },
  {
    name: 'Switzerland', slug: 'switzerland', continent: 'Europe',
    description: 'Discover the stunning Alpine landscapes of Switzerland.',
    heroImages: ['https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=1920'],
    heroQuery: 'switzerland alps mountains',
    bestTime: 'June to September', currency: 'CHF (Swiss Franc)', language: 'German, French, Italian',
    visaInfo: 'Schengen visa required for most nationalities.',
    attractions: [], testimonials: [], isActive: true,
  },
  {
    name: 'Vatican City', slug: 'vatican-city', continent: 'Europe',
    description: "Explore the world's smallest independent state.",
    heroImages: ['https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=1920'],
    heroQuery: 'vatican city st peters basilica',
    bestTime: 'October to April', currency: 'EUR (€)', language: 'Italian, Latin',
    visaInfo: 'No separate visa needed — accessible from Rome (Italy).',
    attractions: [], testimonials: [], isActive: true,
  },
  {
    name: 'Spain', slug: 'spain', continent: 'Europe',
    description: 'Experience the vibrant culture of Spain.',
    heroImages: ['https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1920'],
    heroQuery: 'barcelona spain sagrada familia',
    bestTime: 'May to June, September to October', currency: 'EUR (€)',
    language: 'Spanish, Catalan', visaInfo: 'Schengen visa required for most nationalities.',
    attractions: [], testimonials: [], isActive: true,
  },
  {
    name: 'Japan', slug: 'japan', continent: 'Asia',
    description: 'Discover the perfect blend of ancient tradition and modern innovation in Japan.',
    heroImages: ['https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920'],
    heroQuery: 'tokyo japan mount fuji',
    bestTime: 'March to May (cherry blossom), October to November',
    currency: 'JPY (¥)', language: 'Japanese',
    visaInfo: 'Visa on arrival / e-visa available for many nationalities.',
    attractions: [], testimonials: [], isActive: true,
  },
  {
    name: 'Turkey', slug: 'turkey', continent: 'Asia',
    description: 'Where East meets West — a breathtaking mix of history, culture and landscapes.',
    heroImages: ['https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1920'],
    heroQuery: 'istanbul turkey hagia sophia',
    bestTime: 'April to June, September to November',
    currency: 'TRY (₺)', language: 'Turkish',
    visaInfo: 'e-Visa available online for most nationalities.',
    attractions: [], testimonials: [], isActive: true,
  },
];

// ─── Mongoose schema (minimal — strict:false allows extra fields) ─────────────
const countrySchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, unique: true },
    slug:       { type: String, required: true, unique: true },
    continent:  { type: String },
    description:{ type: String, required: true },
    heroImages: [String],
    heroQuery:  String,
    bestTime:   { type: String, required: true },
    currency:   { type: String, required: true },
    language:   { type: String, required: true },
    visaInfo:   String,
    attractions:[mongoose.Schema.Types.Mixed],
    testimonials:[mongoose.Schema.Types.Mixed],
    isActive:   { type: Boolean, default: true },
  },
  { strict: false, timestamps: true }
);

const Country = mongoose.models.Country ?? mongoose.model('Country', countrySchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getContinentForSlug(slug) {
  return CONTINENT_MAP[slug] ?? null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌  MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  console.log('🔗  Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('✅  Connected.');

  // 1. Upsert foundation countries (won't overwrite existing rich data)
  let upserted = 0;
  for (const data of FOUNDATION_COUNTRIES) {
    const existing = await Country.findOne({ slug: data.slug });
    if (!existing) {
      await Country.create(data);
      console.log(`   ➕  Created missing country: ${data.name}`);
      upserted++;
    }
  }
  if (upserted === 0) console.log('   ✔   All foundation countries already present.');

  // 2. Stamp continent on every document that is missing it
  const missing = await Country.find({
    $or: [{ continent: { $exists: false } }, { continent: null }, { continent: '' }],
  });

  console.log(`\n🌍  Countries missing continent field: ${missing.length}`);

  let updated = 0;
  let skipped = 0;

  for (const doc of missing) {
    const slug = doc.slug || slugify(doc.name || '');
    const continent = getContinentForSlug(slug);
    if (continent) {
      await Country.updateOne({ _id: doc._id }, { $set: { continent } });
      console.log(`   ✔   ${doc.name} (${slug}) → ${continent}`);
      updated++;
    } else {
      console.warn(`   ⚠   ${doc.name} (${slug}) — unknown continent, skipped.`);
      skipped++;
    }
  }

  console.log(`\n📊  Summary:`);
  console.log(`   • Countries upserted  : ${upserted}`);
  console.log(`   • Continent stamped   : ${updated}`);
  console.log(`   • Unknown / skipped   : ${skipped}`);

  await mongoose.disconnect();
  console.log('\n🎉  Migration complete.\n');
}

run().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
