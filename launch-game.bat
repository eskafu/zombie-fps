@echo off
setlocal
cd /d "%~dp0"

REM Try to find a free-ish port; serve defaults to 3000
set PORT=3000

REM Start the static server in a separate window
start "Zombie FPS Server" cmd /c "npx --yes serve . -l %PORT%"

REM Give the server a moment to bind
timeout /t 2 /nobreak >nul

REM Open the game in the default browser
start "" "http://localhost:%PORT%"

endlocal
