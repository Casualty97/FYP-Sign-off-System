@echo off
rem Owner: Role 3, Jun Kai.
rem Downloads the newest kiosk package (from where this copy was installed from, or GitHub) and updates this
rem install with it, keeping all data. Another source: update.cmd -From <web address, zip file or package folder>
rem The download script runs from a copy in the temp folder, because the update replaces this folder.
rem <Jun Kai start>
setlocal EnableDelayedExpansion
for %%I in ("%~dp0..") do set "KIOSK_ROOT=%%~fI"
set "RPK_TMP=%TEMP%\rpk-update-%RANDOM%%RANDOM%"
mkdir "%RPK_TMP%" >nul 2>&1
copy /y "%~dp0scripts\install\get-kiosk.ps1" "%RPK_TMP%\" >nul
cd /d "%TEMP%"
(
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%RPK_TMP%\get-kiosk.ps1" -InstallDir "!KIOSK_ROOT!" -Update %*
  set "CODE=!ERRORLEVEL!"
  rd /s /q "%RPK_TMP%" >nul 2>&1
  if "%~1"=="" pause
  exit /b !CODE!
)
rem <Jun Kai end>
