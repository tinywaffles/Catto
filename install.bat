@echo off
setlocal enabledelayedexpansion
title CATTO v8.0.0 -- Installer
color 0A
mode con: cols=100 lines=30

:: -----------------------------------------------------------------------------
::  CATTO v8.0.0 -- Windows Auto-Installer
::  Requires: Windows 10 / 11, run as Administrator
:: -----------------------------------------------------------------------------
:: Pre-emptively disable QuickEdit in Registry (ensures new window inherits "No Pause")
reg add "HKCU\Console" /v "QuickEdit" /t REG_DWORD /d 0 /f >nul 2>&1

:: Request Admin
if "%1"=="ELEVATED" goto :main
net session >nul 2>&1
if errorlevel 1 (
    echo  Requesting administrator privileges...
    powershell -Command "Start-Process conhost.exe -ArgumentList 'cmd.exe /c \"%~f0\" ELEVATED' -Verb RunAs"
    exit /b
)

:main
:: Disable QuickEdit Mode (prevents clicking in window from pausing execution)
powershell -Command "$i = [System.IntPtr](-10); $k = Add-Type -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern IntPtr GetStdHandle(int n); [DllImport(\"kernel32.dll\")] public static extern bool GetConsoleMode(IntPtr h, out uint m); [DllImport(\"kernel32.dll\")] public static extern bool SetConsoleMode(IntPtr h, uint m);' -Name 'W32' -Namespace 'Console' -PassThru; $h = $k::GetStdHandle(-10); $m = [uint]0; $k::GetConsoleMode($h, [ref]$m); $k::SetConsoleMode($h, $m -band 0xFF3F);" >nul 2>&1
cls
echo.
echo  =========================================================
:: Decoding the original Unicode logo via PowerShell (Safe from Batch parser errors)
powershell -NoProfile -Command ^
  "$b64 = \"IOKWiOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilojilojilojilZcg4paI4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKWiOKVlyAK4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4paI4paI4pWX4pWa4pWQ4pWQ4paI4paI4pWU4pWQ4pWQ4pWd4pWa4pWQ4pWQ4paI4paI4pWU4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4pWQ4paI4paI4pWXCuKWiOKWiOKVkSAgICAg4paI4paI4paI4paI4paI4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4paI4paI4pWRICAg4paI4paI4pWRCuKWiOKWiOKVkSAgICAg4paI4paI4pWU4pWQ4pWQ4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4paI4paI4pWRICAg4paI4paI4pWRCuKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4pWa4paI4paI4paI4paI4paI4paI4pWU4pWdCiDilZrilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVnSAgIOKVmuKVkOKVnSAgICAgIOKVmuKVkOKVnSAgICDilZrilZDilZDilZDilZDilZDilZ0g\"; " ^
  "$logo = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64)); " ^
  "Write-Host $logo -ForegroundColor Green"
echo  =========================================================
echo   v8.0.0  Singapore OSINT Intelligence Dashboard
echo  =========================================================
echo.
echo  [DEBUG] Press any key to start the installer...
pause >nul

set "CATTO_DIR=%~dp0"
if "%CATTO_DIR:~-1%"=="\" set "CATTO_DIR=%CATTO_DIR:~0,-1%"
echo  Location: %CATTO_DIR%

:: -----------------------------------------------------------------------------
:step1
echo.
echo  [STEP 1/9] Checking WSL...
wsl --status >nul 2>&1
if not errorlevel 1 (
    echo  [OK] WSL is installed.
    goto :step1_done
)

echo  [!] WSL is NOT installed.
echo  Attempting automatic install...
wsl --install
if errorlevel 1 (
    echo.
    echo  +-----------------------------------------------------+
    echo  [ MANUAL INSTALL REQUIRED - WSL ]
    echo  1. Open PowerShell as Administrator
    echo  2. Run: wsl --install
    echo  3. Restart and run this script again.
    echo  +-----------------------------------------------------+
    pause
    goto :keepopen
)
echo  [OK] WSL installed. You must RESTART your PC now.
pause
goto :keepopen

:step1_done
echo  [OK] Step 1 finished.

:: -----------------------------------------------------------------------------
:step2
echo.
echo  [STEP 2/9] Checking Docker...
where docker >nul 2>&1
if errorlevel 1 goto :docker_miss

docker info >nul 2>&1
if errorlevel 1 goto :docker_off

echo  [OK] Docker is running.
goto :step2_done

:docker_miss
echo  [!] Docker is NOT installed.
echo  Opening download page...
start "" "https://www.docker.com/products/docker-desktop/"
echo.
set /p "D_RETRY=  Have you installed Docker? [Y/N]: "
if /i "!D_RETRY!"=="Y" goto :step2
goto :keepopen

:docker_off
echo  [!] Docker is installed but NOT running.
echo  Please start Docker Desktop and wait for it to be ready.
echo.
set /p "D_RUN=  Is Docker running now? [Y/N]: "
if /i "!D_RUN!"=="Y" goto :step2
goto :keepopen

:step2_done
echo  [OK] Step 2 finished.

:: -----------------------------------------------------------------------------
:step3
echo.
echo  [STEP 3/9] Checking Node.js...
where node >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%i in ('node --version') do set N_VER=%%i
    echo  [OK] Node.js !N_VER! found.
    goto :step3_done
)

echo  [!] Node.js is NOT installed.
echo  Opening download page...
start "" "https://nodejs.org/"
echo.
set /p "N_SKIP=  Skip Node.js? (Electron won't work) [Y/N]: "
if /i "!N_SKIP!"=="Y" (
    set "SKIP_ELECTRON=1"
    goto :step3_done
)
set /p "N_RETRY=  Is Node.js installed now? [Y/N]: "
if /i "!N_RETRY!"=="Y" goto :step3
goto :keepopen

:step3_done
echo  [OK] Step 3 finished.

:: -----------------------------------------------------------------------------
:step4
echo.
echo  [STEP 4/9] Verifying Folder...
cd /d "%CATTO_DIR%"
if not exist "docker-compose.yml" (
    echo  [ERROR] docker-compose.yml not found in %CATTO_DIR%
    pause
    goto :keepopen
)
echo  [OK] Folder verified.

:: -----------------------------------------------------------------------------
:step5
echo.
echo  [STEP 5/9] Setting up Environment...
if exist ".env" (
    echo  [OK] .env exists.
) else (
    copy ".env.example" ".env"
    echo  [OK] Created .env from example.
)
echo  Opening .env for key entry (Optional)...
set /p "ENV_ED=  Open .env now? [Y/N]: "
if /i "!ENV_ED!"=="Y" start notepad .env
echo  [OK] Step 5 finished.
echo  Check your .env keys later for full functionality.

:: -----------------------------------------------------------------------------
:step6
echo.
echo  [STEP 6/9] Building Containers...
docker compose up -d --build
if errorlevel 1 (
    echo  [ERROR] Build failed. Check Docker logs.
    pause
    goto :keepopen
)
echo  [OK] Containers running.

:: -----------------------------------------------------------------------------
:step7
echo.
echo  [STEP 7/9] Pulling AI model...
set /p "AI_P=  Pull Mistral-Nemo AI? (takes 7GB) [Y/N]: "
if /i "!AI_P!"=="Y" (
    docker exec catto-ollama ollama pull mistral-nemo:12b
    if errorlevel 1 echo  [WARNING] AI pull failed.
)

:: -----------------------------------------------------------------------------
:step8
echo.
echo  [STEP 8/9] Electron Setup...
if defined SKIP_ELECTRON goto :step8_skip
if not exist "electron" goto :step8_skip

cd electron
echo  Installing Electron dependencies...
call npm install
cd ..
:step8_skip
echo.

:: -----------------------------------------------------------------------------
:step9
echo.
echo  [STEP 9/9] Creating Shortcut...
set "S_T=%CATTO_DIR%\start_catto.bat"
:: Using PowerShell to get the REAL Desktop path (OneDrive compatible)
for /f "usebackq tokens=*" %%d in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "D_P=%%d"
set "S_P=%D_P%\Catto.lnk"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut(\"%S_P%\"); $s.TargetPath = \"%S_T%\"; $s.WorkingDirectory = \"%CATTO_DIR%\"; $s.WindowStyle = 1; $s.Save()" >nul 2>&1

if exist "%S_P%" (
    echo  [OK] Desktop shortcut created at: %S_P%
) else (
    echo  [INFO] Shortcut skipped or failed to create.
)

:: -----------------------------------------------------------------------------
:done
cls
:: Decoding the original Unicode logo via PowerShell (Safe from Batch parser errors)
powershell -NoProfile -Command ^
  "$b64 = \"IOKWiOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilojilojilojilZcg4paI4paI4paI4paI4paI4paI4paI4paI4pWX4paI4paI4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKWiOKVlyAK4paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4paI4paI4pWX4pWa4pWQ4pWQ4paI4paI4pWU4pWQ4pWQ4pWd4pWa4pWQ4pWQ4paI4paI4pWU4pWQ4pWQ4pWd4paI4paI4pWU4pWQ4pWQ4pWQ4paI4paI4pWXCuKWiOKWiOKVkSAgICAg4paI4paI4paI4paI4paI4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4paI4paI4pWRICAg4paI4paI4pWRCuKWiOKWiOKVkSAgICAg4paI4paI4pWU4pWQ4pWQ4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4paI4paI4pWRICAg4paI4paI4pWRCuKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVkSAg4paI4paI4pWRICAg4paI4paI4pWRICAgICAg4paI4paI4pWRICAg4pWa4paI4paI4paI4paI4paI4paI4pWU4pWdCiDilZrilZDilZDilZDilZDilZDilZ3ilZrilZDilZ0gIOKVmuKVkOKVnSAgIOKVmuKVkOKVnSAgICAgIOKVmuKVkOKVnSAgICDilZrilZDilZDilZDilZDilZDilZ0g\"; " ^
  "$logo = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64)); " ^
  "Write-Host $logo -ForegroundColor Green"
echo  =========================================================
echo   INSTALLATION COMPLETE
echo  =========================================================
echo   Dashboard: http://localhost:3002
echo.
echo   Press any key to exit this window.

:keepopen
pause >nul
:: Restore QuickEdit in Registry (Polite cleanup)
reg add "HKCU\Console" /v "QuickEdit" /t REG_DWORD /d 1 /f >nul 2>&1
endlocal
exit
