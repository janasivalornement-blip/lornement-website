$script:ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:ScriptsDirectory = $PSScriptRoot
$script:ServerPath = Join-Path $script:ProjectPath 'server.js'
$script:Port = 6754
$script:StartupTaskName = 'LOrnementWebsiteAutoStart'
$script:LogDirectory = Join-Path $script:ProjectPath 'logs'
$script:StartupShortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) "L'Ornement Website.lnk"

function Get-WebsiteListeners {
    @(Get-NetTCPConnection -LocalPort $script:Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
}

function Get-WebsiteProcessInfo {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
}

function Test-WebsiteProcess {
    param([Parameter(Mandatory = $true)]$Process)

    if (-not $Process -or [IO.Path]::GetFileName($Process.ExecutablePath) -ine 'node.exe') {
        return $false
    }

    $commandLine = [string]$Process.CommandLine
    return $commandLine.IndexOf($script:ServerPath, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
        $commandLine -match '(?i)(^|[\s"\\/])server\.js([\s"]|$)'
}

function Get-WebsiteHealth {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$script:Port/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        [pscustomobject]@{
            Healthy = [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400
            StatusCode = [int]$response.StatusCode
            Error = $null
        }
    } catch {
        [pscustomobject]@{
            Healthy = $false
            StatusCode = $null
            Error = $_.Exception.Message
        }
    }
}

function Install-WebsiteStartupShortcut {
    param([Parameter(Mandatory = $true)][string]$PowerShellPath)

    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($script:StartupShortcutPath)
    $shortcut.TargetPath = $PowerShellPath
    $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f (Join-Path $script:ScriptsDirectory 'start.ps1')
    $shortcut.WorkingDirectory = $script:ProjectPath
    $shortcut.WindowStyle = 7
    $shortcut.Save()
}

function Remove-WebsiteStartupShortcut {
    if (Test-Path $script:StartupShortcutPath) {
        Remove-Item $script:StartupShortcutPath -Force -ErrorAction Stop
    }
}
