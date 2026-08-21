@echo off
cd /d "%~dp0"
title SW-OpenC64
echo SW-OpenC64 - Commodore 64 in the browser
echo.
echo If a browser does not open, go to http://127.0.0.1:8082
echo Leave this window open while you play.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch.ps1"
set ERR=%ERRORLEVEL%
if %ERR% NEQ 0 (
  echo.
  echo Launch failed (code %ERR%).
  echo 1. Try opening http://127.0.0.1:8082 in your browser anyway.
  echo 2. If that page is dead, close other SW-OpenC64 windows and run this again.
  echo 3. First run needs a network connection to download Node.js.
  pause
)
