// Background service worker for native messaging
let nativePort = null;
const HOST_NAME = "com.joblogger.native_host";

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEND_TO_HOST') {
    sendToNativeHost(message.payload)
      .then(response => sendResponse({ success: true, response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'TEST_HOST') {
    testNativeHost()
      .then(response => sendResponse({ success: true, response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function sendToNativeHost(payload) {
  return new Promise((resolve, reject) => {
    try {
      const port = chrome.runtime.connectNative(HOST_NAME);
      
      port.onMessage.addListener((response) => {
        port.disconnect();
        resolve(response);
      });
      
      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(`Native host disconnected: ${error.message}`));
        }
      });
      
      port.postMessage(payload);
    } catch (error) {
      reject(new Error(`Failed to connect to native host: ${error.message}`));
    }
  });
}

async function testNativeHost() {
  const testPayload = {
    version: "1.0",
    kind: "Ping",
    requestId: generateUUID(),
    payload: {}
  };
  
  return sendToNativeHost(testPayload);
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateUUID };
}