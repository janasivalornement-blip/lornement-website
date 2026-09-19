$projectPath = (Split-Path $PSScriptRoot -Parent).TrimEnd('\')
$port = 6754

$processIds = @(
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess
)

if (-not $processIds) {
    $processIds = @(
        Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -and $_.CommandLine -match '(?i)(^|[\\/ ])server\.js([\\" ]|$)' -and $_.CommandLine -like "*$projectPath*" } |
            Select-Object -ExpandProperty ProcessId
    )
}

$processIds = @($processIds | Sort-Object -Unique)
if (-not $processIds) {
    Write-Host "Website is not running."
    exit 0
}

foreach ($processId in $processIds) {
    Write-Host "Stopping website process ID $processId"
    Stop-Process -Id $processId -Force -ErrorAction Stop
}

Start-Sleep -Milliseconds 300
if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    Write-Error "Website is still listening on port $port."
    exit 1
}

Write-Host "Website stopped."
