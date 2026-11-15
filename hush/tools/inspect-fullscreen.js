// Hush — 全屏播放页状态探针
//
// 用法：打开 https://music.163.com/st/webplayer，点开全屏播放页（封面页），
// F12 → Console，粘贴运行；输出自动复制到剪贴板。
// 想在“非全屏”对照时，退出全屏再跑一次即可。

(function () {
  'use strict';

  var out = [];
  function L() { out.push(Array.prototype.join.call(arguments, ' ')); }
  function q(s) { return document.querySelector(s); }
  function cls(el) { return (el.getAttribute('class') || '').trim(); }
  function rect(el) {
    var r = el.getBoundingClientRect();
    return Math.round(r.width) + 'x' + Math.round(r.height) +
      ' @(' + Math.round(r.left) + ',' + Math.round(r.top) + ')';
  }
  function vis(el) {
    if (!el) return 'MISSING';
    var cs = getComputedStyle(el);
    return 'rect=' + rect(el) +
      ' display=' + cs.display +
      ' visibility=' + cs.visibility +
      ' opacity=' + cs.opacity;
  }

  var html = document.documentElement;
  var coverArea = q('.cover-area');
  var cover = q('[class*="VinylCoverContainer"]');
  var coverBg = q('[class*="CoverBackgroundContainer"]');
  var vinylPage = q('[class*="VinylPageContainer"]');
  var layout = q('[class*="VinylPageLayoutContainer"]');
  var songPage = q('#page_pc_songplay');
  var coverVar = getComputedStyle(html).getPropertyValue('--hush-album-cover').trim();

  var coverVisible = !!(cover && cover.getBoundingClientRect().width > 0);
  var areaRect = coverArea ? coverArea.getBoundingClientRect() : null;
  var fillsViewport = !!(areaRect &&
    areaRect.width >= window.innerWidth * 0.95 &&
    areaRect.height >= window.innerHeight * 0.95);

  L('=== HUSH · FULLSCREEN STATE ===');
  L('url:', location.href);
  L('when:', new Date().toString());
  L('viewport:', window.innerWidth + 'x' + window.innerHeight);
  L('');
  L('--- 判断 ---');
  L('全屏页 DOM 存在 (VinylPageContainer):', !!vinylPage);
  L('cover-area 铺满视口       :', fillsViewport);
  L('封面可见 (VinylCover width>0):', coverVisible);
  L('综合：当前是全屏态         :', !!(vinylPage && fillsViewport && coverVisible));
  L('document.fullscreenElement :', document.fullscreenElement || '(null)');
  L('');
  L('--- 关键元素 ---');
  L('cover-area                :', vis(coverArea));
  L('VinylCoverContainer       :', vis(cover));
  L('CoverBackgroundContainer  :', vis(coverBg));
  L('VinylPageContainer        :', vis(vinylPage));
  L('CoverBackgroundContainer::before filter:', coverBg ? getComputedStyle(coverBg, '::before').filter : '(n/a)');
  L('--hush-album-cover        :', coverVar ? coverVar.slice(0, 140) : '(empty)');
  L('');
  L('--- html/body 上的状态类名 ---');
  L('<html> class :', cls(html) || '(none)');
  L('<body> class :', cls(document.body) || '(none)');
  L('');
  L('--- VinylPageLayoutContainer 直接子元素 ---');
  if (layout) {
    Array.prototype.forEach.call(layout.children, function (el, i) {
      L('  [' + i + '] ' + el.tagName.toLowerCase() + '.' + cls(el).split(/\s+/).slice(0, 3).join('.') +
        '  ' + vis(el) + '  «' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) + '»');
    });
  } else {
    L('  (no VinylPageLayoutContainer)');
  }
  L('');
  L('--- VinylCoverContainer 内部 ---');
  if (cover) {
    Array.prototype.forEach.call(cover.querySelectorAll('*'), function (el) {
      if (!cls(el) && el.tagName !== 'IMG') return;
      L('  <' + el.tagName.toLowerCase() + '>.' + cls(el).split(/\s+/).slice(0, 3).join('.') + '  ' + vis(el));
    });
    var img = cover.querySelector('img');
    L('  img src:', img ? (img.currentSrc || img.src || '').slice(0, 120) : '(none)');
  }
  if (songPage) {
    L('');
    L('#page_pc_songplay 存在（播放详情页挂载）');
  }

  var text = out.join('\n');
  console.log(text);
  try {
    copy(text);
    console.log('=== 以上输出已复制到剪贴板 ===');
  } catch (e) {
    console.log('=== (无法自动复制，请手动复制) ===');
  }
})();
