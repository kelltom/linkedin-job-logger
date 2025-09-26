// Popup JavaScript
class JobLoggerPopup {
  constructor() {
    this.currentJobData = null;
    this.isExpanded = false;
    this.isLoading = false;
    
    this.bindEvents();
    this.initialize();
  }

  bindEvents() {
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
    document.getElementById('rescanBtn').addEventListener('click', () => this.rescanJob());
    document.getElementById('applyBtn').addEventListener('click', (e) => this.submitJob(e));
    document.getElementById('expandBtn').addEventListener('click', () => this.toggleDescription());
    
    // Copy button events
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.copyFieldValue(e.target));
    });
    
    // Form validation
    const form = document.getElementById('jobForm');
    form.addEventListener('input', () => this.validateForm());
  }

  async initialize() {
    try {
      await this.loadJobData();
    } catch (error) {
      this.showStatus('error', `Failed to load job data: ${error.message}`);
    }
  }

  async loadJobData() {
    this.setLoading(true);
    this.showStatus('loading', 'Parsing job data...');

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('linkedin.com/jobs/')) {
        throw new Error('Please navigate to a LinkedIn job page');
      }

      // First try to inject the content script if it's not already there
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (injectionError) {
        console.log('Content script may already be injected:', injectionError);
      }

      // Wait a moment for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send message to content script with retry logic
      let response;
      let retries = 3;
      
      while (retries > 0) {
        try {
          response = await chrome.tabs.sendMessage(tab.id, { type: 'PARSE_JOB_DATA' });
          break;
        } catch (messageError) {
          console.log(`Message attempt failed, retries left: ${retries - 1}`, messageError);
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw new Error('Could not communicate with LinkedIn page. Please refresh the page and try again.');
          }
        }
      }
      
      if (!response.success) {
        throw new Error(response.error);
      }

      this.currentJobData = response.data;
      this.populateForm(this.currentJobData);
      this.hideStatus();
      
    } catch (error) {
      console.error('Error loading job data:', error);
      this.showStatus('error', error.message);
      // Still allow manual entry
      this.enableManualEntry();
    } finally {
      this.setLoading(false);
    }
  }

  populateForm(data) {
    document.getElementById('title').value = data.title || '';
    document.getElementById('company').value = data.company || '';
    document.getElementById('location').value = data.location || '';
    document.getElementById('pay').value = data.pay || '';
    
    const preview = document.getElementById('descriptionPreview');
    if (data.descriptionHtml) {
      preview.innerHTML = data.descriptionHtml;
    } else {
      preview.textContent = 'No description available';
    }
    
    this.validateForm();
  }

  enableManualEntry() {
    // Clear form and enable manual data entry
    const inputs = document.querySelectorAll('#jobForm input');
    inputs.forEach(input => {
      input.value = '';
      input.removeAttribute('readonly');
    });
    
    document.getElementById('descriptionPreview').textContent = 'Description not available - please enter job details manually';
  }

  validateForm() {
    const title = document.getElementById('title').value.trim();
    const company = document.getElementById('company').value.trim();
    
    const titleError = document.getElementById('titleError');
    const companyError = document.getElementById('companyError');
    const applyBtn = document.getElementById('applyBtn');
    
    let isValid = true;
    
    if (!title) {
      titleError.classList.remove('hidden');
      isValid = false;
    } else {
      titleError.classList.add('hidden');
    }
    
    if (!company) {
      companyError.classList.remove('hidden');
      isValid = false;
    } else {
      companyError.classList.add('hidden');
    }
    
    applyBtn.disabled = !isValid || this.isLoading;
    return isValid;
  }

  async rescanJob() {
    try {
      await this.loadJobData();
    } catch (error) {
      this.showStatus('error', `Rescan failed: ${error.message}`);
    }
  }

  async submitJob(e) {
    e.preventDefault();
    
    if (!this.validateForm()) {
      return;
    }

    this.setLoading(true);
    this.showStatus('loading', 'Creating job folder and PDF...');

    try {
      // Get settings
      const settings = await this.getSettings();
      if (!settings.baseFolder) {
        throw new Error('Base folder not configured. Please go to Settings first.');
      }

      // Prepare payload
      const formData = new FormData(document.getElementById('jobForm'));
      const payload = {
        version: "1.0",
        kind: "CreateJobPacket",
        requestId: this.generateUUID(),
        payload: {
          sourceUrl: this.currentJobData?.sourceUrl || window.location.href,
          capturedAtIso: new Date().toISOString(),
          title: formData.get('title'),
          company: formData.get('company'),
          location: formData.get('location') || null,
          pay: formData.get('pay') || null,
          postedAge: this.currentJobData?.postedAge || null,
          applicants: this.currentJobData?.applicants || null,
          descriptionHtml: this.currentJobData?.descriptionHtml || '',
          baseFolder: settings.baseFolder,
          folderName: this.generateFolderName(formData.get('company'), formData.get('title')),
          pdfFileName: "ad.pdf"
        }
      };

      // Send to native host
      const response = await chrome.runtime.sendMessage({
        type: 'SEND_TO_HOST',
        payload: payload
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      const result = response.response;
      if (!result.ok) {
        throw new Error(`${result.errorCode}: ${result.message}`);
      }

      // Show success
      this.showStatus('success', 
        `Job saved successfully!<br>
         <strong>Folder:</strong> ${result.folderPath}<br>
         <strong>PDF:</strong> ${result.pdfPath}`,
        [
          { text: 'Copy Path', action: () => this.copyToClipboard(result.folderPath) },
          { text: 'Open Folder', action: () => this.openFolder(result.folderPath) }
        ]
      );

    } catch (error) {
      console.error('Submit error:', error);
      this.showStatus('error', error.message);
    } finally {
      this.setLoading(false);
    }
  }

  generateFolderName(company, title) {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitized = `${date} ${company} - ${title}`.replace(/[<>:"/\\|?*]/g, '_');
    return sanitized.substring(0, 150).trim();
  }

  async getSettings() {
    const result = await chrome.storage.local.get(['baseFolder']);
    return {
      baseFolder: result.baseFolder || ''
    };
  }

  toggleDescription() {
    const preview = document.getElementById('descriptionPreview');
    const btn = document.getElementById('expandBtn');
    
    if (this.isExpanded) {
      preview.classList.remove('expanded');
      btn.textContent = 'Show More';
      this.isExpanded = false;
    } else {
      preview.classList.add('expanded');
      btn.textContent = 'Show Less';
      this.isExpanded = true;
    }
  }

  setLoading(loading) {
    this.isLoading = loading;
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = loading);
    
    if (!loading) {
      this.validateForm(); // Re-enable apply button if form is valid
    }
  }

  showStatus(type, message, actions = []) {
    const statusDiv = document.getElementById('status');
    statusDiv.className = `status ${type}`;
    
    let html = '';
    if (type === 'loading') {
      html = '<span class="spinner"></span>';
    }
    html += message;
    
    if (actions.length > 0) {
      html += '<div class="status-actions">';
      actions.forEach(action => {
        html += `<button class="btn-small" onclick="(${action.action.toString()})()">${action.text}</button>`;
      });
      html += '</div>';
    }
    
    statusDiv.innerHTML = html;
    statusDiv.classList.remove('hidden');
  }

  hideStatus() {
    document.getElementById('status').classList.add('hidden');
  }

  openSettings() {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showStatus('success', 'Path copied to clipboard!');
      setTimeout(() => this.hideStatus(), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }

  async copyFieldValue(button) {
    try {
      const targetId = button.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const value = input.value.trim();
      
      if (!value) {
        // Briefly highlight the button to show it was clicked but nothing to copy
        button.style.color = '#ff9800';
        setTimeout(() => button.style.color = '', 500);
        return;
      }
      
      await navigator.clipboard.writeText(value);
      
      // Visual feedback
      const originalText = button.textContent;
      const originalColor = button.style.color;
      
      button.textContent = '✓';
      button.style.color = '#2e7d32';
      button.classList.add('copied');
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.color = originalColor;
        button.classList.remove('copied');
      }, 1000);
      
    } catch (error) {
      console.error('Copy failed:', error);
      
      // Show error feedback
      const originalText = button.textContent;
      button.textContent = '✗';
      button.style.color = '#c62828';
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.color = '';
      }, 1000);
    }
  }

  openFolder(path) {
    // This would need to be handled by the native host
    chrome.runtime.sendMessage({
      type: 'SEND_TO_HOST',
      payload: {
        version: "1.0",
        kind: "OpenFolder",
        requestId: this.generateUUID(),
        payload: { path }
      }
    });
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new JobLoggerPopup();
});