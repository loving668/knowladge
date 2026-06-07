@echo off
echo ========================================
echo 启动后端服务
echo ========================================
cd /d "%~dp0backend"
echo 当前目录: %cd%
echo.
echo 正在启动uvicorn服务...
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause
