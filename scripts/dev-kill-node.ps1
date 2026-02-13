Write-Host "Killing all node.exe processes..." -ForegroundColor Yellow
$procs = Get-Process -Name node -ErrorAction SilentlyContinue
if ($procs) {
  $procs | Stop-Process -Force
}
Write-Host "Done." -ForegroundColor Green
