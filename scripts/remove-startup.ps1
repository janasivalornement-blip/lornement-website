. (Join-Path $PSScriptRoot 'common.ps1')

$task = Get-ScheduledTask -TaskName $script:StartupTaskName -ErrorAction SilentlyContinue
if (-not $task -and -not (Test-Path $script:StartupShortcutPath)) {
    Write-Host 'Automatic startup is not configured.'
    exit 0
}

if ($task) {
    Unregister-ScheduledTask -TaskName $script:StartupTaskName -Confirm:$false -ErrorAction Stop
}
Remove-WebsiteStartupShortcut
Write-Host 'Automatic startup has been disabled. The website is not stopped; run scripts\stop.ps1 if needed.'
