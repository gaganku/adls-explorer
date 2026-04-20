@echo off
title ADLS Explorer Setup
color 0b

echo ===================================================
echo      ADLS Explorer - Automated Setup ^& Run
echo ===================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Node.js is not installed on this system.
    echo Please download and install the LTS version of Node.js from:
    echo https://nodejs.org/
    echo.
    echo Once installed, double-click this script again.
    pause
    exit /b
)

:: 2. Install dependencies
echo [INFO] Node.js is installed. Installing required libraries...
call npm install
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Failed to install libraries. Please check your internet connection.
    pause
    exit /b
)
echo [SUCCESS] Libraries installed successfully!
echo.

:: 3. Start the Next.js server
echo [INFO] Starting the local application server...
echo The application will open in your default browser automatically.
echo.
echo [IMPORTANT] Keep this black window open while you are using the app!
echo To stop the app, simply close this window.
echo.

:: Start a background ping to wait a few seconds before opening the browser
start /b cmd /c "ping localhost -n 6 >nul && start http://localhost:3000"

:: Start the Next.js development server
call npm run dev
