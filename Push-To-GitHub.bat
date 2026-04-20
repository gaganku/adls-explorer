@echo off
title Push ADLS Explorer to GitHub
color 0b

echo ===================================================
echo      ADLS Explorer - Push to GitHub
echo ===================================================
echo.
echo Step 1: Go to https://github.com/new and create a NEW, EMPTY repository.
echo         (Do NOT initialize it with a README, .gitignore, or license).
echo.
echo Step 2: Copy the HTTPS or SSH URL of your new repository.
echo         (It should look like: https://github.com/your-username/your-repo.git)
echo.

set /p repoUrl="Enter your GitHub Repository URL: "
if "%repoUrl%"=="" (
    color 0c
    echo [ERROR] URL cannot be empty.
    pause
    exit /b
)

echo.
echo [INFO] Pushing code to GitHub...

:: Ensure we are on the main branch
call git branch -M main

:: Add remote (remove it first just in case it already exists)
call git remote remove origin >nul 2>&1
call git remote add origin %repoUrl%

:: Push the code
call git push -u origin main

if %errorlevel% neq 0 (
    color 0c
    echo.
    echo [ERROR] Failed to push to GitHub. 
    echo Please make sure you entered the correct URL and that you are logged into GitHub locally.
    pause
    exit /b
)

echo.
echo [SUCCESS] Code successfully pushed to GitHub!
echo Your friends can now clone the repository from: %repoUrl%
echo.
pause
