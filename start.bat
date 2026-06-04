@echo off
cd /d "%~dp0"
set "NODE=node"
where node >nul 2>&1
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\Programs\cursor\resources\app\resources\helpers\node.exe" (
    set "NODE=%LOCALAPPDATA%\Programs\cursor\resources\app\resources\helpers\node.exe"
  ) else (
    echo Node.js was not found. Install from https://nodejs.org or open this folder in Cursor and run: node server.js
    pause
    exit /b 1
  )
)

echo.
echo  ITC Guest Behaviour Report
echo  ========================================
echo  Do NOT open index.html directly in the browser.
echo  Use this URL after the server starts:
echo.
echo    http://127.0.0.1:8000
echo.
echo  Press Ctrl+C to stop the server.
echo  ========================================
echo.

set "PORT=8000"
set "NEED_START=1"

REM Health must include reportApi (v2 server with live data)
powershell -NoProfile -Command ^
  "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:%PORT%/health' -TimeoutSec 3; if ($r.reportApi) { exit 0 } else { exit 2 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  echo  Server already running with live data API on port %PORT%.
  set "NEED_START=0"
) else (
  echo  Starting fresh server ^(old or missing API on port %PORT%^)...
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
    echo  Stopping old process on port %PORT% PID %%p
    taskkill /F /PID %%p >nul 2>&1
  )
  timeout /t 2 /nobreak >nul
)

if "%NEED_START%"=="0" (
  start "" "http://127.0.0.1:%PORT%"
  echo  Opened browser. If it did not open, copy: http://127.0.0.1:%PORT%
  pause
  exit /b 0
)

start "" "http://127.0.0.1:%PORT%"
"%NODE%" server.js
if errorlevel 1 (
  echo.
  echo  Server failed to start. Port %PORT% may still be in use.
  echo  Try: set PORT=8080 ^& node server.js
  echo  Then open: http://127.0.0.1:8080
  pause
  exit /b 1
)
pause
