# Owner: Role 3, Jun Kai.
# ESG Kiosk installer for Windows (task-sheet point 5). Double-click install.cmd in the project folder; it runs this.
#   install.cmd                  asks Laptop or Wall PC, then sets everything up
#   install.cmd -Role Laptop     a developer laptop: kiosk automation off, nothing changed in Windows
#   install.cmd -Role WallPC     the kiosk PC: also starts the kiosk at logon, puts an admin page link on the desktop,
#                                adds the firewall rule the tablets need and, if you agree, turns on hibernate and wake
#                                timers (Windows asks for administrator rights for the last two)
#   install.cmd -Check           only reports what is set up, changes nothing
#   install.cmd -DryRun          prints every step it would take, changes nothing
# Also: -NonInteractive (no questions, the safe answer is taken), -SkipNpm, -PowerSettings (yes to the power question).
# Safe to run again: it never overwrites a filled-in setting and never drops a database table.
# <Jun Kai start>
[CmdletBinding()]
param(
    [ValidateSet('Laptop', 'WallPC')][string]$Role,
    [switch]$Check,
    [switch]$DryRun,
    [switch]$NonInteractive,
    [switch]$SkipNpm,
    [switch]$PowerSettings,
    [switch]$AdminSteps
)
. (Join-Path $PSScriptRoot 'common.ps1')
Set-Location $Root

function Stop-Install([string]$Message) {
    Write-Bad $Message
    Write-Host ''
    exit 1
}

function Get-Port {
    $port = '3000'
    $envFile = Join-Path $Root 'backend\.env'
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) { if ($line -match '^\s*PORT\s*=\s*(\d+)') { $port = $Matches[1] } }
    }
    return $port
}

function Test-Programs {
    $script:ProgramsOk = $true
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Bad 'Node.js is not installed. Install Node.js 22 LTS (winget install OpenJS.NodeJS.LTS, or https://nodejs.org),'
        Write-Info 'then open a new window and run install.cmd again.'
        $script:ProgramsOk = $false
    } else {
        $version = ((& node --version) | Out-String).Trim()
        $major = 0
        [void][int]::TryParse($version.TrimStart('v').Split('.')[0], [ref]$major)
        if ($major -lt 22) { Write-Bad "Node.js $version is too old: install Node.js 22 LTS"; $script:ProgramsOk = $false }
        else { Write-Ok "Node.js $version" }
        if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Write-Bad 'npm is missing (it comes with Node.js: reinstall Node.js)'; $script:ProgramsOk = $false }
    }
    $services = @(Get-Service -Name 'MySQL*' -ErrorAction SilentlyContinue)
    $running = @($services | Where-Object { $_.Status -eq 'Running' })
    if ($services.Count -eq 0) {
        Write-Note 'no MySQL service on this PC. Install MySQL Server 8.4 (https://dev.mysql.com/downloads/installer/),'
        Write-Info 'unless DB_HOST in backend\.env points to MySQL on another PC.'
    } elseif ($running.Count -eq 0) {
        Write-Bad "the MySQL service ($($services[0].Name)) is stopped: start it in Services (services.msc), then run this again"
        $script:ProgramsOk = $false
    } else {
        Write-Ok "MySQL service $($running[0].Name) is running"
    }
    if (Get-Command git -ErrorAction SilentlyContinue) { Write-Ok 'Git (for updates with git pull)' }
    else { Write-Info 'Git is not installed (optional: only needed to get updates with git pull)' }
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        Write-Info 'Ollama is not installed (optional: the AI parts of the admin page use it, https://ollama.com)'
    } else {
        $models = (& ollama list 2>$null | Out-String)
        if ($models -match 'qwen2\.5:3b') { Write-Ok 'Ollama with the qwen2.5:3b model' }
        else { Write-Note 'Ollama is installed but not the qwen2.5:3b model: ollama pull qwen2.5:3b (about 2 GB)' }
    }
}

function Install-Packages {
    $modules = Join-Path $Root 'node_modules'
    if ($SkipNpm) { Write-Info 'skipped (-SkipNpm)'; return }
    if ((Test-Path $modules) -and (Get-Item -Force $modules).LinkType) {
        Write-Note 'node_modules is a link to another folder: npm ci skipped, so that folder is not emptied'
        return
    }
    $running = @(Get-KioskProcesses)
    if ($running.Count -gt 0 -and -not $DryRun) {
        Write-Note "the kiosk is running from this folder ($($running.Count) node process(es)); npm ci cannot replace files it uses."
        if (Confirm-Choice 'Stop the kiosk now?' $false) {
            $running | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
            Write-Ok 'kiosk stopped'
        } else {
            Stop-Install 'close the kiosk window (or Ctrl+C in it) and run install.cmd again, or add -SkipNpm'
        }
    }
    Invoke-Change 'install the packages with npm ci (takes a few minutes)' {
        & npm.cmd ci --no-audit --no-fund | Out-Host
        if ($LASTEXITCODE -ne 0) { Stop-Install "npm ci failed (exit code $LASTEXITCODE)" }
    }
}

function Install-StartupLink {
    $node = (Get-Command node).Source
    $start = Join-Path $Root 'startAll.js'
    Invoke-Change 'start the kiosk at logon (a shortcut in the Startup folder)' {
        $link = (New-Object -ComObject WScript.Shell).CreateShortcut($StartupLink)
        $link.TargetPath = Join-Path $env:SystemRoot 'System32\cmd.exe'
        $link.Arguments = "/k title ESG Kiosk server & `"$node`" `"$start`""
        $link.WorkingDirectory = $Root
        $link.WindowStyle = 7
        $link.Description = 'Starts the ESG Kiosk servers (added by install.cmd, removed by uninstall.cmd)'
        $link.Save()
    }
}

function Install-DesktopLink([string]$Port) {
    Invoke-Change "put an `"ESG Kiosk Admin`" link on the desktop (https://localhost:$Port/admin)" {
        Set-Content -LiteralPath $DesktopLink -Encoding ASCII -Value @('[InternetShortcut]', "URL=https://localhost:$Port/admin")
    }
}

# The administrator part of the Wall PC: the firewall rule and, only when asked, hibernate and wake timers. What it
# changes is written to backend\data\install-state.json first, so uninstall.cmd can put it back.
function Install-AdminSteps([bool]$Power) {
    $state = Read-InstallState
    if (@(Get-FirewallRules).Count -gt 0) { Write-Ok "the firewall rule `"$FirewallName`" is already there" }
    else {
        Invoke-Change "let tablets on this network reach the kiosk (firewall rule, TCP $($KioskPorts -join ' and '), Private and Domain networks only)" {
            New-NetFirewallRule -DisplayName $FirewallName -Group $FirewallGroup -Direction Inbound -Protocol TCP -LocalPort $KioskPorts -Action Allow -Profile Private, Domain -ErrorAction Stop | Out-Null
        }
    }
    if (-not $Power) {
        Write-Info 'hibernate and wake timers: left as they are (run again with -PowerSettings to set them)'
        return
    }
    $hibernate = Get-HibernateEnabled
    if ($hibernate -eq 1) { Write-Ok 'hibernate is already on' }
    else {
        if (-not $DryRun -and -not $state.ContainsKey('hibernateBefore')) { $state['hibernateBefore'] = $hibernate; Save-InstallState $state }
        Invoke-Change 'turn on hibernate (powercfg /hibernate on)' {
            & powercfg.exe /hibernate on | Out-Host
            if ($LASTEXITCODE -ne 0) { Stop-Install 'powercfg /hibernate on failed' }
        }
    }
    $wake = Get-WakeTimers
    if ($wake -and $wake.ac -eq 1 -and $wake.dc -eq 1) { Write-Ok 'wake timers are already allowed' }
    else {
        if (-not $DryRun -and $wake -and -not $state.ContainsKey('wakeTimersBefore')) { $state['wakeTimersBefore'] = @{ ac = $wake.ac; dc = $wake.dc }; Save-InstallState $state }
        Invoke-Change 'allow wake timers in the active power plan (plugged in and on battery)' {
            & powercfg.exe /setacvalueindex SCHEME_CURRENT $WakeTimerSetting[0] $WakeTimerSetting[1] 1
            & powercfg.exe /setdcvalueindex SCHEME_CURRENT $WakeTimerSetting[0] $WakeTimerSetting[1] 1
            & powercfg.exe /setactive SCHEME_CURRENT
            if ($LASTEXITCODE -ne 0) { Stop-Install 'powercfg could not change the wake timer setting' }
        }
    }
}

function Show-WindowsStatus {
    if (@(Get-FirewallRules).Count -gt 0) { Write-Ok "firewall rule `"$FirewallName`": tablets can reach TCP $($KioskPorts -join ' and ')" }
    else { Write-Info 'no firewall rule for the kiosk (only the Wall PC needs it)' }
    if (Test-Path $StartupLink) { Write-Ok 'starts at logon (Startup folder shortcut)' }
    else { Write-Info 'does not start at logon (only the Wall PC does)' }
    if (Test-Path $DesktopLink) { Write-Ok 'desktop link to the admin page' }
    $hibernate = Get-HibernateEnabled
    if ($hibernate -eq 1) { Write-Ok 'hibernate is on' }
    elseif ($hibernate -eq 0) { Write-Info 'hibernate is off (the Wall PC needs it on for the kiosk schedule)' }
    else { Write-Info 'hibernate: Windows did not say whether it is on' }
    $wake = Get-WakeTimers
    if ($wake -and $wake.ac -eq 1) { Write-Ok "wake timers allowed (plugged in $($wake.ac), on battery $($wake.dc))" }
    elseif ($wake) { Write-Info "wake timers not allowed when plugged in (setting $($wake.ac)); the Wall PC needs 1" }
    if (Test-WakeTask) { Write-Ok "`"$WakeTaskName`" task is there (the kiosk schedule keeps it up to date)" }
}

# The elevated second run started below: only the administrator part
if ($AdminSteps) {
    Write-Step 'Wall PC: firewall and power settings (administrator)'
    if (-not (Test-Admin)) { Stop-Install 'this part needs administrator rights' }
    Install-AdminSteps $PowerSettings.IsPresent
    Start-Sleep -Seconds 3
    exit 0
}

Write-Host ''
Write-Host 'ESG Kiosk installer' -ForegroundColor White
Write-Host "Folder: $Root"
if ($DryRun) { Write-Host 'Dry run: nothing is changed.' -ForegroundColor DarkGray }

if ($Check) {
    Write-Step 'Programs'
    Test-Programs
    $code = 1
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Step 'Settings and database'
        & node $SetupJs check
        $code = $LASTEXITCODE
    }
    Write-Step 'Windows'
    Show-WindowsStatus
    Write-Host ''
    exit $code
}

if (-not $Role) {
    if ($NonInteractive) { $Role = 'Laptop' }
    else {
        Write-Host ''
        Write-Host 'Where will this copy run?'
        Write-Host '  1  Laptop   for development and testing (kiosk automation off, Windows left alone)'
        Write-Host '  2  Wall PC  the kiosk server at the ESG Centre (starts at logon, firewall rule, power settings)'
        $answer = Read-Host 'Type 1 or 2'
        if ($answer.Trim() -eq '2') { $Role = 'WallPC' } else { $Role = 'Laptop' }
    }
}
Write-Host "Role: $Role"

Write-Step 'Programs this needs'
Test-Programs
if (-not $script:ProgramsOk) { Stop-Install 'install what is missing above, then run install.cmd again' }

Write-Step 'Packages'
Install-Packages

Write-Step 'Settings (backend\.env) and the database'
$setupArgs = @('install', '--role', $Role.ToLower())
if ($DryRun) { $setupArgs += '--dry-run' }
if ($NonInteractive) { $setupArgs += '--non-interactive' }
& node $SetupJs @setupArgs
if ($LASTEXITCODE -ne 0) { Stop-Install 'the settings or database step did not finish (see above); fix it and run install.cmd again' }

$port = Get-Port
if ($Role -eq 'WallPC') {
    Write-Step 'Wall PC: start at logon and a desktop link'
    Install-StartupLink
    Install-DesktopLink $port

    Write-Step 'Wall PC: firewall and power settings (administrator)'
    $power = $PowerSettings.IsPresent
    if (-not $power -and -not $NonInteractive -and -not $DryRun) {
        Write-Info 'The kiosk schedule hibernates this PC at night and wakes it with a Windows wake timer.'
        Write-Info 'That needs hibernate on and "Allow wake timers" on in the power plan.'
        $power = Confirm-Choice 'Turn on hibernate and allow wake timers?' $false
    }
    if ($DryRun -or (Test-Admin)) { Install-AdminSteps $power }
    elseif ($NonInteractive) { Write-Note 'not running as administrator: firewall and power steps skipped (run install.cmd -Role WallPC as administrator)' }
    else {
        Write-Info 'Windows now asks for administrator rights for these steps.'
        $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Role', 'WallPC', '-AdminSteps', '-NonInteractive')
        if ($power) { $argList += '-PowerSettings' }
        try {
            $elevated = Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -Verb RunAs -Wait -PassThru -ErrorAction Stop
            if ($elevated.ExitCode -ne 0) { Write-Bad "the administrator steps failed (exit code $($elevated.ExitCode))" }
        } catch {
            Write-Note 'administrator rights were not given: firewall and power steps skipped (run install.cmd again to retry)'
        }
        Show-WindowsStatus
    }
}

Write-Step 'Done'
if ($DryRun) { Write-Host '   Dry run finished: nothing was changed.' }
else {
    Write-Ok 'installed'
    if ($Role -eq 'WallPC') { Write-Info 'The kiosk starts by itself at the next logon. To start it now: node startAll.js (in this folder).' }
    else { Write-Info 'Start it with: node startAll.js   (Ctrl+C stops it)' }
    Write-Info "Admin page: https://localhost:$port/admin (the browser warns once about the self-signed certificate)"
    Write-Info 'Check it any time with install.cmd -Check; remove it with uninstall.cmd.'
    if ((Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $Root '.git'))) {
        & git -C $Root ls-files --error-unmatch backend/.env 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { Write-Note 'backend\.env is still tracked by git (from the previous team): never commit it, it now holds this PC''s keys' }
    }
}
Write-Host ''
exit 0
# <Jun Kai end>
