Write-Host "========================================" -ForegroundColor Green
Write-Host "启动后端服务" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$backendPath = Join-Path $PSScriptRoot "backend"
Set-Location $backendPath

Write-Host "当前目录: $PWD" -ForegroundColor Cyan
Write-Host ""

Write-Host "正在启动uvicorn服务..." -ForegroundColor Yellow
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
