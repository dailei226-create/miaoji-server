Write-Host "Starting dev server on port 3100..." -ForegroundColor Yellow

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

taskkill /F /IM node.exe 2>$null | Out-Null

$env:PORT = "3100"

Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d $root && set PORT=3100 && npm run dev" -WorkingDirectory $root | Out-Null

$ok = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    Invoke-WebRequest "http://127.0.0.1:3100/works" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $ok = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}

if ($ok) {
  Write-Host "OK: http://127.0.0.1:3100/works" -ForegroundColor Green
} else {
  Write-Host "FAIL: http://127.0.0.1:3100/works" -ForegroundColor Red
  Write-Host "Check the new window for backend logs." -ForegroundColor Yellow
  pause
}
