@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 18 or newer, then run this file again.
  pause
  exit /b 1
)
set PORT=8776
start "" "http://127.0.0.1:8776"
node server.js
pause
