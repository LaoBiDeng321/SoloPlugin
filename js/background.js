/*
   _____         _         _____   _                _
  / ____|       | |       |  __ \ | |              (_)
 | (___    ___  | |  ___  | |__) || | _   _   __ _  _  _ __
  \___ \  / _ \ | | / _ \ |  ___/ | || | | | / _` || || '_ \
  ____) || (_) || || (_) || |     | || |_| || (_| || || | | |
 |_____/  \___/ |_| \___/ |_|     |_| \__,_| \__, ||_||_| |_|
                                              __/ |
                                             |___/
*/

const DEFAULT_CONFIG = {
  enabled: true,
  includeFileProtocol: true,
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
  isManagementMode: false,
  siteRules: [],
  siteRulesEnabled: false
};

let config = { ...DEFAULT_CONFIG };

class SiteRuleManager {
  constructor() {
    this.rules = [];
    this.enabled = false;
  }

  loadFromConfig(cfg) {
    this.rules = cfg.siteRules || [];
    this.enabled = cfg.siteRulesEnabled || false;
  }

  saveToConfig(cfg) {
    cfg.siteRules = this.rules;
    cfg.siteRulesEnabled = this.enabled;
    return cfg;
  }

  generateId() {
    return 'rule_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  addRule(rule) {
    const newRule = {
      id: this.generateId(),
      name: rule.name || 'Unnamed Rule',
      enabled: rule.enabled !== false,
      domains: rule.domains || [],
      useRegex: rule.useRegex || false,
      disabledExtensionIds: rule.disabledExtensionIds || [],
      priority: rule.priority || 0
    };
    this.rules.push(newRule);
    this.rules.sort((a, b) => b.priority - a.priority);
    return newRule;
  }

  updateRule(id, updates) {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) return null;

    this.rules[index] = {
      ...this.rules[index],
      ...updates,
      id: id
    };
    this.rules.sort((a, b) => b.priority - a.priority);
    return this.rules[index];
  }

  deleteRule(id) {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) return false;
    this.rules.splice(index, 1);
    return true;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  matchDomain(pattern, hostname, useRegex) {
    if (useRegex) {
      try {
        const regex = new RegExp(pattern);
        return regex.test(hostname);
      } catch (e) {
        return false;
      }
    } else {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(hostname);
      }
      return hostname === pattern || hostname.endsWith('.' + pattern);
    }
  }

  findMatchingRule(url) {
    if (!this.enabled || !this.rules.length) {
      return null;
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      for (const rule of this.rules) {
        if (!rule.enabled) continue;

        const matched = rule.domains.some(domain =>
          this.matchDomain(domain, hostname, rule.useRegex)
        );

        if (matched) {
          return rule;
        }
      }
    } catch (e) {
      return null;
    }

    return null;
  }

  getRules() {
    return this.rules.map(r => ({ ...r }));
  }
}

const siteRuleManager = new SiteRuleManager();

function getConfig() {
  return config;
}

async function loadConfig() {
  try {
    const result = await chrome.storage.local.get('config');
    if (result.config) {
      config = { ...DEFAULT_CONFIG, ...result.config };
    }
    siteRuleManager.loadFromConfig(config);
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

async function saveConfig() {
  try {
    siteRuleManager.saveToConfig(config);
    await chrome.storage.local.set({ config });
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

function isLocalService(url) {
  if (!config.enabled) return false;

  const matchedRule = siteRuleManager.findMatchingRule(url);
  if (matchedRule) {
    return matchedRule.enabled;
  }

  try {
    const urlObj = new URL(url);

    if (urlObj.protocol === 'file:' && config.includeFileProtocol) {
      return true;
    }

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

function getMatchedRule(url) {
  return siteRuleManager.findMatchingRule(url);
}

async function disableOtherExtensions(rule) {
  if (config.isManagementMode) return;

  const startTime = performance.now();

  try {
    const extensions = await chrome.management.getAll();
    const currentExtension = await chrome.management.getSelf();

    const disabledExtensions = {};
    const targetExtensionIds = rule && rule.disabledExtensionIds && rule.disabledExtensionIds.length > 0
      ? rule.disabledExtensionIds
      : null;

    for (const ext of extensions) {
      if (ext.id === currentExtension.id) continue;
      if (!ext.enabled) continue;

      if (targetExtensionIds !== null) {
        if (!targetExtensionIds.includes(ext.id)) continue;
      }

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
      const matchedRule = getMatchedRule(tab.url);
      await disableOtherExtensions(matchedRule);
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
        const matchedRule = getMatchedRule(tab.url);
        await disableOtherExtensions(matchedRule);
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
      const matchedRule = getMatchedRule(tab.url);
      await disableOtherExtensions(matchedRule);
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
    siteRuleManager.loadFromConfig(config);
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
  } else if (message.action === 'getSiteRules') {
    sendResponse({ rules: siteRuleManager.getRules(), enabled: siteRuleManager.enabled });
  } else if (message.action === 'addSiteRule') {
    const newRule = siteRuleManager.addRule(message.rule);
    saveConfig().then(() => sendResponse({ success: true, rule: newRule }));
    return true;
  } else if (message.action === 'updateSiteRule') {
    const updatedRule = siteRuleManager.updateRule(message.id, message.rule);
    saveConfig().then(() => sendResponse({ success: true, rule: updatedRule }));
    return true;
  } else if (message.action === 'deleteSiteRule') {
    const deleted = siteRuleManager.deleteRule(message.id);
    saveConfig().then(() => sendResponse({ success: deleted }));
    return true;
  } else if (message.action === 'setSiteRulesEnabled') {
    siteRuleManager.setEnabled(message.enabled);
    saveConfig().then(() => sendResponse({ success: true }));
    return true;
  } else if (message.action === 'testSiteRuleMatch') {
    const matched = siteRuleManager.findMatchingRule(message.url);
    sendResponse({ matched: matched !== null, rule: matched });
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