/**
 * Alternative backup scheduler using node-cron
 * This can run as a long-running Node.js process
 * Useful for development or when Windows Task Scheduler is not preferred
 */

import cron from 'node-cron';
import { MongoDBBackup } from './mongodb-backup';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface SchedulerConfig {
  schedule: string; // Cron expression
  mongoUri: string;
  backupDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess?: (metadata: any) => void;
  onError?: (error: Error) => void;
}

class BackupScheduler {
  private config: SchedulerConfig;
  private task: cron.ScheduledTask | null = null;

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  /**
   * Start the backup scheduler
   */
  start(): void {
    console.log('🚀 Starting MongoDB Backup Scheduler...');
    console.log(`📅 Schedule: ${this.config.schedule}`);
    console.log(`💾 Backup directory: ${this.config.backupDir}\n`);

    // Validate cron expression
    if (!cron.validate(this.config.schedule)) {
      throw new Error(`Invalid cron expression: ${this.config.schedule}`);
    }

    // Create scheduled task
    this.task = cron.schedule(this.config.schedule, async () => {
      await this.runBackup();
    });

    console.log('✅ Scheduler started successfully!');
    console.log('   The backup will run according to the schedule.');
    console.log('   Press Ctrl+C to stop.\n');

    // Show next scheduled run
    this.showNextRun();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      console.log('⏹️  Scheduler stopped');
    }
  }

  /**
   * Run backup job
   */
  private async runBackup(): Promise<void> {
    const now = new Date();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`⏰ Scheduled backup started at: ${now.toLocaleString()}`);
    console.log('='.repeat(60));

    try {
      const backup = new MongoDBBackup({
        mongoUri: this.config.mongoUri,
        backupDir: this.config.backupDir,
        retentionPolicy: {
          daily: 7,
          weekly: 4,
          monthly: 12,
        },
      });

      // Create backup
      const metadata = await backup.createBackup();

      // Clean old backups
      await backup.cleanOldBackups();

      // Show stats
      const stats = backup.getBackupStats();
      console.log('\n📊 Backup Statistics:');
      console.log(`   Total backups: ${stats.totalBackups}`);
      console.log(`   Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);

      console.log('\n✅ Scheduled backup completed successfully!');

      // Call success callback
      if (this.config.onSuccess) {
        this.config.onSuccess(metadata);
      }

      // Show next run
      this.showNextRun();

    } catch (error) {
      console.error('\n❌ Scheduled backup failed:', error);

      // Call error callback
      if (this.config.onError && error instanceof Error) {
        this.config.onError(error);
      }
    }
  }

  /**
   * Show next scheduled run time
   */
  private showNextRun(): void {
    // This is a simple approximation
    // For more accurate next run time, you'd need a library like cron-parser
    console.log(`\n⏭️  Next backup will run according to schedule: ${this.config.schedule}`);
    console.log('   (e.g., "0 2 * * *" = 2:00 AM daily)\n');
  }

  /**
   * Run backup immediately (manual trigger)
   */
  async runNow(): Promise<void> {
    console.log('🔄 Running manual backup...\n');
    await this.runBackup();
  }
}

// Predefined schedules
const SCHEDULES = {
  DAILY_2AM: '0 2 * * *',        // Every day at 2:00 AM
  DAILY_3AM: '0 3 * * *',        // Every day at 3:00 AM
  DAILY_MIDNIGHT: '0 0 * * *',   // Every day at midnight
  EVERY_6_HOURS: '0 */6 * * *',  // Every 6 hours
  EVERY_12_HOURS: '0 */12 * * *',// Every 12 hours
  TWICE_DAILY: '0 2,14 * * *',   // 2:00 AM and 2:00 PM
  WEEKLY_SUNDAY: '0 2 * * 0',    // Every Sunday at 2:00 AM
};

// CLI execution
async function main() {
  const args = process.argv.slice(2);

  // Configuration
  const config: SchedulerConfig = {
    schedule: process.env.BACKUP_SCHEDULE || SCHEDULES.DAILY_2AM,
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/discovergroup',
    backupDir: path.join(__dirname, '..', 'backups', 'mongodb'),
  };

  const scheduler = new BackupScheduler(config);

  // Handle CLI arguments
  if (args.includes('--now')) {
    // Run backup immediately and exit
    console.log('Running backup immediately...\n');
    await scheduler.runNow();
    process.exit(0);
  }

  if (args.includes('--help')) {
    console.log(`
MongoDB Backup Scheduler

Usage:
  npm run backup:schedule              Start the scheduler
  npm run backup:schedule -- --now     Run backup immediately
  npm run backup:schedule -- --help    Show this help

Environment Variables:
  BACKUP_SCHEDULE   Cron expression (default: 0 2 * * * = 2:00 AM daily)
  MONGODB_URI       MongoDB connection string

Predefined Schedules:
  - Daily at 2:00 AM:       0 2 * * *
  - Daily at 3:00 AM:       0 3 * * *
  - Daily at midnight:      0 0 * * *
  - Every 6 hours:          0 */6 * * *
  - Every 12 hours:         0 */12 * * *
  - Twice daily (2AM, 2PM): 0 2,14 * * *
  - Weekly (Sunday 2AM):    0 2 * * 0

Cron Expression Format:
  * * * * *
  │ │ │ │ │
  │ │ │ │ └─── Day of week (0-7, 0 and 7 = Sunday)
  │ │ │ └───── Month (1-12)
  │ │ └─────── Day of month (1-31)
  │ └───────── Hour (0-23)
  └─────────── Minute (0-59)

Examples:
  export BACKUP_SCHEDULE="0 3 * * *"      # 3:00 AM daily
  export BACKUP_SCHEDULE="0 */6 * * *"    # Every 6 hours
`);
    process.exit(0);
  }

  // Start scheduler
  scheduler.start();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
    scheduler.stop();
    process.exit(0);
  });

  // Run initial backup on startup if requested
  if (args.includes('--run-on-start')) {
    console.log('Running initial backup on startup...\n');
    await scheduler.runNow();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { BackupScheduler, SchedulerConfig, SCHEDULES };
