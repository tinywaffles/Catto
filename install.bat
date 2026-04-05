@echo off
setlocal enabledelayedexpansion
title CATTO v7.0.0 — Installer
color 0A

:: ─────────────────────────────────────────────────────────────
::  CATTO v7.0.0 — Windows Auto-Installer
::  Requires: Windows 10/11, Administrator rights
:: ─────────────────────────────────────────────────────────────

:: ── Elevate to Administrator if not already ──────────────────
net session >nul 2>&1
if errorlevel 1 (
    echo  Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cls
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

set "CATTO_DIR=%~dp0"
if "%CATTO_DIR:~-1%"=="\" set "CATTO_DIR=%CATTO_DIR:~0,-1%"
echo  Install location: %CATTO_DIR%
echo.

set "ELECTRON_OK=0"

:: ════════════════════════════════════════════════════════════
echo  [STEP 1/8] Checking WSL (Windows Subsystem for Linux)...
:: ════════════════════════════════════════════════════════════
wsl --status >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [!] WSL is not installed. Docker Desktop requires WSL 2.
    echo.
    echo  Installing WSL now — this may take a few minutes...
    wsl --install
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  ACTION REQUIRED: Restart your computer, then        ║
    echo  ║  double-click install.bat again to continue.         ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    echo  If wsl --install fails, do it manually:
    echo    1. Open PowerShell as Administrator
    echo    2. Run: wsl --install
    echo    3. Restart your PC
    echo    4. Run install.bat again
    echo.
    pause
    exit /b 0
) else (
    echo  [OK] WSL is installed.
)

:: ════════════════════════════════════════════════════════════
echo.
echo  [STEP 2/8] Checking Docker Desktop...
:: ════════════════════════════════════════════════════════════
where docker >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [!] Docker Desktop is not installed.
    echo.
    echo  Opening the Docker Desktop download page now...
    start "" "https://www.docker.com/products/docker-desktop/"
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  1. Download and install Docker Desktop              ║
    echo  ║  2. Launch Docker Desktop and wait for it to start   ║
    echo  ║     (whale icon in the taskbar, no longer animated)  ║
    echo  ║  3. Close this window and run install.bat again      ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    echo  Manual download: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 0
) else (
    echo  [OK] Docker found.
    docker info >nul 2>&1
    if errorlevel 1 (
        echo.
        echo  [!] Docker is installed but not running.
        echo.
        echo  Please:
        echo    1. Open Docker Desktop from the Start menu
        echo    2. Wait for the whale icon in the taskbar to stop animating
        echo    3. Run install.bat again
        echo.
        pause
        exit /b 1
    )
    echo  [OK] Docker daemon is running.
)

:: ════════════════════════════════════════════════════════════
echo.
echo  [STEP 3/8] Checking Node.js (required for Electron)...
:: ════════════════════════════════════════════════════════════
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [!] Node.js is not installed. Required for the Electron desktop app.
    echo.
    echo  Opening the Node.js download page now...
    start "" "https://nodejs.org/en/download/"
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  1. Download Node.js LTS (v20 or newer)              ║
    echo  ║     from https://nodejs.org/en/download/             ║
    echo  ║  2. Run the installer — use all default settings     ║
    echo  ║  3. Restart this installer after installation         ║
    echo  ║                                                      ║
    echo  ║  NOTE: Without Node.js, the Electron desktop app     ║
    echo  ║  will not work — but you can still use Catto         ║
    echo  ║  in your browser at http://localhost:3002            ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    echo  Press any key to continue without Node.js...
    echo  (Docker containers will still be installed)
    pause >nul
    goto :skip_node_check
) else (
    for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VER=%%i
    echo  [OK] Node.js %NODE_VER% found.

    :: Check Node version is >= 18
    for /f "tokens=1 delims=." %%v in ('node --version') do (
        set "MAJOR=%%v"
        set "MAJOR=!MAJOR:v=!"
    )
    if !MAJOR! LSS 18 (
        echo  [WARNING] Node.js v18+ recommended. Current: %NODE_VER%
        echo  Consider upgrading at https://nodejs.org/en/download/
    )
)
:skip_node_check

:: ════════════════════════════════════════════════════════════
echo.
echo  [STEP 4/8] Verifying Catto directory...
:: ════════════════════════════════════════════════════════════
if not exist "%CATTO_DIR%\docker-compose.yml" (
    echo.
    echo  [!] docker-compose.yml not found in %CATTO_DIR%
    echo  Make sure install.bat is in the Catto root folder.
    echo.
    pause
    exit /b 1
)
if not exist "%CATTO_DIR%\electron\package.json" (
    echo  [WARNING] electron\package.json not found — Electron install will be skipped.
)
echo  [OK] Catto folder verified at %CATTO_DIR%

:: ════════════════════════════════════════════════════════════
echo.
echo  [STEP 5/8] Setting up environment file (.env)...
:: ════════════════════════════════════════════════════════════
cd /d "%CATTO_DIR%"

if exist ".env" (
    echo  [OK] .env already exists — skipping copy.
) else (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo  [OK] Created .env from .env.example
    ) else (
        echo  [WARNING] .env.example not found — you will need to create .env manually.
    )
)

echo.
echo  ════════════════════════════════════════════════════════
echo   API KEYS — REQUIRED FOR FULL FUNCTIONALITY
echo  ════════════════════════════════════════════════════════
echo.
echo   Open the file: %CATTO_DIR%\.env
echo   Fill in the following keys before or after installation:
echo.
echo   ┌─────────────────────────────────────────────────────┐
echo   │  REQUIRED (core features will not work without)     │
echo   │                                                     │
echo   │  LTA_ACCOUNT_KEY                                    │
echo   │    → Singapore road, traffic, bus, CCTV data        │
echo   │    → Register: datamall.mytransport.sg              │
echo   │                                                     │
echo   │  OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET          │
echo   │    → Commercial and military flight tracking        │
echo   │    → Register: opensky-network.org (free account)  │
echo   │                                                     │
echo   │  AIS_API_KEY                                        │
echo   │    → Live vessel AIS stream                         │
echo   │    → Register: aisstream.io (free tier)             │
echo   │                                                     │
echo   │  OCEANS_X_API_KEY                                   │
echo   │    → MPA Singapore port vessel positions            │
echo   │    → Register: mpa.gov.sg / Oceans-X portal        │
echo   └─────────────────────────────────────────────────────┘
echo.
echo   ┌─────────────────────────────────────────────────────┐
echo   │  OPTIONAL (enhances specific intelligence layers)   │
echo   │                                                     │
echo   │  OTX_API_KEY         → AlienVault OTX threat intel  │
echo   │  VIRUSTOTAL_API_KEY  → IOC lookup (VT engine hits)  │
echo   │  ABUSEIPDB_API_KEY   → IOC lookup (IP abuse score)  │
echo   │  SHODAN_API_KEY      → Shodan host/search overlay   │
echo   │  FINNHUB_API_KEY     → Defence stocks and markets   │
echo   │  FIRMS_MAP_KEY       → NASA fire data (country)     │
echo   │  ALERTS_IN_UA_TOKEN  → Ukraine air raid alerts      │
echo   │  ACLED_EMAIL         → ACLED conflict event data    │
echo   │  ACLED_PASSWORD      → (paired with ACLED_EMAIL)    │
echo   │  TELEGRAM_API_ID     → Telegram conflict channels   │
echo   │  TELEGRAM_API_HASH   → (paired with TELEGRAM_API_ID)│
echo   │  GFW_API_TOKEN       → Global Fishing Watch data    │
echo   └─────────────────────────────────────────────────────┘
echo.
echo   WHERE TO EDIT:
echo   notepad "%CATTO_DIR%\.env"
echo.
echo  Press any key to continue with installation...
echo  (You can fill in API keys after installation is complete)
pause >nul

:: ════════════════════════════════════════════════════════════
echo.
echo  [STEP 6/8] Building and starting Docker containers...
echo  (This will take 5-10 minutes on first run)
echo  ════════════════════════════════════════════════════════
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  [ERROR] Docker build failed.                        ║
    echo  ║                                                      ║
    echo  ║  Common fixes:                                       ║
    echo  ║  1. Make sure Docker Desktop is fully started        ║
    echo  ║     (whale icon in taskbar, not animating)           ║
    echo  ║  2. Check disk space — need at least 5 GB free       ║
    echo  ║  3. Try manually:                                    ║
    echo  ║       docker compose down                            ║
    echo  ║       docker compose up -d --build                   ║
    echo  ║  4. View error details:                              ║
    echo  ║       docker compose logs                            ║
    echo  ║  5. If image pull fails, check your internet         ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)
echo  [OK] Containers built and started.

:: ════════════════════════════════════════════════════════════
echo.
echo  [STEP 7/8] Installing Electron desktop app...
:: ════════════════════════════════════════════════════════════
if not exist "%CATTO_DIR%\electron\package.json" (
    echo  [SKIP] electron\package.json not found — skipping Electron install.
    goto :electron_skip
)

where node >nul 2>&1
if errorlevel 1 (
    echo  [SKIP] Node.js not found — skipping Electron install.
    echo  Install Node.js from https://nodejs.org then run:
    echo    cd "%CATTO_DIR%\electron"
    echo    npm install
    goto :electron_skip
)

cd /d "%CATTO_DIR%\electron"
echo  Running npm install in electron\...
echo  (Downloads Electron ~120 MB — may take a minute)
echo.

npm install
if errorlevel 1 (
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  [WARNING] Electron npm install failed.              ║
    echo  ║                                                      ║
    echo  ║  To fix manually, open a Command Prompt and run:    ║
    echo  ║                                                      ║
    echo  ║    cd "%CATTO_DIR%\electron"
    echo  ║    npm install                                       ║
    echo  ║                                                      ║
    echo  ║  If that also fails, try:                            ║
    echo  ║    npm install --prefer-offline                      ║
    echo  ║    npm cache clean --force                           ║
    echo  ║    npm install                                       ║
    echo  ║                                                      ║
    echo  ║  If Electron binary download fails specifically:     ║
    echo  ║    node node_modules/electron/install.js             ║
    echo  ║                                                      ║
    echo  ║  FALLBACK: Use the browser at http://localhost:3002  ║
    echo  ║  All features work in-browser without Electron.     ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    set "ELECTRON_OK=0"
) else (
    :: Verify the electron binary exists
    if exist "%CATTO_DIR%\electron\node_modules\.bin\electron.cmd" (
        echo  [OK] Electron installed and binary verified.
        set "ELECTRON_OK=1"
    ) else if exist "%CATTO_DIR%\electron\node_modules\electron\dist\electron.exe" (
        echo  [OK] Electron installed and binary verified.
        set "ELECTRON_OK=1"
    ) else (
        echo  [WARNING] npm install succeeded but Electron binary not found.
        echo  Try running from the electron\ directory:
        echo    node node_modules/electron/install.js
        set "ELECTRON_OK=0"
    )
)

cd /d "%CATTO_DIR%"
:electron_skip

:: ════════════════════════════════════════════════════════════
echo.
echo  Creating desktop shortcut...
:: ════════════════════════════════════════════════════════════
set "SHORTCUT_TARGET=%CATTO_DIR%\start_catto.bat"
set "SHORTCUT_ICON=%CATTO_DIR%\electron\assets\icon.ico"
set "SHORTCUT_PATH=%PUBLIC%\Desktop\Catto.lnk"
if not exist "%PUBLIC%\Desktop" set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Catto.lnk"

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$s.TargetPath = '%SHORTCUT_TARGET%'; " ^
  "$s.WorkingDirectory = '%CATTO_DIR%'; " ^
  "$s.Description = 'Catto v7.0.0 — Singapore OSINT Intelligence Dashboard'; " ^
  "if (Test-Path '%SHORTCUT_ICON%') { $s.IconLocation = '%SHORTCUT_ICON%' }; " ^
  "$s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo  [OK] Desktop shortcut created: Catto.lnk
) else (
    echo  [WARNING] Shortcut creation failed.
    echo  You can still launch Catto by running: start_catto.bat
)

:: ════════════════════════════════════════════════════════════
::  [STEP 8/8] Done
:: ════════════════════════════════════════════════════════════
echo.
echo  ════════════════════════════════════════════════════════
echo   CATTO v7.0.0 IS READY
echo  ════════════════════════════════════════════════════════
echo.
echo   Dashboard (browser):  http://localhost:3002
if "!ELECTRON_OK!"=="1" (
    echo   Desktop app:          Double-click  Catto  on your desktop
    echo                         or run start_catto.bat
) else (
    echo   Desktop app:          Electron install incomplete — see above
    echo                         Use browser at http://localhost:3002
)
echo.
echo   ┌──────────────────────────────────────────────────────┐
echo   │  NEXT STEP: Fill in your API keys                    │
echo   │                                                      │
echo   │  Open: %CATTO_DIR%\.env
echo   │                                                      │
echo   │  Minimum keys for Singapore intelligence:            │
echo   │    LTA_ACCOUNT_KEY     → datamall.mytransport.sg     │
echo   │    OPENSKY_CLIENT_ID   → opensky-network.org         │
echo   │    OPENSKY_CLIENT_SECRET                             │
echo   │    AIS_API_KEY         → aisstream.io                │
echo   │    OCEANS_X_API_KEY    → mpa.gov.sg                  │
echo   │                                                      │
echo   │  After editing .env, restart with:                   │
echo   │    docker compose down                               │
echo   │    docker compose up -d                              │
echo   │  Or just double-click start_catto.bat                │
echo   └──────────────────────────────────────────────────────┘
echo.
echo   Key registration links:
echo     LTA DataMall   → datamall.mytransport.sg
echo     OpenSky        → opensky-network.org
echo     AIS Stream     → aisstream.io
echo     MPA Oceans-X   → mpa.gov.sg
echo     AlienVault OTX → otx.alienvault.com
echo     VirusTotal     → virustotal.com
echo.
echo   View logs:   docker compose logs -f
echo   Restart:     docker compose down ^&^& docker compose up -d
echo.
echo  Press any key to open the dashboard now...
pause >nul
start "" "http://localhost:3002"

endlocal
