@echo off
echo LinkedIn Job Logger - Build Script
echo ==================================
echo.

:: Check if .NET SDK is available
dotnet --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: .NET SDK not found. Please install .NET 9 SDK.
    echo Download from: https://dotnet.microsoft.com/download
    pause
    exit /b 1
)

echo .NET SDK found. Building project...

:: Navigate to project directory
cd /d "%~dp0src\LinkedInJobLoggerHost"

:: Build and publish
echo Building release version...
dotnet publish -c Release -o "..\..\bin" --self-contained false

if %errorLevel% == 0 (
    echo.
    echo Build completed successfully!
    echo Executable location: %~dp0bin\LinkedInJobLoggerHost.exe
    echo.
    echo You can now run install.bat to register the native messaging host.
) else (
    echo.
    echo ERROR: Build failed. Please check the error messages above.
)

echo.
pause