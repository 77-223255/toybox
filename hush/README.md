# Hush

> ✨ **new toy** — 个人自用的浏览器扩展，还在用、还在改。

**Hush** — 让吵人的东西安静下来。个人自用插件，把几个网站里最烦的部分按下去，
popup 里用**颜色**区分各自的独立开关（红 / 蓝 / 橙，三个）。

- 🔴 **红色按钮 — 网易云音乐**（`https://music.163.com/st/webplayer`）
  - 隐藏用不到的 UI：左侧栏的推荐/精选/播客/漫游/最近播放/我的播客、左上角 logo、
    右上角账户/消息/设置/换肤、评论 / 分享 标识、「已购专辑」标签（**专辑 / 歌曲页的收藏按钮保留**，
    底栏的「收藏到歌单 / 添加歌单」和播客底栏的「点赞」隐藏）；
    **音质 SQ / VIP 标识保留不隐藏**；
  - **Apple Music 深色主题**：纯黑底 `#000`、近黑卡片 `#1c1c1e` / `#2c2c2e`，
    强调色 Apple Music 红 `#fa2d48`；搜索框、进度/音量条、控制图标一并换色；
    全屏页会覆盖站点在容器上重定义的整套 token；
  - 全站改用浏览器默认字体（`sans-serif`），不用站点字体栈和 dolphin 数字字体；
  - 侧栏三个栏目改名 **FOLLOWING / FAVORITES / COLLECTION**（大写、去图标）；
    分组标题「创建的歌单」改为 **PLAYLISTS**（保留数量）；
  - 底栏：歌名/作者统一 22px、整条垂直居中，专辑封面静止不转；
  - **全屏播放页（歌曲 / 播客通用）**：只留一个居中的静止方形封面（`min(56vh,56vw)`），隐藏歌词 /
    右侧信息 / 字体浮窗 / 唱臂 / 黑胶盘；背景为「当前封面放大模糊」（Apple Music 式，
    静态）+ 淡暗角（不压暗封面亮度）；底栏隐藏时封面平滑移到视口正中；
  - **全屏底栏**：平时只留进度条，控制键（收藏/分享/喜欢/上一首/播放/下一首/右侧）
    隐藏；鼠标靠近视口底部 ~120px 时平滑滑出。
  - **全屏左上角「退出全屏纯享」按钮**：平时隐藏，鼠标靠近视口顶部 ~120px 时平滑滑出。
  - **方向键控制播放**（底栏 / 全屏底栏通用）：**↓ 播放 / 暂停**，**← 上一首**，**→ 下一首**；
    焦点在搜索框 / 输入框里时不劫持方向键。
- 🔵 **蓝色按钮 — X / Twitter**（`https://x.com`、`https://twitter.com`）
  - **白天封锁**：本地时间 **09:00–21:00** 之间，整页清空、全屏只留一句标语
    （`专注时间 / 9:00 – 21:00 不看 X / Hush · 21:00 后再见`），直接不让看；
    9:00 整进入、21:00 整自动解除，无需刷新。
  - 其余时间：隐藏首页时间线顶部的「为你推荐 / For you」标签，只保留「正在关注 / Following」，
    并把「正在关注」居中铺满整行。
  - 只隐藏标签本身，**不做**自动跳转/自动点击；如果刷新后时间线仍停在「为你推荐」，
    点一下「正在关注」即可。
- 🟠 **橙色按钮 — Hacker News**（`https://news.ycombinator.com`）
  - 整站切换为**深色主题**（页面 / 内容区 / 评论都变深色）；
  - 整体**调大字号**（首页标题、正文、评论、元信息一起放大）；
  - **保留标志性的橙色**：顶部导航条原样保留 `#ff6600`，「More」链接和评论里的链接
    也用品牌橙作强调色。

> 原来还有过一个紫色磁贴（Systems Approach 在线书的深色主题 + 可收起目录 + 中英对照），
> 已连同相关代码拆到独立项目 **Learn**（`~/Projects/learn`），
> 那边还额外带一个 K&R《C 程序设计语言》本地阅读器。两个扩展各自独立安装、互不影响。

三个开关各自独立存储（`chrome.storage.sync`，key 分别是 `netease-hider-enabled` /
`x-hider-enabled` / `hn-hider-enabled`），互不影响。

## 打包 / 安装

源码在 `src/`。本地打包（扩展 ID 由签名私钥固定）：

```bash
cd hush
./pack.sh          # 打包 + 校验扩展 ID + 生成 hush.zip
```

<details><summary>手动打包（等同 pack.sh）</summary>

```bash
cd hush
chromium --user-data-dir=/tmp/cr-pack-profile --no-first-run --no-default-browser-check \
  --pack-extension=$PWD/src --pack-extension-key=${HUSH_KEY:-$HOME/.local/share/hush/hush.pem}
mv src.crx hush.crx   # 产物不入库（见 .gitignore）
rm -f hush.zip && (cd src && zip -qr ../hush.zip .)
```

</details>

然后 `chrome://extensions` → 开发者模式 → 拖入 `hush.crx`（或「加载已解压的扩展程序」
选 `src/`）。

> 扩展 ID 从旧版起一直是 `mdldpbdafiofeclcekinhcjgfhcnelcg`，所以直接拖入新 CRX
> 即可覆盖升级，不用先删除旧版。crx / zip **不再提交到仓库**。

## 使用

点工具栏插件图标 → 上下三个磁贴，各自 ON/OFF（上=红，下=橙）：

- 🔴 红色：网易云「隐藏 + Apple Music 深色 + 全屏精简 + 方向键控制」开/关
- 🔵 蓝色：X「隐藏为你推荐 + 白天 9:00–21:00 封锁」开/关
- 🟠 橙色：Hacker News「深色主题 + 调大字号」开/关

## 签名私钥 / License

**私钥不在仓库里。** 本仓库是公开的，签名私钥一旦进去就等于把扩展 ID
`mdldpbdafiofeclcekinhcjgfhcnelcg` 交给所有人 —— 别人可以用它签出同 ID 的扩展。
私钥请放在 `~/.local/share/hush/hush.pem`（`chmod 600`），或用
`HUSH_KEY=/path/to/hush.pem` 指定。`pack.sh` 会按这个顺序查找。

MIT —— 见仓库根目录 [`LICENSE`](../LICENSE)。
