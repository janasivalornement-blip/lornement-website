$port = 6754
$connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

Write-Host "L'Ornement website status" -ForegroundColor Cyan
if ($connections) {
    $processIds = ($connections.OwningProcess | Sort-Object -Unique) -join ', '
    Write-Host "Running on port $port (PID $processIds)" -ForegroundColor Green
    Write-Host "Local URL: http://localhost:$port/"
} else {
    Write-Host "Stopped (port $port is not listening)" -ForegroundColor Yellow
}
