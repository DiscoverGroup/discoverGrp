/**
 * Seed Demo Admin Accounts
 * Creates the demo staff accounts shown on the admin login page.
 * Run with: node scripts/seed-admin-accounts.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '../apps/api/.env') });
// Fallback to root .env if api/.env missing
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found. Make sure apps/api/.env exists with MONGODB_URI set.');
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: true },
    favorites: { type: [String], default: [] },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', UserSchema);

const DEMO_ACCOUNTS = [
  { email: 'admin@discovergroup.com',   fullName: 'Administrator',     role: 'administrator' },
  { email: 'booking@discovergroup.com', fullName: 'Booking Department', role: 'booking_department' },
  { email: 'visa@discovergroup.com',    fullName: 'Visa Department',    role: 'visa_department' },
  { email: 'csr@discovergroup.com',     fullName: 'Customer Service',   role: 'csr_department' },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const hashedPassword = await bcrypt.hash('demo123', 10);

  for (const account of DEMO_ACCOUNTS) {
    const existing = await User.findOne({ email: account.email });
    if (existing) {
      console.log(`⚠️  Already exists — skipping: ${account.email}`);
      continue;
    }
    await User.create({
      ...account,
      password: hashedPassword,
      isActive: true,
      isArchived: false,
      isEmailVerified: true,
    });
    console.log(`✅ Created: ${account.email}  (${account.role})`);
  }

  console.log('\n🎉 Done! Demo accounts are ready.');
  console.log('   Password for all demo accounts: demo123');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
