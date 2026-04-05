@echo off
title CATTO — Shutdown

echo.
echo  ----------------------------------------
echo  CATTO — Stopping all containers
echo  ----------------------------------------
echo.

cd /d "%~dp0"

docker compose down
if errorlevel 1 (
    echo.
    echo  [ERROR] docker compose down failed.
    echo  You can force-stop containers with: docker ps -q | xargs docker stop
    echo.
) else (
    echo.
    echo  All CATTO containers stopped.
    echo.
)

pause
