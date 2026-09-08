@echo off
echo Starting CareerForge Always-On Voice Server, Python AI Brain, and Next.js Dev Server...
start "CareerForge Voice Streaming Hub" cmd /k "node server/voice-stream-server.mjs"
start "CareerForge Python AI Brain" cmd /k "python python_ai/server.py"
start "CareerForge Next.js Dev" cmd /k "npm run dev"
echo All servers launched!

