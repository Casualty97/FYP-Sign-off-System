# Owner: Role 3, Jun Kai.
# The whole life of an install, run by CI on a Windows runner (it adds a service, a firewall rule and shortcuts, so
# never on a PC in use): a one command install from a download, a repair, an update, two failed updates that must
# put everything back, a refused older package, an export, an uninstall that keeps the data, a reinstall that finds
# it again, an uninstall that deletes everything, a laptop install that loads the exported data, and a failed fresh
# install that must leave nothing. After every uninstall it checks that nothing of the kiosk is left.
#   powershell -File tests\install\package-flow.ps1 -Dist C:\rpkb\dist
# Needs KIOSK_ADMIN_PASSWORD in the environment (a test value).
# <Jun Kai start>
param(
    [Parameter(Mandatory = $true)][string]$Dist,
    [string]$Root = 'C:\RPXK'
)
# 'Continue' (set by KioskCommon): under 5.1 'Stop' would end the test at the first stderr line of a child program;
# every step checks its own result instead
. (Join-Path $PSScriptRoot '..\..\scripts\install\package\KioskCommon.ps1')
$zipName = 'rp-xperience-kiosk-windows-x64.zip'
$work = Join-Path $env:TEMP ('rpk-flow-' + [guid]::NewGuid().ToString('N'))
$fails = 0
$env:KIOSK_DATA_PASSPHRASE = 'ci-only-export-passphrase'
if (-not $env:KIOSK_ADMIN_PASSWORD) { throw 'set KIOSK_ADMIN_PASSWORD' }

function Test-That([string]$Name, [bool]$Ok, $Detail) {
    if ($Ok) { Write-Host "ok   $Name" -ForegroundColor Green }
    else { Write-Host "FAIL $Name  -> $Detail" -ForegroundColor Red; $script:fails++ }
}
function Write-Part([string]$Text) { Write-Host ''; Write-Host "==== $Text" -ForegroundColor Cyan }
function Invoke-Ps([string]$Script, [string[]]$ScriptArgs) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Script @ScriptArgs 2>&1 | ForEach-Object { Write-Host "     | $_" }
    return $LASTEXITCODE
}
function Get-Node([string]$R) { return (Join-Path $R 'app\runtime\node\node.exe') }
function Get-Login([string]$R, [int]$Port, [string]$User, [string]$EnvName) {
    return ("$(& (Get-Node $R) (Join-Path $PSScriptRoot 'kiosk-check.js') login $Port $User $EnvName)").Trim()
}
function Test-Marker([string]$R) {
    & (Get-Node $R) (Join-Path $PSScriptRoot 'kiosk-check.js') marker has (Join-Path $R 'app') | Out-Null
    return ($LASTEXITCODE -eq 0)
}
function Get-Info([string]$R) { return (Get-InstallInfo $R) }
# A copy of the package with another build number (version.json and its checksum), as a newer or older release
function New-PackageCopy([string]$From, [string]$To, [int]$Build) {
    Copy-Item -LiteralPath $From -Destination $To -Recurse
    $v = Get-Content -LiteralPath (Join-Path $To 'version.json') -Raw | ConvertFrom-Json
    $v.build = $Build
    Write-TextFile (Join-Path $To 'version.json') ($v | ConvertTo-Json -Depth 4)
    $lines = foreach ($l in [IO.File]::ReadAllLines((Join-Path $To 'checksums.sha256'))) {
        if ($l -match '^[0-9a-f]{64}  version\.json$') { "$(Get-Sha256 (Join-Path $To 'version.json'))  version.json" } else { $l }
    }
    [IO.File]::WriteAllText((Join-Path $To 'checksums.sha256'), (($lines -join "`r`n") + "`r`n"))
}
# Nothing of an install may be left: folder, service, firewall rules of the kiosk's group, shortcuts, tasks, programs
function Test-NothingLeft([string]$R, [string]$When, [bool]$DataKept) {
    if ($DataKept) {
        $extra = @(Get-ChildItem -LiteralPath $R -Force | Where-Object { @('data', 'mysql-data') -notcontains $_.Name } | ForEach-Object { $_.Name })
        Test-That "$When`: only data and mysql-data are left in the folder" ($extra.Count -eq 0) ($extra -join ', ')
    } else {
        Test-That "$When`: the folder is gone" (-not (Test-Path -LiteralPath $R)) $R
    }
    Test-That "$When`: no service $ServiceName" (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) 'service still there'
    $rules = @(Get-NetFirewallRule -Group $FirewallGroup -ErrorAction SilentlyContinue)
    Test-That "$When`: no firewall rule of the kiosk" ($rules.Count -eq 0) (($rules | ForEach-Object { $_.DisplayName }) -join ', ')
    Test-That "$When`: no Startup shortcut or desktop link" (-not (Test-Path -LiteralPath $StartupLink) -and -not (Test-Path -LiteralPath $DesktopLink)) 'shortcut still there'
    $tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { @($_.Actions | Where-Object { $_.Execute -and $_.Execute -like "$R*" }).Count })
    Test-That "$When`: no scheduled task runs anything from the folder" ($tasks.Count -eq 0) (($tasks | ForEach-Object { $_.TaskName }) -join ', ')
    $procs = @(Get-KioskProcesses $R)
    Test-That "$When`: no program of the folder still runs" ($procs.Count -eq 0) (($procs | ForEach-Object { "$($_.Name) $($_.ProcessId)" }) -join ', ')
    foreach ($p in @(3000, 3003, 3307)) { Test-That "$When`: port $p is free again" (-not (Get-PortOwner $p)) (Get-PortOwner $p) }
}

New-Item -ItemType Directory -Path $work -Force | Out-Null
$server = $null
try {
    Write-Part 'The package itself'
    $listing = @(& $Tar -tf (Join-Path $Dist $zipName))
    $pkgTop = 'rp-xperience-kiosk/'
    Test-That 'the zip holds one folder with install.cmd, README.txt and the checksums' (($listing -contains "${pkgTop}install.cmd") -and ($listing -contains "${pkgTop}README.txt") -and ($listing -contains "${pkgTop}checksums.sha256")) ($listing | Select-Object -First 20)
    & $Tar -xf (Join-Path $Dist $zipName) -C $work
    $pkg = Join-Path $work 'rp-xperience-kiosk'
    $appList = @(& $Tar -tf (Join-Path $pkg 'payload\app.zip') | ForEach-Object { $_ -replace '^\./', '' })
    $private = @($appList | Where-Object { $_ -match '^(backend/\.env$|backend/(certs|data|cache)/.|uploads/.|backend/config/defaults/emailConfig\.json$|\.git/)' -or $_ -match '\.(pem|key|log)$' })
    Test-That 'app.zip holds no .env, certificates, runtime data, photos, email settings or git history' ($private.Count -eq 0) ($private | Select-Object -First 10)
    Test-That 'app.zip holds no tests or docs' (@($appList | Where-Object { $_ -match '^(tests|docs|legacy|Team_Documentation)/' }).Count -eq 0) 'tests or docs packed'
    Test-That 'app.zip brings its own Node.js and the Windows packages (bcrypt, sharp)' (($appList -contains 'runtime/node/node.exe') -and @($appList | Where-Object { $_ -like 'node_modules/bcrypt/*' }).Count -and @($appList | Where-Object { $_ -like 'node_modules/@img/sharp-win32-x64/*' }).Count) 'missing'
    $pkgInfo = Get-PackageInfo $pkg
    $build = [int]$pkgInfo.build

    Write-Part 'One command install from a download (Wall PC, MySQL service, firewall rule)'
    $server = Start-Process -FilePath 'node' -ArgumentList @((ConvertTo-Arg (Join-Path $PSScriptRoot 'serve-dir.js')), (ConvertTo-Arg $Dist), '8099') -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    $code = Invoke-Ps (Join-Path $PSScriptRoot '..\..\scripts\install\get-kiosk.ps1') @('-From', "http://127.0.0.1:8099/$zipName", '-Role', 'WallPC', '-InstallDir', $Root, '-NonInteractive')
    Test-That 'the one command install finishes (exit 0)' ($code -eq 0) "exit $code"
    $info = Get-Info $Root
    Test-That 'the install record lists the folder, MySQL, its data, the service, the firewall rule, the app and two shortcuts' (@($info.items).Count -ge 8 -and @($info.items | Where-Object { $_.type -eq 'service' }).Count -eq 1 -and @($info.items | Where-Object { $_.type -eq 'firewall' }).Count -eq 1 -and @($info.items | Where-Object { $_.type -eq 'shortcut' }).Count -eq 2) ($info.items | ForEach-Object { $_.text })
    Test-That 'the record keeps where the package came from (for update.cmd)' ($info.source -eq "http://127.0.0.1:8099/$zipName") $info.source
    $svc = Get-CimInstance Win32_Service -Filter "Name = '$ServiceName'"
    Test-That 'the MySQL service runs under its own account' ($svc -and $svc.State -eq 'Running' -and $svc.StartName -eq $ServiceAccount -and $svc.StartMode -eq 'Auto') "$($svc.State) $($svc.StartName) $($svc.StartMode)"
    $rule = @(Get-NetFirewallRule -Group $FirewallGroup -ErrorAction SilentlyContinue)
    Test-That 'one firewall rule, TCP 3000, Private and Domain only' ($rule.Count -eq 1 -and (@(Get-RulePorts $rule[0]) -join ',') -eq '3000' -and "$($rule[0].Profile)" -match 'Private' -and "$($rule[0].Profile)" -notmatch 'Public') "$($rule.Count) $($rule[0].Profile)"
    Test-That 'the Startup shortcut starts this install' (Test-OwnShortcut $StartupLink $Root) $StartupLink
    foreach ($sub in @('mysql', 'mysql-data')) {
        $acl = Get-Acl -LiteralPath (Join-Path $Root $sub)
        $writers = @($acl.Access | Where-Object { $_.AccessControlType -eq 'Allow' -and ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]'Write, Delete, ChangePermissions, TakeOwnership') } | ForEach-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } | Sort-Object -Unique)
        $allowed = @($SidSystem, $SidAdmins)
        if ($sub -eq 'mysql-data') { $allowed += (New-Object Security.Principal.NTAccount($ServiceAccount)).Translate([Security.Principal.SecurityIdentifier]).Value }
        $others = @($writers | Where-Object { $allowed -notcontains $_ })
        Test-That "only administrators (and for the data the service) may change $sub" ($others.Count -eq 0) ($others -join ', ')
    }
    $envText = Get-Content -LiteralPath (Join-Path $Root 'app\backend\.env') -Raw
    $envValues = Read-EnvLines (Join-Path $Root 'app\backend\.env')
    Test-That 'backend\.env has new secrets, not the defaults' ((Get-EnvValue $envValues 'ENCRYPTION_KEY' '') -match '^[0-9a-f]{64}$' -and (Get-EnvValue $envValues 'ENCRYPTION_KEY' '') -notmatch '^0+$' -and (Get-EnvValue $envValues 'SESSION_SECRET' '') -and (Get-EnvValue $envValues 'DB_PASSWORD' 'kiosk123') -ne 'kiosk123' -and (Get-EnvValue $envValues 'DB_PORT' '') -eq '3307') 'a default value is left'
    Test-That 'the Wall PC runs the kiosk automation' ((Get-EnvValue $envValues 'KIOSK_AUTOMATION' 'on') -eq 'on') 'off'
    $env:CI_WRONG = 'SystemAdmin123!'
    Test-That 'the public default password is refused' ((Get-Login $Root 3000 'systemadmin' 'CI_WRONG') -eq '401') (Get-Login $Root 3000 'systemadmin' 'CI_WRONG')
    Test-That 'the password chosen at install signs in' ((Get-Login $Root 3000 'systemadmin' 'KIOSK_ADMIN_PASSWORD') -eq '200') 'not 200'
    New-Item -ItemType Directory -Path (Join-Path $Root 'app\uploads\photos') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $Root 'app\uploads\photos\ci-marker.txt') -Value 'visitor photo stand in'
    New-Item -ItemType Directory -Path (Join-Path $Root 'app\assets\backgrounds') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $Root 'app\assets\backgrounds\ci-uploaded.png') -Value 'uploaded on the admin page'
    & (Get-Node $Root) (Join-Path $PSScriptRoot 'kiosk-check.js') marker add (Join-Path $Root 'app')
    Test-That 'a visitor row can be written and read back' (Test-Marker $Root) 'no marker'

    Write-Part 'The same package again: a repair keeps everything'
    $code = Invoke-Ps (Join-Path $pkg 'installer\Install-Kiosk.ps1') @('-InstallDir', $Root, '-NonInteractive')
    Test-That 'the repair finishes (exit 0)' ($code -eq 0) "exit $code"
    Test-That 'after the repair: photo, uploaded picture, visitor row and password are kept' ((Test-Path (Join-Path $Root 'app\uploads\photos\ci-marker.txt')) -and (Test-Path (Join-Path $Root 'app\assets\backgrounds\ci-uploaded.png')) -and (Test-Marker $Root) -and (Get-Login $Root 3000 'systemadmin' 'KIOSK_ADMIN_PASSWORD') -eq '200') 'something is gone'

    Write-Part 'A newer build: the update keeps everything and makes a backup'
    $newer = Join-Path $work 'newer'
    New-PackageCopy $pkg $newer ($build + 1)
    $code = Invoke-Ps (Join-Path $newer 'installer\Install-Kiosk.ps1') @('-InstallDir', $Root, '-NonInteractive')
    Test-That 'the update finishes (exit 0)' ($code -eq 0) "exit $code"
    Test-That 'the record says the newer build' ([int](Get-Info $Root).build -eq $build + 1) (Get-Info $Root).build
    Test-That 'after the update: photo, uploaded picture, visitor row and password are kept' ((Test-Path (Join-Path $Root 'app\uploads\photos\ci-marker.txt')) -and (Test-Path (Join-Path $Root 'app\assets\backgrounds\ci-uploaded.png')) -and (Test-Marker $Root) -and (Get-Login $Root 3000 'systemadmin' 'KIOSK_ADMIN_PASSWORD') -eq '200') 'something is gone'
    $backups = @(Get-ChildItem -LiteralPath (Join-Path $Root 'data\backups') -Directory -ErrorAction SilentlyContinue)
    Test-That 'a database backup was made before the update' ($backups.Count -ge 1 -and (Test-Path (Join-Path $backups[0].FullName 'database.sql'))) ($backups | ForEach-Object { $_.Name })

    foreach ($point in @('after-migrations', 'after-start')) {
        Write-Part "An update that fails ($point): everything must come back"
        $bad = Join-Path $work "bad-$point"
        New-PackageCopy $pkg $bad ($build + 2)
        $env:KIOSK_INSTALL_TEST_FAIL = $point
        $code = Invoke-Ps (Join-Path $bad 'installer\Install-Kiosk.ps1') @('-InstallDir', $Root, '-NonInteractive')
        Remove-Item Env:\KIOSK_INSTALL_TEST_FAIL
        Test-That "the failed update says so (exit 1, $point)" ($code -eq 1) "exit $code"
        Test-That 'the record still says the build before' ([int](Get-Info $Root).build -eq $build + 1) (Get-Info $Root).build
        Test-That 'no half made folders are left' (-not (Test-Path (Join-Path $Root 'app.new')) -and -not (Test-Path (Join-Path $Root 'app.old')) -and (Test-Path (Join-Path $Root 'app\runtime\node\node.exe'))) 'leftovers'
        Test-That 'the previous version runs again with all its data' ((Test-Path (Join-Path $Root 'app\uploads\photos\ci-marker.txt')) -and (Test-Path (Join-Path $Root 'app\assets\backgrounds\ci-uploaded.png')) -and (Test-Marker $Root) -and (Get-Login $Root 3000 'systemadmin' 'KIOSK_ADMIN_PASSWORD') -eq '200') 'not back'
    }

    Write-Part 'An older build is refused'
    $code = Invoke-Ps (Join-Path $pkg 'installer\Install-Kiosk.ps1') @('-InstallDir', $Root, '-NonInteractive')
    Test-That 'the older package is refused (exit 3) and nothing changes' ($code -eq 3 -and [int](Get-Info $Root).build -eq $build + 1) "exit $code"

    Write-Part 'Status and export'
    $code = Invoke-Ps (Join-Path $Root 'app\scripts\install\package\Show-KioskStatus.ps1') @()
    Test-That 'kiosk-status runs' ($code -eq 0) "exit $code"
    $export = Join-Path $work 'moved.rpxkdata'
    & cmd.exe /d /c "`"$Root\app\export-data.cmd`" -OutFile `"$export`" -NonInteractive" 2>&1 | ForEach-Object { Write-Host "     | $_" }
    Test-That 'export-data.cmd makes the locked data file' ($LASTEXITCODE -eq 0 -and (Test-Path $export)) "exit $LASTEXITCODE"

    Write-Part 'Uninstall, keeping the visitor data'
    & cmd.exe /d /c "`"$Root\app\uninstall.cmd`" -NonInteractive" 2>&1 | ForEach-Object { Write-Host "     | $_" }
    Test-That 'uninstall.cmd finishes (exit 0)' ($LASTEXITCODE -eq 0) "exit $LASTEXITCODE"
    Test-NothingLeft $Root 'after uninstall' $true
    Test-That 'the photo and the uploaded picture are kept in data\kept' ((Test-Path (Join-Path $Root 'data\kept\app\uploads\photos\ci-marker.txt')) -and (Test-Path (Join-Path $Root 'data\kept\app\assets\backgrounds\ci-uploaded.png'))) 'not kept'

    Write-Part 'Install again: the kept data is used'
    $code = Invoke-Ps (Join-Path $newer 'installer\Install-Kiosk.ps1') @('-InstallDir', $Root, '-Role', 'WallPC', '-NonInteractive')
    Test-That 'the install over kept data finishes (exit 0)' ($code -eq 0) "exit $code"
    Test-That 'photo, uploaded picture, visitor row and the earlier password are back' ((Test-Path (Join-Path $Root 'app\uploads\photos\ci-marker.txt')) -and (Test-Path (Join-Path $Root 'app\assets\backgrounds\ci-uploaded.png')) -and (Test-Marker $Root) -and (Get-Login $Root 3000 'systemadmin' 'KIOSK_ADMIN_PASSWORD') -eq '200') 'not back'

    Write-Part 'Uninstall with -RemoveData: nothing may be left'
    $code = Invoke-Ps (Join-Path $pkg 'installer\Uninstall-Kiosk.ps1') @('-InstallDir', $Root, '-RemoveData', '-NonInteractive')
    Test-That '-RemoveData without the typed confirmation is refused (exit 3)' ($code -eq 3 -and (Test-Path (Join-Path $Root 'app'))) "exit $code"
    $code = Invoke-Ps (Join-Path $pkg 'installer\Uninstall-Kiosk.ps1') @('-InstallDir', $Root, '-RemoveData', '-ConfirmDelete', 'DELETE', '-NonInteractive')
    Test-That 'the full uninstall finishes (exit 0)' ($code -eq 0) "exit $code"
    Test-NothingLeft $Root 'after the full uninstall' $false

    Write-Part 'A laptop install without a service, with the data moved from the first install'
    $laptop = 'C:\RPXK2'
    $code = Invoke-Ps (Join-Path $pkg 'installer\Install-Kiosk.ps1') @('-InstallDir', $laptop, '-Role', 'Laptop', '-NoService', '-ImportData', $export, '-NonInteractive')
    Test-That 'the laptop install with the moved data finishes (exit 0)' ($code -eq 0) "exit $code"
    $info2 = Get-Info $laptop
    Test-That 'MySQL runs as a program, no service was made' ($info2.mode -eq 'process' -and -not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) -and @(Get-KioskProcesses $laptop @('mysqld.exe')).Count -ge 1) "$($info2.mode)"
    Test-That 'a laptop gets no firewall rule and no shortcuts' (@(Get-NetFirewallRule -Group $FirewallGroup -ErrorAction SilentlyContinue).Count -eq 0 -and -not (Test-Path $StartupLink)) 'made'
    Test-That 'the moved data is there: photo, uploaded picture, visitor row, admin password' ((Test-Path (Join-Path $laptop 'app\uploads\photos\ci-marker.txt')) -and (Test-Path (Join-Path $laptop 'app\assets\backgrounds\ci-uploaded.png')) -and (Test-Marker $laptop) -and (Get-Login $laptop 3000 'systemadmin' 'KIOSK_ADMIN_PASSWORD') -eq '200') 'missing'
    Test-That 'the laptop runs with the kiosk automation off' ((Get-EnvValue (Read-EnvLines (Join-Path $laptop 'app\backend\.env')) 'KIOSK_AUTOMATION' 'on') -eq 'off') 'on'
    $code = Invoke-Ps (Join-Path $pkg 'installer\Uninstall-Kiosk.ps1') @('-InstallDir', $laptop, '-RemoveData', '-ConfirmDelete', 'DELETE', '-NonInteractive')
    Test-That 'the laptop uninstall finishes (exit 0)' ($code -eq 0) "exit $code"
    Test-NothingLeft $laptop 'after the laptop uninstall' $false

    Write-Part 'A fresh install that fails half way leaves nothing'
    $env:KIOSK_INSTALL_TEST_FAIL = 'after-files'
    $code = Invoke-Ps (Join-Path $pkg 'installer\Install-Kiosk.ps1') @('-InstallDir', 'C:\RPXK3', '-Role', 'WallPC', '-NonInteractive')
    Remove-Item Env:\KIOSK_INSTALL_TEST_FAIL
    Test-That 'the failed install says so (exit 1)' ($code -eq 1) "exit $code"
    Test-NothingLeft 'C:\RPXK3' 'after the failed install' $false
} catch {
    Write-Host "FAIL the test itself stopped: $($_.Exception.Message) at line $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Red
    $fails++
} finally {
    if ($server) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host ''
Write-Host "$fails failure(s)"
exit $fails
# <Jun Kai end>
