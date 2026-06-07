Write-Host "========================================" -ForegroundColor Green
Write-Host "启动前端服务" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$frontendPath = Join-Path $PSScriptRoot "frontend"
Set-Location $frontendPath

Write-Host "当前目录: $PWD" -ForegroundColor Cyan
Write-Host ""

Write-Host "正在启动Vite开发服务器..." -ForegroundColor Yellow
npm run dev
