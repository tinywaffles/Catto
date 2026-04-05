@echo off
setlocal enabledelayedexpansion
title CATTO v8.0.0 -- Launcher
color 0A
mode con: cols=100 lines=30

:: -----------------------------------------------------------------------------
::  CATTO v8.0.0 -- Windows Alpha Launcher
::  Requires: Windows 10 / 11, run as Administrator
:: -----------------------------------------------------------------------------
:: Pre-emptively disable QuickEdit in Registry (ensures new window inherits "No Pause")
reg add "HKCU\Console" /v "QuickEdit" /t REG_DWORD /d 0 /f >nul 2>&1

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

:: ── [1/4] Check .env ─────────────────────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo  [OK] Created .env from example.
    )
)

:: ── [2/4] Start Docker Desktop ───────────────────────────────
echo  [1/4] Checking Docker Status...
docker info >nul 2>&1
if errorlevel 1 (
    echo  [!] Docker is not running. Attempting to start...
    
    set "DD_PATH="
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "DD_PATH=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    if exist "%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe" set "DD_PATH=%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe"

    if not "!DD_PATH!"=="" (
        start "" "!DD_PATH!"
        echo  [OK] Docker Desktop launched. Waiting for engine to start...
    ) else (
        echo  [ERROR] Could not find Docker Desktop. Please start it manually.
        pause
        exit /b 1
    )

    set /a WAIT_COUNT=0
    goto :docker_wait_loop
)

goto :docker_ready

:docker_wait_loop
timeout /t 5 /nobreak >nul
set /a WAIT_COUNT+=5
docker info >nul 2>&1
if not errorlevel 1 goto :docker_ready
if !WAIT_COUNT! geq 60 (
    echo  [ERROR] Docker took too long to start. Please check Docker Desktop.
    pause
    exit /b 1
)
echo      ... still waiting (!WAIT_COUNT!s)
goto :docker_wait_loop

:docker_ready
echo  [OK] Docker is ready.

:: ── [3/4] Start Catto services ─────────────────────────────
echo.
echo  [2/4] Starting Containers...
docker compose up -d
if errorlevel 1 (
    echo  [ERROR] Failed to start services. Use 'docker compose logs' to debug.
    pause
    exit /b 1
)
echo  [OK] Services are online.

:: ── [4/4] Launch Application ───────────────────────────────
echo.
echo  [3/4] Initialising OSINT Engine...
powershell -NoProfile -Command "for ($i=1; $i -le 15; $i++) { $p = [math]::Round(($i/15)*100); $bar = ('#' * $i) + ('.' * (15-$i)); Write-Host -NoNewline \"`r      Progress: [$bar] $p%% \"; Start-Sleep -Seconds 1 } Write-Host ''"

echo  [4/4] Launching Catto Desktop...
if exist "electron\node_modules\.bin\electron.cmd" (
    cd /d "electron"
    :: Launch as a detached minimized process (eliminates blank window)
    start "" /min npx electron .
    cd ..
) else (
    echo  [!] Desktop app files missing. Opening browser instead...
    start "" "http://localhost:3002"
)

echo.
echo  =========================================================
echo.
echo   Success! Minimizing this window in 3 seconds...
timeout /t 3 /nobreak >nul

:: Automatically Minimize the current window (Robust PowerShell hook)
powershell -Command "$c = Add-Type -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern IntPtr GetConsoleWindow(); [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h, int n);' -Name 'W32' -Namespace 'Win' -PassThru; $h = $c::GetConsoleWindow(); if ($h -ne 0) { $c::ShowWindow($h, 6) }" >nul 2>&1

:: Restore QuickEdit in Registry (Polite cleanup)
reg add "HKCU\Console" /v "QuickEdit" /t REG_DWORD /d 1 /f >nul 2>&1
endlocal
exit
