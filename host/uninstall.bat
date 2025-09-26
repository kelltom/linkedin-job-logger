@echo off
echo LinkedIn Job Logger - Uninstall Script
echo ======================================
echo.

:: Remove registry key for native messaging host
echo Removing native messaging host registration...
set REG_KEY="HKEY_CURRENT_USER\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.joblogger.native_host"

reg delete %REG_KEY% /f >nul 2>&1
if %errorLevel% == 0 (
    echo Successfully removed native messaging host registration.
) else (
    echo Warning: Failed to remove registry key or key was not found.
)

:: Clean up temp manifest
set TEMP_MANIFEST=%TEMP%\linkedin_job_logger_manifest.json
if exist "%TEMP_MANIFEST%" (
    del "%TEMP_MANIFEST%" >nul 2>&1
    echo Cleaned up temporary files.
)

echo.
echo Uninstallation completed.
echo.
echo Note: The extension files and host executable are not automatically deleted.
echo You can manually remove them if desired.
echo.
pause