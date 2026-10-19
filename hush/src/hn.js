// Hush — Hacker News Content Script
//
// 由 popup 里的橙色按钮控制：把 news.ycombinator.com 换成深色主题，
// 并整体调大字号（首页 + 帖子页 + 评论页，评论自然也在内）。
//
// 站点是上古的 table 布局，颜色一部分写在 CSS、一部分写在 bgcolor 属性上，
// 所以这里统一用 !important 压过去。**橙色是 Hacker News 的标志，必须保留**：
// 顶部导航条是 <td bgcolor="#ff6600">，我们只改 #hnmain（内容底色），
// 绝不碰那一格的背景，橙色原样保留；另外把「More」链接和评论里的链接
// 也沿用品牌橙，作为深色下的强调色。
//
// 关键结构：
//   #hnmain（内容表，bgcolor=#f6f6ef）
//     └ tr:first-child > td[bgcolor=#ff6600]  ← 顶栏，保持橙色，不动
//     └ tr > td → 列表 / 帖子 / 评论（td.default / .comment / .commtext / .comhead）
//   首页标题：.title / .titleline > a；元信息：.subtext

const STORAGE_KEY = 'hn-hider-enabled';
const STYLE_ID = 'hn-hider-style';

const HN_ORANGE = '#ff6600'; // 标志性橙色，保留
const HN_ORANGE_TEXT = '#ff8a3d'; // 深色底上更易读的橙色（评论链接）
const BG_BASE = '#121212'; // 页面底色
const BG_MAIN = '#1b1b1b'; // #hnmain 内容底色
const TEXT = '#d6d6d6';
const TEXT_STRONG = '#ececec';
const TEXT_MUTED = '#8a8a8a';
const LINK = '#cfcfcf';
const LINK_VISITED = '#7d7d7d';

const HN_CSS = `
  /* 底色：body / 内容表。顶栏那格是 bgcolor="#ff6600"，只改 #hnmain 不会动到它。 */
  html, body { background: ${BG_BASE} !important; }
  #hnmain { background-color: ${BG_MAIN} !important; }

  /* ── 字号整体调大 ─────────────────────────────────────────── */
  body,
  td,
  .default,
  .comment,
  .commtext,
  .title,
  .titleline,
  .storylink,
  .subtext,
  .comhead,
  .pagetop,
  .yclinks {
    font-size: 15px !important;
    line-height: 1.55 !important;
  }
  .title,
  .titleline,
  .titleline > a,
  .storylink {
    font-size: 17px !important;
    line-height: 1.45 !important;
  }
  .comment,
  .commtext,
  .default {
    font-size: 15px !important;
    line-height: 1.65 !important;
  }
  .subtext,
  .comhead {
    font-size: 13px !important;
    line-height: 1.5 !important;
  }
  .pagetop {
    font-size: 14px !important;
    line-height: 1.4 !important;
  }

  /* ── 文字颜色 ─────────────────────────────────────────────── */
  body, td, #hnmain, .default, .comment, .commtext, .title, .titleline {
    color: ${TEXT} !important;
  }
  .subtext,
  .subtext a:link,
  .subtext a:visited,
  .comhead,
  .comhead a:link,
  .comhead a:visited,
  .score,
  .age,
  .yclinks,
  .yclinks a:link,
  .yclinks a:visited {
    color: ${TEXT_MUTED} !important;
  }

  /* ── 链接 ─────────────────────────────────────────────────── */
  a:link, a:visited { color: ${LINK} !important; }
  a:hover { color: ${HN_ORANGE} !important; }

  /* 首页 / 列表里的标题链接：正文用亮色，已访问的压暗 */
  .title a:link,
  .storylink:link,
  .titleline > a:link { color: ${TEXT_STRONG} !important; }
  .title a:visited,
  .storylink:visited,
  .titleline > a:visited { color: ${LINK_VISITED} !important; }

  /* 评论里的链接用品牌橙，深色下更醒目、也呼应顶栏 */
  .comment a:link,
  .commtext a:link { color: ${HN_ORANGE_TEXT} !important; }
  .comment a:visited,
  .commtext a:visited { color: #b34700 !important; }
  .comment a:hover,
  .commtext a:hover { color: ${HN_ORANGE} !important; }

  /* 顶栏文字保持白字 / 白链接（橙底），不要被通用链接色污染 */
  .pagetop,
  .pagetop a:link,
  .pagetop a:visited,
  .pagetop a:hover { color: #ffffff !important; }
  .hnname a:link,
  .hnname a:visited { color: #ffffff !important; }

  /* 「More」链接：品牌橙 */
  .morelink,
  a.morelink:link,
  a.morelink:visited { color: ${HN_ORANGE} !important; }

  /* ── 其它小件 ─────────────────────────────────────────────── */
  /* 评论树左侧的缩进条本来用 s.gif 撑宽，保持透明即可；这里只统一分隔线颜色 */
  .athing.comtr td,
  .athing.comtr .comhead { background: transparent !important; }
  .votelinks a:hover { color: ${HN_ORANGE} !important; }
  input, textarea, select {
    background: #202020 !important;
    color: ${TEXT} !important;
    border: 1px solid #3a3a3a !important;
  }
`;

function applyStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = HN_CSS;
  (document.head || document.documentElement).appendChild(style);
}

function removeStyle() {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}

function enable() {
  applyStyle();
}

function disable() {
  removeStyle();
}

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || { enabled: true });
    });
  });
}

// 先挂样式（默认开启），避免深色晚一拍造成闪白；随后读到关闭再摘掉。
applyStyle();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateHnConfig') {
    if (request.enabled) enable();
    else disable();
    sendResponse({ success: true });
  }
});

(async function init() {
  const config = await getConfig();
  if (config.enabled) enable();
  else disable();
})();
