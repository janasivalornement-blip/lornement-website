. (Join-Path $PSScriptRoot 'common.ps1')

Write-Host "L'Ornement website status" -ForegroundColor Cyan
$listeners = Get-WebsiteListeners
$healthy = $false
if ($listeners.Count -gt 0) {
    $knownWebsiteProcesses = @($listeners | ForEach-Object {
        Test-WebsiteProcess -Process (Get-WebsiteProcessInfo -ProcessId $_)
    })
    if ($knownWebsiteProcesses -contains $false) {
        Write-Host "Port $script:Port is occupied by a process that is not identifiable as this website." -ForegroundColor Red
    } else {
        $health = Get-WebsiteHealth
    }
    if ($health -and $health.Healthy) {
        $healthy = $true
        Write-Host "Running and responding (HTTP $($health.StatusCode)); PID $($listeners -join ', ')." -ForegroundColor Green
        Write-Host "Local URL: http://localhost:$script:Port/"
    } elseif ($knownWebsiteProcesses -notcontains $false) {
        Write-Host "A process is listening on port $script:Port, but the website health check failed: $($health.Error)" -ForegroundColor Red
    }
} else {
    Write-Host "Stopped (port $script:Port is not listening)." -ForegroundColor Yellow
}

$startupTask = Get-ScheduledTask -TaskName $script:StartupTaskName -ErrorAction SilentlyContinue
if ($startupTask) {
    Write-Host "Startup: enabled (Task Scheduler state: $($startupTask.State))." -ForegroundColor Green
} elseif (Test-Path $script:StartupShortcutPath) {
    Write-Host 'Startup: enabled for the current user at sign-in.' -ForegroundColor Green
} else {
    Write-Host 'Startup: not configured. Run scripts\install-startup.ps1 to enable it.' -ForegroundColor Yellow
}

if (-not $healthy) {
    exit 1
}
