@echo off
echo Starting Backend Server...
cd /d "%~dp0server"
npm run dev
pause
