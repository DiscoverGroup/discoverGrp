/**
 * Seed demo staff accounts into the database if they don't already exist.
 * Called once at server startup — safe to re-run (idempotent).
 */
import bcrypt from 'bcryptjs';
import User from '../models/User';
import logger from './logger';

const DEMO_ACCOUNTS = [
  { email: 'admin@discovergroup.com',   fullName: 'Administrator',      role: 'administrator' },
  { email: 'booking@discovergroup.com', fullName: 'Booking Department', role: 'booking_department' },
  { email: 'visa@discovergroup.com',    fullName: 'Visa Department',    role: 'visa_department' },
  { email: 'csr@discovergroup.com',     fullName: 'Customer Service',   role: 'csr_department' },
];

export async function seedDemoAccounts(): Promise<void> {
  try {
    const hashedPassword = await bcrypt.hash('demo123', 10);

    for (const account of DEMO_ACCOUNTS) {
      const existing = await User.findOne({ email: account.email });
      if (existing) continue; // already seeded

      await User.create({
        ...account,
        password: hashedPassword,
        isActive: true,
        isArchived: false,
        isEmailVerified: true,
        favorites: [],
      });

      logger.info(`✅ Demo account created: ${account.email} (${account.role})`);
    }
  } catch (error) {
    // Non-fatal — log but don't crash the server
    logger.warn(`⚠️  seedDemoAccounts warning: ${error instanceof Error ? error.message : error}`);
  }
}
