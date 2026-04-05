@echo off
setlocal enabledelayedexpansion

:: ─────────────────────────────────────────────────────────────────────────────
:: VERSION -- change this one value to update everywhere
set "CATTO_VERSION=8.0.0"
:: ─────────────────────────────────────────────────────────────────────────────

title CATTO v%CATTO_VERSION% -- Launcher

:: ── [1/4] Environment Shielding ──────────────────────────────
reg add "HKCU\Console" /v "QuickEdit" /t REG_DWORD /d 0 /f >nul 2>&1

:main
cls
mode con: cols=100 lines=30
echo.
:: Decoding the High-Res logo via PowerShell (Safe from Batch parser errors)
set "B64_LOGO=IOKWiOKWiOKWiOKWiOKWiOKWiOKVly DilojilojilojilojilojilZcg4paI4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKWiOKVly AK4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4paI4paI4pWX4pWa4pWQ4pWQ4paI4paI4pWU4pWQ4pWQ4pWd4pWa4pWQ4pWQ4paI4paI4pWU4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4pWQ4paI4paI4pWXCuKWiOKWiOKVkSAgICAg4paI4paI4paI4paI4paI4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4paI4paI4pWRICAg4paI4paI4pWRCuKWiOKWiOKVkSAgICAg4paI4paI4pWU4pWQ4pWQ4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4paI4paI4pWRICAg4paI4paI4pWRCuKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4pWa4paI4paI4paI4paI4paI4paI4pWU4pWdCiDilZrilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVnSAgIOKVmuKVkOKVnSAgICAgIOKVmuKVkOKVnSAgICDilZrilZDilZDilZDilZDilZDilZ0g"
powershell -NoProfile -Command "Write-Host ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:B64_LOGO))) -ForegroundColor Green"
echo  =========================================================
echo   CATTO v%CATTO_VERSION%  Singapore OSINT Dashboard
echo   Ollama AI ^| Correlation Engine ^| Timeline ^| SEA Feeds
echo  =========================================================
color 0A
echo.

:: ── [2/4] Check .env ─────────────────────────────────────────
:env_check
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo  [OK] Created .env from example.
    ) else (
        :: FIX: warn clearly if .env is genuinely missing with no fallback
        echo  [!] WARNING: .env not found and no .env.example to copy from.
        echo      Intelligence key audit will be skipped.
        goto :docker_check
    )
)

set "LOADED_KEYS="
set "MISSING_KEYS="
set "MISSING_CORE="

:: Core Intelligence Audit
set "M_LTA=0" & findstr /r "^LTA_ACCOUNT_KEY=[^ ]" .env >nul 2>&1 && (set "LOADED_KEYS=!LOADED_KEYS! LTA") || (set "M_LTA=1" & set "MISSING_CORE=1")
set "M_SKY=0" & findstr /r "^OPENSKY_CLIENT_ID=[^ ]" .env >nul 2>&1 && (set "LOADED_KEYS=!LOADED_KEYS! OpenSky") || (set "M_SKY=1" & set "MISSING_CORE=1")
set "M_AIS=0" & findstr /r "^AIS_API_KEY=[^ ]" .env >nul 2>&1 && (set "LOADED_KEYS=!LOADED_KEYS! AIS") || (set "M_AIS=1" & set "MISSING_CORE=1")
set "M_OCX=0" & findstr /r "^OCEANS_X_API_KEY=[^ ]" .env >nul 2>&1 && (set "LOADED_KEYS=!LOADED_KEYS! Oceans-X") || (set "M_OCX=1" & set "MISSING_CORE=1")

:: FIX: optional keys only set their own flag -- they do NOT set MISSING_KEYS
:: (previously this caused the warning legend to show on every launch)
set "M_OTX=0" & findstr /r "^OTX_API_KEY=[^ ]" .env >nul 2>&1 || set "M_OTX=1"
set "M_VTS=0" & findstr /r "^VIRUSTOTAL_API_KEY=[^ ]" .env >nul 2>&1 || set "M_VTS=1"
set "M_IPD=0" & findstr /r "^ABUSEIPDB_API_KEY=[^ ]" .env >nul 2>&1 || set "M_IPD=1"
set "M_SHD=0" & findstr /r "^SHODAN_API_KEY=[^ ]" .env >nul 2>&1 || set "M_SHD=1"
set "M_TLG=0" & findstr /r "^TELEGRAM_API_ID=[^ ]" .env >nul 2>&1 || set "M_TLG=1"

:: MISSING_KEYS is now only set when core keys are missing
if "!MISSING_CORE!"=="1" set "MISSING_KEYS=1"

:: Situational Report Display
if not "!LOADED_KEYS!"=="" echo   [OK] ACTIVE INTELLIGENCE : !LOADED_KEYS!
if "!MISSING_KEYS!"=="1"   echo  [^^!] OFFLINE INTELLIGENCE: ^(Review Legend Below^)

:: Dynamic Intelligence Legend (Only shows if core keys are missing)
if "!MISSING_KEYS!"=="1" (
    echo  [^^!] The following intelligence layers will NOT load: ^(Missing API Keys^)
    echo.
    set /a "M_CORE=!M_LTA! + !M_SKY! + !M_AIS! + !M_OCX!"
    if !M_CORE! GTR 0 (
        echo   CORE INTELLIGENCE:
        if "!M_LTA!"=="1" echo     LTA_ACCOUNT_KEY    -^> Singapore road/traffic/bus
        if "!M_SKY!"=="1" echo     OPENSKY_CLIENT_ID  -^> Commercial ^& military flights
        if "!M_AIS!"=="1" echo     AIS_API_KEY        -^> Live vessel tracking
        if "!M_OCX!"=="1" echo     OCEANS_X_API_KEY   -^> MPA Singapore port vessels
        echo.
    )
    set /a "M_OPT=!M_OTX! + !M_VTS! + !M_IPD! + !M_SHD! + !M_TLG!"
    if !M_OPT! GTR 0 (
        echo   OPTIONAL ENHANCEMENTS ^(not configured^):
        if "!M_OTX!"=="1" echo     OTX_API_KEY        -^> AlienVault threat intel
        if "!M_VTS!"=="1" echo     VIRUSTOTAL_API_KEY -^> IOC malware lookup
        if "!M_IPD!"=="1" echo     ABUSEIPDB_API_KEY  -^> IP abuse scoring
        if "!M_SHD!"=="1" echo     SHODAN_API_KEY     -^> Shodan host overlay
        if "!M_TLG!"=="1" echo     TELEGRAM_API_ID    -^> Conflict channel monitor
        echo.
    )
    echo   Edit your keys: %~dp0.env
    echo.
    echo   Auto-proceeding in 5 seconds...
    timeout /t 5 >nul
)

:docker_check
color 0A

:: ── [3/4] Check Docker ───────────────────────────────────────
echo  [1/4] Checking Docker Status...
docker info >nul 2>&1
if not errorlevel 1 goto :docker_ready

:: Docker not running -- attempt to launch it
echo  [!] Docker is not running. Attempting to start...

set "DD_PATH="
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "DD_PATH=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if exist "%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe" set "DD_PATH=%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe"

if "!DD_PATH!"=="" (
    echo  [ERROR] Could not find Docker Desktop. Please start it manually.
    pause
    goto :cleanup
)

start "" "!DD_PATH!"
echo  [OK] Docker Desktop launched. Waiting for engine to start...

:: FIX: wait loop moved outside the if block to avoid CMD label-in-block fragility
set "WAIT_COUNT=0"
:docker_wait_loop
set /a "WAIT_COUNT+=1"
timeout /t 2 >nul
docker info >nul 2>&1
if not errorlevel 1 goto :docker_ready

if !WAIT_COUNT! gtr 30 (
    echo.
    echo  +-----------------------------------------------------+
    echo  [ERROR] Docker engine is not responding after 60s.
    echo.
    echo  Common fixes:
    echo  1. Make sure Docker Desktop is fully running.
    echo  2. Check free disk space -- need at least 10 GB.
    echo  3. Try manually in a Command Prompt:
    echo       docker compose down
    echo       docker compose up -d
    echo  4. Check logs: docker compose logs
    echo  +-----------------------------------------------------+
    echo.
    echo  The engine cannot start without Docker.
    pause
    goto :cleanup
)
goto :docker_wait_loop

:docker_ready
echo  [OK] Docker engine is Ready.
color 0A

:: ── [4/4] Start Catto services ───────────────────────────────
echo.
echo  [2/4] Starting CATTO Containers...
docker compose up -d
color 0A
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to start services.
    echo  Please run 'docker compose logs' to debug.
    pause
    goto :cleanup
)
echo  [OK] CATTO Frontend and Backend Services are online.

echo.
echo  [3/4] Initialising OSINT Engine...
:: Visual Progress Bar (Safe from PowerShell Special Character Errors)
powershell -NoProfile -Command "for ($i=1; $i -le 15; $i++) { $p = [math]::Round(($i/15)*100); $bar = ('#' * $i) + ('.' * (15-$i)); Write-Host -NoNewline \"`r      Progress: [$bar] $p%% \"; Start-Sleep -Seconds 1 } Write-Host ''"

echo  [4/4] Launching Catto Desktop...
color 0A
if exist "electron\node_modules\.bin\electron.cmd" (
    cd /d "electron"
    start "" /min npx electron .
    cd ..
) else (
    echo  [!] Desktop app files missing. Opening browser instead...
    start "" "http://localhost:3002"
)

echo.
echo  =========================================================
:: FIX: was hardcoded v7.0.0 -- now uses CATTO_VERSION variable
echo  SUCCESS! CATTO v%CATTO_VERSION% is running at http://localhost:3002
echo  =========================================================
echo.
echo  To stop Catto, run stop.bat or close Docker Desktop.
echo.
echo  Minimizing this window in 3 seconds...
timeout /t 3 /nobreak >nul

:: Automatically Minimize the current window (Robust PowerShell hook)
powershell -Command "$c = Add-Type -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern IntPtr GetConsoleWindow(); [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h, int n);' -Name 'W32' -Namespace 'Win' -PassThru; $h = $c::GetConsoleWindow(); if ($h -ne 0) { $c::ShowWindow($h, 6) }" >nul 2>&1

:cleanup
:: Restore QuickEdit in Registry (Polite cleanup)
reg add "HKCU\Console" /v "QuickEdit" /t REG_DWORD /d 1 /f >nul 2>&1
endlocal
exit
