// Hush — Codeforces Content Script
//
// 由 popup 里的金色按钮控制：把 codeforces.com 换成「复古老派」的暖色深色主题。
//
// 配色思路：深棕近黑的底 + 暖米白的字 + 琥珀/黄铜色的链接与强调，
// 像旧式 CRT / 牛皮纸铅印的观感，但保证正文与代码可读。
//
// 站点是服务端渲染的「上古」页面（jQuery 时代），颜色一半写在 style.css 里，
// 一半写在 :root 的 CSS 变量与内联 bgcolor 属性上。做法：
//   1) 覆写 :root 的 --border-color / --muted-color / --highlighted-* 等变量，
//      一次性带走所有引用变量的组件（notice / text-label / datatable-filter …）；
//   2) 对硬编码颜色的组件逐条用 !important 覆盖。
//
// 关键结构：
//   body
//     #body
//       #header            → logo + 语言/登录
//       .roundbox.menu-box → 顶部主菜单 .menu-list（当前项下划线 #3B5998）
//       #pageContent       → 内容区，内含 .roundbox 面板
//         .roundbox .caption / .titled / .bottom-links / .dark
//         .datatable（榜单表格，浅色角贴图）
//         div.ttypography / .problem-statement（题面、代码、样例）
//         .topic（博客/评论）
//       #sidebar           → .sidebox
//       #footer
//
// 注意：`.rated-user.user-*` 的段位颜色（红/橙/紫/蓝/青/绿/灰）带 !important，
// 所以链接色用「不带 !important」的 a:link/a:visited/a:hover —— 让段位色自然胜出；
// 少数站点用 !important 写死的链接色（.logo-href / .pagination a / 评论等）再逐条覆盖。
// 段位里在黑底上看不见的黑字（user-black / user-admin / legendary 首字母）单独改成暖色。

const STORAGE_KEY = 'cf-hider-enabled';
const STYLE_ID = 'cf-hider-style';

// ── 暖色深色调色板 ──────────────────────────────────────────────
const BG_BASE = '#191512'; // 页面底（深棕近黑）
const BG_PANEL = '#211c17'; // .roundbox 面板
const BG_RAISED = '#2b241c'; // 标题条 / 表头 / 交替行
const BG_CODE = '#141110'; // 代码 / 样例 / pre
const BG_INPUT = '#241e18'; // 输入框
const BG_HOVER = '#2a2319'; // 表格悬停行
const BORDER = '#4a3d2d'; // 常规暖棕描边
const BORDER_SOFT = '#382e22'; // 更淡的分隔线
const BORDER_STRONG = '#6d5a3e'; // 强调描边
const TEXT = '#e6dac0'; // 正文（暖米白）
const TEXT_STRONG = '#f6ecd6';
const TEXT_MUTED = '#a08d6b'; // 元信息（暖灰棕）
const LINK = '#e0a94e'; // 链接（琥珀）
const LINK_VISITED = '#b07d33';
const LINK_HOVER = '#ffd483';
const ACCENT = '#d9a441'; // 强调金（标题 / 当前项）
const ACCENT_DIM = '#8a6a2f'; // 次级强调 / 按钮底
const TINT = '#33291a'; // 暖色高亮底（原 #def / #FFF7DB）
const WARM_GREEN = '#8fae5a';
const WARM_RED = '#d96a4a';
const WARM_BLUE = '#8fa9d6';

const CF_CSS = `
  /* ── 1. 覆写站点 CSS 变量（带走所有引用变量的组件） ─────────── */
  :root {
    --border-color: ${BORDER} !important;
    --notice-color: ${TEXT_MUTED} !important;
    --muted-color: ${TEXT_MUTED} !important;
    --highlighted-blue-color: ${TINT} !important;
    --highlighted-green-color: #262f1d !important;
    --success-color: ${WARM_GREEN} !important;
    --warning-color: ${ACCENT} !important;
    --error-color: ${WARM_RED} !important;
  }

  /* ── 2. 页面底色 / 正文 ─────────────────────────────────────── */
  html {
    color-scheme: dark !important; /* 原生滚动条 / 表单控件跟着变深色 */
  }
  html, body {
    background: ${BG_BASE} !important;
    color: ${TEXT} !important;
  }
  /* 品牌 logo 是深蓝 PNG，深底上偏暗；略微提亮以看清 */
  #header img[alt="Codeforces"] { filter: brightness(1.4) saturate(1.05); }
  ::selection { background: ${ACCENT_DIM} !important; color: ${TEXT_STRONG} !important; }

  /* ── 3. 链接（不带 !important，段位色 user-* 才能胜出） ─────── */
  a:link { color: ${LINK}; }
  a:visited { color: ${LINK_VISITED}; }
  a:hover, a:active { color: ${LINK_HOVER}; }

  /* ── 4. 顶部 logo / 主菜单 ──────────────────────────────────── */
  .logo-href { color: ${TEXT_STRONG} !important; }
  .menu-list li a { color: ${TEXT} !important; }
  .menu-list li a:hover, .menu-list li a:active { color: ${LINK_HOVER} !important; }
  .menu-list li.current { border-bottom-color: ${ACCENT} !important; }
  .menu-list li.item-highlighted * { color: ${LINK_HOVER} !important; }

  /* ── 5. roundbox 面板（站点默认白底 + 浅色圆角贴图） ────────── */
  .roundbox {
    background-color: ${BG_PANEL} !important;
    border-color: ${BORDER} !important;
  }
  .roundbox .caption { color: ${ACCENT} !important; }
  .roundbox .titled { border-bottom-color: ${BORDER} !important; }
  .roundbox .bottom-links {
    background-color: ${BG_RAISED} !important;
    border-top-color: ${BORDER} !important;
  }
  .roundbox .dark { background-color: ${BG_RAISED} !important; }
  .roundbox .rtable td, .roundbox .rtable th { border-color: ${BORDER} !important; }
  /* 浅色 PNG 圆角贴图在深色下很突兀，交给 border-radius */
  .roundbox-lt, .roundbox-rt, .roundbox-lb, .roundbox-rb { display: none !important; }

  .caption { color: ${ACCENT} !important; }
  #footer { border-top-color: ${BORDER} !important; color: ${TEXT_MUTED} !important; }
  .post { background: ${TINT} !important; }

  /* ── 6. 表单 / 输入 / 按钮 ──────────────────────────────────── */
  input, textarea, select {
    background-color: ${BG_INPUT} !important;
    color: ${TEXT} !important;
    border-color: ${BORDER} !important;
  }
  input[type="submit"], input[type="button"], button, .button {
    background-color: ${ACCENT_DIM} !important;
    color: ${TEXT_STRONG} !important;
    border: 1px solid ${BORDER_STRONG} !important;
    border-radius: 3px !important;
    cursor: pointer;
  }
  input[type="submit"]:hover, input[type="button"]:hover, button:hover {
    background-color: ${ACCENT} !important;
    color: ${BG_BASE} !important;
  }
  .table-form .submit:not(:disabled) { color: ${TEXT_STRONG} !important; }
  .search, .search-large {
    background-color: ${BG_INPUT} !important;
    color: ${TEXT} !important;
    border-color: ${BORDER} !important;
  }

  /* ── 7. 搜索 / 分页 / 杂项 ──────────────────────────────────── */
  .search-help code { background: ${BG_CODE} !important; border-color: ${BORDER} !important; }
  .filter-box input { background-color: ${BG_INPUT} !important; border-color: ${BORDER} !important; }
  .pagination a { color: ${LINK} !important; }
  .pagination .arrow { color: ${TEXT} !important; }
  .pagination .inactive { color: ${TEXT_MUTED} !important; }
  .pagination span.active {
    border-color: ${BORDER} !important;
    background-color: ${BG_RAISED} !important;
  }
  .countdown { color: ${TEXT_MUTED} !important; }
  .welldone { color: ${WARM_GREEN} !important; }
  .error { color: ${WARM_RED} !important; }
  .warning { color: ${ACCENT} !important; }
  a.not-decorated { color: ${TEXT} !important; }
  .blog-entry-section-name { color: ${TEXT} !important; }
  .live li .blog { color: ${TEXT} !important; }
  .live li .comments { color: ${WARM_RED} !important; }
  .red-link { background-color: ${WARM_RED} !important; color: ${TEXT_STRONG} !important; }
  .contest-state-phase { color: ${ACCENT} !important; }
  .contest-state-regular { color: ${TEXT_MUTED} !important; }
  .copier-small {
    color: ${TEXT_MUTED} !important;
    border-color: ${BORDER} !important;
  }
  .copier-small:hover { background-color: ${TINT} !important; }
  img.resource:hover { border-color: ${BORDER_STRONG} !important; }

  /* ── 8. 评论 ────────────────────────────────────────────────── */
  .comments .title { color: ${ACCENT} !important; }
  .comment-indent span { color: ${ACCENT_DIM} !important; }
  .comment-table .reply a { color: ${TEXT_MUTED} !important; }
  .comment-table .info,
  .comment-table .info .item a { color: ${TEXT_MUTED} !important; }
  .comment-table .reply:hover a { color: ${LINK_HOVER} !important; }
  .likeActionLink, .dislikeActionLink { color: ${TEXT_MUTED} !important; }
  .liked { color: ${ACCENT} !important; }
  .disliked { color: ${WARM_RED} !important; }

  /* ── 9. 高亮 / 判定色 ───────────────────────────────────────── */
  .highlight { background-color: ${TINT} !important; border-color: ${ACCENT_DIM} !important; }
  .highlight-blue { background-color: ${TINT} !important; }
  .highlighted-row td, .highlighted-row th { background-color: ${TINT} !important; }
  .problems .accepted-problem td.act { background-color: #2a3320 !important; }
  .problems .accepted-problem td.id { border-left-color: ${WARM_GREEN} !important; }
  .problems .rejected-problem td.act { background-color: #3a231d !important; }
  .problems .rejected-problem td.id { border-left-color: ${WARM_RED} !important; }
  .problems .submitted-verdict-problem td.act { background-color: ${TINT} !important; }
  .problems .submitted-verdict-problem td.id { border-left-color: ${ACCENT_DIM} !important; }
  .verdict-accepted, .verdict-accepted-challenged,
  .verdict-successful-challenge { color: ${WARM_GREEN} !important; }
  .verdict-rejected, .verdict-unsuccessful-challenge { color: ${WARM_BLUE} !important; }
  .verdict-failed, .verdict-challenged { color: ${WARM_RED} !important; }
  .verdict-waiting { color: ${TEXT_MUTED} !important; }

  /* ── 10. 文本标签 / 提示 / 日志 ─────────────────────────────── */
  .text-label-blue, .text-label-info { background-color: ${TINT} !important; color: ${ACCENT} !important; }
  .text-label-green, .text-label-success { background-color: #2a3320 !important; color: ${WARM_GREEN} !important; }
  .text-label-yellow, .text-label-warning { background-color: #3a2f1c !important; color: ${ACCENT} !important; }
  .text-label-red, .text-label-error { background-color: #3a231d !important; color: ${WARM_RED} !important; }
  .text-label-gray, .text-label-muted { background-color: ${BG_RAISED} !important; color: ${TEXT_MUTED} !important; }
  .alert, div.alert-warning {
    background-color: ${TINT} !important;
    border-color: ${BORDER_STRONG} !important;
    color: ${TEXT} !important;
    text-shadow: none !important;
  }
  .interactionLog { color: ${TEXT} !important; }
  .interactionLog .IN { background: ${TINT} !important; }
  .interactionLog .OUT { background-color: ${BG_RAISED} !important; }
  .interactionLog .direction, .interactionLog .truncatedNote { color: ${TEXT_MUTED} !important; }
  .file .text { background-color: ${BG_RAISED} !important; }
  .spoiler-content { background-color: ${TINT} !important; border-color: ${BORDER} !important; }
  .test-for-popup pre { background-color: ${BG_CODE} !important; border-color: ${BORDER} !important; }
  .test-for-popup .interactionLog { border-color: ${BORDER} !important; }

  /* ── 11. 段位色：只修黑底上读不出的，其余原样保留 ───────────── */
  .user-black { color: ${TEXT_MUTED} !important; }
  .user-admin, .user-4000 { color: ${TEXT_STRONG} !important; }
  .user-legendary::first-letter, .legendary-user-first-letter { color: ${TEXT_STRONG} !important; }
  .user-blue { color: ${WARM_BLUE} !important; }
  .user-green { color: ${WARM_GREEN} !important; }

  /* ── 12. 题面排版（ttypography / problem-statement） ────────── */
  div.ttypography { color: ${TEXT} !important; }
  div.ttypography h1, div.ttypography h2, div.ttypography h3,
  div.ttypography h4, div.ttypography h5, div.ttypography h6 { color: ${TEXT_STRONG} !important; }
  div.ttypography .tt {
    background-color: ${BG_CODE} !important;
    border-color: ${BORDER} !important;
  }
  div.ttypography blockquote { color: ${TEXT_MUTED} !important; }
  div.ttypography pre, div.ttypography code { color: ${LINK} !important; }
  div.ttypography pre.lstlisting { background-color: ${BG_CODE} !important; }
  div.ttypography kbd, div.ttypography samp,
  div.ttypography var, div.ttypography tt { color: ${TEXT_MUTED} !important; }
  div.ttypography mark { background: ${ACCENT_DIM} !important; color: ${TEXT_STRONG} !important; }
  div.ttypography hr { border-bottom-color: ${BORDER_SOFT} !important; }
  div.ttypography a { color: ${LINK} !important; }
  div.ttypography a:hover, div.ttypography a:focus {
    background-color: ${ACCENT_DIM} !important;
    color: ${TEXT_STRONG} !important;
  }
  div.ttypography table {
    color: ${TEXT} !important;
    border-top-color: ${BORDER} !important;
    border-bottom-color: ${BORDER} !important;
  }
  div.ttypography thead th { color: ${TEXT_STRONG} !important; border-bottom-color: ${BORDER_STRONG} !important; }
  div.ttypography .bordertable thead th { background: ${BG_RAISED} !important; border-color: ${BORDER} !important; }
  div.ttypography .bordertable tbody th[scope="row"] { background: ${BG_RAISED} !important; }
  div.ttypography tbody th, div.ttypography tbody td { border-top-color: ${BORDER} !important; }
  div.ttypography .bordertable tbody td { border-right-color: ${BORDER} !important; }
  div.ttypography tbody tr:hover th, div.ttypography tbody tr:hover td { background: ${BG_HOVER} !important; }
  div.ttypography .bordered { border-color: ${BORDER} !important; }
  div.ttypography .MathJax { color: ${TEXT_STRONG} !important; }

  .problem-statement .sample-tests .input,
  .problem-statement .sample-tests .output { border-color: ${BORDER} !important; }
  .problem-statement .sample-tests pre { background-color: ${BG_CODE} !important; }
  .problem-statement .sample-tests .title { border-bottom-color: ${BORDER} !important; color: ${ACCENT} !important; }
  .problem-statement .epigraph-source { border-top-color: ${BORDER} !important; }
  .problem-statement .tex-tabular .tex-tabular-border-left { border-left-color: ${BORDER} !important; }
  .problem-statement .tex-tabular .tex-tabular-border-right { border-right-color: ${BORDER} !important; }
  .problem-statement .tex-tabular .tex-tabular-border-top { border-top-color: ${BORDER} !important; }
  .problem-statement .tex-tabular .tex-tabular-border-bottom { border-bottom-color: ${BORDER} !important; }

  /* ── 13. 代码语法高亮（prettify）：暖色复古配色 ─────────────── */
  pre.prettyprint { background: ${BG_CODE} !important; border-color: ${BORDER} !important; }
  .prettyprint .pln, .lstlisting .pln { color: ${TEXT} !important; }
  .prettyprint .str, .lstlisting .str { color: #a8b56a !important; }
  .prettyprint .kwd, .lstlisting .kwd { color: ${ACCENT} !important; }
  .prettyprint .com, .lstlisting .com { color: #8a7a5c !important; font-style: italic !important; }
  .prettyprint .typ, .lstlisting .typ { color: #d98f5a !important; }
  .prettyprint .lit, .lstlisting .lit { color: #c9a26a !important; }
  .prettyprint .pun, .prettyprint .opn, .prettyprint .clo,
  .lstlisting .pun, .lstlisting .opn, .lstlisting .clo { color: #b8a888 !important; }
  .prettyprint .tag, .lstlisting .tag { color: ${ACCENT} !important; }
  .prettyprint .atn, .lstlisting .atn { color: #d98f5a !important; }
  .prettyprint .atv, .lstlisting .atv { color: #a8b56a !important; }
  .prettyprint .dec, .prettyprint .var,
  .lstlisting .dec, .lstlisting .var { color: #d98f5a !important; }
  .prettyprint .fun, .lstlisting .fun { color: #e8c06a !important; }

  /* ── 14. 数据表格 / 二级菜单 / 话题 ─────────────────────────── */
  .datatable td, .datatable th { border-color: ${BORDER_SOFT} !important; }
  .datatable .dark { background-color: ${BG_RAISED} !important; }
  .datatable .lt, .datatable .rt, .datatable .lb, .datatable .rb,
  .datatable .ilt, .datatable .irt { display: none !important; }
  .datatable .filter input { background-color: ${BG_INPUT} !important; color: ${TEXT} !important; }
  .datatable-caption-label { border-color: ${BORDER} !important; }

  .second-level-menu-list li a { color: ${TEXT} !important; }
  .second-level-menu-list li a:hover { color: ${LINK_HOVER} !important; }
  .second-level-menu-list li.backLava {
    background: ${ACCENT_DIM} !important;
    border-radius: 3px !important;
  }
  .second-level-menu-list li.backLava .leftLava { background: transparent !important; }

  .topic .title *, .topic .title a,
  .topic .title a:hover, .topic .title a:visited { color: ${ACCENT} !important; }
  .topic-userpic { border-color: ${BORDER} !important; }
  .topic .content { border-left-color: ${BORDER_STRONG} !important; }
  .topic-edit .title { color: ${ACCENT} !important; }
  .collapsible-topic.collapsed .content .collapsible-topic-options:before {
    background-image: linear-gradient(rgba(25, 21, 18, 0), ${BG_BASE}) !important;
  }
`;

function applyStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CF_CSS;
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
  if (request.action === 'updateCfConfig') {
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
