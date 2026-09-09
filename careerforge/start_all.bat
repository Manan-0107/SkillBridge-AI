@echo off
setlocal
cd /d "%~dp0"
echo Starting CareerForge Python AI Brain and Next.js Dev Server...
if exist ".next" rmdir /s /q ".next"
start "CareerForge Python AI Brain" cmd /k "cd /d "%~dp0" && python python_ai/server.py"
start "CareerForge Next.js Dev" cmd /k "cd /d "%~dp0" && npm run dev:clean"
echo Both servers started!
echo Website: http://localhost:3000
endlocal
