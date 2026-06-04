@echo off
cd /d "%~dp0"
echo ITC Usage Report - build
if exist raw_report_*.json (
  echo.
  echo Found raw_report JSON - regenerating embedded data...
  node scripts\raw-to-report\build-from-raw.js
  if errorlevel 1 (
    echo Raw pipeline FAILED.
    pause
    exit /b 1
  )
)
node scripts\finish-all.js
if errorlevel 1 (
  echo Build FAILED.
  pause
  exit /b 1
)
echo.
echo Build OK. Start with: node server.js
echo Open http://127.0.0.1:8000
pause
