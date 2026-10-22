@echo off
title cubit
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js saknas. Installera LTS fran https://nodejs.org och kor start.bat igen.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installerar dependencies, forsta gangen tar det en minut...
  call npm install
  if errorlevel 1 (
    echo npm install misslyckades.
    pause
    exit /b 1
  )
)
echo Startar cubit pa http://localhost:5173
call npm run dev -- --open
pause
