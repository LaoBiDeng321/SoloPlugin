let config = null;

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
  const fileProtocolToggle = document.getElementById('fileProtocolToggle');
  const regexToggle = document.getElementById('regexToggle');
  const domainItems = document.getElementById('domainItems');

  enabledToggle.checked = config.enabled;
  fileProtocolToggle.checked = config.includeFileProtocol;
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

async function handleFileProtocolToggle() {
  const fileProtocolToggle = document.getElementById('fileProtocolToggle');
  config.includeFileProtocol = fileProtocolToggle.checked;
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

// 图片文件列表
let backgroundImages = [];

// 图片选择算法配置
const IMAGE_SELECTION_CONFIG = {
  // 基础权重（从未出现过的图片的基础权重）
  baseWeight: 10,
  // 衰减系数（每次选中后权重的衰减比例，0.5表示减半）
  decayFactor: 0.5,
  // 恢复系数（未被选中的图片每轮恢复的比例，0.1表示恢复10%）
  recoveryFactor: 0.1,
  // 最小权重（图片权重的最小值，防止概率过低）
  minWeight: 1,
  // 最大权重（图片权重的最大值）
  maxWeight: 20,
  // 重置周期（多少次选择后重置权重，0表示不自动重置）
  resetCycle: 20
};

// 图片权重和历史记录
let imageWeights = {};
let totalSelectionCount = 0;

// 从img目录中加载图片文件列表
async function loadBackgroundImages() {
  try {
    // 获取扩展根目录
    const rootEntry = await new Promise((resolve, reject) => {
      chrome.runtime.getPackageDirectoryEntry((entry) => {
        if (entry) {
          resolve(entry);
        } else {
          reject(new Error('Failed to get package directory'));
        }
      });
    });

    // 获取img目录
    const imgEntry = await new Promise((resolve, reject) => {
      rootEntry.getDirectory('img', {}, (entry) => {
        resolve(entry);
      }, (error) => {
        reject(error);
      });
    });

    // 获取backgrounds子目录
    const backgroundsEntry = await new Promise((resolve, reject) => {
      imgEntry.getDirectory('backgrounds', {}, (entry) => {
        resolve(entry);
      }, (error) => {
        reject(error);
      });
    });

    // 读取backgrounds目录中的文件
    const reader = backgroundsEntry.createReader();
    const files = await new Promise((resolve, reject) => {
      const readEntries = () => {
        reader.readEntries((entries) => {
          if (entries.length) {
            resolve(entries);
          } else {
            resolve([]);
          }
        }, (error) => {
          reject(error);
        });
      };
      readEntries();
    });

    // 过滤出图片文件并构建路径
    backgroundImages = files
      .filter(entry => entry.isFile)
      .map(entry => `img/backgrounds/${entry.name}`);

    // 初始化图片权重
    initializeImageWeights();

    // 如果没有找到图片，使用默认背景
    if (backgroundImages.length === 0) {
      console.warn('No background images found in img directory');
    }
  } catch (error) {
    console.error('Error loading background images:', error);
  }
}

// 初始化图片权重
function initializeImageWeights() {
  imageWeights = {};
  backgroundImages.forEach(imagePath => {
    imageWeights[imagePath] = IMAGE_SELECTION_CONFIG.baseWeight;
  });
}

// 智能随机选择背景图片
function setRandomBackground() {
  if (backgroundImages.length === 0) {
    document.body.classList.add('no-background');
    return;
  }

  document.body.classList.remove('no-background');

  // 恢复未被选中的图片权重
  recoverImageWeights();

  // 计算总权重
  const totalWeight = Object.values(imageWeights).reduce((sum, weight) => sum + weight, 0);

  // 生成随机数并选择图片
  let random = Math.random() * totalWeight;
  let selectedImage = null;

  for (const imagePath of backgroundImages) {
    random -= imageWeights[imagePath];
    if (random <= 0) {
      selectedImage = imagePath;
      break;
    }
  }

  // 如果没有选中（理论上不应该发生），选择最后一张
  if (!selectedImage) {
    selectedImage = backgroundImages[backgroundImages.length - 1];
  }

  // 应用选中的图片
  document.body.style.backgroundImage = `url('${selectedImage}')`;

  // 更新权重
  updateImageWeight(selectedImage);

  // 增加总选择次数
  totalSelectionCount++;

  // 检查是否需要重置权重
  if (IMAGE_SELECTION_CONFIG.resetCycle > 0 && 
      totalSelectionCount % IMAGE_SELECTION_CONFIG.resetCycle === 0) {
    resetImageWeights();
  }
}

// 更新图片权重（选中后衰减）
function updateImageWeight(imagePath) {
  const currentWeight = imageWeights[imagePath] || IMAGE_SELECTION_CONFIG.baseWeight;
  const newWeight = Math.max(
    IMAGE_SELECTION_CONFIG.minWeight,
    currentWeight * IMAGE_SELECTION_CONFIG.decayFactor
  );
  imageWeights[imagePath] = newWeight;
}

// 恢复未被选中的图片权重
function recoverImageWeights() {
  backgroundImages.forEach(imagePath => {
    const currentWeight = imageWeights[imagePath] || IMAGE_SELECTION_CONFIG.baseWeight;
    if (currentWeight < IMAGE_SELECTION_CONFIG.maxWeight) {
      const recoveredWeight = Math.min(
        IMAGE_SELECTION_CONFIG.maxWeight,
        currentWeight + (IMAGE_SELECTION_CONFIG.baseWeight * IMAGE_SELECTION_CONFIG.recoveryFactor)
      );
      imageWeights[imagePath] = recoveredWeight;
    }
  });
}

// 重置所有图片权重
function resetImageWeights() {
  console.log('Resetting image weights after', totalSelectionCount, 'selections');
  initializeImageWeights();
  totalSelectionCount = 0;
}

// 获取图片选择统计信息（用于调试）
function getImageSelectionStats() {
  const stats = {};
  backgroundImages.forEach(imagePath => {
    const imageName = imagePath.split('/').pop();
    stats[imageName] = {
      weight: imageWeights[imagePath],
      probability: imageWeights[imagePath] / 
        Object.values(imageWeights).reduce((sum, w) => sum + w, 0)
    };
  });
  return stats;
}

// 当页面可见时重新设置背景（处理浏览器标签页切换）
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    setRandomBackground();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 加载背景图片列表
  await loadBackgroundImages();
  // 设置随机背景图片
  setRandomBackground();
  
  // 加载配置和主题
  loadConfig();
  loadTheme();

  // 初始化拖动功能
  initDraggable();

  // 添加事件监听器
  document.getElementById('addDomainBtn').addEventListener('click', handleAddDomain);
  document.getElementById('domainInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAddDomain();
    }
  });

  document.getElementById('enabledToggle').addEventListener('change', handleEnabledToggle);
  document.getElementById('fileProtocolToggle').addEventListener('change', handleFileProtocolToggle);
  document.getElementById('regexToggle').addEventListener('change', handleRegexToggle);
  document.getElementById('resetBtn').addEventListener('click', handleReset);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
  document.getElementById('closeBtn').addEventListener('click', handleClose);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', handleThemeChange);
  });

  // 添加可见性变化监听器
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // 监听消息
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'configUpdated') {
      loadConfig();
    }
  });
});

// 拖动功能实现
function initDraggable() {
  const container = document.getElementById('draggableContainer');
  const dragHandle = document.getElementById('dragHandle');
  
  if (!container || !dragHandle) return;

  let isDragging = false;
  let startX, startY, initialX, initialY;

  dragHandle.addEventListener('mousedown', (e) => {
    // 防止点击按钮时触发拖动
    if (e.target.closest('button')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = container.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    container.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newX = initialX + deltaX;
    let newY = initialY + deltaY;

    // 确保容器不会拖出视口
    const containerRect = container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 限制在视口范围内
    newX = Math.max(0, Math.min(newX, viewportWidth - containerRect.width));
    newY = Math.max(0, Math.min(newY, viewportHeight - containerRect.height));

    // 移除transform，使用绝对定位
    container.style.transform = 'none';
    container.style.left = `${newX}px`;
    container.style.top = `${newY}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      container.classList.remove('dragging');
    }
  });

  // 防止拖动时选中文本
  container.addEventListener('selectstart', (e) => {
    if (isDragging) {
      e.preventDefault();
    }
  });
}