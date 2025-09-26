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
      console.log('Connecting to native host:', HOST_NAME);
      console.log('Sending payload:', payload);
      
      const port = chrome.runtime.connectNative(HOST_NAME);
      let responseReceived = false;
      
      // Add timeout
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          port.disconnect();
          reject(new Error('Native host response timeout (10 seconds)'));
        }
      }, 10000);
      
      port.onMessage.addListener((response) => {
        console.log('Received response from native host:', response);
        responseReceived = true;
        clearTimeout(timeout);
        port.disconnect();
        resolve(response);
      });
      
      port.onDisconnect.addListener(() => {
        clearTimeout(timeout);
        const error = chrome.runtime.lastError;
        console.log('Native host disconnected, error:', error);
        if (error && !responseReceived) {
          reject(new Error(`Native host disconnected: ${error.message}`));
        }
        // If response was received, the disconnect is expected
      });
      
      port.postMessage(payload);
      console.log('Message sent to native host');
    } catch (error) {
      console.error('Error connecting to native host:', error);
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