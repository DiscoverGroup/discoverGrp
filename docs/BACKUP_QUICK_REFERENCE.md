# MongoDB Backup System - Quick Reference Card

## 🎯 Most Common Commands

### Create a Backup Now
```powershell
npm run backup
```

### Restore from Backup
```powershell
# Interactive mode (recommended)
npm run backup:restore

# List all available backups
npm run backup:restore -- --list

# Restore specific backup
npm run backup:restore -- --file="backups/mongodb/daily/backup_daily_2026-02-18_02-00-00.zip"
```

### Setup Automated Backups
```powershell
# Windows Task Scheduler (one-time setup)
npm run backup:setup

# Or use Node.js scheduler (runs continuously)
npm run backup:schedule
```

## 📁 Backup Location
```
backups/mongodb/
├── daily/     (7 backups kept)
├── weekly/    (4 backups kept)
└── monthly/   (12 backups kept)
```

## ⏰ Backup Schedule
- **Daily**: Every day except Sunday and 1st of month
- **Weekly**: Every Sunday
- **Monthly**: 1st day of each month

## 🆘 Emergency Recovery

### Full Database Restore
```powershell
# 1. List backups
npm run backup:restore -- --list

# 2. Restore (interactive)
npm run backup:restore

# 3. Or restore specific file
npm run backup:restore -- --file="path/to/backup.zip" --drop
```

### Verify Backup Before Restore
```powershell
npm run backup:restore -- --verify --file="path/to/backup.zip"
```

## 📊 Check Backup Status

### View Recent Logs
```powershell
Get-Content logs\backup.log -Tail 20
```

### Check Backup Metadata
```powershell
Get-Content backups\mongodb\backup-log.json | ConvertFrom-Json | Select-Object -Last 5
```

## ⚙️ Windows Task Management

### View Scheduled Task
```powershell
Get-ScheduledTask -TaskName "DiscoverGroup-MongoDB-Backup"
```

### Run Task Manually
```powershell
Start-ScheduledTask -TaskName "DiscoverGroup-MongoDB-Backup"
```

### Disable/Enable Task
```powershell
Disable-ScheduledTask -TaskName "DiscoverGroup-MongoDB-Backup"
Enable-ScheduledTask -TaskName "DiscoverGroup-MongoDB-Backup"
```

## 🔧 Troubleshooting

### Check MongoDB Connection
```powershell
# Verify MONGODB_URI is set
echo $env:MONGODB_URI

# Test connection
mongosh "$env:MONGODB_URI" --eval "db.runCommand({ ping: 1 })"
```

### Manual Backup Run
```powershell
# Run backup script directly
npx ts-node scripts/mongodb-backup.ts

# Or using batch file
.\scripts\run-mongodb-backup.bat
```

### Check Disk Space
```powershell
Get-PSDrive C
```

## 📞 Need Help?

See full documentation: [docs/MONGODB_BACKUP_GUIDE.md](MONGODB_BACKUP_GUIDE.md)

---
**Remember**: Test your backups regularly! Run a restore to a test database monthly.
