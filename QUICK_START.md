# Quick Start Guide

## Installation Summary

✅ **Native Host Built**: `LinkedInJobLoggerHost.exe` created successfully  
⏳ **Extension & Host Setup**: Follow steps below  

## Installation Steps

### 1. Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Navigate to and select: `c:\Users\kelle\repos\linkedin-job-logger\extension`
5. **Copy the Extension ID** (it will look like `khcdpkncnmhkdmjmpbmijgchopjliood`)

### 2. Register the Native Host

1. **Run as Administrator**: Right-click `host\install.bat` → "Run as administrator"
2. **Enter Extension ID**: Paste the ID you copied in step 1
3. Wait for "Installation completed successfully!"
4. **Restart Chrome completely**

### 3. Configure Base Folder

1. Click the extension icon in Chrome
2. Click the settings gear (⚙️) 
3. Set your base folder (e.g., `C:\Users\kelle\Documents\Job Applications`)
4. Click "Test Native Host" - you should see "Native host connection successful!"
5. Save settings

### 4. Test on LinkedIn

1. Go to any LinkedIn job posting: `https://www.linkedin.com/jobs/view/[job-id]`
2. Click the extension icon
3. Review the parsed job data
4. Click "Apply" to create the job folder

## Troubleshooting

### "Native host connection failed"
- **Re-run installation**: Run `host\install.bat` as administrator with correct extension ID
- **Restart Chrome**: Completely close and reopen Chrome
- **Check paths**: Verify the host executable exists at the correct location

### "Extension ID mismatch"
- Copy the extension ID from `chrome://extensions/`
- Re-run `install.bat` with the correct ID

### "Base folder path does not exist"
- Create the folder or choose an existing path
