# diagnose.js — 插件失灵时的诊断工具

当网易云 WebPlayer 改版导致插件失效时：

1. 打开 https://music.163.com/st/webplayer
2. F12 → Console，粘贴运行本文件全部内容
3. 把输出发给 AI agent，根据真实 DOM 更新 `src/netease.js` 中的选择器

## inspect-fullscreen.js — 全屏播放页状态探针

点开全屏播放页后，在 Console 运行本文件：

- 判断当前是否处于全屏态（`VinylPageContainer` 存在 + `.cover-area` 铺满视口 + 封面可见）；
- 打印 `cover-area` / `VinylCoverContainer` / `CoverBackgroundContainer` 的尺寸与显隐；
- 打印 `--hush-album-cover` 是否已写入（即「模糊封面」背景是否生效）；
- 列出 `VinylPageLayoutContainer` 直接子元素与封面容器内部的类名/尺寸。
