@echo off
title Run ADLS Explorer
color 0b

echo ===================================================
echo      ADLS Explorer - Run from Cloud
echo ===================================================
echo.

:: IMPORTANT: The sender must update this variable to their Docker Hub username!
set username=YOUR_DOCKER_USERNAME_HERE

if "%username%"=="YOUR_DOCKER_USERNAME_HERE" (
    color 0c
    echo [ERROR] The script hasn't been configured yet!
    echo Please edit this file and replace YOUR_DOCKER_USERNAME_HERE with the actual username.
    pause
    exit /b
)

set imageName=%username%/adls-explorer:latest

:: Check if Docker is installed
where docker >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Docker is not installed or not running.
    echo Please install Docker Desktop from https://www.docker.com/
    pause
    exit /b
)

echo [INFO] Pulling the latest version of ADLS Explorer...
call docker pull %imageName%

echo.
echo [INFO] Starting the application...
call docker run -d -p 3000:3000 --name adls-explorer --restart unless-stopped %imageName%

if %errorlevel% neq 0 (
    echo [WARNING] Container might already be running. Attempting to start it...
    call docker start adls-explorer
)

echo.
echo [SUCCESS] ADLS Explorer is running!
echo The application will open in your default browser shortly.
echo.

:: Open browser
start /b cmd /c "ping localhost -n 3 >nul && start http://localhost:3000"

echo To stop the app later, run: docker stop adls-explorer
pause
