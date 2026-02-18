# MongoDB Backup & Restore System

Complete automated backup and restore solution for DiscoverGroup MongoDB database with retention policies, scheduling, and disaster recovery capabilities.

## 📋 Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Backup System](#backup-system)
- [Restore System](#restore-system)
- [Automation](#automation)
- [Retention Policy](#retention-policy)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **Automated Daily Backups**: Scheduled backups with Windows Task Scheduler or Node.js cron
- **Smart Retention**: 7 daily, 4 weekly, 12 monthly backups with automatic cleanup
- **Dual Backup Methods**: 
  - Native `mongodump` (preferred, requires MongoDB Database Tools)
  - Mongoose-based JSON export (fallback, always works)
- **Compression**: All backups are automatically compressed to .zip format
- **Restore Capabilities**: Interactive or command-line restore with verification
- **Backup Verification**: Integrity checking before restore
- **Detailed Logging**: Complete audit trail of all backup operations

## 🚀 Quick Start

### Prerequisites

```powershell
# Install required dependencies
npm install

# Optional: Install MongoDB Database Tools for faster backups
# Download from: https://www.mongodb.com/try/download/database-tools
# Or use chocolatey:
choco install mongodb-database-tools
```

### Run Your First Backup

```powershell
# Manual backup (one-time)
npm run backup

# Or using ts-node directly
npx ts-node scripts/mongodb-backup.ts
```

### Restore from Backup

```powershell
# Interactive restore (select from list)
npm run backup:restore

# Restore specific backup file
npm run backup:restore -- --file="backups/mongodb/daily/backup_daily_2026-02-18_02-00-00.zip"

# List available backups
npm run backup:restore -- --list

# Verify backup integrity
npm run backup:restore -- --verify --file="path/to/backup.zip"
```

## 💾 Backup System

### How It Works

1. **Determines Backup Type**: 
   - 1st of month → Monthly backup
   - Sunday → Weekly backup
   - Other days → Daily backup

2. **Creates Backup**: Uses `mongodump` or Mongoose fallback

3. **Compresses**: Creates .zip archive

4. **Stores**: Saves to appropriate directory (daily/weekly/monthly)

5. **Cleans**: Removes old backups based on retention policy

### Backup Structure

```
backups/
└── mongodb/
    ├── daily/
    │   ├── backup_daily_2026-02-18_02-00-00.zip
    │   ├── backup_daily_2026-02-17_02-00-00.zip
    │   └── ... (7 total)
    ├── weekly/
    │   ├── backup_weekly_2026-02-16_02-00-00.zip
    │   └── ... (4 total)
    ├── monthly/
    │   ├── backup_monthly_2026-02-01_02-00-00.zip
    │   └── ... (12 total)
    ├── temp/
    │   └── (temporary extraction directories)
    └── backup-log.json
```

### Manual Backup Commands

```powershell
# Run backup now
npm run backup

# View backup statistics
npm run backup:stats

# Force specific backup type (development only)
npx ts-node scripts/mongodb-backup.ts --type=weekly
```

### Backup Metadata

Each backup is logged in `backup-log.json`:

```json
{
  "timestamp": "2026-02-18T02:00:00.000Z",
  "filename": "backup_daily_2026-02-18_02-00-00",
  "size": 52428800,
  "type": "daily",
  "success": true
}
```

## 🔄 Restore System

### Interactive Restore

```powershell
npm run backup:restore
```

This will:
1. Show all available backups
2. Let you select which one to restore
3. Ask for confirmation
4. Perform the restore

### Command-Line Restore

```powershell
# Restore specific backup
npm run backup:restore -- --file="backups/mongodb/daily/backup_daily_2026-02-18_02-00-00.zip"

# Restore and drop existing collections (DESTRUCTIVE!)
npm run backup:restore -- --file="..." --drop

# Dry run (preview without making changes)
npm run backup:restore -- --file="..." --dry-run
```

### List Backups

```powershell
npm run backup:restore -- --list
```

Output:
```
📂 Available Backups:

1. [MONTHLY] backup_monthly_2026-02-01_02-00-00.zip
   Date: 2/1/2026, 2:00:00 AM | Size: 50.00 MB

2. [WEEKLY] backup_weekly_2026-02-16_02-00-00.zip
   Date: 2/16/2026, 2:00:00 AM | Size: 52.34 MB

3. [DAILY] backup_daily_2026-02-18_02-00-00.zip
   Date: 2/18/2026, 2:00:00 AM | Size: 52.50 MB
```

### Verify Backup

```powershell
# Verify backup integrity before restore
npm run backup:restore -- --verify --file="backups/mongodb/daily/backup_2026-02-18.zip"
```

## ⚙️ Automation

### Option 1: Windows Task Scheduler (Recommended for Production)

```powershell
# Run setup script
.\scripts\setup-backup-automation.ps1
```

This will:
1. Create a batch file to run backups
2. Set up Windows Task Scheduler task
3. Configure daily execution at your chosen time
4. Enable logging to `logs/backup.log`

**Manual Task Scheduler Setup:**

1. Open Task Scheduler
2. Create Basic Task → "DiscoverGroup MongoDB Backup"
3. Trigger: Daily at 2:00 AM
4. Action: Start a program
   - Program: `cmd.exe`
   - Arguments: `/c "C:\path\to\project\scripts\run-mongodb-backup.bat"`
5. Settings: Run whether user is logged on or not

### Option 2: Node.js Scheduler (Development/Docker)

```powershell
# Install cron dependency
npm install node-cron
npm install --save-dev @types/node-cron

# Start scheduler (runs as long-running process)
npm run backup:schedule

# Or with custom schedule
$env:BACKUP_SCHEDULE="0 3 * * *"  # 3 AM daily
npm run backup:schedule

# Run backup immediately
npm run backup:schedule -- --now
```

### Cron Schedule Examples

```bash
0 2 * * *       # Every day at 2:00 AM
0 3 * * *       # Every day at 3:00 AM
0 0 * * *       # Every day at midnight
0 */6 * * *     # Every 6 hours
0 */12 * * *    # Every 12 hours
0 2,14 * * *    # 2:00 AM and 2:00 PM
0 2 * * 0       # Every Sunday at 2:00 AM
0 2 1 * *       # First day of month at 2:00 AM
```

### Environment Variables

Create a `.env` file with:

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/discovergroup

# Backup Schedule (cron expression)
BACKUP_SCHEDULE=0 2 * * *

# Optional: Backup directory (default: backups/mongodb)
BACKUP_DIR=./backups/mongodb
```

## 📅 Retention Policy

### Default Policy

- **Daily Backups**: Keep 7 (last week)
- **Weekly Backups**: Keep 4 (last month)
- **Monthly Backups**: Keep 12 (last year)

### How It Works

```
Day of Month = 1st  → Monthly Backup → Keep 12
Day of Week = Sunday → Weekly Backup → Keep 4
All Other Days       → Daily Backup  → Keep 7
```

### Storage Estimates

Assuming 50 MB per backup:

```
Daily:   7 × 50 MB  = 350 MB
Weekly:  4 × 50 MB  = 200 MB
Monthly: 12 × 50 MB = 600 MB
Total:               ~1.15 GB
```

### Customize Retention

Edit `scripts/mongodb-backup.ts`:

```typescript
const config: BackupConfig = {
  retentionPolicy: {
    daily: 14,   // Keep 14 daily backups
    weekly: 8,   // Keep 8 weekly backups
    monthly: 24, // Keep 24 monthly backups
  },
};
```

## 🎯 Best Practices

### 1. Test Backups Regularly

```powershell
# Monthly: Verify a backup can be restored
npm run backup:restore -- --verify --file="path/to/backup.zip"

# Quarterly: Perform full restore to test environment
npm run backup:restore -- --file="..." --dry-run
```

### 2. Monitor Backup Success

```powershell
# Check backup logs
Get-Content logs\backup.log -Tail 50

# Check backup-log.json
Get-Content backups\mongodb\backup-log.json | ConvertFrom-Json | Select-Object -Last 5
```

### 3. Off-Site Backups

**Cloudflare R2 (Recommended):**

```typescript
// Add to scripts/mongodb-backup.ts after creating archive
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async uploadToR2(filePath: string) {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const fileStream = fs.createReadStream(filePath);
  const filename = path.basename(filePath);

  await s3.send(new PutObjectCommand({
    Bucket: 'discovergroup-backups',
    Key: `mongodb/${filename}`,
    Body: fileStream,
  }));
}
```

**AWS S3:**
```powershell
# Install AWS CLI
npm install @aws-sdk/client-s3

# Upload after backup
aws s3 cp backups/mongodb/daily/backup.zip s3://your-bucket/mongodb/
```

### 4. Encryption at Rest

```powershell
# Encrypt backup before storage
gpg --symmetric --cipher-algo AES256 backup.zip

# Decrypt before restore
gpg --decrypt backup.zip.gpg > backup.zip
```

### 5. Backup Before Major Changes

```powershell
# Before database migrations
npm run backup

# Before major updates
npm run backup
```

## 🔒 Security Considerations

### 1. Protect Backup Files

```powershell
# Set restrictive permissions
icacls backups /grant:r "$env:USERNAME:(OI)(CI)F" /T
icacls backups /inheritance:r
```

### 2. Secure MongoDB URI

Never commit `.env` file:

```gitignore
.env
.env.local
.env.production
```

### 3. Encrypt Sensitive Backups

For backups containing PII or sensitive data:

```powershell
# Encrypt before off-site storage
7z a -p -mhe=on backup-encrypted.7z backup.zip
```

## 🧪 Testing

### Test Backup

```powershell
# Create test database
$env:MONGODB_URI="mongodb://localhost:27017/discovergroup-test"

# Run backup
npm run backup

# Verify
npm run backup:restore -- --list
```

### Test Restore

```powershell
# Restore to test database
$env:MONGODB_URI="mongodb://localhost:27017/discovergroup-test"
npm run backup:restore -- --file="..."

# Verify data
mongosh discovergroup-test --eval "db.tours.countDocuments()"
```

## ❗ Troubleshooting

### Problem: "mongodump not found"

**Solution:**
```powershell
# Install MongoDB Database Tools
choco install mongodb-database-tools

# Or download from:
# https://www.mongodb.com/try/download/database-tools

# Fallback: Script will use Mongoose backup automatically
```

### Problem: "Cannot connect to MongoDB"

**Solution:**
```powershell
# Check MongoDB URI
echo $env:MONGODB_URI

# Test connection
mongosh "$env:MONGODB_URI" --eval "db.runCommand({ ping: 1 })"

# Check .env file exists
Test-Path .env
```

### Problem: "Task failed with error 0x1"

**Solution:**
```powershell
# Check logs
Get-Content logs\backup.log -Tail 20

# Ensure batch file has correct paths
Get-Content scripts\run-mongodb-backup.bat

# Run manually to see errors
.\scripts\run-mongodb-backup.bat
```

### Problem: "Backup size is 0 bytes"

**Solution:**
```powershell
# Check MongoDB has data
mongosh "$env:MONGODB_URI" --eval "db.stats()"

# Verify backup directory permissions
Test-Path backups\mongodb -PathType Container

# Check available disk space
Get-PSDrive C
```

### Problem: "Restore fails with 'no data found'"

**Solution:**
```powershell
# Verify backup integrity
npm run backup:restore -- --verify --file="path/to/backup.zip"

# Check backup is not corrupted
7z t path\to\backup.zip

# Try extracting manually
Expand-Archive path\to\backup.zip -DestinationPath temp
```

## 📊 Monitoring & Alerts

### Monitor Backup Success

Create `scripts/check-backup-health.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const backupLogPath = path.join(__dirname, '..', 'backups', 'mongodb', 'backup-log.json');
const logs = JSON.parse(fs.readFileSync(backupLogPath, 'utf-8'));
const lastBackup = logs[logs.length - 1];

const hoursSinceLastBackup = (Date.now() - new Date(lastBackup.timestamp).getTime()) / 1000 / 60 / 60;

if (hoursSinceLastBackup > 25) {
  console.error(`❌ No backup in ${hoursSinceLastBackup.toFixed(1)} hours!`);
  process.exit(1);
}

if (!lastBackup.success) {
  console.error('❌ Last backup failed!');
  process.exit(1);
}

console.log('✅ Backups are healthy');
```

### Email Notifications

Add to `scripts/mongodb-backup.ts`:

```typescript
import nodemailer from 'nodemailer';

async function sendBackupNotification(success: boolean, metadata: BackupMetadata) {
  const transporter = nodemailer.createTransporter({...});
  
  await transporter.sendMail({
    to: 'admin@discovergroup.com',
    subject: success ? '✅ Backup Successful' : '❌ Backup Failed',
    text: `Backup ${metadata.filename} ${success ? 'completed' : 'failed'}`,
  });
}
```

## 📞 Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review logs: `logs/backup.log`
3. Check backup metadata: `backups/mongodb/backup-log.json`
4. Contact: your-support-email@example.com

## 🔄 Disaster Recovery Plan

### Full Database Loss

1. **Stop Application**: Prevent new data writes
2. **Select Backup**: Choose most recent successful backup
3. **Restore Database**: 
   ```powershell
   npm run backup:restore -- --file="path/to/backup.zip" --drop
   ```
4. **Verify Data**: Check critical collections
5. **Restart Application**: Resume normal operations
6. **Post-Mortem**: Investigate cause of data loss

### Estimated Recovery Time

- **RTO (Recovery Time Objective)**: 30 minutes
- **RPO (Recovery Point Objective)**: 24 hours (daily backups)

### Emergency Contacts

- Database Admin: 
- DevOps Team: 
- Backup System: See this document

---

**Last Updated**: February 2026  
**Version**: 1.0.0  
**Maintained By**: DiscoverGroup Dev Team
