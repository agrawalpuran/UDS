# PowerShell script to create a backup of the uniform distribution system
# Usage: .\scripts\create-backup.ps1

$projectRoot = Split-Path -Parent $PSScriptRoot
$parentDir = Split-Path -Parent $projectRoot
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupName = "uniform-distribution-system-backup-$timestamp"
$backupPath = Join-Path $parentDir $backupName

Write-Host "Creating backup..." -ForegroundColor Cyan
Write-Host "Source: $projectRoot" -ForegroundColor Gray
Write-Host "Destination: $backupPath" -ForegroundColor Gray

# Copy the project, excluding node_modules and .next
Copy-Item -Path $projectRoot -Destination $backupPath -Recurse -Exclude "node_modules",".next" -Force

Write-Host ""
Write-Host "✅ Code backup created successfully!" -ForegroundColor Green
Write-Host "📁 Backup location: $backupPath" -ForegroundColor Green
Write-Host ""
Write-Host "Backup includes:" -ForegroundColor Yellow
Write-Host "  ✓ All source code files" -ForegroundColor White
Write-Host "  ✓ Configuration files" -ForegroundColor White
Write-Host "  ✓ Scripts" -ForegroundColor White
Write-Host "  ✓ Documentation" -ForegroundColor White
Write-Host ""
Write-Host "Excluded (can be regenerated):" -ForegroundColor Yellow
Write-Host "  ✗ node_modules (run 'npm install' to restore)" -ForegroundColor White
Write-Host "  ✗ .next (run 'npm run build' to regenerate)" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Database NOT included in this backup!" -ForegroundColor Yellow
Write-Host "   To backup database, run: npm run backup-db" -ForegroundColor White

