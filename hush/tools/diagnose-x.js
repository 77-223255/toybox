// X 诊断脚本
// 用法：打开 https://x.com/home，按 F12，在 Console 里粘贴运行，
// 把输出复制给 agent。
//
// 插件失灵（「为你推荐」标签没被隐藏）时，用这个脚本确认真实 DOM：
// 标签是否还在、role/文字是否变了。

(function () {
  var FOR_YOU = ['为你推荐', 'For you'];
  var FOLLOWING = ['正在关注', 'Following'];

  function label(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  var tabs = document.querySelectorAll('[role="tab"]');
  console.log('=== X HIDER DIAGNOSTIC ===');
  console.log('role="tab" 数量: ' + tabs.length);

  tabs.forEach(function (t, i) {
    var list = t.closest('[role="tablist"]');
    var siblings = list ? list.querySelectorAll('[role="tab"]').length : 0;
    var mark = t.getAttribute('data-x-hider-foryou') ? ' [已标记隐藏]' : '';
    console.log(
      '--- tab[' + i + '] "' + label(t) + '"' + mark + '\n' +
      '  aria-selected: ' + t.getAttribute('aria-selected') + '\n' +
      '  role=tablist 内 tab 数: ' + siblings + '\n' +
      '  tag: ' + t.tagName + '  href: ' + (t.getAttribute('href') || '-')
    );
  });

  var lists = document.querySelectorAll('[role="tablist"]');
  lists.forEach(function (l, i) {
    var texts = [];
    l.querySelectorAll('[role="tab"]').forEach(function (t) { texts.push(label(t)); });
    console.log('tablist[' + i + ']: ' + JSON.stringify(texts));
  });

  console.log('是否检测到「为你推荐」+「正在关注」同处一个 tablist: ' +
    !!document.querySelector('[role="tablist"]'));
  console.log('样式 <style id="x-hider-style"> 存在: ' + !!document.getElementById('x-hider-style'));
  console.log('FOR_YOU 关键词: ' + JSON.stringify(FOR_YOU) + ' / FOLLOWING: ' + JSON.stringify(FOLLOWING));
})();
