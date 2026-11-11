# Owner: Role 3, Jun Kai.
# Shared by install.ps1 and uninstall.ps1: the names of what they add to Windows, the dry-run wrapper and small
# helpers. Windows PowerShell 5.1 is enough (the Wall PC may have nothing newer), so: ASCII only, no && or ?? here.
# <Jun Kai start>
# A caller's 'Stop' (GitHub Actions sets it) would end the script at the first native stderr line under 5.1
$ErrorActionPreference = 'Continue'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$SetupJs = Join-Path $PSScriptRoot 'setup.js'
$StateFile = Join-Path $Root 'backend\data\install-state.json'
$FirewallGroup = 'ESG Kiosk'
$FirewallName = 'ESG Kiosk - tablets to the kiosk server'
$KioskPorts = @('3000', '3003')
$WakeTaskName = 'ESG Kiosk Wake'
$WakeTimerSetting = @('238c9fa8-0aad-41ed-83f4-97be242c8f20', 'bd3b718a-0680-4d9d-8ab2-e1d2b4ac806d')
$StartupLink = Join-Path ([Environment]::GetFolderPath('Startup')) 'ESG Kiosk.lnk'
$DesktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'ESG Kiosk Admin.url'

function Write-Step([string]$Text) { Write-Host ''; Write-Host "== $Text" -ForegroundColor Cyan }
function Write-Ok([string]$Text) { Write-Host "   ok    $Text" -ForegroundColor Green }
function Write-Info([string]$Text) { Write-Host "         $Text" }
function Write-Note([string]$Text) { Write-Host "   note  $Text" -ForegroundColor Yellow }
function Write-Bad([string]$Text) { Write-Host "   error $Text" -ForegroundColor Red }

# Makes one change, or on a dry run only says what it would do
function Invoke-Change([string]$What, [scriptblock]$Action) {
    if ($script:DryRun) { Write-Host "   would $What" -ForegroundColor DarkGray; return }
    & $Action
    Write-Ok $What
}

# A yes/no question; with -NonInteractive the default answers it, so a risky question must default to no
function Confirm-Choice([string]$Question, [bool]$Default) {
    if ($script:NonInteractive) { return $Default }
    $hint = '[y/N]'
    if ($Default) { $hint = '[Y/n]' }
    $answer = Read-Host "         $Question $hint"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    return $answer.Trim().ToLower().StartsWith('y')
}

function Test-Admin {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# node.exe processes started from this folder: their command line names a file inside it (startAll.js, server.js,
# kioskServer.js). Never "every node.exe" and never "whatever listens on port 3000".
function Get-KioskProcesses {
    $needle = ($Root.TrimEnd('\') + '\').ToLowerInvariant()
    $all = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue)
    $mine = @($all | Where-Object { $_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($needle) })
    $ids = @($mine | ForEach-Object { $_.ProcessId })
    $parents = @($all | Where-Object { ($ids -contains $_.ProcessId) -eq $false -and $_.CommandLine -match 'startAll\.js' -and (@($mine | Where-Object ParentProcessId -eq $_.ProcessId).Count -gt 0) })
    return @($mine + $parents)
}

# Allow wake timers, read from the active power plan: 0 off, 1 on, 2 important ones only (AC = plugged in)
function Get-WakeTimers {
    $out = (& powercfg /q SCHEME_CURRENT $WakeTimerSetting[0] $WakeTimerSetting[1] 2>$null) -join "`n"
    $values = @([regex]::Matches($out, '0x([0-9a-fA-F]{8})') | ForEach-Object { [Convert]::ToInt32($_.Groups[1].Value, 16) })
    if ($values.Count -lt 2) { return $null }
    return @{ ac = $values[$values.Count - 2]; dc = $values[$values.Count - 1] }
}

# 1 on, 0 off; many PCs only have HibernateEnabledDefault until someone runs powercfg /hibernate
function Get-HibernateEnabled {
    $key = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power' -ErrorAction SilentlyContinue
    if ($null -eq $key) { return $null }
    if ($null -ne $key.HibernateEnabled) { return [int]$key.HibernateEnabled }
    if ($null -ne $key.HibernateEnabledDefault) { return [int]$key.HibernateEnabledDefault }
    return $null
}

function Get-FirewallRules {
    return @(Get-NetFirewallRule -Group $FirewallGroup -ErrorAction SilentlyContinue)
}

function Test-WakeTask {
    & schtasks.exe /Query /TN $WakeTaskName 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

# What the installer changed, so the uninstaller puts back exactly that (backend/data/install-state.json)
function Read-InstallState {
    if (-not (Test-Path $StateFile)) { return @{} }
    $state = @{}
    $json = Get-Content -Raw -Path $StateFile | ConvertFrom-Json
    foreach ($p in $json.PSObject.Properties) { $state[$p.Name] = $p.Value }
    return $state
}

function Save-InstallState([hashtable]$State) {
    $folder = Split-Path $StateFile -Parent
    if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }
    [IO.File]::WriteAllText($StateFile, ($State | ConvertTo-Json -Depth 4))
}
# <Jun Kai end>
