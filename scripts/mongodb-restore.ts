import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const execAsync = promisify(exec);

interface RestoreOptions {
  mongoUri: string;
  backupDir: string;
  backupFile?: string;
  dropDatabase?: boolean;
  dryRun?: boolean;
}

class MongoDBRestore {
  private options: RestoreOptions;

  constructor(options: RestoreOptions) {
    this.options = options;
  }

  /**
   * List all available backups
   */
  listAvailableBackups(): {
    path: string;
    name: string;
    type: string;
    size: number;
    date: Date;
  }[] {
    const backups: {
      path: string;
      name: string;
      type: string;
      size: number;
      date: Date;
    }[] = [];

    for (const type of ['monthly', 'weekly', 'daily']) {
      const backupDir = path.join(this.options.backupDir, type);

      if (!fs.existsSync(backupDir)) continue;

      const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.zip'))
        .map(f => {
          const filePath = path.join(backupDir, f);
          const stats = fs.statSync(filePath);
          return {
            path: filePath,
            name: f,
            type,
            size: stats.size,
            date: stats.mtime,
          };
        });

      backups.push(...files);
    }

    // Sort by date (newest first)
    return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Extract backup archive
   */
  private async extractBackup(backupPath: string, extractPath: string): Promise<void> {
    console.log('📦 Extracting backup archive...');

    // Ensure extract directory exists
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    if (process.platform === 'win32') {
      // Windows: Use PowerShell Expand-Archive
      const command = `powershell -command "Expand-Archive -Path '${backupPath}' -DestinationPath '${extractPath}' -Force"`;
      await execAsync(command);
    } else {
      // Unix/Linux/Mac: Use unzip
      const command = `unzip -o "${backupPath}" -d "${extractPath}"`;
      await execAsync(command);
    }

    console.log('✅ Backup extracted successfully');
  }

  /**
   * Restore using mongorestore
   */
  private async restoreWithMongorestore(backupPath: string): Promise<void> {
    console.log('\n🔄 Starting MongoDB restore...');

    const tempDir = path.join(this.options.backupDir, 'temp', `restore_${Date.now()}`);

    try {
      // Extract backup
      await this.extractBackup(backupPath, tempDir);

      // Find the actual backup directory (might be nested)
      let restoreDir = tempDir;
      const contents = fs.readdirSync(tempDir);
      
      // If extraction created a subdirectory, use that
      if (contents.length === 1 && fs.statSync(path.join(tempDir, contents[0])).isDirectory()) {
        restoreDir = path.join(tempDir, contents[0]);
      }

      // Check if this is a mongodump backup or mongoose backup
      const isMongodumpBackup = fs.existsSync(path.join(restoreDir, 'admin')) ||
                                fs.readdirSync(restoreDir).some(f => !f.endsWith('.json'));

      if (isMongodumpBackup) {
        await this.restoreWithMongodump(restoreDir);
      } else {
        await this.restoreWithMongoose(restoreDir);
      }

      // Cleanup temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('🧹 Cleaned up temporary files');

    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  /**
   * Restore using mongorestore command
   */
  private async restoreWithMongodump(restoreDir: string): Promise<void> {
    try {
      await execAsync('mongorestore --version');
    } catch {
      throw new Error('mongorestore not found. Please install MongoDB Database Tools.');
    }

    const uri = this.options.mongoUri;
    let restoreCommand = `mongorestore --uri="${uri}"`;

    if (this.options.dropDatabase) {
      restoreCommand += ' --drop';
      console.log('⚠️  --drop flag enabled: existing collections will be dropped before restore');
    }

    restoreCommand += ` "${restoreDir}"`;

    console.log('🔧 Executing mongorestore...');

    if (this.options.dryRun) {
      console.log('🔍 DRY RUN - Command that would be executed:');
      console.log(restoreCommand);
      return;
    }

    const { stdout, stderr } = await execAsync(restoreCommand, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    if (stderr && !stderr.includes('restoring')) {
      console.warn('⚠️  Restore warnings:', stderr);
    }

    console.log('📝 Restore output:', stdout);
    console.log('✅ Database restored successfully using mongorestore!');
  }

  /**
   * Restore using mongoose (for JSON backups)
   */
  private async restoreWithMongoose(restoreDir: string): Promise<void> {
    console.log('🔧 Using mongoose restore (JSON backup detected)...');

    if (this.options.dryRun) {
      console.log('🔍 DRY RUN - Would restore from:', restoreDir);
      const jsonFiles = fs.readdirSync(restoreDir).filter(f => f.endsWith('.json'));
      console.log('Collections to restore:', jsonFiles.map(f => f.replace('.json', '')));
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mongoose = require('mongoose');

    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(this.options.mongoUri);
      console.log('✅ Connected to MongoDB');
    }

    // Get all JSON files
    const jsonFiles = fs.readdirSync(restoreDir).filter(f => f.endsWith('.json'));

    console.log(`📚 Found ${jsonFiles.length} collections to restore`);

    for (const file of jsonFiles) {
      const collectionName = file.replace('.json', '');
      const filePath = path.join(restoreDir, file);

      console.log(`  📄 Restoring collection: ${collectionName}`);

      // Read data
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (!Array.isArray(data) || data.length === 0) {
        console.log(`     ℹ️  Skipping empty collection: ${collectionName}`);
        continue;
      }

      // Drop collection if requested
      if (this.options.dropDatabase) {
        try {
          await mongoose.connection.db.collection(collectionName).drop();
          console.log(`     🗑️  Dropped existing collection: ${collectionName}`);
        } catch {
          // Collection might not exist, that's okay
        }
      }

      // Insert data
      await mongoose.connection.db.collection(collectionName).insertMany(data);
      console.log(`     ✅ Restored ${data.length} documents`);
    }

    console.log('✅ Database restored successfully using mongoose!');
  }

  /**
   * Restore from a specific backup
   */
  async restore(): Promise<void> {
    let backupPath: string;

    if (this.options.backupFile) {
      // Use specified backup file
      backupPath = this.options.backupFile;
      
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }
    } else {
      // Show interactive backup selection
      const backups = this.listAvailableBackups();

      if (backups.length === 0) {
        throw new Error('No backups found');
      }

      console.log('\n📂 Available Backups:\n');
      backups.forEach((backup, index) => {
        const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
        const date = backup.date.toLocaleString();
        console.log(`${index + 1}. [${backup.type.toUpperCase()}] ${backup.name}`);
        console.log(`   Date: ${date} | Size: ${sizeMB} MB`);
        console.log('');
      });

      // Get user selection
      const selection = await this.promptUser(
        `\nSelect backup to restore (1-${backups.length}): `
      );

      const selectedIndex = parseInt(selection) - 1;

      if (selectedIndex < 0 || selectedIndex >= backups.length) {
        throw new Error('Invalid selection');
      }

      backupPath = backups[selectedIndex].path;
    }

    console.log(`\n📦 Selected backup: ${path.basename(backupPath)}`);

    // Confirmation
    if (!this.options.dryRun) {
      const confirm = await this.promptUser(
        '\n⚠️  WARNING: This will restore the database. Continue? (yes/no): '
      );

      if (confirm.toLowerCase() !== 'yes') {
        console.log('❌ Restore cancelled by user');
        return;
      }
    }

    // Perform restore
    await this.restoreWithMongorestore(backupPath);

    console.log('\n✅ Restore completed successfully!');
  }

  /**
   * Prompt user for input
   */
  private promptUser(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise(resolve => {
      rl.question(question, answer => {
        rl.close();
        resolve(answer);
      });
    });
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupPath: string): Promise<boolean> {
    console.log('\n🔍 Verifying backup integrity...');

    const tempDir = path.join(this.options.backupDir, 'temp', `verify_${Date.now()}`);

    try {
      // Extract backup
      await this.extractBackup(backupPath, tempDir);

      // Check contents
      const contents = fs.readdirSync(tempDir);
      
      if (contents.length === 0) {
        console.error('❌ Backup is empty');
        return false;
      }

      // Basic validation
      let hasData = false;
      
      function checkDir(dir: string) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            checkDir(filePath);
          } else if (stat.size > 0) {
            hasData = true;
          }
        }
      }

      checkDir(tempDir);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });

      if (hasData) {
        console.log('✅ Backup verification successful');
        return true;
      } else {
        console.error('❌ Backup contains no data');
        return false;
      }
    } catch (error) {
      console.error('❌ Backup verification failed:', error);
      
      // Cleanup
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      
      return false;
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  const options: RestoreOptions = {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/discovergroup',
    backupDir: path.join(__dirname, '..', 'backups', 'mongodb'),
    backupFile: args.find(arg => arg.startsWith('--file='))?.split('=')[1],
    dropDatabase: args.includes('--drop'),
    dryRun: args.includes('--dry-run'),
  };

  const restore = new MongoDBRestore(options);

  try {
    if (args.includes('--list')) {
      // List backups only
      const backups = restore.listAvailableBackups();
      
      console.log('\n📂 Available Backups:\n');
      
      if (backups.length === 0) {
        console.log('No backups found');
      } else {
        backups.forEach((backup, index) => {
          const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
          const date = backup.date.toLocaleString();
          console.log(`${index + 1}. [${backup.type.toUpperCase()}] ${backup.name}`);
          console.log(`   Path: ${backup.path}`);
          console.log(`   Date: ${date} | Size: ${sizeMB} MB`);
          console.log('');
        });
      }
      
      return;
    }

    if (args.includes('--verify')) {
      // Verify backup
      if (!options.backupFile) {
        console.error('❌ Please specify a backup file with --file=<path>');
        process.exit(1);
      }

      const isValid = await restore.verifyBackup(options.backupFile);
      process.exit(isValid ? 0 : 1);
      return;
    }

    // Perform restore
    await restore.restore();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Restore failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { MongoDBRestore, RestoreOptions };
