let config = null;

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

async function loadConfig() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
    config = response.config;
    updateUI();
  } catch (error) {
    console.error('Failed to load config:', error);
    config = { ...DEFAULT_CONFIG };
  }
}

async function saveConfig() {
  try {
    await chrome.runtime.sendMessage({
      action: 'updateConfig',
      config: config
    });
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

function updateUI() {
  if (!config) return;

  const enabledToggle = document.getElementById('enabledToggle');
  const regexToggle = document.getElementById('regexToggle');
  const domainItems = document.getElementById('domainItems');

  enabledToggle.checked = config.enabled;
  regexToggle.checked = config.useRegex;

  renderDomainList();
}

function renderDomainList() {
  const domainItems = document.getElementById('domainItems');
  
  if (config.domains.length === 0) {
    domainItems.innerHTML = '<div class="empty-state">暂无监控域名</div>';
    return;
  }

  domainItems.innerHTML = config.domains.map((domain, index) => `
    <div class="domain-item" data-index="${index}">
      <div class="domain-text">${escapeHtml(domain)}</div>
      <button class="delete-btn" data-index="${index}" title="删除">
        <svg viewBox="0 0 24 24">
          <use href="svg/icons.svg#close-icon"></use>
        </svg>
      </button>
    </div>
  `).join('');

  domainItems.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', handleDeleteDomain);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function handleAddDomain() {
  const input = document.getElementById('domainInput');
  const domain = input.value.trim();

  if (!domain) {
    alert('请输入域名或IP地址');
    return;
  }

  if (config.domains.includes(domain)) {
    alert('该域名已存在');
    return;
  }

  if (config.useRegex) {
    try {
      new RegExp(domain);
    } catch (e) {
      alert('无效的正则表达式');
      return;
    }
  }

  config.domains.push(domain);
  await saveConfig();
  renderDomainList();
  input.value = '';
}

async function handleDeleteDomain(event) {
  const btn = event.currentTarget;
  const index = parseInt(btn.dataset.index);

  if (confirm('确定要删除该域名吗？')) {
    config.domains.splice(index, 1);
    await saveConfig();
    renderDomainList();
  }
}

async function handleEnabledToggle() {
  const enabledToggle = document.getElementById('enabledToggle');
  config.enabled = enabledToggle.checked;
  await saveConfig();
}

async function handleRegexToggle() {
  const regexToggle = document.getElementById('regexToggle');
  config.useRegex = regexToggle.checked;
  await saveConfig();
}

async function handleReset() {
  if (confirm('确定要重置所有设置吗？这将恢复默认配置。')) {
    config = { ...DEFAULT_CONFIG };
    await saveConfig();
    updateUI();
  }
}

async function handleClear() {
  if (confirm('确定要清除所有数据吗？此操作不可撤销。')) {
    await chrome.storage.local.clear();
    config = { ...DEFAULT_CONFIG };
    await saveConfig();
    updateUI();
  }
}

function handleClose() {
  window.close();
}

function handleThemeChange(event) {
  const themeBtn = event.currentTarget;
  const theme = themeBtn.dataset.theme;

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  themeBtn.classList.add('active');

  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    chrome.storage.local.set({ theme: 'dark' });
  } else {
    document.documentElement.removeAttribute('data-theme');
    chrome.storage.local.set({ theme: 'light' });
  }
}

async function loadTheme() {
  const result = await chrome.storage.local.get('theme');
  if (result.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.querySelector('.theme-btn[data-theme="dark"]').classList.add('active');
    document.querySelector('.theme-btn[data-theme="light"]').classList.remove('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadTheme();

  document.getElementById('addDomainBtn').addEventListener('click', handleAddDomain);
  document.getElementById('domainInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAddDomain();
    }
  });

  document.getElementById('enabledToggle').addEventListener('change', handleEnabledToggle);
  document.getElementById('regexToggle').addEventListener('change', handleRegexToggle);
  document.getElementById('resetBtn').addEventListener('click', handleReset);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
  document.getElementById('closeBtn').addEventListener('click', handleClose);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', handleThemeChange);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'configUpdated') {
      loadConfig();
    }
  });
});