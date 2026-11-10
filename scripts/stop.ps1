. (Join-Path $PSScriptRoot 'common.ps1')

$processIds = Get-WebsiteListeners
if ($processIds.Count -eq 0) {
    Write-Host "Website is not running on port $script:Port."
    exit 0
}

$processes = foreach ($processId in $processIds) {
    $process = Get-WebsiteProcessInfo -ProcessId $processId
    if (-not (Test-WebsiteProcess -Process $process)) {
        Write-Error "Refusing to stop PID ${processId}: it owns port $script:Port but is not identifiable as this website's Node.js server."
        exit 1
    }
    $process
}

foreach ($process in $processes) {
    Write-Host "Stopping website process ID $($process.ProcessId)"
    Stop-Process -Id $process.ProcessId -ErrorAction Stop
}

for ($attempt = 0; $attempt -lt 10 -and (Get-WebsiteListeners).Count -gt 0; $attempt++) {
    Start-Sleep -Milliseconds 300
}
if ((Get-WebsiteListeners).Count -gt 0) {
    Write-Error "Website is still listening on port $script:Port."
    exit 1
}

Write-Host 'Website stopped. Startup remains enabled; use scripts\remove-startup.ps1 to disable automatic startup.'
