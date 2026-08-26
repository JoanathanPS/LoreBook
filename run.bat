@echo off
cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies, first run only...
    call npm install
)

echo Starting LoreBook dev server...
start "LoreBook Dev Server" cmd /k npm run dev

timeout /t 5 /nobreak > nul
start "" http://localhost:3000
