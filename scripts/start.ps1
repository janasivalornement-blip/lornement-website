$projectPath = Split-Path $PSScriptRoot -Parent
$port = 6754
$logDir = Join-Path $projectPath 'logs'
$logPath = Join-Path $logDir 'website.log'
$errorLogPath = Join-Path $logDir 'website-error.log'

$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    $processIds = ($existing.OwningProcess | Sort-Object -Unique) -join ', '
    Write-Host "Website is already running on port $port (PID $processIds)."
    exit 0
}

$nodePath = (Get-Command node -ErrorAction Stop).Source
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$env:STOREFRONT_PORT = [string]$port
Write-Host "Starting website on port $port. Logs: $logPath"
Start-Process -FilePath $nodePath -ArgumentList 'server.js' -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath
