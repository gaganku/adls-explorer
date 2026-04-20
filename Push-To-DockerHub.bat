@echo off
title Push ADLS Explorer to Docker Hub
color 0b

echo ===================================================
echo      ADLS Explorer - Build ^& Push to Docker Hub
echo ===================================================
echo.
echo This script will build your Docker image and push it to Docker Hub.
echo You must be logged into Docker Hub on this machine.
echo.

:: Prompt for Docker Hub Username
set /p username="Enter your Docker Hub Username: "
if "%username%"=="" (
    echo [ERROR] Username cannot be empty.
    pause
    exit /b
)

set imageName=%username%/adls-explorer:latest

echo.
echo [INFO] Step 1/3: Building the Docker image...
call docker build -t %imageName% .
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Docker build failed.
    pause
    exit /b
)

echo.
echo [INFO] Step 2/3: Logging into Docker (if not already logged in)...
call docker login
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Docker login failed.
    pause
    exit /b
)

echo.
echo [INFO] Step 3/3: Pushing the image to Docker Hub...
call docker push %imageName%
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Docker push failed.
    pause
    exit /b
)

echo.
echo [SUCCESS] Your image '%imageName%' has been published!
echo.
echo To share the app, just send the 'Run-ADLS-Explorer.bat' file to your friends.
echo They do NOT need the source code.
echo.
pause
