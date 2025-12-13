# Stop any running Node processes
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Clear Next.js cache
if (Test-Path .next) {
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
    Write-Host "Cache cleared"
}

# Restart the server
Write-Host "Starting server..."
Write-Host "Server will start in a new window. Check the new PowerShell window for output."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'Starting UDS server on port 3001...'; npm run dev"






