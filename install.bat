@echo off
setlocal enabledelayedexpansion
title CATTO v8.0.0 — Installer
color 0A

:: ─────────────────────────────────────────────────────────────────────────────
::  CATTO v8.0.0 — Windows Auto-Installer
::  Requires: Windows 10 / 11, run as Administrator
::  If anything fails, follow the on-screen manual steps and press Y to retry.
:: ─────────────────────────────────────────────────────────────────────────────

:: Prevent window from closing on any unexpected error
if "%1"=="ELEVATED" goto :main
net session >nul 2>&1
if errorlevel 1 (
    echo  Requesting administrator privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\" ELEVATED' -Verb RunAs -Wait"
    goto :keepopen
)

:main
cls
echo.
echo  =========================================================
echo   ██████╗ █████╗ ████████╗████████╗ ██████╗
echo  ██╔════╝██╔══██╗╚══██╔══╝╚══██╔══╝██╔═══██╗
echo  ██║     ███████║   ██║      ██║   ██║   ██║
echo  ██║     ██╔══██║   ██║      ██║   ██║   ██║
echo  ╚██████╗██║  ██║   ██║      ██║   ╚██████╔╝
echo   ╚═════╝╚═╝  ╚═╝   ╚═╝      ╚═╝    ╚═════╝
echo  =========================================================
echo   v8.0.0  Singapore OSINT Intelligence Dashboard
echo   Ollama AI · Correlation Engine · Timeline · SEA Feeds
echo  =========================================================
echo.

set "CATTO_DIR=%~dp0"
if "%CATTO_DIR:~-1%"=="\" set "CATTO_DIR=%CATTO_DIR:~0,-1%"
echo  Install location: %CATTO_DIR%
echo.

set "ELECTRON_OK=0"
set "OLLAMA_MODEL_OK=0"
set "STEP_FAILED=0"

:: ─────────────────────────────────────────────────────────────────────────────
:step1
echo  =========================================================
echo   STEP 1 of 9 ^|  WSL (Windows Subsystem for Linux)
echo  =========================================================
echo.
wsl --status >nul 2>&1
if errorlevel 1 (
    echo  [!] WSL is not installed.
    echo      Docker Desktop requires WSL 2 to run.
    echo.
    echo  Attempting automatic WSL install...
    wsl --install
    if errorlevel 1 (
        echo.
        echo  ┌─────────────────────────────────────────────────────┐
        echo  │  MANUAL INSTALL REQUIRED — WSL                      │
        echo  │                                                      │
        echo  │  1. Open PowerShell as Administrator                 │
        echo  │  2. Run:  wsl --install                              │
        echo  │  3. Restart your PC when prompted                    │
        echo  │  4. Run this installer again after restart           │
        echo  └─────────────────────────────────────────────────────┘
        echo.
        echo  Press any key to exit. Re-run install.bat after restarting.
        pause >nul
        goto :keepopen
    )
    echo.
    echo  ┌─────────────────────────────────────────────────────┐
    echo  │  WSL installed. YOU MUST RESTART YOUR PC NOW.       │
    echo  │  After restarting, run install.bat again.           │
    echo  └─────────────────────────────────────────────────────┘
    echo.
    pause
    goto :keepopen
) else (
    echo  [OK] WSL is installed.
)

:: ─────────────────────────────────────────────────────────────────────────────
:step2
echo.
echo  =========================================================
echo   STEP 2 of 9 ^|  Docker Desktop
echo  =========================================================
echo.
where docker >nul 2>&1
if errorlevel 1 (
    echo  [!] Docker Desktop is not installed.
    echo.
    echo  ┌─────────────────────────────────────────────────────┐
    echo  │  MANUAL INSTALL REQUIRED — Docker Desktop           │
    echo  │                                                      │
    echo  │  1. Download from: https://www.docker.com/products/ │
    echo  │     docker-desktop/                                  │
    echo  │  2. Run the installer (use all default settings)     │
    echo  │  3. Start Docker Desktop and wait for the whale      │
    echo  │     icon in the taskbar to stop animating            │
    echo  │  4. Press Y here to retry                            │
    echo  └─────────────────────────────────────────────────────┘
    echo.
    start "" "https://www.docker.com/products/docker-desktop/"
    echo  Opening download page in your browser...
    echo.
    :docker_retry
    set /p "RETRY=  Have you installed and started Docker Desktop? [Y/N]: "
    if /i "!RETRY!"=="Y" (
        where docker >nul 2>&1
        if errorlevel 1 (
            echo  [!] Docker still not found. Make sure installation is complete.
            goto :docker_retry
        )
        docker info >nul 2>&1
        if errorlevel 1 (
            echo  [!] Docker found but not running. Please start Docker Desktop first.
            goto :docker_retry
        )
        echo  [OK] Docker is now running.
    ) else (
        echo  Skipping Docker. Catto cannot run without Docker.
        echo  Press any key to exit.
        pause >nul
        goto :keepopen
    )
) else (
    docker info >nul 2>&1
    if errorlevel 1 (
        echo  [!] Docker is installed but not running.
        echo.
        echo  ┌─────────────────────────────────────────────────────┐
        echo  │  Please start Docker Desktop:                        │
        echo  │  1. Open Docker Desktop from the Start menu          │
        echo  │  2. Wait for the whale icon to stop animating        │
        echo  │  3. Press Y here to retry                            │
        echo  └─────────────────────────────────────────────────────┘
        echo.
        :docker_start_retry
        set /p "RETRY=  Is Docker Desktop running? [Y/N]: "
        if /i "!RETRY!"=="Y" (
            docker info >nul 2>&1
            if errorlevel 1 (
                echo  [!] Still not running. Please check Docker Desktop.
                goto :docker_start_retry
            )
            echo  [OK] Docker daemon is running.
        ) else (
            echo  Cannot continue without Docker running.
            pause >nul
            goto :keepopen
        )
    ) else (
        echo  [OK] Docker Desktop is running.
    )
)

:: ─────────────────────────────────────────────────────────────────────────────
:step3
echo.
echo  =========================================================
echo   STEP 3 of 9 ^|  Node.js (for Electron desktop app)
echo  =========================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
    echo  [!] Node.js is not installed.
    echo.
    echo  ┌─────────────────────────────────────────────────────┐
    echo  │  MANUAL INSTALL REQUIRED — Node.js                  │
    echo  │                                                      │
    echo  │  1. Download LTS from: https://nodejs.org/          │
    echo  │  2. Run the installer (use all default settings)     │
    echo  │  3. Press Y here to retry, or N to skip             │
    echo  │                                                      │
    echo  │  NOTE: Without Node.js, the Electron desktop app    │
    echo  │  won't install. You can still use Catto in your     │
    echo  │  browser at http://localhost:3002                    │
    echo  └─────────────────────────────────────────────────────┘
    echo.
    start "" "https://nodejs.org/en/download/"
    echo  Opening download page in your browser...
    echo.
    set /p "SKIP_NODE=  Skip Node.js and continue without Electron? [Y/N]: "
    if /i "!SKIP_NODE!"=="Y" (
        echo  [SKIP] Continuing without Node.js — Electron will not be installed.
        set "SKIP_ELECTRON=1"
    ) else (
        :node_retry
        set /p "RETRY=  Have you installed Node.js? [Y/N]: "
        if /i "!RETRY!"=="Y" (
            where node >nul 2>&1
            if errorlevel 1 (
                echo  [!] Node.js still not found. Make sure installation is complete
                echo      and open a new Command Prompt window, then run install.bat again.
                goto :node_retry
            )
            echo  [OK] Node.js found.
        ) else (
            echo  [SKIP] Skipping Node.js — Electron will not be installed.
            set "SKIP_ELECTRON=1"
        )
    )
) else (
    for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VER=%%i
    echo  [OK] Node.js !NODE_VER! found.
)

:: ─────────────────────────────────────────────────────────────────────────────
:step4
echo.
echo  =========================================================
echo   STEP 4 of 9 ^|  Verifying Catto directory
echo  =========================================================
echo.
cd /d "%CATTO_DIR%"
if not exist "docker-compose.yml" (
    echo  [ERROR] docker-compose.yml not found at: %CATTO_DIR%
    echo.
    echo  Make sure install.bat is in the Catto root folder
    echo  (the folder that contains docker-compose.yml).
    echo.
    pause
    goto :keepopen
)
echo  [OK] Catto root folder verified.

:: ─────────────────────────────────────────────────────────────────────────────
:step5
echo.
echo  =========================================================
echo   STEP 5 of 9 ^|  Environment file (.env)
echo  =========================================================
echo.
if exist ".env" (
    echo  [OK] .env already exists — skipping.
) else if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo  [OK] Created .env from .env.example
) else (
    echo  [WARNING] .env.example not found. Creating blank .env...
    echo. > ".env"
)

echo.
echo  =========================================================
echo   API KEYS — fill in .env before or after installation
echo  =========================================================
echo.
echo  REQUIRED (without these, core features won't work):
echo.
echo    LTA_ACCOUNT_KEY          → datamall.mytransport.sg
echo    OPENSKY_CLIENT_ID        → opensky-network.org  (free)
echo    OPENSKY_CLIENT_SECRET    → opensky-network.org  (free)
echo    AIS_API_KEY              → aisstream.io         (free)
echo    OCEANS_X_API_KEY         → mpa.gov.sg Oceans-X portal
echo.
echo  OPTIONAL (extra intelligence layers):
echo.
echo    OTX_API_KEY              → otx.alienvault.com
echo    VIRUSTOTAL_API_KEY       → virustotal.com
echo    ABUSEIPDB_API_KEY        → abuseipdb.com
echo    SHODAN_API_KEY           → shodan.io
echo    FINNHUB_API_KEY          → finnhub.io
echo    TELEGRAM_API_ID          → my.telegram.org
echo    TELEGRAM_API_HASH        → my.telegram.org
echo    ACLED_EMAIL              → acleddata.com
echo    ACLED_PASSWORD           → acleddata.com
echo    GFW_API_TOKEN            → globalfishingwatch.org
echo.
echo  Edit .env now:   notepad "%CATTO_DIR%\.env"
echo.
set /p "OPEN_ENV=  Open .env in Notepad now to fill in keys? [Y/N]: "
if /i "!OPEN_ENV!"=="Y" (
    start notepad "%CATTO_DIR%\.env"
    echo.
    echo  Fill in your keys, save the file, then come back here.
    pause
)

:: ─────────────────────────────────────────────────────────────────────────────
:step6
echo.
echo  =========================================================
echo   STEP 6 of 9 ^|  Building Docker containers
echo   (First run downloads ~3 GB — may take 5-15 minutes)
echo  =========================================================
echo.

:: Re-check Docker is still running before we try to build
:pre_build_docker_check
docker info >nul 2>&1
if errorlevel 1 (
    echo  [!] Docker is not running. Please start Docker Desktop.
    echo.
    echo  ┌─────────────────────────────────────────────────────┐
    echo  │  1. Open Docker Desktop from the Start menu          │
    echo  │  2. Wait for the whale icon to stop animating        │
    echo  │  3. Press Y here once Docker is up                   │
    echo  └─────────────────────────────────────────────────────┘
    echo.
    :build_wait_docker
    set /p "DOCKER_UP=  Is Docker Desktop running now? [Y/N]: "
    if /i "!DOCKER_UP!"=="Y" (
        docker info >nul 2>&1
        if errorlevel 1 (
            echo  [!] Still not running. Please check Docker Desktop and try again.
            goto :build_wait_docker
        )
        echo  [OK] Docker is running. Continuing build...
    ) else (
        echo  Cannot build without Docker running.
        echo  Start Docker Desktop and run install.bat again.
        pause >nul
        goto :keepopen
    )
)

:docker_build_retry
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo  ┌─────────────────────────────────────────────────────┐
    echo  │  [ERROR] Docker build failed.                        │
    echo  │                                                      │
    echo  │  Common fixes:                                       │
    echo  │  1. Make sure Docker Desktop is fully running        │
    echo  │     (whale icon not animating)                       │
    echo  │  2. Check free disk space — need at least 10 GB      │
    echo  │  3. Check your internet connection                    │
    echo  │  4. Try manually in a Command Prompt:                │
    echo  │       docker compose down                            │
    echo  │       docker compose up -d --build                   │
    echo  │  5. Check logs: docker compose logs                  │
    echo  └─────────────────────────────────────────────────────┘
    echo.
    set /p "RETRY_BUILD=  Retry Docker build? [Y/N]: "
    if /i "!RETRY_BUILD!"=="Y" goto :pre_build_docker_check
    echo.
    echo  [!] Docker build skipped. Catto will not run until containers are built.
    echo      Run  docker compose up -d --build  manually when ready.
    set "STEP_FAILED=1"
) else (
    echo  [OK] Containers built and started.
)

:: ─────────────────────────────────────────────────────────────────────────────
:step7
echo.
echo  =========================================================
echo   STEP 7 of 9 ^|  Pulling Ollama AI model (mistral-nemo:12b)
echo   (~7 GB download — skip if you don't need on-device AI)
echo  =========================================================
echo.
set /p "PULL_MODEL=  Pull Mistral-Nemo 12B AI model now? [Y/N]: "
if /i "!PULL_MODEL!"=="Y" (
    echo.
    echo  Waiting for Ollama container to be ready...
    timeout /t 5 >nul
    :ollama_pull_retry
    docker exec catto-ollama ollama pull mistral-nemo:12b
    if errorlevel 1 (
        echo.
        echo  ┌─────────────────────────────────────────────────────┐
        echo  │  [!] Model pull failed.                              │
        echo  │                                                      │
        echo  │  Common fixes:                                       │
        echo  │  1. Make sure catto-ollama container is running:    │
        echo  │       docker ps ^| findstr ollama                    │
        echo  │  2. Check internet connection (need ~7 GB free)     │
        echo  │  3. Pull manually later:                             │
        echo  │       docker exec catto-ollama ollama pull \        │
        echo  │         mistral-nemo:12b                             │
        echo  │  4. AI features will show "AI OFFLINE" until done   │
        echo  └─────────────────────────────────────────────────────┘
        echo.
        set /p "RETRY_MODEL=  Retry model pull? [Y/N]: "
        if /i "!RETRY_MODEL!"=="Y" goto :ollama_pull_retry
        echo  [SKIP] Model pull skipped. Pull it later with:
        echo         docker exec catto-ollama ollama pull mistral-nemo:12b
    ) else (
        echo  [OK] Mistral-Nemo 12B model ready.
        set "OLLAMA_MODEL_OK=1"
    )
) else (
    echo  [SKIP] Model pull skipped.
    echo         Pull later with: docker exec catto-ollama ollama pull mistral-nemo:12b
)

:: ─────────────────────────────────────────────────────────────────────────────
:step8
echo.
echo  =========================================================
echo   STEP 8 of 9 ^|  Electron desktop app
echo  =========================================================
echo.
if defined SKIP_ELECTRON (
    echo  [SKIP] Node.js not available — skipping Electron.
    goto :electron_skip
)
if not exist "%CATTO_DIR%\electron\package.json" (
    echo  [SKIP] electron\package.json not found — skipping.
    goto :electron_skip
)

cd /d "%CATTO_DIR%\electron"
echo  Installing Electron (~120 MB)...
echo.
:electron_install_retry
npm install
if errorlevel 1 (
    echo.
    echo  ┌─────────────────────────────────────────────────────┐
    echo  │  [!] Electron npm install failed.                    │
    echo  │                                                      │
    echo  │  Manual fix — open a Command Prompt and run:         │
    echo  │    cd "%CATTO_DIR%\electron"
    echo  │    npm install                                       │
    echo  │                                                      │
    echo  │  If binary download fails specifically:              │
    echo  │    node node_modules/electron/install.js             │
    echo  │                                                      │
    echo  │  FALLBACK: browser at http://localhost:3002 works    │
    echo  │  fully without Electron.                             │
    echo  └─────────────────────────────────────────────────────┘
    echo.
    set /p "RETRY_ELECTRON=  Retry Electron install? [Y/N]: "
    if /i "!RETRY_ELECTRON!"=="Y" goto :electron_install_retry
    set "ELECTRON_OK=0"
) else (
    if exist "%CATTO_DIR%\electron\node_modules\electron\dist\electron.exe" (
        echo  [OK] Electron installed and verified.
        set "ELECTRON_OK=1"
    ) else if exist "%CATTO_DIR%\electron\node_modules\.bin\electron.cmd" (
        echo  [OK] Electron installed and verified.
        set "ELECTRON_OK=1"
    ) else (
        echo  [WARNING] npm install succeeded but Electron binary not found.
        echo  Run manually:  node node_modules/electron/install.js
        set "ELECTRON_OK=0"
    )
)

cd /d "%CATTO_DIR%"
:electron_skip

:: ─────────────────────────────────────────────────────────────────────────────
:step9
echo.
echo  =========================================================
echo   STEP 9 of 9 ^|  Desktop shortcut
echo  =========================================================
echo.
set "SHORTCUT_TARGET=%CATTO_DIR%\start_catto.bat"
set "SHORTCUT_ICON=%CATTO_DIR%\electron\assets\icon.ico"
set "SHORTCUT_PATH=%PUBLIC%\Desktop\Catto.lnk"
if not exist "%PUBLIC%\Desktop" set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Catto.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$s.TargetPath = '%SHORTCUT_TARGET%'; " ^
  "$s.WorkingDirectory = '%CATTO_DIR%'; " ^
  "$s.Description = 'Catto v8.0.0 - Singapore OSINT Intelligence Dashboard'; " ^
  "if (Test-Path '%SHORTCUT_ICON%') { $s.IconLocation = '%SHORTCUT_ICON%' }; " ^
  "$s.Save()" >nul 2>&1

if exist "%SHORTCUT_PATH%" (
    echo  [OK] Desktop shortcut created: Catto.lnk
) else (
    echo  [INFO] Shortcut creation skipped — launch via start_catto.bat
)

:: ─────────────────────────────────────────────────────────────────────────────
::  DONE
:: ─────────────────────────────────────────────────────────────────────────────
echo.
echo  =========================================================
if "!STEP_FAILED!"=="0" (
    echo   CATTO v8.0.0 IS READY
) else (
    echo   CATTO v8.0.0 — INSTALLED WITH WARNINGS (see above)
)
echo  =========================================================
echo.
echo   Dashboard (browser):  http://localhost:3002
if "!ELECTRON_OK!"=="1" (
    echo   Desktop app:          Double-click Catto on your desktop
    echo                         or run start_catto.bat
) else (
    echo   Desktop app:          Use browser at http://localhost:3002
)
echo.
if "!OLLAMA_MODEL_OK!"=="1" (
    echo   AI features:          Ready (Mistral-Nemo 12B loaded)
) else (
    echo   AI features:          Pull model when ready:
    echo                         docker exec catto-ollama ollama pull mistral-nemo:12b
)
echo.
echo  ┌──────────────────────────────────────────────────────┐
echo  │  NEXT: Fill in API keys for full functionality       │
echo  │                                                      │
echo  │  Edit: %CATTO_DIR%\.env
echo  │                                                      │
echo  │  Minimum keys:                                       │
echo  │    LTA_ACCOUNT_KEY     datamall.mytransport.sg       │
echo  │    OPENSKY_CLIENT_ID   opensky-network.org           │
echo  │    AIS_API_KEY         aisstream.io                  │
echo  │    OCEANS_X_API_KEY    mpa.gov.sg                    │
echo  │                                                      │
echo  │  After editing .env, restart containers:             │
echo  │    docker compose down ^&^& docker compose up -d     │
echo  └──────────────────────────────────────────────────────┘
echo.
echo   Useful commands:
echo     View logs:    docker compose logs -f
echo     Restart:      docker compose down ^&^& docker compose up -d
echo     Pull AI:      docker exec catto-ollama ollama pull mistral-nemo:12b
echo.
set /p "OPEN_NOW=  Open dashboard in browser now? [Y/N]: "
if /i "!OPEN_NOW!"=="Y" start "" "http://localhost:3002"

echo.
echo  Installation complete. This window will stay open.
echo  Press any key to close.
echo.

:keepopen
pause >nul
endlocal
