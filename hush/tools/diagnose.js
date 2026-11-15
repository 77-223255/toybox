// Hush — 网易云 诊断脚本
// 用法：打开 https://music.163.com/st/webplayer，按 F12，
// 在 Console 里粘贴运行，把输出复制给 agent。

(function () {
  var KEYWORDS = ['推荐', '精选', '播客', '漫游', '关注', '最近播放', '我喜欢的音乐', '我的收藏'];
  var all = document.querySelectorAll('body *');
  var found = [];

  all.forEach(function (el) {
    var ownText = '';
    el.childNodes.forEach(function (n) {
      if (n.nodeType === 3) ownText += n.textContent;
    });
    ownText = ownText.trim();
    if (KEYWORDS.indexOf(ownText) === -1) return;

    var chain = [];
    for (var e = el, i = 0; e && e !== document.body && i < 8; e = e.parentElement, i++) {
      chain.push(e.tagName + '.' + (e.getAttribute('class') || '').split(' ').slice(0, 3).join('.').slice(0, 80) + (e.id ? '#' + e.id : ''));
    }
    found.push('--- "' + ownText + '"\n  self: ' + el.tagName + '#' + el.id + ' .' + el.className + '\n  chain: ' + chain.join(' < '));
  });

  console.log('=== NETEASE HIDER DIAGNOSTIC (' + found.length + ' items) ===');
  found.forEach(function (f) { console.log(f); });

  // 顶部右侧区域
  ['消息中心', '设置', '换肤'].forEach(function (t) {
    var el = document.querySelector('[title="' + t + '"]');
    console.log('[title="' + t + '"] exists: ' + !!el + (el ? ' chain: ' + el.parentElement.className : ''));
  });
})();
