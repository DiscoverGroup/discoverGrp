# MongoDB Automated Backup Setup (Windows Task Scheduler)
# This script sets up a daily automated backup task in Windows Task Scheduler

Write-Host "🔧 MongoDB Backup Automation Setup" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Get the project root directory
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupScriptPath = Join-Path $projectRoot "scripts\mongodb-backup.ts"

# Check if backup script exists
if (-not (Test-Path $backupScriptPath)) {
    Write-Host "❌ Error: Backup script not found at: $backupScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Project root: $projectRoot" -ForegroundColor Gray
Write-Host "📄 Backup script: $backupScriptPath`n" -ForegroundColor Gray

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  WARNING: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "   Some features may require elevated privileges.`n" -ForegroundColor Yellow
}

# Prompt for backup time
Write-Host "⏰ When should the daily backup run?" -ForegroundColor Cyan
$hour = Read-Host "   Enter hour (0-23, default: 2 for 2 AM)"
if ([string]::IsNullOrWhiteSpace($hour)) { $hour = "2" }

$minute = Read-Host "   Enter minute (0-59, default: 0)"
if ([string]::IsNullOrWhiteSpace($minute)) { $minute = "0" }

$backupTime = "{0:D2}:{1:D2}" -f [int]$hour, [int]$minute

Write-Host "`n📅 Backup will run daily at: $backupTime" -ForegroundColor Green

# Create a batch file to run the TypeScript backup script
$batchScriptPath = Join-Path $projectRoot "scripts\run-mongodb-backup.bat"
$batchContent = @"
@echo off
REM MongoDB Backup Runner
REM This batch file is called by Windows Task Scheduler

echo ================================================
echo MongoDB Automated Backup
echo Started: %date% %time%
echo ================================================

cd /d "$projectRoot"

REM Load environment variables from .env file
if exist .env (
    echo Loading environment variables...
    for /f "usebackq tokens=*" %%a in (".env") do (
        set %%a
    )
)

REM Check if we should use ts-node or compiled JavaScript
if exist "dist\scripts\mongodb-backup.js" (
    echo Running compiled backup script...
    node dist\scripts\mongodb-backup.js >> logs\backup.log 2>&1
) else if exist "node_modules\.bin\ts-node.cmd" (
    echo Running TypeScript backup script...
    node_modules\.bin\ts-node.cmd scripts\mongodb-backup.ts >> logs\backup.log 2>&1
) else (
    echo ERROR: Neither compiled script nor ts-node found!
    echo Please run: npm install -g ts-node
    exit /b 1
)

set BACKUP_EXIT_CODE=%ERRORLEVEL%

echo.
echo ================================================
echo Backup completed with exit code: %BACKUP_EXIT_CODE%
echo Finished: %date% %time%
echo ================================================

exit /b %BACKUP_EXIT_CODE%
"@

# Create logs directory if it doesn't exist
$logsDir = Join-Path $projectRoot "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    Write-Host "✅ Created logs directory: $logsDir" -ForegroundColor Green
}

# Write batch file
$batchContent | Out-File -FilePath $batchScriptPath -Encoding ASCII -Force
Write-Host "✅ Created batch script: $batchScriptPath`n" -ForegroundColor Green

# Ask if user wants to create Windows Task Scheduler task
Write-Host "📋 Setup Windows Task Scheduler?" -ForegroundColor Cyan
$setupScheduler = Read-Host "   Create automated task? (Y/N, default: Y)"

if ([string]::IsNullOrWhiteSpace($setupScheduler) -or $setupScheduler -eq "Y" -or $setupScheduler -eq "y") {
    
    $taskName = "DiscoverGroup-MongoDB-Backup"
    
    # Check if task already exists
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    
    if ($existingTask) {
        Write-Host "⚠️  Task '$taskName' already exists" -ForegroundColor Yellow
        $overwrite = Read-Host "   Overwrite? (Y/N, default: Y)"
        
        if ([string]::IsNullOrWhiteSpace($overwrite) -or $overwrite -eq "Y" -or $overwrite -eq "y") {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "✅ Removed existing task" -ForegroundColor Green
        } else {
            Write-Host "❌ Setup cancelled" -ForegroundColor Red
            exit 0
        }
    }
    
    try {
        # Create scheduled task action
        $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batchScriptPath`""
        
        # Create daily trigger
        $trigger = New-ScheduledTaskTrigger -Daily -At $backupTime
        
        # Create task settings
        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -StartWhenAvailable `
            -RunOnlyIfNetworkAvailable `
            -MultipleInstances IgnoreNew
        
        # Create principal (run whether user is logged on or not)
        $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
        
        # Register the task
        Register-ScheduledTask `
            -TaskName $taskName `
            -Action $action `
            -Trigger $trigger `
            -Settings $settings `
            -Principal $principal `
            -Description "Automated daily MongoDB backup for DiscoverGroup travel website" | Out-Null
        
        Write-Host "`n✅ Successfully created scheduled task: $taskName" -ForegroundColor Green
        Write-Host "   Schedule: Daily at $backupTime" -ForegroundColor Gray
        Write-Host "   Log file: $logsDir\backup.log`n" -ForegroundColor Gray
        
        # Test the task
        Write-Host "🧪 Test the backup now?" -ForegroundColor Cyan
        $testNow = Read-Host "   Run backup immediately? (Y/N, default: N)"
        
        if ($testNow -eq "Y" -or $testNow -eq "y") {
            Write-Host "`n🔄 Running backup test...`n" -ForegroundColor Cyan
            Start-ScheduledTask -TaskName $taskName
            Start-Sleep -Seconds 2
            
            # Show task status
            $task = Get-ScheduledTask -TaskName $taskName
            Write-Host "Task Status: $($task.State)" -ForegroundColor Gray
            Write-Host "`nCheck the log file for details: $logsDir\backup.log" -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "❌ Error creating scheduled task: $_" -ForegroundColor Red
        Write-Host "`n💡 You can manually create the task using Task Scheduler:" -ForegroundColor Yellow
        Write-Host "   1. Open Task Scheduler" -ForegroundColor Gray
        Write-Host "   2. Create Basic Task" -ForegroundColor Gray
        Write-Host "   3. Set to run daily at $backupTime" -ForegroundColor Gray
        Write-Host "   4. Action: Start a program" -ForegroundColor Gray
        Write-Host "   5. Program: cmd.exe" -ForegroundColor Gray
        Write-Host "   6. Arguments: /c `"$batchScriptPath`"`n" -ForegroundColor Gray
        exit 1
    }
    
} else {
    Write-Host "`n💡 To manually run backups, execute:" -ForegroundColor Yellow
    Write-Host "   $batchScriptPath`n" -ForegroundColor Gray
}

Write-Host "✅ Setup complete!`n" -ForegroundColor Green

Write-Host "📚 Useful commands:" -ForegroundColor Cyan
Write-Host "   View task:        Get-ScheduledTask -TaskName 'DiscoverGroup-MongoDB-Backup'" -ForegroundColor Gray
Write-Host "   Run task now:     Start-ScheduledTask -TaskName 'DiscoverGroup-MongoDB-Backup'" -ForegroundColor Gray
Write-Host "   Disable task:     Disable-ScheduledTask -TaskName 'DiscoverGroup-MongoDB-Backup'" -ForegroundColor Gray
Write-Host "   Enable task:      Enable-ScheduledTask -TaskName 'DiscoverGroup-MongoDB-Backup'" -ForegroundColor Gray
Write-Host "   Remove task:      Unregister-ScheduledTask -TaskName 'DiscoverGroup-MongoDB-Backup'`n" -ForegroundColor Gray
