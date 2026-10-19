// Hush — 网易云 WebPlayer 完整诊断脚本
//
// 用法：
//   1. 打开**已登录**的 https://music.163.com/st/webplayer
//   2. 想拿到「站点原生 DOM」时，先在 popup 里把红色（网易云）开关关掉，再刷新页面；
//      想确认插件当前效果则保持开启，两种状态各跑一次最全。
//   3. F12 → Console，粘贴本文件全部内容，回车。
//   4. 输出会打印到 Console，并自动复制到剪贴板（Chrome 支持 copy() 时）。
//      把输出整段贴回给 agent。
//
// 说明：不使用 TreeWalker（曾把站点卡死）；全部为 querySelectorAll + 只读遍历。

(function () {
  'use strict';

  var L = [];
  function log() {
    L.push(Array.prototype.join.call(arguments, ' '));
    if (L.length > 4000) throw new Error('diagnostic output too long');
  }
  function q(s) { return document.querySelector(s); }
  function qa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function cls(el) { return (el.getAttribute('class') || '').trim(); }
  function short(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    n = n || 90;
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function ownText(el) {
    var t = '';
    Array.prototype.forEach.call(el.childNodes, function (c) {
      if (c.nodeType === 3) t += c.textContent;
    });
    return t.trim();
  }
  // 从元素往上取 6 层的标签/id/前缀类名，方便定位
  function path(el) {
    var parts = [];
    for (var e = el, i = 0; e && e !== document.body && i < 6; e = e.parentElement, i++) {
      var c = cls(e).split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      parts.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (c ? '.' + c : ''));
    }
    return parts.join(' < ');
  }

  log('=== HUSH · NETEASE DIAGNOSTIC ===');
  log('url   :', location.href);
  log('when  :', new Date().toString());
  log('hidden-style:', !!document.getElementById('netease-hider-style'),
      '| theme-style:', !!document.getElementById('netease-hider-theme'));

  // ── 1. 主题状态 ─────────────────────────────────────────
  log('');
  log('--- [1] THEME STATE ---');
  log('localStorage.currentTheme =', JSON.stringify(localStorage.getItem('currentTheme')));
  log('localStorage["netease-hider-mirror"] =', JSON.stringify(localStorage.getItem('netease-hider-mirror')));
  log('<html> style attr:');
  log(document.documentElement.getAttribute('style') || '(none)');

  // ── 2. html 自定义属性 ───────────────────────────────────
  log('');
  log('--- [2] :root CUSTOM PROPERTIES (--color*/--hush*) ---');
  var cs = getComputedStyle(document.documentElement);
  var props = [];
  for (var i = 0; i < cs.length; i++) {
    var pn = cs[i];
    if (pn.indexOf('--color') === 0 || pn.indexOf('--hush') === 0) props.push(pn);
  }
  props.sort().forEach(function (n) { log('  ' + n + ' = ' + cs.getPropertyValue(n).trim()); });
  if (!props.length) log('  (none)');

  // ── 3. 稳定 id 是否存在 ─────────────────────────────────
  log('');
  log('--- [3] KNOWN ID SELECTORS ---');
  ['#root', '#contentContainer', '#topArea', '#recommend', '#choice', '#audio',
   '#privateFm', '#historyPlaylist', '#myAudio', '#community', '#myFavoriteMusic',
   '#myFavorite'].forEach(function (s) {
    var el = q(s);
    log('  ' + s + ' : ' + (el ? 'FOUND  class=' + short(cls(el), 70) : 'MISSING'));
  });

  // ── 4. 侧栏 / 内容容器结构树（最多 4 层） ─────────────────
  log('');
  log('--- [4] STRUCTURE TREE (depth<=4, from #contentContainer / nav / #root) ---');
  var root = q('#contentContainer') || q('nav') || q('#root');
  if (root) {
    var lines = 0;
    (function walk(el, d) {
      if (d > 4 || lines > 350) return;
      lines++;
      var c = cls(el).split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      var ot = ownText(el);
      log('  ' + new Array(d + 1).join('  ') + el.tagName.toLowerCase() +
          (el.id ? '#' + el.id : '') + (c ? '.' + c : '') +
          (ot ? '  «' + short(ot, 36) + '»' : ''));
      Array.prototype.forEach.call(el.children, function (ch) { walk(ch, d + 1); });
    })(root, 0);
  } else {
    log('  (no #contentContainer / nav / #root)');
  }

  // ── 5. 类名 token 前缀扫描（判断哈希后缀是否变了） ────────
  // 列出每个前缀命中的真实 class token + 数量 + 示例路径。
  log('');
  log('--- [5] CLASS TOKENS BY PREFIX ---');
  var PREFIXES = [
    'Bar_', 'MiniModeIconBar', 'LeftScrollContainer', 'IconWrapper', 'Title',
    'StyledBackground', 'vinylImgCls', 'DefaultBarWrapper', 'songPlayInfo',
    'info-wrapper', 'TitleWrapper', 'qualityTagClassName', 'red-star-comment-wrapper',
    'miniBarIcon', 'MiniBarMiddleIcon', 'middleHover', 'IconComp', 'DidplayModeEntryStyle',
    'StyledSliderContainer', 'Volumn', 'likenumber', 'BasePlayButtonWrapper',
    'StyledRoundPlayButton', 'TrianglePlayButtonWrapper', 'playorPauseIconStyle',
    'play-pause-btn', 'VinylCoverContainer', 'cover-container', 'CenterImg',
    'CoverBackgroundContainer', 'VinylPageContainer', 'VinylPageLayoutContainer',
    'Lyric', 'FontResizer', 'VinylPageBarWrapper', 'cmd-', 'Tab'
  ];
  var buckets = {};
  PREFIXES.forEach(function (p) { buckets[p] = {}; });
  qa('body *').forEach(function (el) {
    var toks = cls(el).split(/\s+/);
    for (var t = 0; t < toks.length; t++) {
      if (!toks[t]) continue;
      for (var k = 0; k < PREFIXES.length; k++) {
        var pfx = PREFIXES[k];
        if (toks[t].indexOf(pfx) !== -1) {
          if (!buckets[pfx][toks[t]]) buckets[pfx][toks[t]] = { n: 0, e: el };
          buckets[pfx][toks[t]].n++;
        }
      }
    }
  });
  PREFIXES.forEach(function (pfx) {
    var keys = Object.keys(buckets[pfx]);
    if (!keys.length) { log('  ' + pfx + ' → (none)'); return; }
    log('  ' + pfx + ' →');
    keys.slice(0, 40).forEach(function (t) {
      log('      .' + t + '  x' + buckets[pfx][t].n + '   e.g. ' + path(buckets[pfx][t].e) + '  «' + short(buckets[pfx][t].e.textContent) + '»');
    });
    if (keys.length > 40) log('      … +' + (keys.length - 40) + ' more');
  });

  // ── 6. 底栏播放条 ───────────────────────────────────────
  log('');
  log('--- [6] BOTTOM PLAYER BAR ---');
  var bar = q('[class*="DefaultBarWrapper"]');
  if (bar) {
    log('  wrapper class : ' + cls(bar));
    log('  wrapper text  : ' + short(bar.textContent, 220));
    var probe = ['.title', '.author', '[class*="TitleWrapper"]', '[class*="songPlayInfo"]',
                 '.left', '[class*="info-wrapper"]'];
    probe.forEach(function (s) {
      var el = bar.querySelector(s);
      if (!el) { log('  ' + s + ' → (none)'); return; }
      var st = getComputedStyle(el);
      log('  ' + s + ' → class=' + short(cls(el), 60) +
          ' font-size=' + st.fontSize + ' display=' + st.display +
          ' align=' + st.alignItems + ' text=' + JSON.stringify(short(el.textContent, 60)));
    });
    log('  buttons with title attr:');
    qa('[class*="DefaultBarWrapper"] [title]').slice(0, 40).forEach(function (b) {
      log('      [title="' + b.getAttribute('title') + '"] class=' + short(cls(b), 50));
    });
  } else {
    log('  (no [class*="DefaultBarWrapper"])');
  }

  // ── 7. 全屏播放页（需先点开全屏再跑一次） ────────────────
  log('');
  log('--- [7] FULLSCREEN (VinylPage) ---');
  var vinyl = q('[class*="VinylPageContainer"]');
  var cover = q('[class*="VinylCoverContainer"]');
  var coverBg = q('[class*="CoverBackgroundContainer"]');
  log('  VinylPageContainer     : ' + (vinyl ? short(cls(vinyl), 90) : 'MISSING'));
  log('  VinylCoverContainer    : ' + (cover ? short(cls(cover), 90) : 'MISSING'));
  log('  CoverBackgroundContainer: ' + (coverBg ? short(cls(coverBg), 90) : 'MISSING'));
  log('  .cover-area            : ' + (q('.cover-area') ? 'FOUND' : 'MISSING'));
  if (cover) {
    var cimg = cover.querySelector('[class*="CenterImg"]');
    log('  CenterImg              : ' + (cimg ? short(cls(cimg), 90) : 'MISSING'));
    log('  cover img src          : ' + short((cover.querySelector('img') || {}).src, 120));
    log('  --hush-album-cover     : ' + short(cs.getPropertyValue('--hush-album-cover'), 140));
  }
  if (vinyl) {
    var layout = q('[class*="VinylPageLayoutContainer"]');
    log('  VinylPageLayoutContainer children:');
    qa('[class*="VinylPageLayoutContainer"] > *').forEach(function (el) {
      log('      ' + el.tagName.toLowerCase() + '.' + short(cls(el), 70) + '  «' + short(el.textContent, 40) + '»');
    });
    if (!layout) log('  (no VinylPageLayoutContainer)');
  }

  // ── 8. tab / 标签 / 小标题 ───────────────────────────────
  log('');
  log('--- [8] TABS / TAGS / SMALL TITLES ---');
  qa('[role="tab"]').slice(0, 40).forEach(function (t) {
    log('  [role=tab] ' + JSON.stringify(short(t.textContent, 50)) + ' | ' + path(t));
  });
  qa('.cmd-tag, [class*="TagWrapper"]').slice(0, 40).forEach(function (t) {
    log('  tag        ' + JSON.stringify(short(t.textContent, 50)) + ' | ' + path(t));
  });
  ['评论', '收藏者', '已购专辑', 'VIP', '已购'].forEach(function (kw) {
    var hits = qa('body *').filter(function (el) {
      var t = ownText(el);
      return t === kw || t.indexOf(kw) === 0;
    }).slice(0, 4);
    log('  keyword "' + kw + '" hits: ' + hits.length);
    hits.forEach(function (el) {
      log('      <' + el.tagName.toLowerCase() + '> class=' + short(cls(el), 60) +
          ' text=' + JSON.stringify(short(ownText(el), 40)) + ' | ' + path(el));
    });
  });

  // ── 9. 顶部右上角账户区 ─────────────────────────────────
  log('');
  log('--- [9] TOP BAR / ACCOUNT AREA ---');
  log('  div[class^="Bar_"] : ' + (qa('div[class^="Bar_"]').map(function (e) { return cls(e); }).join(' | ') || '(none)'));
  ['消息中心', '设置', '换肤'].forEach(function (t) {
    var el = q('[title="' + t + '"]');
    log('  [title="' + t + '"] : ' + (el ? path(el) : 'MISSING'));
  });
  log('  .searchbox : ' + (q('.searchbox') ? 'FOUND  class=' + short(cls(q('.searchbox')), 70) : 'MISSING'));
  log('  .first-group / .tab-area : ' + (q('.first-group') ? 'first-group FOUND' : 'first-group MISSING') +
      ' / ' + (q('.tab-area') ? 'tab-area FOUND' : 'tab-area MISSING'));

  // ── 10. body 顶层结构 ───────────────────────────────────
  log('');
  log('--- [10] BODY TOP-LEVEL STRUCTURE ---');
  Array.prototype.forEach.call(document.body.children, function (el, idx) {
    log('  [' + idx + '] ' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
        (cls(el) ? '.' + short(cls(el).split(/\s+/).join('.'), 70) : ''));
  });

  // ── 输出 ────────────────────────────────────────────────
  var text = L.join('\n');
  console.log(text);
  try {
    copy(text); // DevTools 专用：复制到剪贴板
    console.log('=== 以上输出已复制到剪贴板 ===');
  } catch (e) {
    console.log('=== (无法自动复制，请手动全选上面的输出复制) ===');
  }
})();
