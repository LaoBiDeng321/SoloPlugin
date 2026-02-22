let config = null;
let extensions = [];

async function loadConfig() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
    config = response.config;
    updateUI();
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

async function loadExtensions() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getExtensions' });
    extensions = response.extensions;
    renderExtensionsList();
  } catch (error) {
    console.error('Failed to load extensions:', error);
  }
}

function updateUI() {
  if (!config) return;

  const enableToggle = document.getElementById('enableToggle');
  const statusIndicator = document.getElementById('statusIndicator');
  const modeIndicator = document.getElementById('modeIndicator');
  const modeText = document.getElementById('modeText');
  const domainCount = document.getElementById('domainCount');
  const disabledCount = document.getElementById('disabledCount');

  enableToggle.checked = config.enabled;

  if (config.enabled) {
    statusIndicator.classList.add('active');
    statusIndicator.querySelector('.status-text').textContent = '运行中';
  } else {
    statusIndicator.classList.remove('active');
    statusIndicator.querySelector('.status-text').textContent = '已暂停';
  }

  if (config.isManagementMode) {
    modeIndicator.classList.add('active');
    modeText.textContent = '管理模式';
    disabledCount.textContent = Object.keys(config.disabledExtensions).length;
  } else {
    modeIndicator.classList.remove('active');
    modeText.textContent = '正常模式';
    disabledCount.textContent = '0';
  }

  domainCount.textContent = config.domains.length;
}

function renderExtensionsList() {
  const content = document.getElementById('extensionsContent');
  
  if (extensions.length === 0) {
    content.innerHTML = '<div class="empty">暂无其他插件</div>';
    return;
  }

  content.innerHTML = extensions.map(ext => {
    const isDisabled = config.disabledExtensions[ext.id];
    return `
      <div class="extension-item ${isDisabled ? 'disabled' : ''}">
        <div class="extension-icon">
          ${ext.icons ? `<img src="${ext.icons[ext.icons.length - 1].url}" alt="">` : '<svg viewBox="0 0 24 24"><use href="#extension-icon"></use></svg>'}
        </div>
        <div class="extension-info">
          <div class="extension-name">${ext.name}</div>
          <div class="extension-status">${isDisabled ? '已禁用' : '启用'}</div>
        </div>
        <div class="extension-badge ${isDisabled ? 'badge-disabled' : 'badge-enabled'}">
          ${isDisabled ? '禁用' : '启用'}
        </div>
      </div>
    `;
  }).join('');
}

async function handleEnableToggle() {
  const enableToggle = document.getElementById('enableToggle');
  const newEnabled = enableToggle.checked;
  
  try {
    await chrome.runtime.sendMessage({
      action: 'updateConfig',
      config: { enabled: newEnabled }
    });
    await loadConfig();
  } catch (error) {
    console.error('Failed to update config:', error);
    enableToggle.checked = !newEnabled;
  }
}

async function handleDisableBtn() {
  const disableBtn = document.getElementById('disableBtn');
  disableBtn.disabled = true;
  
  try {
    await chrome.runtime.sendMessage({ action: 'disableExtensions' });
    await loadConfig();
    await loadExtensions();
  } catch (error) {
    console.error('Failed to disable extensions:', error);
  } finally {
    disableBtn.disabled = false;
  }
}

async function handleRestoreBtn() {
  const restoreBtn = document.getElementById('restoreBtn');
  restoreBtn.disabled = true;
  
  try {
    await chrome.runtime.sendMessage({ action: 'restoreExtensions' });
    await loadConfig();
    await loadExtensions();
  } catch (error) {
    console.error('Failed to restore extensions:', error);
  } finally {
    restoreBtn.disabled = false;
  }
}

function handleSettingsBtn() {
  chrome.runtime.openOptionsPage();
}

function handleExtensionsBtn() {
  // 打开浏览器扩展管理页面
  chrome.tabs.create({ url: 'chrome://extensions' });
}

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadExtensions();

  document.getElementById('enableToggle').addEventListener('change', handleEnableToggle);
  document.getElementById('disableBtn').addEventListener('click', handleDisableBtn);
  document.getElementById('restoreBtn').addEventListener('click', handleRestoreBtn);
  document.getElementById('settingsBtn').addEventListener('click', handleSettingsBtn);
  document.getElementById('extensionsBtn').addEventListener('click', handleExtensionsBtn);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'configUpdated') {
      loadConfig();
      loadExtensions();
    }
  });
});