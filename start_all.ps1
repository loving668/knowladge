Write-Host "========================================" -ForegroundColor Green
Write-Host "启动所有服务" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# 启动后端
$backendJob = Start-Job -ScriptBlock {
    Set-Location "E:\AI项目\前端设计\backend"
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

# 启动前端
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "E:\AI项目\前端设计\frontend"
    npm run dev
}

Write-Host ""
Write-Host "服务启动中..." -ForegroundColor Yellow
Write-Host "- 后端: http://localhost:8000" -ForegroundColor Cyan
Write-Host "- 前端: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Gray

# 等待所有作业
Wait-Job $backendJob, $frontendJob

# 输出结果
Receive-Job $backendJob
Receive-Job $frontendJob
