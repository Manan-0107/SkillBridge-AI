@echo off
echo Starting CareerForge Python AI Brain and Next.js Dev Server...
start "CareerForge Python AI Brain" cmd /k "python python_ai/server.py"
start "CareerForge Next.js Dev" cmd /k "npm run dev"
echo Both servers started!
