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

  const backgroundSettings = await chrome.storage.local.get(['autoRotate', 'rotateInterval', 'selectedTypes']);
  if (backgroundSettings.autoRotate !== undefined) {
    autoRotate = backgroundSettings.autoRotate;
    const autoRotateToggle = document.getElementById('autoRotateToggle');
    if (autoRotateToggle) autoRotateToggle.checked = autoRotate;
    const rotateIntervalItem = document.getElementById('rotateIntervalItem');
    if (rotateIntervalItem) rotateIntervalItem.style.display = autoRotate ? 'flex' : 'none';
  }
  if (backgroundSettings.rotateInterval !== undefined) {
    rotateInterval = backgroundSettings.rotateInterval;
    const intervalInput = document.getElementById('rotateIntervalInput');
    if (intervalInput) intervalInput.value = rotateInterval;
  }
  if (backgroundSettings.selectedTypes !== undefined) {
    selectedTypes = backgroundSettings.selectedTypes;
    const imageTypeToggle = document.getElementById('imageTypeToggle');
    const videoTypeToggle = document.getElementById('videoTypeToggle');
    if (imageTypeToggle) imageTypeToggle.checked = selectedTypes.image;
    if (videoTypeToggle) videoTypeToggle.checked = selectedTypes.video;
  }
  
  // NSFW默认关闭，不保存状态
  nsfwEnabled = false;
  const nsfwToggle = document.getElementById('nsfwToggle');
  if (nsfwToggle) nsfwToggle.checked = false;
  
  // 仅NSFW默认关闭，不保存状态
  nsfwOnly = false;
  const nsfwOnlyToggle = document.getElementById('nsfwOnlyToggle');
  if (nsfwOnlyToggle) nsfwOnlyToggle.checked = false;
  
  // 控制仅NSFW选项的显示
  const nsfwOnlyItem = document.getElementById('nsfwOnlyItem');
  if (nsfwOnlyItem) {
    nsfwOnlyItem.style.display = 'none';
  }
  
  // 视频重播默认开启，不保存状态
  videoReplay = true;
  const videoReplayToggle = document.getElementById('videoReplayToggle');
  if (videoReplayToggle) videoReplayToggle.checked = true;
  
  // 控制视频重播选项的显示
  const videoReplayItem = document.getElementById('videoReplayItem');
  if (videoReplayItem) {
    videoReplayItem.style.display = autoRotate ? 'none' : 'flex';
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

  config.domains.unshift(domain);
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
    resetContainerPosition();
    resetRestoreBtnPosition();
    resetBackgroundBtnPosition();
    
    // 重置NSFW相关设置
    nsfwEnabled = false;
    nsfwOnly = false;
    const nsfwToggle = document.getElementById('nsfwToggle');
    const nsfwOnlyToggle = document.getElementById('nsfwOnlyToggle');
    const nsfwOnlyItem = document.getElementById('nsfwOnlyItem');
    if (nsfwToggle) nsfwToggle.checked = false;
    if (nsfwOnlyToggle) nsfwOnlyToggle.checked = false;
    if (nsfwOnlyItem) nsfwOnlyItem.style.display = 'none';
    
    // 重置视频重播设置
    videoReplay = true;
    const videoReplayToggle = document.getElementById('videoReplayToggle');
    const videoReplayItem = document.getElementById('videoReplayItem');
    if (videoReplayToggle) videoReplayToggle.checked = true;
    if (videoReplayItem) {
      videoReplayItem.style.display = autoRotate ? 'none' : 'flex';
    }
    
    // 重新加载背景文件
    loadBackgroundFiles();
  }
}

async function handleClear() {
  if (confirm('确定要清除所有数据吗？此操作不可撤销。')) {
    await chrome.storage.local.clear();
    config = { ...DEFAULT_CONFIG };
    await saveConfig();
    updateUI();
    
    // 重置NSFW相关设置
    nsfwEnabled = false;
    nsfwOnly = false;
    const nsfwToggle = document.getElementById('nsfwToggle');
    const nsfwOnlyToggle = document.getElementById('nsfwOnlyToggle');
    const nsfwOnlyItem = document.getElementById('nsfwOnlyItem');
    if (nsfwToggle) nsfwToggle.checked = false;
    if (nsfwOnlyToggle) nsfwOnlyToggle.checked = false;
    if (nsfwOnlyItem) nsfwOnlyItem.style.display = 'none';
    
    // 重置视频重播设置
    videoReplay = true;
    const videoReplayToggle = document.getElementById('videoReplayToggle');
    const videoReplayItem = document.getElementById('videoReplayItem');
    if (videoReplayToggle) videoReplayToggle.checked = true;
    if (videoReplayItem) {
      videoReplayItem.style.display = autoRotate ? 'none' : 'flex';
    }
    
    // 重新加载背景文件
    loadBackgroundFiles();
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

// 背景文件列表
let backgroundImages = [];
let backgroundVideos = [];

// 背景选择算法配置
const BACKGROUND_SELECTION_CONFIG = {
  // 最近播放历史长度（避免重复）
  recentHistorySize: 5
};

// 背景播放历史
let recentBackgrounds = [];
let autoRotate = false;
let rotateInterval = 30;
let rotateTimer = null;
let currentBackgroundType = null;
let currentBackgroundPath = null;
let currentVideoElement = null;
let selectedTypes = {
  image: true,
  video: true
};
let nsfwEnabled = false;
let nsfwOnly = false;
let videoReplay = true;

let restoreBtnDragging = false;
let restoreBtnStartX, restoreBtnStartY;
let restoreBtnInitialX, restoreBtnInitialY;
let restoreBtnHasMoved = false;

let backgroundBtnDragging = false;
let backgroundBtnStartX, backgroundBtnStartY;
let backgroundBtnInitialX, backgroundBtnInitialY;
let backgroundBtnHasMoved = false;

async function loadBackgroundFiles() {
  try {
    const rootEntry = await new Promise((resolve, reject) => {
      chrome.runtime.getPackageDirectoryEntry((entry) => {
        if (entry) {
          resolve(entry);
        } else {
          reject(new Error('Failed to get package directory'));
        }
      });
    });

    // 加载图片文件
    await loadImageFiles(rootEntry);
    
    // 加载视频文件
    await loadVideoFiles(rootEntry);

    initializeBackground();

    if (backgroundImages.length === 0 && backgroundVideos.length === 0) {
      console.warn('No background files found');
    }
  } catch (error) {
    console.error('Error loading background files:', error);
  }
}

async function loadImageFiles(rootEntry) {
  try {
    const imgEntry = await new Promise((resolve, reject) => {
      rootEntry.getDirectory('img', {}, (entry) => {
        resolve(entry);
      }, (error) => {
        reject(error);
      });
    });

    const backgroundsEntry = await new Promise((resolve, reject) => {
      imgEntry.getDirectory('backgrounds', {}, (entry) => {
        resolve(entry);
      }, (error) => {
        reject(error);
      });
    });

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

    // 支持的图片格式
    const supportedImageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    let imageFiles = [];
    // 如果不是仅NSFW模式，加载普通图片
    if (!nsfwOnly) {
      imageFiles = files.filter(entry => {
        if (!entry.isFile) return false;
        if (entry.name === 'nsfw') return false;
        // 检查文件格式
        const extension = entry.name.toLowerCase().substring(entry.name.lastIndexOf('.'));
        return supportedImageFormats.includes(extension);
      });
      backgroundImages = imageFiles.map(entry => `img/backgrounds/${entry.name}`);
    } else {
      // 仅NSFW模式，初始为空
      backgroundImages = [];
    }

    // 如果启用了NSFW内容，加载NSFW子文件夹中的内容
    if (nsfwEnabled) {
      try {
        const nsfwEntry = await new Promise((resolve, reject) => {
          backgroundsEntry.getDirectory('nsfw', {}, (entry) => {
            resolve(entry);
          }, (error) => {
            reject(error);
          });
        });

        const nsfwReader = nsfwEntry.createReader();
        const nsfwFiles = await new Promise((resolve, reject) => {
          const readEntries = () => {
            nsfwReader.readEntries((entries) => {
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

        const nsfwImageFiles = nsfwFiles.filter(entry => {
          if (!entry.isFile) return false;
          // 检查文件格式
          const extension = entry.name.toLowerCase().substring(entry.name.lastIndexOf('.'));
          return supportedImageFormats.includes(extension);
        });
        const nsfwImages = nsfwImageFiles.map(entry => `img/backgrounds/nsfw/${entry.name}`);
        backgroundImages = backgroundImages.concat(nsfwImages);
      } catch (error) {
        console.log('No NSFW image folder found or error loading NSFW images:', error);
      }
    }
  } catch (error) {
    console.error('Error loading image files:', error);
    backgroundImages = [];
  }
}

async function loadVideoFiles(rootEntry) {
  try {
    const videosEntry = await new Promise((resolve, reject) => {
      rootEntry.getDirectory('videos', {}, (entry) => {
        resolve(entry);
      }, (error) => {
        reject(error);
      });
    });

    const backgroundsEntry = await new Promise((resolve, reject) => {
      videosEntry.getDirectory('backgrounds', {}, (entry) => {
        resolve(entry);
      }, (error) => {
        reject(error);
      });
    });

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

    // 支持的视频格式
    const supportedVideoFormats = ['.mp4', '.webm', '.ogg'];

    let videoFiles = [];
    // 如果不是仅NSFW模式，加载普通视频
    if (!nsfwOnly) {
      videoFiles = files.filter(entry => {
        if (!entry.isFile) return false;
        if (entry.name === 'nsfw') return false;
        // 检查文件格式
        const extension = entry.name.toLowerCase().substring(entry.name.lastIndexOf('.'));
        return supportedVideoFormats.includes(extension);
      });
      backgroundVideos = videoFiles.map(entry => `videos/backgrounds/${entry.name}`);
    } else {
      // 仅NSFW模式，初始为空
      backgroundVideos = [];
    }

    // 如果启用了NSFW内容，加载NSFW子文件夹中的内容
    if (nsfwEnabled) {
      try {
        const nsfwEntry = await new Promise((resolve, reject) => {
          backgroundsEntry.getDirectory('nsfw', {}, (entry) => {
            resolve(entry);
          }, (error) => {
            reject(error);
          });
        });

        const nsfwReader = nsfwEntry.createReader();
        const nsfwFiles = await new Promise((resolve, reject) => {
          const readEntries = () => {
            nsfwReader.readEntries((entries) => {
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

        const nsfwVideoFiles = nsfwFiles.filter(entry => {
          if (!entry.isFile) return false;
          // 检查文件格式
          const extension = entry.name.toLowerCase().substring(entry.name.lastIndexOf('.'));
          return supportedVideoFormats.includes(extension);
        });
        const nsfwVideos = nsfwVideoFiles.map(entry => `videos/backgrounds/nsfw/${entry.name}`);
        backgroundVideos = backgroundVideos.concat(nsfwVideos);
      } catch (error) {
        console.log('No NSFW video folder found or error loading NSFW videos:', error);
      }
    }
  } catch (error) {
    console.error('Error loading video files:', error);
    backgroundVideos = [];
  }
}

// 初始化背景（不再需要权重系统）
function initializeBackground() {
  recentBackgrounds = [];
}

// 智能随机选择背景
function setRandomBackground() {
  // 清理当前背景
  clearCurrentBackground();
  
  // 构建可用背景列表
  const availableBackgrounds = [];
  if (selectedTypes.image && backgroundImages.length > 0) {
    availableBackgrounds.push(...backgroundImages);
  }
  if (selectedTypes.video && backgroundVideos.length > 0) {
    availableBackgrounds.push(...backgroundVideos);
  }

  if (availableBackgrounds.length === 0) {
    document.body.classList.add('no-background');
    return;
  }

  document.body.classList.remove('no-background');

  // 过滤掉最近播放过的背景
  const filteredBackgrounds = availableBackgrounds.filter(bg => !recentBackgrounds.includes(bg));
  
  // 如果过滤后没有可选的背景（所有背景都在最近播放列表中），则清空历史并重新选择
  let selectableBackgrounds = filteredBackgrounds;
  if (selectableBackgrounds.length === 0) {
    recentBackgrounds = [];
    selectableBackgrounds = availableBackgrounds;
  }

  // 纯随机选择一个背景
  const randomIndex = Math.floor(Math.random() * selectableBackgrounds.length);
  const selectedBackground = selectableBackgrounds[randomIndex];

  // 应用选中的背景
  applyBackground(selectedBackground);

  // 更新最近播放历史
  updateRecentHistory(selectedBackground);
}

// 清理当前背景
function clearCurrentBackground() {
  // 移除图片背景
  document.body.style.backgroundImage = '';
  
  // 移除视频背景
  if (currentVideoElement) {
    // 移除事件监听器
    currentVideoElement.removeEventListener('ended', handleVideoEnded);
    currentVideoElement.removeEventListener('loadeddata', handleVideoLoaded);
    
    // 暂停并移除视频元素
    currentVideoElement.pause();
    currentVideoElement.src = ''; // 释放视频资源
    currentVideoElement.remove();
    currentVideoElement = null;
  }
  
  // 清除定时器
  if (rotateTimer) {
    clearTimeout(rotateTimer);
    rotateTimer = null;
  }
}

// 应用背景
function applyBackground(backgroundPath) {
  const isVideo = backgroundPath.includes('videos/');
  currentBackgroundPath = backgroundPath;
  currentBackgroundType = isVideo ? 'video' : 'image';
  
  if (isVideo) {
    applyVideoBackground(backgroundPath);
  } else {
    applyImageBackground(backgroundPath);
  }
}

// 应用图片背景
function applyImageBackground(imagePath) {
  document.body.style.backgroundImage = `url('${imagePath}')`;
  
  // 如果启用了自动轮转，设置定时器
  if (autoRotate) {
    startAutoRotate();
  }
}

// 视频结束事件处理函数
function handleVideoEnded() {
  if (autoRotate) {
    setRandomBackground();
  } else if (videoReplay && currentVideoElement) {
    // 如果开启了视频重播，重新播放当前视频
    currentVideoElement.currentTime = 0;
    currentVideoElement.play();
  }
}

// 视频加载完成事件处理函数
function handleVideoLoaded() {
  if (currentVideoElement) {
    currentVideoElement.style.opacity = '1';
  }
}

// 应用视频背景
function applyVideoBackground(videoPath) {
  // 创建视频元素
  const video = document.createElement('video');
  video.src = videoPath;
  video.autoplay = true;
  video.muted = true;
  video.loop = false;
  video.style.position = 'fixed';
  video.style.top = '0';
  video.style.left = '0';
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  video.style.zIndex = '-2';
  video.style.opacity = '0';
  video.style.transition = 'opacity 1s ease-in-out';
  
  // 监听视频结束事件
  video.addEventListener('ended', handleVideoEnded);
  
  // 监听视频加载完成事件
  video.addEventListener('loadeddata', handleVideoLoaded);
  
  // 添加到body
  document.body.appendChild(video);
  currentVideoElement = video;
  
  // 清除自动轮转定时器，因为视频结束时会自动切换
  if (rotateTimer) {
    clearInterval(rotateTimer);
    rotateTimer = null;
  }
}

// 更新最近播放历史
function updateRecentHistory(backgroundPath) {
  // 将背景添加到历史记录的开头
  recentBackgrounds.unshift(backgroundPath);
  
  // 如果历史记录超过配置的大小，移除最旧的记录
  if (recentBackgrounds.length > BACKGROUND_SELECTION_CONFIG.recentHistorySize) {
    recentBackgrounds.pop();
  }
}

// 获取背景选择统计信息（用于调试）
function getBackgroundSelectionStats() {
  const stats = {
    totalImages: backgroundImages.length,
    totalVideos: backgroundVideos.length,
    recentHistory: recentBackgrounds.map(bg => ({
      path: bg,
      type: bg.includes('videos/') ? 'video' : 'image',
      name: bg.split('/').pop()
    }))
  };
  
  return stats;
}

// 当页面可见时重新设置背景（处理浏览器标签页切换）
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    setRandomBackground();
    if (autoRotate) {
      startAutoRotate();
    }
  } else {
    stopAutoRotate();
  }
}

// 存储所有事件监听器的引用，以便在需要时移除
const eventListeners = {
  domainInput: null,
  messageListener: null
};

// 内存使用监控
let memoryMonitoringInterval = null;
const memoryUsageHistory = [];

// 开始内存使用监控
function startMemoryMonitoring() {
  // 每10秒监控一次内存使用情况
  memoryMonitoringInterval = setInterval(() => {
    if (performance && performance.memory) {
      const memoryInfo = performance.memory;
      const memoryUsage = {
        timestamp: new Date().toISOString(),
        usedJSHeapSize: memoryInfo.usedJSHeapSize / 1024 / 1024, // 转换为MB
        totalJSHeapSize: memoryInfo.totalJSHeapSize / 1024 / 1024,
        jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit / 1024 / 1024
      };
      
      memoryUsageHistory.push(memoryUsage);
      
      // 只保留最近100条记录
      if (memoryUsageHistory.length > 100) {
        memoryUsageHistory.shift();
      }
      
      // 控制台输出内存使用情况（用于调试）
      console.log('Memory Usage:', memoryUsage);
    }
  }, 10000);
}

// 停止内存使用监控
function stopMemoryMonitoring() {
  if (memoryMonitoringInterval) {
    clearInterval(memoryMonitoringInterval);
    memoryMonitoringInterval = null;
  }
}

// 获取内存使用统计信息
function getMemoryUsageStats() {
  if (memoryUsageHistory.length === 0) {
    return null;
  }
  
  const latest = memoryUsageHistory[memoryUsageHistory.length - 1];
  const average = memoryUsageHistory.reduce((sum, entry) => sum + entry.usedJSHeapSize, 0) / memoryUsageHistory.length;
  const peak = Math.max(...memoryUsageHistory.map(entry => entry.usedJSHeapSize));
  
  return {
    latest: latest.usedJSHeapSize,
    average,
    peak,
    historyLength: memoryUsageHistory.length
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadBackgroundFiles();
  setRandomBackground();
  
  loadConfig();
  loadTheme();

  initDraggable();
  loadContainerPosition();
  initRestoreBtnDraggable();
  loadRestoreBtnPosition();
  initBackgroundBtnDraggable();
  loadBackgroundBtnPosition();

  if (autoRotate) {
    startAutoRotate();
  }

  document.getElementById('addDomainBtn').addEventListener('click', handleAddDomain);
  
  // 存储domainInput的事件监听器引用
  eventListeners.domainInput = (e) => {
    if (e.key === 'Enter') {
      handleAddDomain();
    }
  };
  document.getElementById('domainInput').addEventListener('keypress', eventListeners.domainInput);

  document.getElementById('enabledToggle').addEventListener('change', handleEnabledToggle);
  document.getElementById('fileProtocolToggle').addEventListener('change', handleFileProtocolToggle);
  document.getElementById('regexToggle').addEventListener('change', handleRegexToggle);
  document.getElementById('autoRotateToggle').addEventListener('change', handleAutoRotateToggle);
  document.getElementById('rotateIntervalInput').addEventListener('change', handleRotateIntervalChange);
  document.getElementById('imageTypeToggle').addEventListener('change', handleImageTypeToggle);
  document.getElementById('videoTypeToggle').addEventListener('change', handleVideoTypeToggle);
  document.getElementById('nsfwToggle').addEventListener('change', handleNsfwToggle);
  document.getElementById('nsfwOnlyToggle').addEventListener('change', handleNsfwOnlyToggle);
  document.getElementById('videoReplayToggle').addEventListener('change', handleVideoReplayToggle);
  document.getElementById('resetBtn').addEventListener('click', handleReset);
  document.getElementById('resetPositionBtn').addEventListener('click', resetContainerPosition);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
  document.getElementById('closeBtn').addEventListener('click', handleClose);
  document.getElementById('minimizeBtn').addEventListener('click', handleMinimize);
  document.getElementById('restoreBtn').addEventListener('click', handleRestore);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', handleThemeChange);
  });

  // 添加可见性变化监听器
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // 存储消息监听器的引用
  eventListeners.messageListener = (message) => {
    if (message.action === 'configUpdated') {
      loadConfig();
    }
  };
  
  // 监听消息
  chrome.runtime.onMessage.addListener(eventListeners.messageListener);

  // 开始内存使用监控
  startMemoryMonitoring();

  // 添加页面卸载监听器，清理资源
  window.addEventListener('beforeunload', handleBeforeUnload);
});

// 页面卸载时清理资源
function handleBeforeUnload() {
  // 清理定时器
  if (rotateTimer) {
    clearTimeout(rotateTimer);
    rotateTimer = null;
  }
  
  // 清理存储防抖计时器
  if (storageDebounceTimer) {
    clearTimeout(storageDebounceTimer);
    storageDebounceTimer = null;
  }
  
  // 清理内存监控定时器
  if (memoryMonitoringInterval) {
    clearInterval(memoryMonitoringInterval);
    memoryMonitoringInterval = null;
  }
  
  // 清理视频背景
  if (currentVideoElement) {
    currentVideoElement.removeEventListener('ended', handleVideoEnded);
    currentVideoElement.removeEventListener('loadeddata', handleVideoLoaded);
    currentVideoElement.pause();
    currentVideoElement.src = '';
    currentVideoElement.remove();
    currentVideoElement = null;
  }
  
  // 移除存储的事件监听器
  if (eventListeners.domainInput) {
    const domainInput = document.getElementById('domainInput');
    if (domainInput) {
      domainInput.removeEventListener('keypress', eventListeners.domainInput);
    }
  }
  
  if (eventListeners.messageListener) {
    chrome.runtime.onMessage.removeListener(eventListeners.messageListener);
  }
  
  // 移除可见性变化监听器
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  // 清空背景文件列表，释放内存
  backgroundImages = [];
  backgroundVideos = [];
  recentBackgrounds = [];
  memoryUsageHistory.length = 0;
  eventListeners = {};
  pendingStorageData = {};
}

// 拖动功能实现
function initDraggable() {
  const container = document.getElementById('draggableContainer');
  const dragHandle = document.getElementById('dragHandle');
  
  if (!container || !dragHandle) return;

  let isDragging = false;
  let startX, startY, initialX, initialY;

  dragHandle.addEventListener('mousedown', (e) => {
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

    const containerRect = container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    newX = Math.max(0, Math.min(newX, viewportWidth - containerRect.width));
    newY = Math.max(0, Math.min(newY, viewportHeight - containerRect.height));

    container.style.transform = 'none';
    container.style.left = `${newX}px`;
    container.style.top = `${newY}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      container.classList.remove('dragging');
      saveContainerPosition();
    }
  });

  container.addEventListener('selectstart', (e) => {
    if (isDragging) {
      e.preventDefault();
    }
  });
}

function saveContainerPosition() {
  const container = document.getElementById('draggableContainer');
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const positionData = {
    left: rect.left,
    top: rect.top,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight
  };

  updateStorage({ containerPosition: positionData });
}

function loadContainerPosition() {
  chrome.storage.local.get(['containerPosition'], (result) => {
    if (!result.containerPosition) return;

    const container = document.getElementById('draggableContainer');
    if (!container) return;

    const savedPosition = result.containerPosition;
    const containerRect = container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = savedPosition.left;
    let top = savedPosition.top;

    if (savedPosition.screenWidth && savedPosition.screenHeight) {
      const scaleX = viewportWidth / savedPosition.screenWidth;
      const scaleY = viewportHeight / savedPosition.screenHeight;

      left = left * scaleX;
      top = top * scaleY;
    }

    left = Math.max(0, Math.min(left, viewportWidth - containerRect.width));
    top = Math.max(0, Math.min(top, viewportHeight - containerRect.height));

    container.style.transform = 'none';
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
  });
}

function resetContainerPosition() {
  const container = document.getElementById('draggableContainer');
  if (!container) return;

  container.style.transform = '';
  container.style.left = '';
  container.style.top = '';

  chrome.storage.local.remove(['containerPosition']);
}

function startAutoRotate() {
  stopAutoRotate();
  
  // 只有当前背景是图片时才设置定时器
  if (autoRotate && currentBackgroundType === 'image') {
    // 使用setTimeout代替setInterval，避免定时器累积
    function rotateBackground() {
      setRandomBackground();
      // 只有在图片背景且自动轮转启用时才继续设置下一个定时器
      if (autoRotate && currentBackgroundType === 'image') {
        rotateTimer = setTimeout(rotateBackground, rotateInterval * 1000);
      }
    }
    rotateTimer = setTimeout(rotateBackground, rotateInterval * 1000);
  }
}

function stopAutoRotate() {
  if (rotateTimer) {
    clearTimeout(rotateTimer);
    rotateTimer = null;
  }
}

// 存储防抖计时器
let storageDebounceTimer = null;

// 待更新的存储数据
let pendingStorageData = {};

// 防抖函数，延迟执行存储操作
function debouncedStorageUpdate() {
  clearTimeout(storageDebounceTimer);
  storageDebounceTimer = setTimeout(() => {
    if (Object.keys(pendingStorageData).length > 0) {
      chrome.storage.local.set(pendingStorageData);
      pendingStorageData = {};
    }
  }, 300); // 300ms延迟，减少频繁存储
}

// 更新存储数据（使用防抖）
function updateStorage(data) {
  Object.assign(pendingStorageData, data);
  debouncedStorageUpdate();
}

function handleAutoRotateToggle(e) {
  const newValue = e.target.checked;
  if (autoRotate !== newValue) {
    autoRotate = newValue;
    updateStorage({ autoRotate });
    
    const rotateIntervalItem = document.getElementById('rotateIntervalItem');
    if (rotateIntervalItem) {
      rotateIntervalItem.style.display = autoRotate ? 'flex' : 'none';
    }
    
    // 控制视频重播选项的显示
    const videoReplayItem = document.getElementById('videoReplayItem');
    const videoReplayToggle = document.getElementById('videoReplayToggle');
    if (videoReplayItem) {
      videoReplayItem.style.display = autoRotate ? 'none' : 'flex';
    }
    
    // 当关闭自动轮转时，重置视频重播为默认开启状态
    if (!autoRotate) {
      videoReplay = true;
      if (videoReplayToggle) videoReplayToggle.checked = true;
    }
    
    if (autoRotate) {
      startAutoRotate();
    } else {
      stopAutoRotate();
    }
  }
}

function handleRotateIntervalChange(e) {
  const value = parseInt(e.target.value);
  if (value >= 5 && value <= 300 && rotateInterval !== value) {
    rotateInterval = value;
    updateStorage({ rotateInterval });
    if (autoRotate) {
      startAutoRotate();
    }
  }
}

function handleImageTypeToggle(e) {
  const newValue = e.target.checked;
  if (selectedTypes.image !== newValue) {
    selectedTypes.image = newValue;
    // 确保至少选择一种类型
    if (!selectedTypes.image && !selectedTypes.video) {
      e.target.checked = true;
      selectedTypes.image = true;
    }
    updateStorage({ selectedTypes });
    setRandomBackground();
  }
}

function handleVideoTypeToggle(e) {
  const newValue = e.target.checked;
  if (selectedTypes.video !== newValue) {
    selectedTypes.video = newValue;
    // 确保至少选择一种类型
    if (!selectedTypes.image && !selectedTypes.video) {
      e.target.checked = true;
      selectedTypes.video = true;
    }
    updateStorage({ selectedTypes });
    setRandomBackground();
  }
}

function handleVideoReplayToggle(e) {
  const newValue = e.target.checked;
  if (videoReplay !== newValue) {
    videoReplay = newValue;
    // 不保存视频重播状态到存储，仅在当前会话中生效
  }
}

function handleNsfwToggle(e) {
  const newValue = e.target.checked;
  if (nsfwEnabled !== newValue) {
    nsfwEnabled = newValue;
    // 不保存NSFW状态到存储，仅在当前会话中生效
    
    // 控制仅NSFW选项的显示
    const nsfwOnlyItem = document.getElementById('nsfwOnlyItem');
    if (nsfwOnlyItem) {
      nsfwOnlyItem.style.display = nsfwEnabled ? 'flex' : 'none';
    }
    
    // 如果关闭NSFW，同时关闭仅NSFW选项
    if (!nsfwEnabled) {
      nsfwOnly = false;
      const nsfwOnlyToggle = document.getElementById('nsfwOnlyToggle');
      if (nsfwOnlyToggle) nsfwOnlyToggle.checked = false;
    }
    
    // 重新加载背景文件
    loadBackgroundFiles();
  }
}

function handleNsfwOnlyToggle(e) {
  const newValue = e.target.checked;
  if (nsfwOnly !== newValue) {
    nsfwOnly = newValue;
    // 不保存仅NSFW状态到存储，仅在当前会话中生效
    // 重新加载背景文件
    loadBackgroundFiles();
  }
}

function handleMinimize() {
  const container = document.getElementById('draggableContainer');
  const restoreBtn = document.getElementById('restoreBtn');
  if (container && restoreBtn) {
    container.classList.add('minimized');
    restoreBtn.classList.add('show');
  }
}

function handleRestore() {
  if (restoreBtnHasMoved) {
    return;
  }
  
  const container = document.getElementById('draggableContainer');
  const restoreBtn = document.getElementById('restoreBtn');
  if (container && restoreBtn) {
    container.classList.remove('minimized');
    restoreBtn.classList.remove('show');
    if (autoRotate) {
      startAutoRotate();
    }
  }
}

function initRestoreBtnDraggable() {
  const restoreBtn = document.getElementById('restoreBtn');
  if (!restoreBtn) return;

  restoreBtn.addEventListener('mousedown', (e) => {
    restoreBtnDragging = true;
    restoreBtnHasMoved = false;
    restoreBtnStartX = e.clientX;
    restoreBtnStartY = e.clientY;
    
    const rect = restoreBtn.getBoundingClientRect();
    restoreBtnInitialX = rect.left;
    restoreBtnInitialY = rect.top;
    
    restoreBtn.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!restoreBtnDragging) return;

    const deltaX = e.clientX - restoreBtnStartX;
    const deltaY = e.clientY - restoreBtnStartY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      restoreBtnHasMoved = true;
    }

    let newX = restoreBtnInitialX + deltaX;
    let newY = restoreBtnInitialY + deltaY;

    const btnRect = restoreBtn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    newX = Math.max(0, Math.min(newX, viewportWidth - btnRect.width));
    newY = Math.max(0, Math.min(newY, viewportHeight - btnRect.height));

    restoreBtn.style.left = `${newX}px`;
    restoreBtn.style.top = `${newY}px`;
    restoreBtn.style.right = 'auto';
    restoreBtn.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (restoreBtnDragging) {
      restoreBtnDragging = false;
      restoreBtn.classList.remove('dragging');
      saveRestoreBtnPosition();
      
      setTimeout(() => {
        restoreBtnHasMoved = false;
      }, 100);
    }
  });
}

function saveRestoreBtnPosition() {
  const restoreBtn = document.getElementById('restoreBtn');
  if (!restoreBtn) return;

  const rect = restoreBtn.getBoundingClientRect();
  const positionData = {
    left: rect.left,
    top: rect.top,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight
  };

  updateStorage({ restoreBtnPosition: positionData });
}

function loadRestoreBtnPosition() {
  chrome.storage.local.get(['restoreBtnPosition'], (result) => {
    if (!result.restoreBtnPosition) return;

    const restoreBtn = document.getElementById('restoreBtn');
    if (!restoreBtn) return;

    const savedPosition = result.restoreBtnPosition;
    const btnRect = restoreBtn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = savedPosition.left;
    let top = savedPosition.top;

    if (savedPosition.screenWidth && savedPosition.screenHeight) {
      const scaleX = viewportWidth / savedPosition.screenWidth;
      const scaleY = viewportHeight / savedPosition.screenHeight;

      left = left * scaleX;
      top = top * scaleY;
    }

    left = Math.max(0, Math.min(left, viewportWidth - btnRect.width));
    top = Math.max(0, Math.min(top, viewportHeight - btnRect.height));

    restoreBtn.style.left = `${left}px`;
    restoreBtn.style.top = `${top}px`;
    restoreBtn.style.right = 'auto';
    restoreBtn.style.bottom = 'auto';
  });
}

function resetRestoreBtnPosition() {
  const restoreBtn = document.getElementById('restoreBtn');
  if (!restoreBtn) return;

  restoreBtn.style.left = '';
  restoreBtn.style.top = '';
  restoreBtn.style.right = '20px';
  restoreBtn.style.bottom = '20px';

  chrome.storage.local.remove(['restoreBtnPosition']);
}

function handleBackgroundUpdate() {
  setRandomBackground();
}

function initBackgroundBtnDraggable() {
  const backgroundBtn = document.getElementById('backgroundBtn');
  if (!backgroundBtn) return;

  backgroundBtn.addEventListener('click', (e) => {
    if (!backgroundBtnHasMoved) {
      handleBackgroundUpdate();
    }
  });

  backgroundBtn.addEventListener('mousedown', (e) => {
    backgroundBtnDragging = true;
    backgroundBtnHasMoved = false;
    backgroundBtnStartX = e.clientX;
    backgroundBtnStartY = e.clientY;
    
    const rect = backgroundBtn.getBoundingClientRect();
    backgroundBtnInitialX = rect.left;
    backgroundBtnInitialY = rect.top;
    
    backgroundBtn.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!backgroundBtnDragging) return;

    const deltaX = e.clientX - backgroundBtnStartX;
    const deltaY = e.clientY - backgroundBtnStartY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      backgroundBtnHasMoved = true;
    }

    let newX = backgroundBtnInitialX + deltaX;
    let newY = backgroundBtnInitialY + deltaY;

    const btnRect = backgroundBtn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    newX = Math.max(0, Math.min(newX, viewportWidth - btnRect.width));
    newY = Math.max(0, Math.min(newY, viewportHeight - btnRect.height));

    backgroundBtn.style.left = `${newX}px`;
    backgroundBtn.style.top = `${newY}px`;
    backgroundBtn.style.right = 'auto';
    backgroundBtn.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (backgroundBtnDragging) {
      backgroundBtnDragging = false;
      backgroundBtn.classList.remove('dragging');
      saveBackgroundBtnPosition();
      
      setTimeout(() => {
        backgroundBtnHasMoved = false;
      }, 100);
    }
  });
}

function saveBackgroundBtnPosition() {
  const backgroundBtn = document.getElementById('backgroundBtn');
  if (!backgroundBtn) return;

  const rect = backgroundBtn.getBoundingClientRect();
  const positionData = {
    left: rect.left,
    top: rect.top,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight
  };

  updateStorage({ backgroundBtnPosition: positionData });
}

function loadBackgroundBtnPosition() {
  chrome.storage.local.get(['backgroundBtnPosition'], (result) => {
    if (!result.backgroundBtnPosition) return;

    const backgroundBtn = document.getElementById('backgroundBtn');
    if (!backgroundBtn) return;

    const savedPosition = result.backgroundBtnPosition;
    const btnRect = backgroundBtn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = savedPosition.left;
    let top = savedPosition.top;

    if (savedPosition.screenWidth && savedPosition.screenHeight) {
      const scaleX = viewportWidth / savedPosition.screenWidth;
      const scaleY = viewportHeight / savedPosition.screenHeight;

      left = left * scaleX;
      top = top * scaleY;
    }

    left = Math.max(0, Math.min(left, viewportWidth - btnRect.width));
    top = Math.max(0, Math.min(top, viewportHeight - btnRect.height));

    backgroundBtn.style.left = `${left}px`;
    backgroundBtn.style.top = `${top}px`;
    backgroundBtn.style.right = 'auto';
    backgroundBtn.style.bottom = 'auto';
  });
}

function resetBackgroundBtnPosition() {
  const backgroundBtn = document.getElementById('backgroundBtn');
  if (!backgroundBtn) return;

  backgroundBtn.style.left = '';
  backgroundBtn.style.top = '';
  backgroundBtn.style.right = '20px';
  backgroundBtn.style.bottom = '80px';

  chrome.storage.local.remove(['backgroundBtnPosition']);
}