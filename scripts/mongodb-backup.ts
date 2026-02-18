import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';

const execAsync = promisify(exec);

interface BackupConfig {
  mongoUri: string;
  backupDir: string;
  retentionPolicy: {
    daily: number;    // Keep 7 daily backups
    weekly: number;   // Keep 4 weekly backups
    monthly: number;  // Keep 12 monthly backups
  };
}

interface BackupMetadata {
  timestamp: Date;
  filename: string;
  size: number;
  type: 'daily' | 'weekly' | 'monthly';
  success: boolean;
  error?: string;
}

class MongoDBBackup {
  private config: BackupConfig;
  private backupLogPath: string;

  constructor(config: BackupConfig) {
    this.config = config;
    this.backupLogPath = path.join(config.backupDir, 'backup-log.json');
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
      console.log(`✅ Created backup directory: ${this.config.backupDir}`);
    }

    // Create subdirectories for different backup types
    ['daily', 'weekly', 'monthly', 'temp'].forEach(type => {
      const dir = path.join(this.config.backupDir, type);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Determine backup type based on current date
   */
  private getBackupType(): 'daily' | 'weekly' | 'monthly' {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const dayOfWeek = now.getDay(); // 0 = Sunday

    // First day of month = monthly backup
    if (dayOfMonth === 1) {
      return 'monthly';
    }

    // Sunday = weekly backup
    if (dayOfWeek === 0) {
      return 'weekly';
    }

    // Everything else = daily backup
    return 'daily';
  }

  /**
   * Create a backup using mongodump
   */
  async createBackup(): Promise<BackupMetadata> {
    const backupType = this.getBackupType();
    const timestamp = new Date();
    const dateStr = format(timestamp, 'yyyy-MM-dd_HH-mm-ss');
    const filename = `backup_${backupType}_${dateStr}`;
    const backupPath = path.join(this.config.backupDir, backupType, filename);

    console.log(`\n🔄 Starting ${backupType} MongoDB backup...`);
    console.log(`📁 Backup path: ${backupPath}`);

    const metadata: BackupMetadata = {
      timestamp,
      filename,
      size: 0,
      type: backupType,
      success: false,
    };

    try {
      // Check if mongodump is available
      try {
        await execAsync('mongodump --version');
      } catch {
        console.warn('⚠️  mongodump not found. Using mongoose-based backup...');
        return await this.createMongooseBackup(backupPath, metadata);
      }

      // Parse MongoDB URI to extract connection details
      const uri = this.config.mongoUri;
      let dumpCommand: string;

      if (uri.startsWith('mongodb+srv://') || uri.startsWith('mongodb://')) {
        // Use URI directly
        dumpCommand = `mongodump --uri="${uri}" --out="${backupPath}"`;
      } else {
        throw new Error('Invalid MongoDB URI format');
      }

      // Execute backup
      const { stdout, stderr } = await execAsync(dumpCommand, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      if (stderr && !stderr.includes('writing')) {
        console.warn('⚠️  Backup warnings:', stderr);
      }

      console.log('📝 Backup output:', stdout);

      // Create archive (zip) of the backup
      const archivePath = `${backupPath}.zip`;
      await this.createArchive(backupPath, archivePath);

      // Get backup size
      const stats = fs.statSync(archivePath);
      metadata.size = stats.size;
      metadata.success = true;

      // Remove uncompressed backup directory
      fs.rmSync(backupPath, { recursive: true, force: true });

      console.log(`✅ Backup completed successfully!`);
      console.log(`📦 Archive size: ${(metadata.size / 1024 / 1024).toFixed(2)} MB`);

      // Log backup
      await this.logBackup(metadata);

      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metadata.success = false;
      metadata.error = errorMessage;

      console.error('❌ Backup failed:', errorMessage);

      // Log failed backup
      await this.logBackup(metadata);

      throw error;
    }
  }

  /**
   * Fallback: Create backup using mongoose (without mongodump)
   */
  private async createMongooseBackup(
    backupPath: string,
    metadata: BackupMetadata
  ): Promise<BackupMetadata> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mongoose = require('mongoose');
      
      // Connect to MongoDB if not connected
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(this.config.mongoUri);
      }

      // Get all collections
      const collections = await mongoose.connection.db.listCollections().toArray();
      
      // Create backup directory
      fs.mkdirSync(backupPath, { recursive: true });

      console.log(`📚 Found ${collections.length} collections to backup`);

      // Export each collection
      for (const collection of collections) {
        const collectionName = collection.name;
        console.log(`  📄 Backing up collection: ${collectionName}`);
        
        const data = await mongoose.connection.db
          .collection(collectionName)
          .find({})
          .toArray();
        
        const filePath = path.join(backupPath, `${collectionName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }

      // Create archive
      const archivePath = `${backupPath}.zip`;
      await this.createArchive(backupPath, archivePath);

      // Get backup size
      const stats = fs.statSync(archivePath);
      metadata.size = stats.size;
      metadata.success = true;

      // Remove uncompressed backup directory
      fs.rmSync(backupPath, { recursive: true, force: true });

      console.log(`✅ Mongoose backup completed!`);
      console.log(`📦 Archive size: ${(metadata.size / 1024 / 1024).toFixed(2)} MB`);

      await this.logBackup(metadata);

      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metadata.success = false;
      metadata.error = errorMessage;
      
      console.error('❌ Mongoose backup failed:', errorMessage);
      await this.logBackup(metadata);
      
      throw error;
    }
  }

  /**
   * Create a zip archive of the backup
   */
  private async createArchive(sourcePath: string, archivePath: string): Promise<void> {
    console.log('📦 Creating archive...');
    
    if (process.platform === 'win32') {
      // Windows: Use PowerShell Compress-Archive
      const command = `powershell -command "Compress-Archive -Path '${sourcePath}' -DestinationPath '${archivePath}' -Force"`;
      await execAsync(command);
    } else {
      // Unix/Linux/Mac: Use zip
      const command = `cd "${path.dirname(sourcePath)}" && zip -r "${archivePath}" "${path.basename(sourcePath)}"`;
      await execAsync(command);
    }
  }

  /**
   * Log backup metadata
   */
  private async logBackup(metadata: BackupMetadata): Promise<void> {
    let logs: BackupMetadata[] = [];

    // Read existing logs
    if (fs.existsSync(this.backupLogPath)) {
      const content = fs.readFileSync(this.backupLogPath, 'utf-8');
      logs = JSON.parse(content);
    }

    // Add new log
    logs.push(metadata);

    // Keep only last 100 logs
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }

    // Write logs
    fs.writeFileSync(this.backupLogPath, JSON.stringify(logs, null, 2));
  }

  /**
   * Clean old backups based on retention policy
   */
  async cleanOldBackups(): Promise<void> {
    console.log('\n🧹 Cleaning old backups...');

    for (const type of ['daily', 'weekly', 'monthly'] as const) {
      const backupDir = path.join(this.config.backupDir, type);
      const retention = this.config.retentionPolicy[type];

      if (!fs.existsSync(backupDir)) continue;

      // Get all backups for this type
      const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.zip'))
        .map(f => ({
          name: f,
          path: path.join(backupDir, f),
          mtime: fs.statSync(path.join(backupDir, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Delete old backups
      const toDelete = files.slice(retention);
      
      if (toDelete.length > 0) {
        console.log(`  🗑️  Removing ${toDelete.length} old ${type} backup(s)...`);
        toDelete.forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`     Deleted: ${file.name}`);
        });
      } else {
        console.log(`  ✅ No old ${type} backups to remove (${files.length}/${retention} kept)`);
      }
    }
  }

  /**
   * List all available backups
   */
  listBackups(): { type: string; backups: string[] }[] {
    const result: { type: string; backups: string[] }[] = [];

    for (const type of ['daily', 'weekly', 'monthly']) {
      const backupDir = path.join(this.config.backupDir, type);
      
      if (!fs.existsSync(backupDir)) {
        result.push({ type, backups: [] });
        continue;
      }

      const backups = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.zip'))
        .sort()
        .reverse();

      result.push({ type, backups });
    }

    return result;
  }

  /**
   * Get backup statistics
   */
  getBackupStats(): {
    totalBackups: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  } {
    let totalBackups = 0;
    let totalSize = 0;
    const byType: Record<string, { count: number; size: number }> = {};

    for (const type of ['daily', 'weekly', 'monthly']) {
      const backupDir = path.join(this.config.backupDir, type);
      
      if (!fs.existsSync(backupDir)) {
        byType[type] = { count: 0, size: 0 };
        continue;
      }

      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.zip'));
      const size = files.reduce((acc, file) => {
        return acc + fs.statSync(path.join(backupDir, file)).size;
      }, 0);

      byType[type] = { count: files.length, size };
      totalBackups += files.length;
      totalSize += size;
    }

    return { totalBackups, totalSize, byType };
  }
}

// CLI execution
async function main() {
  const config: BackupConfig = {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/discovergroup',
    backupDir: path.join(__dirname, '..', 'backups', 'mongodb'),
    retentionPolicy: {
      daily: 7,    // Keep 7 daily backups
      weekly: 4,   // Keep 4 weekly backups
      monthly: 12, // Keep 12 monthly backups
    },
  };

  const backup = new MongoDBBackup(config);

  try {
    // Display current stats
    console.log('📊 Current Backup Statistics:');
    const stats = backup.getBackupStats();
    console.log(`   Total backups: ${stats.totalBackups}`);
    console.log(`   Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Daily: ${stats.byType.daily.count} backups (${(stats.byType.daily.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   Weekly: ${stats.byType.weekly.count} backups (${(stats.byType.weekly.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   Monthly: ${stats.byType.monthly.count} backups (${(stats.byType.monthly.size / 1024 / 1024).toFixed(2)} MB)`);

    // Create backup
    await backup.createBackup();

    // Clean old backups
    await backup.cleanOldBackups();

    // Display updated stats
    console.log('\n📊 Updated Backup Statistics:');
    const newStats = backup.getBackupStats();
    console.log(`   Total backups: ${newStats.totalBackups}`);
    console.log(`   Total size: ${(newStats.totalSize / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n✅ Backup process completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Backup process failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { MongoDBBackup, BackupConfig, BackupMetadata };
