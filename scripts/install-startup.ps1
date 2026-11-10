. (Join-Path $PSScriptRoot 'common.ps1')

$startScript = Join-Path $PSScriptRoot 'start.ps1'
$powerShellPath = Join-Path $PSHOME 'powershell.exe'
$userIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $startScript
$action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $arguments -WorkingDirectory $script:ProjectPath
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT30S'
$principal = New-ScheduledTaskPrincipal -UserId $userIdentity -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

try {
    Register-ScheduledTask -TaskName $script:StartupTaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Starts the L'Ornement website after Windows starts." -Force -ErrorAction Stop | Out-Null
    Remove-WebsiteStartupShortcut
    Write-Host "Windows startup task '$script:StartupTaskName' is installed for $userIdentity."
    Write-Host 'The website will start 30 seconds after Windows starts, even if you have not signed in.'
    Start-ScheduledTask -TaskName $script:StartupTaskName -ErrorAction Stop
} catch {
    if ($_.Exception.Message -notmatch '(?i)access is denied|0x80070005') {
        throw
    }

    Install-WebsiteStartupShortcut -PowerShellPath $powerShellPath
    Write-Warning "Windows denied permission to register a boot task. A current-user Startup shortcut was installed instead; it starts the website when you sign in after a restart. For startup before sign-in, rerun this script from an Administrator PowerShell. Task Scheduler error: $($_.Exception.Message)"
    Start-Process -FilePath $powerShellPath -ArgumentList $arguments -WindowStyle Hidden
}

for ($attempt = 0; $attempt -lt 25; $attempt++) {
    Start-Sleep -Seconds 1
    $health = Get-WebsiteHealth
    if ($health.Healthy) {
        Write-Host "Website is up (HTTP $($health.StatusCode)) at http://localhost:$script:Port/."
        exit 0
    }
}

throw "Startup was configured but the website did not become healthy. $($health.Error) Check logs under $script:LogDirectory."
