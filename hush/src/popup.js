// Hush — Popup Script
//
// 三个无文字磁贴，撑满 popup、中间 1px 细线分割，靠颜色区分功能：
//   红色 = 网易云音乐（隐藏侧栏 + Apple Music 深色主题 + 方向键控制播放）
//   蓝色 = X（隐藏「为你推荐」+ 白天 9:00–21:00 封锁）
//   橙色 = Hacker News（深色主题 + 调大字号）
// 三个开关各自独立存储，互不影响。

const NETEASE_KEY = 'netease-hider-enabled';
const X_KEY = 'x-hider-enabled';
const HN_KEY = 'hn-hider-enabled';

const neteaseBtn = document.getElementById('neteaseBtn');
const xBtn = document.getElementById('xBtn');
const hnBtn = document.getElementById('hnBtn');

function getConfig(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(key, (result) => {
      resolve(result[key] || { enabled: true });
    });
  });
}

function saveConfig(key, config) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [key]: config }, resolve);
  });
}

function updateUI(btn, enabled) {
  btn.classList.toggle('on', enabled);
  btn.classList.toggle('off', !enabled);
}

// 只有当前标签页是对应站点时才发消息，避免 "Receiving end does not exist"。
async function sendToActiveTab(hosts, message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !hosts.some((h) => tab.url.includes(h))) return;
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    // 页面没有注入 content script（比如刚装好还没刷新）时忽略即可
  }
}

async function initNetease() {
  let enabled = (await getConfig(NETEASE_KEY)).enabled;
  updateUI(neteaseBtn, enabled);

  neteaseBtn.addEventListener('click', async () => {
    enabled = !enabled;
    await saveConfig(NETEASE_KEY, { enabled });
    await sendToActiveTab(['music.163.com'], { action: 'updateConfig', enabled });
    updateUI(neteaseBtn, enabled);
  });
}

async function initX() {
  let enabled = (await getConfig(X_KEY)).enabled;
  updateUI(xBtn, enabled);

  xBtn.addEventListener('click', async () => {
    enabled = !enabled;
    await saveConfig(X_KEY, { enabled });
    await sendToActiveTab(['x.com', 'twitter.com'], { action: 'updateXConfig', enabled });
    updateUI(xBtn, enabled);
  });
}

async function initHn() {
  let enabled = (await getConfig(HN_KEY)).enabled;
  updateUI(hnBtn, enabled);

  hnBtn.addEventListener('click', async () => {
    enabled = !enabled;
    await saveConfig(HN_KEY, { enabled });
    await sendToActiveTab(['news.ycombinator.com'], { action: 'updateHnConfig', enabled });
    updateUI(hnBtn, enabled);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNetease();
  initX();
  initHn();
});
