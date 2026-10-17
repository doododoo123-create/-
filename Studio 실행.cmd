@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 이상을 먼저 설치해 주세요. https://nodejs.org/
  pause
  exit /b 1
)
start "" "http://localhost:3000"
node scripts/serve.mjs
pause
