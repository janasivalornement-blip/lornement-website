. (Join-Path $PSScriptRoot 'common.ps1')

$listeners = Get-WebsiteListeners
if ($listeners.Count -gt 0) {
    $knownWebsiteProcesses = @($listeners | ForEach-Object {
        Test-WebsiteProcess -Process (Get-WebsiteProcessInfo -ProcessId $_)
    })
    if ($knownWebsiteProcesses -contains $false) {
        Write-Error "Port $script:Port is occupied by a process that is not identifiable as this website. Refusing to report it as running or start another server."
        exit 1
    }

    $health = Get-WebsiteHealth
    if ($health.Healthy) {
        Write-Host "Website is already running and responding on port $script:Port (PID $($listeners -join ', '))."
        exit 0
    }

    Write-Error "Port $script:Port is already in use, but the website health check failed. $($health.Error) Check the listener and logs before starting another process."
    exit 1
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    $knownNodePaths = @(
        (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe')
    )
    $nodePath = $knownNodePaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
} else {
    $nodePath = $nodeCommand.Source
}
if (-not $nodePath) {
    throw 'Node.js (node.exe) was not found. Install Node.js or add it to PATH, then run this script again.'
}
if (-not (Test-Path $script:ServerPath)) {
    throw "Website entry point was not found: $script:ServerPath"
}

New-Item -ItemType Directory -Path $script:LogDirectory -Force | Out-Null
$logPath = Join-Path $script:LogDirectory 'website.log'
$errorLogPath = Join-Path $script:LogDirectory 'website-error.log'
$env:STOREFRONT_PORT = [string]$script:Port
$process = Start-Process -FilePath $nodePath -ArgumentList ('"{0}"' -f $script:ServerPath) -WorkingDirectory $script:ProjectPath -WindowStyle Hidden -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru
Write-Host "Started website process $($process.Id). Waiting for http://localhost:$script:Port/ ..."

for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Seconds 1
    $health = Get-WebsiteHealth
    if ($health.Healthy) {
        Write-Host "Website is up (HTTP $($health.StatusCode))."
        Write-Host "Local URL: http://localhost:$script:Port/"
        Write-Host "Logs: $logPath and $errorLogPath"
        exit 0
    }
    if ($process.HasExited) {
        break
    }
}

$errorTail = if (Test-Path $errorLogPath) { (Get-Content $errorLogPath -Tail 20 -ErrorAction SilentlyContinue) -join [Environment]::NewLine } else { '' }
Write-Error "Website did not become healthy. $($health.Error) See $errorLogPath. $errorTail"
exit 1
