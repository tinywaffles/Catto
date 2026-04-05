@echo off
setlocal enabledelayedexpansion
title CATTO v7.0.0 — Launcher
color 0A

cd /d "%~dp0"

echo.
echo  ██████╗ █████╗ ████████╗████████╗ ██████╗
echo ██╔════╝██╔══██╗╚══██╔══╝╚══██╔══╝██╔═══██╗
echo ██║     ███████║   ██║      ██║   ██║   ██║
echo ██║     ██╔══██║   ██║      ██║   ██║   ██║
echo ╚██████╗██║  ██║   ██║      ██║   ╚██████╔╝
echo  ╚═════╝╚═╝  ╚═╝   ╚═╝      ╚═╝    ╚═════╝
echo.
echo  v7.0.0  Singapore OSINT Intelligence Dashboard
echo  ════════════════════════════════════════════════
echo.

:: ── [1/4] Check .env and remind about API keys ───────────────
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo  [NOTICE] .env was missing — created from .env.example
    )
)

:: Check if required keys look empty (basic check)
set "MISSING_KEYS="
findstr /i "^LTA_ACCOUNT_KEY=$\|^LTA_ACCOUNT_KEY= $" .env >nul 2>&1 && set "MISSING_KEYS=!MISSING_KEYS! LTA_ACCOUNT_KEY"
findstr /i "^OPENSKY_CLIENT_ID=$\|^OPENSKY_CLIENT_ID= $" .env >nul 2>&1 && set "MISSING_KEYS=!MISSING_KEYS! OPENSKY"
findstr /i "^AIS_API_KEY=$\|^AIS_API_KEY= $" .env >nul 2>&1 && set "MISSING_KEYS=!MISSING_KEYS! AIS_API_KEY"

if not "!MISSING_KEYS!"=="" (
    echo.
    echo  ┌──────────────────────────────────────────────────────┐
    echo  │  WARNING: Some API keys appear to be empty.          │
    echo  │  These intelligence layers will not load:            │
    echo  │                                                      │
    echo  │  LTA_ACCOUNT_KEY    → Singapore road/traffic/bus     │
    echo  │  OPENSKY_CLIENT_ID  → Commercial ^& military flights  │
    echo  │  AIS_API_KEY        → Live vessel tracking           │
    echo  │  OCEANS_X_API_KEY   → MPA Singapore port vessels     │
    echo  │                                                      │
    echo  │  Edit your keys:  %~dp0.env
    echo  │                                                      │
    echo  │  Optional keys for enhanced intelligence:            │
    echo  │  OTX_API_KEY        → AlienVault threat intel        │
    echo  │  VIRUSTOTAL_API_KEY → IOC malware lookup             │
    echo  │  ABUSEIPDB_API_KEY  → IP abuse scoring               │
    echo  │  SHODAN_API_KEY     → Shodan host overlay            │
    echo  │  TELEGRAM_API_ID    → Conflict channel monitor       │
    echo  └──────────────────────────────────────────────────────┘
    echo.
    echo  Press any key to start anyway, or close this window to edit .env first.
    pause >nul
)

:: ── [2/4] Start Docker Desktop if not running ────────────────
echo  [1/4] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo  Docker Desktop is not running. Starting it now...

    :: Try common install locations
    set "DD_PATH="
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        set "DD_PATH=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe" (
        set "DD_PATH=%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe"
    )

    if not "!DD_PATH!"=="" (
        start "" "!DD_PATH!"
    ) else (
        echo  [!] Could not find Docker Desktop. Please start it manually.
        pause
        exit /b 1
    )

    echo  Waiting for Docker to become ready (up to 60 seconds)...
    set /a WAIT=0
:DOCKER_WAIT
    timeout /t 5 /nobreak >nul
    set /a WAIT+=5
    docker info >nul 2>&1
    if not errorlevel 1 goto DOCKER_READY
    if !WAIT! geq 60 (
        echo  [ERROR] Docker did not start in time. Please start Docker Desktop manually and try again.
        pause
        exit /b 1
    )
    echo  Still waiting... (!WAIT!s)
    goto DOCKER_WAIT
:DOCKER_READY
    echo  [OK] Docker is ready.
) else (
    echo  [OK] Docker is already running.
)

:: ── [3/4] Start Catto containers ─────────────────────────────
echo.
echo  [2/4] Starting Catto services...
docker compose up -d
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to start containers.
    echo  Check logs with:  docker compose logs
    echo.
    pause
    exit /b 1
)
echo  [OK] Catto backend and frontend containers started.

:: ── Wait for frontend to be healthy ──────────────────────────
echo.
echo  [3/4] Waiting 15 seconds for services to initialise...
timeout /t 15 /nobreak >nul
echo  [OK] Services should be ready.

:: ── [4/4] Launch Electron desktop app ────────────────────────
echo.
echo  [4/4] Launching Catto desktop app...

if exist "%~dp0electron\node_modules\.bin\electron.cmd" (
    cd /d "%~dp0electron"
    start "" cmd /c "npx electron . && cd /d %~dp0"
    cd /d "%~dp0"
) else if exist "%~dp0electron\package.json" (
    cd /d "%~dp0electron"
    echo  Installing Electron dependencies first...
    npm install --silent
    start "" cmd /c "npx electron ."
    cd /d "%~dp0"
) else (
    echo  [!] Electron not found. Opening browser instead...
    start "" "http://localhost:3002"
)

echo.
echo  ════════════════════════════════════════════════════════
echo   CATTO v7.0.0 is running at http://localhost:3002
echo  ════════════════════════════════════════════════════════
echo.
echo  To stop Catto, run stop.bat or close Docker Desktop.
echo.
timeout /t 5 /nobreak >nul

endlocal
