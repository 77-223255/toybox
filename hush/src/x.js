// Hush — X (Twitter) Content Script
//
// 由 popup 里的蓝色按钮统一控制，做两件事：
//
//   1) 「为你推荐」隐藏：只保留首页时间线顶部的「正在关注 / Following」。
//      为什么不用纯 CSS：标签文字在 DOM 文本里，CSS 无法按文字选择。
//      所以用 JS 扫描 [role="tab"]，给「为你推荐」打上 MARK_ATTR 标记，
//      再由注入的 CSS 隐藏。
//
//   2) 白天封锁：本地时间 09:00–21:00 之间，整页清空、只留一句标语，
//      直接不让看（全屏遮罩，覆盖整个站点）。到 21:00 自动解除，
//      恢复成「隐藏为你推荐」的正常 X。判定用本地时间的小时数，
//      9:00 整进入、21:00 整解除。
//
// 选择器策略：X 的类名全是哈希（如 r-1habvwh），不可靠；但
// role="tab" / role="tablist" 是稳定的无障碍属性，优先使用。
//
// 只隐藏标签本身：不做自动跳转 / 自动点击（用户明确不要），
// 也不动探索页（那里虽然也有「为你推荐」，但 tablist 里没有「正在关注」）。
// 因此如果刷新后时间线仍停在「为你推荐」，点一下「正在关注」即可。
//
// 居中：X 的 tablist 是两个等宽容器（tablist > div > [role="tab"]），
// 只把「为你推荐」那半的 tab 隐藏的话，「正在关注」会留在右半边。
// 所以注入的 CSS 还会把被隐藏那半的容器压成 0，让「正在关注」撑满整行并居中。

const STORAGE_KEY = 'x-hider-enabled';
const STYLE_ID = 'x-hider-style';
const MARK_ATTR = 'data-x-hider-foryou';

// ── 白天封锁（09:00–21:00）─────────────────────────────────────
// 与「隐藏为你推荐」共用同一个开关（popup 蓝色按钮），不单独加开关。
const BLOCK_ATTR = 'data-x-hush-block';
const BLOCK_ID = 'x-hush-block';
const BLOCK_MIRROR_KEY = 'x-hider-block-mirror'; // 同源 localStorage 镜像，用于 document_start 同步预判
const BLOCK_START_HOUR = 9; // 09:00 起封锁
const BLOCK_END_HOUR = 21; // 21:00 起解除
const BLOCK_TICK_MS = 15000; // 每 15s 复查一次，跨过 9 点 / 21 点后最多 15s 内生效

// 中英文 UI 都覆盖
const FOR_YOU_RE = /^(为你推荐|for you)$/i;
const FOLLOWING_RE = /^(正在关注|following)$/i;

let enabled = true;
let blocked = false;
let scanTimer = null;
let observer = null;
let pollTimer = null;
let blockTimer = null;
let overlayPending = false;

function labelOf(el) {
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [${MARK_ATTR}="1"]{display:none !important;}

    /* 隐藏「为你推荐」后，别让它的容器继续占着半边宽度：
       X 的结构是 tablist > div(容器) > [role="tab"]，两个容器各 flex-grow:1 → 各占一半。
       把被隐藏那半的容器压成 0，剩下的「正在关注」就会撑满整行、文字居中，
       否则「正在关注」只占右半边，看着像偏在一边。 */
    [role="tablist"]:has([${MARK_ATTR}="1"]) > *:has(> [${MARK_ATTR}="1"]) {
      flex-grow: 0 !important;
      flex-basis: 0 !important;
      flex-shrink: 1 !important;
      width: 0 !important;
      min-width: 0 !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }

    /* 剩下的容器 / 标签撑满整行，并让标签内容居中 */
    [role="tablist"]:has([${MARK_ATTR}="1"]) > [role="tab"]:not([${MARK_ATTR}="1"]),
    [role="tablist"]:has([${MARK_ATTR}="1"]) > *:has(> [role="tab"]:not([${MARK_ATTR}="1"])) {
      flex: 1 1 0% !important;
      max-width: none !important;
      min-width: 0 !important;
    }
    [role="tablist"]:has([${MARK_ATTR}="1"]) > *:has(> [role="tab"]:not([${MARK_ATTR}="1"])) > [role="tab"] {
      justify-content: center !important;
    }

    /* ── 白天封锁：整页清空，只留标语 ───────────────────────── */
    html[${BLOCK_ATTR}="1"] body {
      background: #0b0b0b !important;
      overflow: hidden !important;
    }
    /* 隐藏 body 下除遮罩外的所有内容（含 X 的 #react-root），
       让页面彻底清空、无法滚动查看。遮罩自身是 body 的直接子元素，不受影响。 */
    html[${BLOCK_ATTR}="1"] body > *:not(#${BLOCK_ID}) {
      display: none !important;
    }
    #${BLOCK_ID} { display: none; }
    html[${BLOCK_ATTR}="1"] #${BLOCK_ID} {
      display: flex !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      background: #0b0b0b;
      color: #f5f5f5;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    #${BLOCK_ID} .x-hush-inner { max-width: 36rem; }
    #${BLOCK_ID} .x-hush-title {
      margin: 0 0 18px;
      font-size: clamp(30px, 7vw, 56px);
      font-weight: 700;
      letter-spacing: 0.12em;
    }
    #${BLOCK_ID} .x-hush-line {
      margin: 0 0 10px;
      font-size: clamp(15px, 3.4vw, 22px);
      letter-spacing: 0.06em;
      color: #c9c9c9;
    }
    #${BLOCK_ID} .x-hush-note {
      margin: 0;
      font-size: clamp(12px, 2.6vw, 15px);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #6f6f6f;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function clearMarks() {
  document.querySelectorAll(`[${MARK_ATTR}]`).forEach((el) => {
    el.removeAttribute(MARK_ATTR);
  });
}

function scan() {
  if (!enabled) return;
  document.querySelectorAll('[role="tab"]').forEach((tab) => {
    if (!FOR_YOU_RE.test(labelOf(tab))) return;
    const list = tab.closest('[role="tablist"]');
    if (!list) return;
    // 只在首页时间线的 tablist 里动手：它同时包含「正在关注」
    let hasFollowing = false;
    list.querySelectorAll('[role="tab"]').forEach((t) => {
      if (FOLLOWING_RE.test(labelOf(t))) hasFollowing = true;
    });
    if (hasFollowing) tab.setAttribute(MARK_ATTR, '1');
  });
}

function scheduleScan() {
  if (!enabled || scanTimer) return;
  scanTimer = setTimeout(() => {
    scanTimer = null;
    scan();
  }, 100);
}

// ── 白天封锁相关 ───────────────────────────────────────────────

function isWithinBlockWindow() {
  const hour = new Date().getHours();
  return hour >= BLOCK_START_HOUR && hour < BLOCK_END_HOUR;
}

function buildOverlay(parent) {
  if (document.getElementById(BLOCK_ID)) return;
  const el = document.createElement('div');
  el.id = BLOCK_ID;
  el.setAttribute('role', 'presentation');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="x-hush-inner">
      <div class="x-hush-title">专注时间</div>
      <div class="x-hush-line">9:00 – 21:00 不看 X</div>
      <div class="x-hush-note">Hush · 21:00 后再见</div>
    </div>`;
  parent.appendChild(el);
}

// document_start 时 body 可能还不存在，等它出现再挂遮罩。
function ensureOverlay() {
  if (document.getElementById(BLOCK_ID)) return;
  if (document.body) {
    buildOverlay(document.body);
    return;
  }
  if (overlayPending) return;
  overlayPending = true;
  const obs = new MutationObserver(() => {
    if (!document.body) return;
    obs.disconnect();
    overlayPending = false;
    if (blocked) buildOverlay(document.body);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

// 计算并应用「是否封锁」。force=true 时无论状态是否变化都重算一次。
function syncBlock(force) {
  const should = enabled && isWithinBlockWindow();
  if (!force && should === blocked) return;
  blocked = should;
  if (should) {
    document.documentElement.setAttribute(BLOCK_ATTR, '1');
    ensureOverlay();
    try {
      localStorage.setItem(BLOCK_MIRROR_KEY, '1');
    } catch (e) {
      /* localStorage 不可用时忽略 */
    }
  } else {
    document.documentElement.removeAttribute(BLOCK_ATTR);
    try {
      localStorage.setItem(BLOCK_MIRROR_KEY, '0');
    } catch (e) {
      /* localStorage 不可用时忽略 */
    }
  }
}

function startBlockClock() {
  if (blockTimer) return;
  blockTimer = setInterval(() => syncBlock(false), BLOCK_TICK_MS);
}

function stopBlockClock() {
  if (blockTimer) {
    clearInterval(blockTimer);
    blockTimer = null;
  }
}

// 页面脚本执行前同步预判：镜像不是明确的 “0”（即扩展开着）且当前在封锁时段，
// 就先给 <html> 打上封锁标记并同步注入样式，避免 body 渲染后才遮造成闪一下。
(function preApplyBlock() {
  try {
    if (localStorage.getItem(BLOCK_MIRROR_KEY) !== '0' && isWithinBlockWindow()) {
      ensureStyle();
      document.documentElement.setAttribute(BLOCK_ATTR, '1');
    }
  } catch (e) {
    /* localStorage 不可用时忽略 */
  }
})();

// 只在开启时才挂 MutationObserver / 兜底 interval；
// 关闭时全部拆掉，让插件彻底闲着，不参与 X 的 DOM 变动。
function startWatching() {
  if (!observer) {
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (!pollTimer) pollTimer = setInterval(scheduleScan, 2000);
}

function stopWatching() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
}

function enable() {
  enabled = true;
  ensureStyle();
  syncBlock(true);
  startBlockClock();
  scan();
  startWatching();
}

function disable() {
  enabled = false;
  stopWatching();
  stopBlockClock();
  clearMarks();
  syncBlock(true); // enabled=false → 一定会解除封锁
}

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || { enabled: true });
    });
  });
}

// popup 里的蓝色按钮
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateXConfig') {
    if (request.enabled) enable();
    else disable();
    sendResponse({ success: true });
  }
});

(async function init() {
  ensureStyle();
  const config = await getConfig();
  if (config.enabled) enable();
  else disable();
})();
