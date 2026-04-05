@echo off
title CATTO v8.0.0 -- Installer

:: If we're already elevated, skip the splash to proceed directly
if "%1"=="ELEVATED" goto :main

:splash
cls
color 0A
mode con: cols=100 lines=30
echo  =========================================================
:: Decoding the High-Res logo via PowerShell (Safe from Batch parser errors)
set "B64_LOGO=IOKWiOKWiOKWiOKWiOKWiOKWiOKVly DilojilojilojilojilojilZcg4paI4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKWiOKVly AK4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4paI4paI4pWX4pWa4pWQ4pWQ4paI4paI4pWU4pWQ4pWQ4pWd4pWa4pWQ4pWQ4paI4paI4pWU4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4pWQ4paI4paI4pWXCuKWiOKWiOKVkSAgICAg4paI4paI4paI4paI4paI4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4paI4paI4pWRICAg4paI4paI4pWRCuKWiOKWiOKVkSAgICAg4paI4paI4pWU4pWQ4pWQ4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4paI4paI4pWRICAg4paI4paI4pWRCuKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4pWa4paI4paI4paI4paI4paI4paI4pWU4pWdCiDilZrilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVnSAgIOKVmuKVkOKVnSAgICAgIOKVmuKVkOKVnSAgICDilZrilZDilZDilZDilZDilZDilZ0g"
powershell -NoProfile -Command "Write-Host ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:B64_LOGO))) -ForegroundColor Green"
echo  =========================================================
echo.
echo   CATTO v8.0.0  Singapore OSINT Dashboard
echo   Ollama AI ^| Correlation Engine ^| Timeline ^| SEA Feeds
echo.
echo  =========================================================
echo.
echo PRESS ANY KEY TO START INSTALLATION...
pause >nul

:: Prevent window from closing on any unexpected error
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Requesting administrator privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\" ELEVATED' -Verb RunAs -Wait"
    exit /b
)

:main
setlocal enabledelayedexpansion
cls
color 0A
mode con: cols=100 lines=30

echo.
echo  =========================================================
echo   CATTO v8.0.0  Singapore OSINT Dashboard
echo   Ollama AI ^| Correlation Engine ^| Timeline ^| SEA Feeds
echo   Installation Engine Initialized
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
if not errorlevel 1 goto :wsl_ok

echo  [!] WSL is not installed.
echo      Docker Desktop requires WSL 2 to run.
echo.
echo  Attempting automatic WSL install...
wsl --install
if errorlevel 1 (
    echo.
    echo  +-----------------------------------------------------+
    echo  [ MANUAL INSTALL REQUIRED -- WSL ]
    echo.
    echo  1. Open PowerShell as Administrator
    echo  2. Run:  wsl --install
    echo  3. Restart your PC when prompted
    echo  4. Run this installer again after restart
    echo  +-----------------------------------------------------+
    echo.
    echo  Press any key to exit. Re-run install.bat after restarting.
    pause >nul
    goto :keepopen
)
echo.
echo  +-----------------------------------------------------+
echo  [ WSL installed. YOU MUST RESTART YOUR PC NOW. ]
echo  After restarting, run install.bat again.
echo  +-----------------------------------------------------+
echo.
pause
goto :keepopen

:wsl_ok
echo  [OK] WSL is installed.

:: ─────────────────────────────────────────────────────────────────────────────
:step2
echo.
echo  =========================================================
echo   STEP 2 of 9 ^|  Docker Desktop
echo  =========================================================
echo.
echo  Checking for Docker...
where docker >nul 2>&1
if errorlevel 1 goto :docker_missing
docker info >nul 2>&1
if errorlevel 1 goto :docker_stopped
echo  [OK] Docker Desktop is running.
goto :step3

:docker_missing
echo  [!] Docker Desktop is not installed.
echo.
echo  +-----------------------------------------------------+
echo  [ INSTALL REQUIRED -- Docker Desktop ]
echo.
echo  1. Download from: https://www.docker.com/products/
echo     docker-desktop/
echo  2. Run the installer (use all default settings)
echo  3. Start Docker Desktop and wait for the whale icon
echo  +-----------------------------------------------------+
echo.
set /p "D_OPEN=  Open Docker download page in browser now? [Y/N]: "
if /i "%D_OPEN%"=="Y" start "" "https://www.docker.com/products/docker-desktop/"
echo.
:docker_retry
set /p "RETRY=  Have you installed and started Docker Desktop? [Y/N]: "
if /i not "!RETRY!"=="Y" (
    echo  Skipping Docker... Catto cannot run without it.
    pause >nul
    goto :keepopen
)
where docker >nul 2>&1
if errorlevel 1 goto :docker_retry
docker info >nul 2>&1
if errorlevel 1 goto :docker_retry
echo  [OK] Docker is now Ready.
goto :step3

:docker_stopped
echo  [!] Docker is installed but not running.
echo.
echo  +-----------------------------------------------------+
echo  [ Please start Docker Desktop: ]
echo.
echo  1. Open Docker Desktop from the Start menu
echo  2. Wait for the whale icon to stop animating
echo  +-----------------------------------------------------+
echo.
:docker_start_retry
set /p "RETRY=  Is Docker Desktop running now? [Y/N]: "
if /i not "!RETRY!"=="Y" (
    pause >nul
    goto :keepopen
)
docker info >nul 2>&1
if errorlevel 1 goto :docker_start_retry
echo  [OK] Docker daemon is running.

:: ─────────────────────────────────────────────────────────────────────────────
:step3
echo.
echo  =========================================================
echo   STEP 3 of 9 ^|  Node.js (for Electron desktop app)
echo  =========================================================
echo.
where node >nul 2>&1
if errorlevel 1 goto :node_missing
for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VER=%%i
echo  [OK] Node.js !NODE_VER! found.
goto :step4

:node_missing
echo  [!] Node.js is not installed.
echo.
echo  +-----------------------------------------------------+
echo  [ INSTALL REQUIRED -- Node.js ]
echo.
echo  1. Download LTS from: https://nodejs.org/
echo  2. Run the installer (use all default settings)
echo.
echo  Without Node.js, the Electron desktop app will not
echo  be installed. Browser launch only.
echo  +-----------------------------------------------------+
echo.
set /p "N_OPEN=  Open Node.js download page? [Y/N]: "
if /i "%N_OPEN%"=="Y" start "" "https://nodejs.org/en/download/"
echo.
set /p "SKIP_NODE=  Continue without Node.js (Browser-only)? [Y/N]: "
if /i "%SKIP_NODE%"=="Y" (
    set "SKIP_ELECTRON=1"
    goto :step4
)
:node_retry
set /p "RETRY=  Have you installed Node.js? [Y/N]: "
if /i not "!RETRY!"=="Y" (
    set "SKIP_ELECTRON=1"
    goto :step4
)
where node >nul 2>&1
if errorlevel 1 goto :node_retry
echo  [OK] Node.js found.

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
    echo  [OK] .env already exists -- skipping.
) else if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo  [OK] Created .env from .env.example
)

echo.
echo  =========================================================
echo   API KEYS -- REQUIRED FOR CORE FUNCTIONALITY
echo  =========================================================
echo.
echo   LTA_ACCOUNT_KEY      : datamall.mytransport.sg
echo   OPENSKY_CLIENT_ID    : opensky-network.org (free)
echo   OPENSKY_CLIENT_SECRET: opensky-network.org (free)
echo   AIS_API_KEY          : aisstream.io (free)
echo   OCEANS_X_API_KEY     : mpa.gov.sg (Oceans-X portal)
echo.
echo  =========================================================
echo.
set /p "OPEN_ENV=  Open .env in Notepad now to fill in keys? [Y/N]: "
if /i "%OPEN_ENV%"=="Y" (
    echo  Opening .env... Please save and close Notepad to continue.
    start /wait notepad "%CATTO_DIR%\.env"
)

:: ─────────────────────────────────────────────────────────────────────────────
:step6
echo.
echo  =========================================================
echo   STEP 6 of 9 ^|  Building Docker containers
echo   (First run downloads ~3 GB -- may take 5-15 minutes)
echo  =========================================================
echo.
:docker_build_retry
docker compose up -d --build
color 0A
if not errorlevel 1 (
    echo  [OK] Containers built and started.
    goto :step7
)
echo.
echo  +-----------------------------------------------------+
echo  [ERROR] Docker build failed.
echo.
echo  1. Check disk space (need 10 GB free).
echo  2. Check internet connection.
echo  3. Manual: docker compose up -d --build
echo  +-----------------------------------------------------+
echo.
set /p "RETRY_BUILD=  Retry Docker build? [Y/N]: "
if /i "%RETRY_BUILD%"=="Y" goto :docker_build_retry
set "STEP_FAILED=1"

:: ─────────────────────────────────────────────────────────────────────────────
:step7
echo.
echo  =========================================================
echo   STEP 7 of 9 ^|  Pulling Ollama AI model (mistral-nemo:12b)
echo   (~7 GB download -- skip if you don't need on-device AI)
echo  =========================================================
echo.
set /p "PULL_MODEL=  Pull Mistral-Nemo 12B AI model now? [Y/N]: "
if /i not "!PULL_MODEL!"=="Y" goto :step8

echo  Waiting for Ollama container...
timeout /t 5 >nul
:ollama_pull_retry
docker exec catto-ollama ollama pull mistral-nemo:12b
color 0A
if not errorlevel 1 (
    echo  [OK] AI model ready.
    set "OLLAMA_MODEL_OK=1"
    goto :step8
)
echo.
echo  +-----------------------------------------------------+
echo  [!] Model pull failed.
echo.
echo  1. Check catto-ollama container: docker ps
echo  2. Pull manually later: docker exec ... pull
echo  +-----------------------------------------------------+
echo.
set /p "RETRY_MODEL=  Retry model pull? [Y/N]: "
if /i "!RETRY_MODEL!"=="Y" goto :ollama_pull_retry

:: ─────────────────────────────────────────────────────────────────────────────
:step8
echo.
echo  =========================================================
echo   STEP 8 of 9 ^|  Electron desktop app
echo  =========================================================
echo.
if defined SKIP_ELECTRON goto :step9
if not exist "%CATTO_DIR%\electron\package.json" goto :step9

cd /d "%CATTO_DIR%\electron"
echo  Installing Desktop dependencies (~120 MB)...
:electron_install_retry
call npm install
color 0A
if not errorlevel 1 (
    if exist "node_modules\electron\dist\electron.exe" set "ELECTRON_OK=1"
    if exist "node_modules\.bin\electron.cmd" set "ELECTRON_OK=1"
    goto :step8_done
)
echo.
echo  +-----------------------------------------------------+
echo  [!] Electron npm install failed.
echo  FALLBACK: browser at http://localhost:3002 works fine.
echo  +-----------------------------------------------------+
echo.
set /p "RETRY_ELECTRON=  Retry Electron install? [Y/N]: "
if /i "!RETRY_ELECTRON!"=="Y" goto :electron_install_retry

:step8_done
cd /d "%CATTO_DIR%"
echo  [OK] Step 8 finished.

:: ─────────────────────────────────────────────────────────────────────────────
:step9
echo.
echo  =========================================================
echo   STEP 9 of 9 ^|  Desktop shortcut
echo  =========================================================
echo.
set /p "DO_SHORT=  Create a Catto Desktop shortcut? [Y/N]: "
if /i not "!DO_SHORT!"=="Y" goto :done

set "S_T=%CATTO_DIR%\start_catto.bat"
set "S_I=%CATTO_DIR%\electron\assets\icon.ico"
for /f "delims=" %%d in ('powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"') do set "D_P=%%d"
set "S_P=!D_P!\Catto.lnk"

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"%S_P%\"); $s.TargetPath = \"%S_T%\"; $s.WorkingDirectory = \"%CATTO_DIR%\"; $s.Description = 'Catto v8.1.3 OSINT Dashboard'; if (Test-Path \"%S_I%\") { $s.IconLocation = \"%S_I%\" }; $s.Save()" >nul 2>&1

if exist "!S_P!" (
    echo  [OK] Desktop shortcut created.
) else (
    echo  [INFO] Shortcut creation failed.
)

:: ─────────────────────────────────────────────────────────────────────────────
:done
cls
echo.
echo  =========================================================
if "%STEP_FAILED%"=="0" ( echo   CATTO v8.1.3 IS READY ) else ( echo   CATTO v8.1.3 -- READY WITH WARNINGS )
echo  =========================================================
echo.
echo   Dashboard (browser):  http://localhost:3002
if "%ELECTRON_OK%"=="1" ( echo   Desktop app:          Double-click Catto on your desktop ) else ( echo   Desktop app:          Electron not available -- use browser )
echo.
echo  +------------------------------------------------------+
echo  [ REMINDER: API KEYS ]
echo  1. Edit %CATTO_DIR%\.env and enter your keys.
echo  2. Restart to apply: docker compose down ^&^& up -d
echo  +------------------------------------------------------+
echo.
set /p "OPEN_URL=  Open dashboard in browser now? [Y/N]: "
if /i "!OPEN_URL!"=="Y" start "" "http://localhost:3002"
echo.
echo   Press any key to exit.
:keepopen
pause >nul
endlocal
exit
