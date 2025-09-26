// Settings page JavaScript
class SettingsManager {
  constructor() {
    this.bindEvents();
    this.loadSettings();
  }

  bindEvents() {
    document.getElementById('settingsForm').addEventListener('submit', (e) => this.saveSettings(e));
    document.getElementById('testBtn').addEventListener('click', () => this.testNativeHost());
    document.getElementById('cancelBtn').addEventListener('click', () => this.cancel());
    document.getElementById('theme').addEventListener('change', (e) => this.toggleTheme(e));
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['baseFolder', 'theme']);
      document.getElementById('baseFolder').value = result.baseFolder || '';
      
      const theme = result.theme || 'light';
      document.getElementById('theme').checked = theme === 'dark';
      this.applyTheme(theme);
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showSaveStatus('error', 'Failed to load settings');
    }
  }

  async saveSettings(e) {
    e.preventDefault();
    
    const baseFolder = document.getElementById('baseFolder').value.trim();
    const theme = document.getElementById('theme').checked ? 'dark' : 'light';
    
    if (!baseFolder) {
      this.showSaveStatus('error', 'Base folder path is required');
      return;
    }

    try {
      await chrome.storage.local.set({ baseFolder, theme });
      this.showSaveStatus('success', 'Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showSaveStatus('error', 'Failed to save settings');
    }
  }

  async testNativeHost() {
    this.setTestLoading(true);
    this.showTestStatus('loading', 'Testing connection to native host...');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'TEST_HOST' });
      
      if (response.success) {
        this.showTestStatus('success', 'Native host connection successful!');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Test failed:', error);
      this.showTestStatus('error', `Connection failed: ${error.message}`);
    } finally {
      this.setTestLoading(false);
    }
  }

  cancel() {
    window.close();
  }

  setTestLoading(loading) {
    const testBtn = document.getElementById('testBtn');
    testBtn.disabled = loading;
    testBtn.textContent = loading ? 'Testing...' : 'Test Native Host';
  }

  showTestStatus(type, message) {
    const statusDiv = document.getElementById('testStatus');
    statusDiv.className = `status ${type}`;
    
    let html = '';
    if (type === 'loading') {
      html = '<span class="spinner"></span>';
    }
    html += message;
    
    statusDiv.innerHTML = html;
    statusDiv.classList.remove('hidden');
    
    if (type === 'success') {
      setTimeout(() => this.hideTestStatus(), 3000);
    }
  }

  hideTestStatus() {
    document.getElementById('testStatus').classList.add('hidden');
  }

  showSaveStatus(type, message) {
    const statusDiv = document.getElementById('saveStatus');
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');
    
    if (type === 'success') {
      setTimeout(() => this.hideSaveStatus(), 3000);
    }
  }

  hideSaveStatus() {
    document.getElementById('saveStatus').classList.add('hidden');
  }

  toggleTheme(e) {
    const theme = e.target.checked ? 'dark' : 'light';
    this.applyTheme(theme);
    // Auto-save theme preference
    chrome.storage.local.set({ theme });
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SettingsManager();
});