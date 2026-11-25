@echo off
rem Owner: Role 3, Jun Kai.
rem Removes this install of the kiosk. Visitor data is kept unless -RemoveData is added.
rem The scripts run from a copy in the temp folder, because this folder is deleted while they run; the last lines
rem sit in one block so Windows has read them before this file is gone.
rem <Jun Kai start>
setlocal EnableDelayedExpansion
for %%I in ("%~dp0..") do set "KIOSK_ROOT=%%~fI"
set "RPK_TMP=%TEMP%\rpk-uninstall-%RANDOM%%RANDOM%"
mkdir "%RPK_TMP%" >nul 2>&1
copy /y "%~dp0scripts\install\package\*.ps1" "%RPK_TMP%\" >nul
cd /d "%TEMP%"
(
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%RPK_TMP%\Uninstall-Kiosk.ps1" %*
  set "CODE=!ERRORLEVEL!"
  rd /s /q "%RPK_TMP%" >nul 2>&1
  if "%~1"=="" pause
  exit /b !CODE!
)
rem <Jun Kai end>
