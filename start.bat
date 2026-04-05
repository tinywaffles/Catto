@echo off
setlocal enabledelayedexpansion
title CATTO — Launcher

echo.
echo  ██████╗ █████╗ ████████╗████████╗ ██████╗
echo ██╔════╝██╔══██╗╚══██╔══╝╚══██╔══╝██╔═══██╗
echo ██║     ███████║   ██║      ██║   ██║   ██║
echo ██║     ██╔══██║   ██║      ██║   ██║   ██║
echo ╚██████╗██║  ██║   ██║      ██║   ╚██████╔╝
echo  ╚═════╝╚═╝  ╚═╝   ╚═╝      ╚═╝    ╚═════╝
echo.
echo  Singapore OSINT Intelligence Dashboard
echo  ----------------------------------------
echo.

cd /d "%~dp0"

:: [1/5] Check Docker is installed
echo [1/5] Checking Docker installation...
where docker >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Docker is not installed or not in PATH.
    echo  Download Docker Desktop from: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)
echo        Docker found.

:: [2/5] Check Docker daemon is running
echo [2/5] Checking Docker daemon...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Docker daemon is not running.
    echo  Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)
echo        Docker daemon is running.

:: [3/5] Check .env file
echo [3/5] Checking environment file...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo.
        echo  [NOTICE] .env file created from .env.example
        echo  Please open .env and fill in your API keys before continuing.
        echo.
        echo  Required keys:
        echo    LTA_ACCOUNT_KEY       - LTA DataMall
        echo    OPENSKY_CLIENT_ID     - OpenSky Network
        echo    OPENSKY_CLIENT_SECRET - OpenSky Network
        echo    AIS_API_KEY           - aisstream.io
        echo.
        echo  Press any key to continue, or close this window to edit .env first.
        pause >nul
    ) else (
        echo  [WARNING] No .env file found. Some features may not work without API keys.
    )
) else (
    echo        .env file found.
)

:: [4/5] Pull latest images
echo [4/5] Pulling latest images...
docker compose pull --quiet 2>nul
if errorlevel 1 (
    echo  [WARNING] Image pull failed. Using cached images if available.
) else (
    echo        Images up to date.
)

:: [5/5] Start containers
echo [5/5] Starting CATTO...
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to start containers.
    echo  Run "docker compose logs" in this folder to see what went wrong.
    echo.
    pause
    exit /b 1
)

echo.
echo  ----------------------------------------
echo  CATTO is up. Opening http://localhost:3002
echo  (Allow 10-15 seconds for first load)
echo  ----------------------------------------
echo.
echo  To stop CATTO, run stop.bat
echo.

timeout /t 5 /nobreak >nul
start "" "http://localhost:3002"

endlocal
