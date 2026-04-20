@echo off
title ADLS Explorer - Docker Setup
color 0b

echo ===================================================
echo      ADLS Explorer - Automated Docker Setup
echo ===================================================
echo.

:: Check if Docker is installed
where docker >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Docker is not installed or not running.
    echo Please install Docker Desktop from https://www.docker.com/
    echo Make sure Docker is running before executing this script.
    pause
    exit /b
)

echo [INFO] Docker detected. Building and starting the application container...
echo This might take a few minutes the first time to download the Node.js image and build the app.
echo.

:: Run docker-compose up in detached mode
call docker-compose up -d --build

if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Failed to start Docker container. Ensure Docker Desktop is running.
    pause
    exit /b
)

echo.
echo [SUCCESS] Application container is running!
echo The application will open in your default browser shortly.
echo.

:: Wait a few seconds for the server to be ready inside the container
start /b cmd /c "ping localhost -n 4 >nul && start http://localhost:3000"

echo To stop the application later, you can run:
echo docker-compose down
echo.
pause
