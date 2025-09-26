# LinkedIn Job Logger

Automate your job application workflow with one-click capture of LinkedIn job postings. This Chrome extension creates organized folders and PDF snapshots of job advertisements for your personal tracking.

Authored by Kelltom & Claude

## Features

- **One-Click Capture**: Extract job details from LinkedIn job pages automatically
- **Smart Parsing**: Robust DOM parsing that handles LinkedIn's dynamic content
- **Organized Storage**: Creates dated folders with company and job title
- **PDF Generation**: Saves job details as HTML and text files (PDF coming soon)
- **Easy Editing**: Review and edit extracted data before saving
- **Settings Management**: Configurable base folder and connection testing

## Architecture

- **Chrome Extension (Manifest V3)**: Handles LinkedIn page parsing and user interface
- **Native Messaging Host (C#)**: Manages file system operations and PDF generation
- **Secure Communication**: Uses Chrome's native messaging API for safe extension-to-desktop communication

## Installation

### Prerequisites

- Windows 10 or later
- Google Chrome browser
- .NET 9 Runtime (for the native host)

### Step 1: Build the Native Host

1. Open Command Prompt or PowerShell in the `host` directory
2. Run the build script:
   ```cmd
   build.bat
   ```
3. This will create `LinkedInJobLoggerHost.exe` in the `host/bin` directory

### Step 2: Install the Native Host

1. Run the installation script as administrator (recommended):
   ```cmd
   install.bat
   ```
2. This registers the native messaging host with Chrome

### Step 3: Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder from this project
5. Note the extension ID that appears in the extension card

### Step 4: Configure Settings

1. Click the extension icon in Chrome's toolbar
2. Click the settings gear (⚙️) icon
3. Set your base folder path (e.g., `C:\Users\%USERPROFILE%\Documents\Job Applications`)
4. Click "Test Native Host" to verify the connection
5. Save your settings

## Usage

### Capturing a Job

1. Navigate to any LinkedIn job posting (`linkedin.com/jobs/view/...`)
2. Click the LinkedIn Job Logger extension icon
3. Review the extracted job details:
   - Job Title (required)
   - Company (required)
   - Location (optional)
   - Pay (optional)
   - Job Description (read-only preview)
4. Edit any fields as needed
5. Click "Apply" to create the job folder and files

### What Gets Created

Each job creates a folder named: `{YYYY-MM-DD} {Company} - {Job Title}`

Inside the folder:
- `ad.html` - Formatted job posting with all details

### Folder Organization Example

```
📁 Job Applications/
  📁 2024-09-25 Google - Senior Software Engineer/
    📄 ad.html
  📁 2024-09-25 Microsoft - Product Manager/
    📄 ad.html
```

## Troubleshooting

### Extension Issues

**"Failed to load job data"**
- Ensure you're on a LinkedIn job page (`linkedin.com/jobs/view/...`)
- Try clicking "Rescan" to parse the page again
- Check that LinkedIn has finished loading the job details

**"Native host connection failed"**
- Run `install.bat` again to re-register the native host
- Make sure `LinkedInJobLoggerHost.exe` exists in the `host/bin` directory
- Check Chrome's extension error console for detailed error messages

### Native Host Issues

**"Base folder path does not exist"**
- Verify the folder path in settings exists and is accessible
- Use forward slashes or double backslashes in Windows paths

**"Access denied to base folder path"**
- Check folder permissions
- Try running Chrome as administrator (not recommended for regular use)

### General Issues

**Job details not extracting properly**
- LinkedIn frequently updates their page structure
- The extension uses resilient selectors but may need updates for major LinkedIn changes

## Development

### Project Structure

```
linkedin-job-logger/
├── extension/           # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js    # Service worker for native messaging
│   ├── content.js       # LinkedIn page parser
│   ├── popup.html       # Main UI
│   ├── popup.js
│   ├── settings.html
│   └── settings.js
├── host/                # Native messaging host
│   ├── src/
│   │   └── LinkedInJobLoggerHost/
│   │       ├── Program.cs
│   │       ├── NativeMessagingHost.cs
│   │       └── LinkedInJobLoggerHost.csproj
│   ├── build.bat
│   ├── install.bat
│   └── uninstall.bat
└── README.md
```

### Building from Source

1. **Native Host**:
   ```cmd
   cd host
   build.bat
   ```

2. **Extension**: No build required, load directly in Chrome developer mode

## Privacy & Security

- **Local Storage Only**: All job data stays on your computer
- **No External Services**: No data is sent to external servers
- **Minimal Permissions**: Extension only accesses LinkedIn pages and local storage
- **Open Source**: Full source code available for review

## Uninstalling

1. Remove the Chrome extension from `chrome://extensions/`
2. Run `uninstall.bat` to remove the native messaging host registration
3. Optionally delete the project folder and any created job folders

## License

This project is for personal use only. Do not publish to the Chrome Web Store or distribute without modification.

## Support

This is a personal project without formal support. However, you can:
- Check the troubleshooting section above
- Review error logs in `%TEMP%\linkedin_job_logger_error.log`
- Examine Chrome's extension console for JavaScript errors

---

This extension is not affiliated with LinkedIn.