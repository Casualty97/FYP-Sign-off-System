@echo off
setlocal
set ROOT=%~dp0
set LOG=%ROOT%logs\restart-app.log
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
(
  echo [%DATE% %TIME%] Restart request received
  echo Waiting briefly for the admin restart response to return...
) >> "%LOG%"

cd /d "%ROOT%"
timeout /t 2 /nobreak >nul

for %%P in (3000 3001 3002 3003) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /C:":%%P " ^| findstr /C:"LISTENING"') do (
    if not "%%A"=="0" (
      echo [%DATE% %TIME%] Stopping Node process %%A on port %%P >> "%LOG%"
      taskkill /PID %%A /F >> "%LOG%" 2>&1
    )
  )
)

timeout /t 2 /nobreak >nul

rem <Jun Kai start> startup-monitor.bat may have started the programs in the gap above. One copy is enough: a
rem second one only fails with "port already in use" in a second window.
netstat -ano | findstr /C:":3000 " | findstr /C:"LISTENING" >nul
if not errorlevel 1 (
  echo [%DATE% %TIME%] Port 3000 is in use again, so the programs were not started a second time >> "%LOG%"
  exit /b 0
)
rem <Jun Kai end>
start "Kiosk App" cmd /k "node startAll.js"

(
  echo [%DATE% %TIME%] Restart command launched
) >> "%LOG%"

exit /b 0
