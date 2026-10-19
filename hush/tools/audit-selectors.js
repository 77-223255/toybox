// Hush — 网易云选择器命中率审计
//
// 在下面每种页面各跑一次，把四次输出都发回：
//   ① 首页 / 普通播放页
//   ② 我喜欢的音乐（有 歌曲/评论/收藏者 tab + 曲目列表）
//   ③ 专辑或歌单详情页（有封面、收藏按钮、曲目列表）
//   ④ 全屏播放页
//
// 命中 0 的选择器不一定是死代码（可能只在别的视图出现），所以要多页对照。
(function () {
  'use strict';
  var SEL = [
    '#recommend', '#choice', '#audio', '#privateFm', '#historyPlaylist', '#myAudio',
    '#community', '#myFavoriteMusic', '#myFavorite', '#topArea', '#contentContainer',
    'div[class^="Bar_"]', '.MiniModeIconBar_m1jn0mly',
    '[class*="LeftScrollContainer"]', '[class*="IconWrapper"]',
    '[class*="StyledBackground"]', '[class*="vinylImgCls"]',
    '[class*="DefaultBarWrapper"]', '[class*="songPlayInfo"]', '.info-wrapper',
    '[class*="TitleWrapper"]', '[class*="qualityTagClassName"]',
    '[class*="red-star-comment-wrapper"]', '[class*="miniBarIcon"]',
    '[class*="MiniBarMiddleIcon"]', '[class*="middleHover"]', '[class*="IconComp"]',
    '[class*="DidplayModeEntryStyle"]', '[class*="StyledSliderContainer"]',
    '[class*="VolumnSlider"]', '[class*="VolumnThumb"]', '[class*="likenumber"]',
    '.likenumber-red', '[class*="BasePlayButtonWrapper"]', '[class*="StyledRoundPlayButton"]',
    '[class*="TrianglePlayButtonWrapper"]', '[class*="playorPauseIconStyle"]',
    '[class*="play-pause-btn"]', '.play-btn',
    '[class*="VinylCoverContainer"]', '.cover-area', '[class*="cover-container"]',
    '[class*="CenterImg"]', '[class*="CoverBackgroundContainer"]',
    '[class*="VinylPageContainer"]', '[class*="VinylPageLayoutContainer"]',
    '[class*="LyricOperatorContainer"]', '[class*="LyricWrapper"]',
    '[class*="ScrollableLyricDisplayContainer"]', '[class*="LyricDefaultPageContainer"]',
    '[class*="LyricEffectPageContainer"]', '[class*="FontResizer"]',
    '[class*="VinylPageBarWrapper"]', '[class*="HeartBeat"]', '[class*="heartBeat"]',
    '[class*="handle"]', '[class*="Comment"]', '[class*="comment-count"]',
    '[class*="vip-tag"]', '[class*="VipTag"]', '[class*="VIP"]',
    '.cmd-tag', '[class*="TagWrapper"]',
    '.cmd-progress-track', '.cmd-progress-track-inner',
    '.cmd-icon-collect', '.cmd-icon-share', '.cmd-icon-comment_number',
    '.first-group', '.tab-area', '.show-bottom-border',
    '.cmd-button', '[class*="cmd-button"]', '.cmd-badge-primary.cmd-badge-solid',
    '.searchbox', '.icon-clear', '.icon-btn',
    '[title="消息中心"]', '[title="设置"]', '[title="换肤"]',
    '[title="分享"]', '[title="收藏到歌单"]', '[title="添加到歌单"]', '[title="添加歌单"]',
    '[title="评论"]', '[title="查看评论"]', '[title^="取消喜欢"]'
  ];

  function cls(el) { return (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.'); }
  var out = [];
  out.push('=== HUSH · SELECTOR AUDIT ===');
  out.push('url : ' + location.href);
  out.push('html: ' + (document.documentElement.className || '(none)'));
  out.push('body: ' + (document.body.className || '(none)'));
  out.push('');

  SEL.forEach(function (sel) {
    var n = 0, sample = '';
    try {
      var list = document.querySelectorAll(sel);
      n = list.length;
      if (n) sample = cls(list[0]) + '  «' + (list[0].textContent || '').trim().slice(0, 24) + '»';
    } catch (e) {
      sample = 'INVALID: ' + e.message;
    }
    out.push((n === 0 ? '[ 0 ] ' : '[' + String(n).padStart(3) + '] ') + sel + (sample ? '   e.g. ' + sample : ''));
  });

  // 顺带把站点的 class token 按关键词列出来，方便对照改版
  out.push('');
  out.push('=== 现网 class token（关键词）===');
  var KW = ['comment', 'vip', 'quality', 'slider', 'progress', 'like', 'volume', 'lyric', 'cover', 'vinyl', 'bar'];
  var seen = {};
  document.querySelectorAll('body *').forEach(function (el) {
    var toks = (el.getAttribute('class') || '').split(/\s+/);
    toks.forEach(function (t) {
      if (!t) return;
      var low = t.toLowerCase();
      for (var i = 0; i < KW.length; i++) {
        if (low.indexOf(KW[i]) !== -1) {
          if (!seen[low]) { seen[low] = 0; }
          seen[low]++;
          break;
        }
      }
    });
  });
  Object.keys(seen).sort().forEach(function (t) { out.push('  .' + t + '  x' + seen[t]); });

  var text = out.join('\n');
  console.log(text);
  try { copy(text); } catch (e) {}
})();
