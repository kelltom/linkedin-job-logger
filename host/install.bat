@echo off
echo LinkedIn Job Logger - Installation Script
echo ========================================
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Running with administrator privileges...
) else (
    echo Warning: Not running as administrator. Registry operations may fail.
    echo.
)

:: Get current directory
set SCRIPT_DIR=%~dp0
set HOST_EXE=%SCRIPT_DIR%bin\Release\LinkedInJobLoggerHost.exe
set MANIFEST_FILE=%SCRIPT_DIR%native-messaging-manifest.json

echo Checking for host executable...
if not exist "%HOST_EXE%" (
    echo ERROR: Host executable not found at %HOST_EXE%
    echo Please build the project first using: build.bat
    pause
    exit /b 1
)

echo Host executable found: %HOST_EXE%

:: Get Chrome extension ID
echo.
echo Please provide your Chrome extension ID.
echo You can find this at chrome://extensions/ after loading the extension.
echo It should look like: khcdpkncnmhkdmjmpbmijgchopjliood
echo.
set /p EXTENSION_ID="Enter Extension ID: "

if "%EXTENSION_ID%"=="" (
    echo ERROR: Extension ID is required
    pause
    exit /b 1
)

:: Create temporary manifest with correct paths
echo Creating native messaging manifest...
set TEMP_MANIFEST=%TEMP%\linkedin_job_logger_manifest.json
powershell -Command "(Get-Content '%MANIFEST_FILE%') -replace 'REPLACE_WITH_ACTUAL_PATH', '%HOST_EXE:\=\\%' -replace 'REPLACE_WITH_EXTENSION_ID', '%EXTENSION_ID%' | Out-File -FilePath '%TEMP_MANIFEST%' -Encoding UTF8"

:: Verify the manifest was created correctly
echo Verifying manifest content...
powershell -Command "Get-Content '%TEMP_MANIFEST%' | Out-String" | findstr "REPLACE_WITH" >nul
if %errorLevel% == 0 (
    echo ERROR: Manifest still contains placeholder values
    echo Please check the template file and try again
    pause
    exit /b 1
)

:: Create registry key for native messaging host
echo Registering native messaging host with Chrome...
set REG_KEY="HKEY_CURRENT_USER\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.joblogger.native_host"

reg add %REG_KEY% /ve /t REG_SZ /d "%TEMP_MANIFEST%" /f >nul 2>&1
if %errorLevel% == 0 (
    echo Successfully registered native messaging host.
) else (
    echo ERROR: Failed to register native messaging host.
    echo Make sure you have permission to write to the registry.
    pause
    exit /b 1
)

echo.
echo Installation completed successfully!
echo Extension ID: %EXTENSION_ID%
echo Host executable: %HOST_EXE%
echo Manifest file: %TEMP_MANIFEST%
echo.
echo Next steps:
echo 1. Restart Chrome completely
echo 2. Configure the base folder path in extension settings
echo 3. Test the connection using the "Test Native Host" button
echo.
pause