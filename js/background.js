const DEFAULT_CONFIG = {
  enabled: true,
  domains: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'localhost:3000',
    'localhost:3001',
    'localhost:4000',
    'localhost:5000',
    'localhost:5500',
    'localhost:8000',
    'localhost:8080',
    'localhost:9000',
    'localhost:4200',
    'localhost:5173',
    '127.0.0.1:3000',
    '127.0.0.1:3001',
    '127.0.0.1:4000',
    '127.0.0.1:5000',
    '127.0.0.1:5500',
    '127.0.0.1:8000',
    '127.0.0.1:8080',
    '127.0.0.1:9000',
    '127.0.0.1:4200',
    '127.0.0.1:5173'
  ],
  useRegex: false,
  disabledExtensions: {},
  isManagementMode: false
};

let config = { ...DEFAULT_CONFIG };

function getConfig() {
  return config;
}

async function loadConfig() {
  try {
    const result = await chrome.storage.local.get('config');
    if (result.config) {
      config = { ...DEFAULT_CONFIG, ...result.config };
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

async function saveConfig() {
  try {
    await chrome.storage.local.set({ config });
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

function isLocalService(url) {
  if (!config.enabled) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    if (config.useRegex) {
      return config.domains.some(pattern => {
        try {
          const regex = new RegExp(pattern);
          return regex.test(hostname);
        } catch (e) {
          return false;
        }
      });
    } else {
      return config.domains.some(domain => {
        if (domain.includes('*')) {
          const pattern = domain.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(hostname);
        }
        return hostname === domain || hostname.endsWith('.' + domain);
      });
    }
  } catch (error) {
    return false;
  }
}

async function disableOtherExtensions() {
  if (config.isManagementMode) return;
  
  const startTime = performance.now();
  
  try {
    const extensions = await chrome.management.getAll();
    const currentExtension = await chrome.management.getSelf();
    
    const disabledExtensions = {};
    
    for (const ext of extensions) {
      if (ext.id === currentExtension.id) continue;
      if (!ext.enabled) continue;
      
      try {
        await chrome.management.setEnabled(ext.id, false);
        disabledExtensions[ext.id] = true;
      } catch (error) {
        console.error(`Failed to disable extension ${ext.id}:`, error);
      }
    }
    
    config.disabledExtensions = disabledExtensions;
    config.isManagementMode = true;
    await saveConfig();
    
    const endTime = performance.now();
    console.log(`Extensions disabled in ${(endTime - startTime).toFixed(2)}ms`);
    
  } catch (error) {
    console.error('Failed to disable extensions:', error);
  }
}

async function restoreExtensions() {
  if (!config.isManagementMode) return;
  
  const startTime = performance.now();
  
  try {
    const disabledIds = Object.keys(config.disabledExtensions);
    
    for (const extId of disabledIds) {
      try {
        await chrome.management.setEnabled(extId, true);
      } catch (error) {
        console.error(`Failed to enable extension ${extId}:`, error);
      }
    }
    
    config.disabledExtensions = {};
    config.isManagementMode = false;
    await saveConfig();
    
    const endTime = performance.now();
    console.log(`Extensions restored in ${(endTime - startTime).toFixed(2)}ms`);
    
  } catch (error) {
    console.error('Failed to restore extensions:', error);
  }
}

async function handleTabUpdate(tabId, changeInfo, tab) {
  if (!tab || !tab.url) return;
  
  if (changeInfo.status === 'complete') {
    await loadConfig();
    
    if (isLocalService(tab.url)) {
      await disableOtherExtensions();
    } else {
      await restoreExtensions();
    }
  }
}

async function handleTabRemoved(tabId) {
  await loadConfig();
  await restoreExtensions();
}

async function handleTabActivated(activeInfo) {
  await loadConfig();
  
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      if (isLocalService(tab.url)) {
        await disableOtherExtensions();
      } else {
        await restoreExtensions();
      }
    }
  } catch (error) {
    console.error('Failed to handle tab activation:', error);
  }
}

async function handleExtensionInstalled() {
  await loadConfig();
  await saveConfig();
  console.log('Extension installed, config initialized');
}

async function handleExtensionStartup() {
  await loadConfig();
  
  if (config.isManagementMode) {
    await restoreExtensions();
  }
  
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && isLocalService(tab.url)) {
      await disableOtherExtensions();
      break;
    }
  }
}

chrome.tabs.onUpdated.addListener(handleTabUpdate);
chrome.tabs.onRemoved.addListener(handleTabRemoved);
chrome.tabs.onActivated.addListener(handleTabActivated);

chrome.runtime.onInstalled.addListener(handleExtensionInstalled);
chrome.runtime.onStartup.addListener(handleExtensionStartup);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getConfig') {
    sendResponse({ config });
  } else if (message.action === 'updateConfig') {
    config = { ...config, ...message.config };
    saveConfig().then(() => sendResponse({ success: true }));
    return true;
  } else if (message.action === 'disableExtensions') {
    disableOtherExtensions().then(() => sendResponse({ success: true }));
    return true;
  } else if (message.action === 'restoreExtensions') {
    restoreExtensions().then(() => sendResponse({ success: true }));
    return true;
  } else if (message.action === 'getExtensions') {
    chrome.management.getAll().then(extensions => {
      chrome.management.getSelf().then(self => {
        const otherExtensions = extensions.filter(ext => ext.id !== self.id);
        sendResponse({ extensions: otherExtensions });
      });
    });
    return true;
  }
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.action === 'getExtensionStatus') {
    sendResponse({
      isManagementMode: config.isManagementMode,
      enabled: config.enabled,
      domainCount: config.domains.length,
      disabledExtensionCount: Object.keys(config.disabledExtensions).length,
      version: chrome.runtime.getManifest().version,
      domains: config.domains.slice(0, 5)
    });
  }
  return true;
});

loadConfig();