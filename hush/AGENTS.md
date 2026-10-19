# AGENTS.md — 给未来修改此插件的 agent

## 背景

这是一个仅个人使用的 Chrome 扩展（Manifest V3），目前管四个互不相干的站点，
靠 popup 里四个不同颜色的磁贴分别开关：

1. **网易云音乐** Linux WebPlayer（`https://music.163.com/st/webplayer`）：
   隐藏部分 UI + **Apple Music 深色主题** + 全屏播放页精简，逻辑全在 `src/netease.js`。
2. **X / Twitter**（`x.com` / `twitter.com`）：隐藏首页「为你推荐 / For you」标签，
   并在**本地时间 09:00–21:00** 之间「白昼封锁」——整页清空、全屏只留标语，逻辑全在 `src/x.js`。
3. **Hacker News**（`news.ycombinator.com`）：深色主题 + 整体调大字号（含评论），
   保留品牌橙，逻辑全在 `src/hn.js`。
4. **Codeforces**（`codeforces.com`）：复古暖色深色主题，逻辑全在 `src/codeforces.js`。

原来还有第 4 个磁贴（紫 = Computer Networks: A Systems Approach 7e 在线书的深色主题
+ 可收起目录 + 中英对照），已经连同 `src/systemsapproach.js`、`src/i18n/` 一起**移出**
本项目，去 `~/Projects/learn`（扩展名 Learn，紫色磁贴）里了；那边还多了
K&R《C 程序设计语言》的本地阅读器。别把它加回来。

网易云网站是 React SPA，登录后才有完整侧边栏；
**静态 curl / headless dump-dom 拿不到侧边栏 DOM**（未登录时只返回空壳），
不要基于静态抓取写选择器。

## 文件结构

```
src/                     扩展源码（chromium 打包目录）
src/netease.js           网易云：注入 CSS 隐藏元素 + 切换站点深色主题（网易云逻辑全在此）
src/x.js                 X：隐藏「为你推荐 / For you」标签 + 白天 9:00–21:00 全屏封锁
src/hn.js                Hacker News：注入深色主题 + 调大字号（保留品牌橙）
src/codeforces.js        Codeforces：注入复古暖色深色主题（覆盖 CSS 变量 + 硬编码颜色）
src/popup.html / popup.js  弹窗：上下四个无文字 ON/OFF 磁贴，撑满 popup、中间 1px 细线分割
                         （红=网易云，蓝=X，橙=HN，金=Codeforces）；
                         加站点就往 body 里追加一个 .tile
src/manifest.json        MV3（version 5.3.0）；四个 content_scripts：
                         music.163.com → netease.js，
                         x.com / twitter.com → x.js，news.ycombinator.com → hn.js，
                         codeforces.com（含子域）→ codeforces.js；
                         无 web_accessible_resources（v5.0.0 已随 Systems Approach 移出而删掉）；
                         action 图标用 icons/icon48.png
src/icons/*              图标（16/48/128 + svg）
~/.local/share/hush/     扩展签名私钥 hush.pem —— 决定扩展 ID，千万别丢；
                         不入库（公开仓库），用 HUSH_KEY 可改路径
hush.crx / hush.zip      本地打包产物（**不入库**，见 .gitignore）
tools/diagnose.js        网易云失灵诊断脚本（在 Console 粘贴运行）
tools/diagnose-netease.js 网易云完整诊断（可对比插件开 / 关两种 DOM，输出自动复制）
tools/audit-selectors.js 网易云选择器命中率审计（四种页面各跑一次）
tools/inspect-fullscreen.js 全屏播放页状态探针（封面 / 背景 / 类名尺寸）
tools/diagnose-x.js      X 失灵诊断脚本
tools/README.md          上面几个诊断脚本的用法说明
```

## 图标

`src/icons/icon.svg` 是唯一源文件：**极简**风格 —— 圆角方块里一坨**水彩**：
多种鲜艳颜色互相晕染，再用 `feTurbulence` + `feDisplacementMap` 做噪声位移扭曲混合
（不是单向渐变），正常亮度、不压暗；没有任何字母/图形。修改后用 rsvg-convert 重新生成三个 PNG：

```bash
cd src/icons
rsvg-convert -w 16  -h 16  icon.svg -o icon16.png
rsvg-convert -w 48  -h 48  icon.svg -o icon48.png
rsvg-convert -w 128 -h 128 icon.svg -o icon128.png
```

不要只改 PNG 不改 SVG，也不要只改 SVG 不重新生成 PNG。

## 选择器策略（为什么这样写）

网站 CSS 是 CSS Modules，**类名带哈希后缀（如 `ItemContainer_ijv59hq`、
`Bar_b2jgnke`）会随前端构建变化**，不可靠。按优先级使用：

1. **元素 ID（最稳）**：侧栏栏目有稳定 ID
   - 隐藏：`#recommend` 推荐 / `#choice` 精选 / `#audio` 播客 / `#privateFm` 漫游
     / `#historyPlaylist` 最近播放 / `#myAudio` 我的播客
   - 左上角整体 logo（圆形图标 + “网易云音乐”标题）容器：`#topArea`
   - 保留不隐藏的：`#community` 关注、`#myFavoriteMusic` 我喜欢的音乐、`#myFavorite` 我的收藏
   - 隐藏 `#topArea` 后，还要收掉为 logo 预留的整条高度（父级 BackContainer 固定高），
     否则下方会空一块：`#contentContainer > div:has(> #topArea){height:0 !important}`。
     注意 `#topArea` 在 Linux 上是普通流内元素（`position:absolute` 只适用于 `.is-osx-tag`）。
2. **未混淆的语义类名**：`.first-group`、`.tab-area`（配合 `.show-bottom-border`
   去分隔线/空行）
3. **中文 title 属性**：`[title="消息中心"] [title="设置"] [title="换肤"]`
4. **前缀属性选择器**：`div[class^="Bar_"]` 匹配右上角账户条
   （哈希会变，但 `Bar_` 前缀一般不变）
5. **搜索框**：`.searchbox` 是未混淆类名（在顶部栏 / 内容区均有）。它的默认样式是
   `background-color:transparent` + 粉紫渐变 `::after` 描边环（`--s14tpfr6-1/7`）。
   深灰主题下要强制深灰底、去掉渐变、加中性描边，用 `SIDEBAR_CSS` 里的
   `html body .searchbox.searchbox{...!important}`（重复类名提高优先级，压过
   `.SearchWrapper_xxx .searchbox`）。

## 深色主题（重要）

站点前端自带 design token 主题系统，不要用 `filter: invert()` 之类的暴力方案。
原理：站点在 `<html>` 上写行内 CSS 变量（`--colorBackground` / `--colorBlack3` …），
变量取值来自 `@cloudmusic-desktop` 的 tokens，每个 token 有若干场景：
`color_white`（浅色，实际缺省→用 token 默认值）、`dark`、`color_red`、`color_custom`。
主题名存在 `localStorage.currentTheme`（`light|dark|red|color|customskin`），
应用挂载时读取它，并把对应场景的 token 写到 `<html>`。

因此 `netease.js` 的做法（用户要的是 **Apple Music 深色**：纯黑底 + 近黑卡片 +
品牌红 `#fa2d48`；不是官方的蓝灰 dark，也不是之前的深灰/绿）：

- 页面脚本执行前（`run_at: document_start`）把 `currentTheme` 设成 `dark`，
  并同步注入深色主题样式，**无闪白**；
- 站点在挂载时会往 `<html>` 写**行内** token（官方 dark）。行内非 `!important`
  会被 `netease.js` 注入的 `<style id="netease-hider-theme">:root{--x:… !important}`
  盖掉，所以最终一定是我们的主题；
- `THEME_TOKENS = DARK_TOKENS + SURFACE_OVERRIDES + ACCENT_OVERRIDES`：
  - `SURFACE_OVERRIDES`：把“背景类” token 换成分层近黑：
    页面底 `BG_BASE=#000000` < 卡片 `BG_SURFACE=#1c1c1e` <
    浮层 `BG_ELEVATED=#2c2c2e` < tooltip `BG_TOOLTIP=#3a3a3c`；
  - `ACCENT_OVERRIDES`：Apple Music 红 `#fa2d48`（`ACCENT_HEX` / `ACCENT_FILL`）
    → `colorPrimary1..8`、`colorSecondary1_1/1_2`、`colorFunction11/12`、`colorSidebar9..12`；
  - 实心按钮 / 播放键：`ACCENT_TEXT_ON_FILL=#ffffff`（红底白字，见 `SIDEBAR_CSS` 的
    `.cmd-button-surface-pri` / `playorPauseIconStyle` 规则）；
- **全屏页 token 覆盖**：全屏播放页 `VinylPageContainer` 会用专辑主色在**容器上**
  重定义整套 `color*` token（`:root` 盖不过它：CSS 变量就近继承）。所以
  `albumTokenResetCss()` 把 `THEME_TOKENS` 再写一份到
  `[class*="VinylPageContainer"],#root,body`（`!important`）。
- **字体**：站点文本字体是一串写死的系统字体栈
  （`-apple-system / Helvetica / PingFang SC / Microsoft YaHei ...`），
  `SIDEBAR_CSS` 里用 `html body, html body * { font-family: sans-serif !important }`
  全部换成通用 `sans-serif`（走浏览器字体设置里的默认值）。
  站点唯一的 webfont 是 `dolphin` / `dolphin-s`（播放量「万/亿/千」数字字体）和
  `desktop-ui-tag-font`，一并换掉即可；**图标是 SVG，不是图标字体，不受影响**，
  所以这里可以放心用 `*` 覆盖。input/button/textarea 不继承字体，必须用 `*`；
- 专辑 / 歌单详情页的背景是 **JS 内联**写上去的
  `linear-gradient(180deg, 封面主色… )`（组件名 `CoverBackgroundContainer` /
  `StyledBackground`，哈希会变所以用 `[class*="…"]`），token 无法覆盖。
  `SIDEBAR_CSS` 里直接 `background:${BG_BASE} !important` 盖掉；
  否则滚动时固定头部遮罩（用 `--colorBackground`）与渐变背景不一致，
  看起来像页面错位/畸形；
- 运行时点按钮切换：注入/移除那个深灰 `<style>`，立即生效、无需刷新；
- 关闭时：移除深灰 `<style>` 与字体/按钮样式，并把 80 个浅色 token 作为**行内**样式写回
  （顶掉站点挂载时写的深色行内值），`currentTheme` 置回 `light`；
- 另有一个同源 `localStorage['netease-hider-mirror']` 镜像（`'1'`/`'0'`），
  让 document_start 时能同步决定是否预置深灰。

若站点升级后主题不对，排查方式：
在已登录页面 Console 里看 `localStorage.currentTheme` 与 `<html>` 的 inline style；
必要时从站点 JS（`@cloudmusic-desktop` tokens）重新导出 80 个 token 的 dark/default 值，
替换 `netease.js` 里的 `LIGHT_TOKENS` / `DARK_TOKENS`。

改配色只需要动 `netease.js` 顶部的 `BG_*` / `ACCENT_*` 常量（`SIDEBAR_CSS` 与
`SURFACE_OVERRIDES` / `ACCENT_OVERRIDES` 都引用它们），以及 `popup.html` 里的
`background` / `.tile.on` 渐变。

## X（Twitter）「为你推荐」隐藏（`src/x.js`）

- 站点：`*://x.com/*`、`*://twitter.com/*`。
- 目标：首页时间线顶部的 tablist 有两个 tab ——「为你推荐 / For you」和
  「正在关注 / Following」。只隐藏前者，保留后者。
- 为什么不用纯 CSS：标签文字写在 DOM 文本里，CSS 选不到文字。所以用 JS 扫描
  `[role="tab"]`，给匹配到的元素打上 `data-x-hider-foryou="1"`，再由注入的
  `[data-x-hider-foryou="1"]{display:none!important}` 隐藏。
- 选择器：X 类名全是哈希（`r-1habvwh`）不可靠；用稳定的无障碍属性
  `[role="tab"]` / `[role="tablist"]`。文字匹配用中英文正则
  `/^(为你推荐|for you)$/i`，只处理同时含有「正在关注 / Following」的 tablist
  （即首页时间线），不动探索页等其它也带「为你推荐」的 tablist。
- X 的 tablist 结构是 `div[role="tablist"] > div(容器) > [role="tab"]`，两个容器
  各 `flex-grow:1`（各占一半）。所以只把 tab 隐藏的话，「正在关注」会留在右半边；
  注入的 CSS 会把被隐藏那半的容器压成 0（`flex-basis:0; flex-grow:0; width:0`），
  剩下的容器撑满整行、内容居中。改这段 CSS 时别把居中改坏。
- X 是 SPA：`MutationObserver` 监听 `documentElement`（childList + subtree），
  100ms 节流后重扫；另有 2s 兜底 interval。**只在开启时才挂**（`startWatching`），
  关闭时 `stopWatching()` 把它们全部拆掉，关闭状态下不参与 X 的 DOM 变动。
- **只隐藏标签本身，不做自动跳转 / 自动点击**（用户明确不要）。所以刷新后时间线若仍
  停在「为你推荐」，点一下「正在关注」即可；不要“好心”加自动切换。
- 存储 key = `x-hider-enabled`；popup 蓝色按钮发消息
  `{ action: 'updateXConfig', enabled }`。

## X 白昼封锁（`src/x.js`，与「为你推荐」共用蓝色开关）

- 本地时间 **09:00–21:00**（`BLOCK_START_HOUR=9` / `BLOCK_END_HOUR=21`，`getHours()` 判断，
  9:00 整进入、21:00 整解除）之间，给 `<html>` 打上 `data-x-hush-block="1"`：
  - 注入 CSS 隐藏 `body > *:not(#x-hush-block)`（含 `#react-root`），整页清空、禁止滚动；
  - 一个全屏遮罩 `#x-hush-block`（`position:fixed; inset:0; z-index:2147483647`）只留一句标语
    （「专注时间 / 9:00 – 21:00 不看 X / Hush · 21:00 后再见」），改标语改 `buildOverlay()` 里的 innerHTML。
- **遮罩是 `<body>` 的直接子元素**，所以隐藏规则用 `:not(#x-hush-block)` 把它排除；
  不要改成 `body{display:none}`（那样遮罩也没了）。顶栏橙色与这里无关。
- `document_start` 时 `body` 可能还不存在：`ensureOverlay()` 先挂 `MutationObserver` 等 body 出现
  再 `buildOverlay()`。同步预判用同源 `localStorage['x-hider-block-mirror']`（`'1'`/`'0'`）
  在脚本执行前就设好 `data-x-hush-block`，避免 body 渲染后才遮造成闪一下。
- 进入 / 离开时段靠 `setInterval(15s)` 的 `syncBlock()` 复查；关闭开关时 `stopBlockClock()` 停掉，
  并强制 `syncBlock()` 解除封锁 + 写镜像 `'0'`。
- **不要**把封锁做成独立开关或与「为你推荐」拆成两个按钮（用户要的就是蓝色那一个）。

## Hacker News 深色 + 大字号（`src/hn.js`）

- 站点：`*://news.ycombinator.com/*`；存储 key = `hn-hider-enabled`；
  popup 橙色按钮发消息 `{ action: 'updateHnConfig', enabled }`。
- 上古 table 布局，颜色一部分写在 CSS、一部分写在 `bgcolor` 属性上：CSS 规则（尤其 `!important`）
  能盖过 `bgcolor` 属性，这正是能改深色的原因。
- **保留标志性橙色**：顶栏是 `#hnmain > tbody > tr:first-child > td[bgcolor="#ff6600"]`。
  所以**绝对不要**给所有 `#hnmain td` 设背景色（那会把橙色顶栏也刷掉），只改 `#hnmain` 本身；
  橙色还用在 `.morelink` 与评论链接 `.comment a` / `.commtext a` 上。
- 主要选择器：内容底色 `#hnmain`；正文 `td.default` / `.comment` / `.commtext`；
  首页标题 `.title` / `.titleline > a` / `.storylink`；元信息 `.subtext` / `.comhead`；
  顶栏 `.pagetop`（强制白字白链接，防止被通用链接色污染）。
- 字号：基础 15px、标题 17px、元信息 / comhead 13px、pagetop 14px，全部 `!important` 覆盖站点写死的 `pt` 值。
- 不单独加开关；`applyStyle()` 在 document_start 先挂（默认开启，避免闪白），init 读到关闭再 `removeStyle()`。
- 不做内容隐藏，只改主题与字号 —— 与「Hush」在其它站点的“隐藏”不同，这是有意为之。

## Codeforces 复古暖色深色主题（`src/codeforces.js`）

- 站点：`*://codeforces.com/*`、`*://*.codeforces.com/*`（含 m1/m2/mirror 等镜像子域）；
  存储 key = `cf-hider-enabled`；popup 金色按钮发消息 `{ action: 'updateCfConfig', enabled }`。
- 配色思路：**复古老派的暖色深色** —— 深棕近黑的底 + 暖米白的字 + 琥珀/黄铜色的
  链接与标题（`BG_*` / `TEXT_*` / `LINK_*` / `ACCENT*` 常量在文件顶部，改配色只动它们）。
- 站点是服务端渲染的 jQuery 时代页面，颜色一半来自 `:root` 的 CSS 变量、一半硬编码。
  做法分两层：
  1. 覆写 `:root` 的 `--border-color` / `--notice-color` / `--muted-color` /
     `--highlighted-blue-color` / `--highlighted-green-color` / `--success-color` /
     `--warning-color` / `--error-color`，一次性带走所有引用变量的组件
     （notice / text-label / datatable-filter / footer 分隔线…）；
  2. 对硬编码颜色的组件逐条 `!important` 覆盖（`.roundbox` 白底、`.menu-list li a` 黑字、
     `div.ttypography`、`.problem-statement` 样例、`.datatable`、`.topic` 等）。
- **链接色故意不带 `!important`**（`a:link` / `a:visited` / `a:hover`）：段位色
  `.rated-user.user-*` 是 `!important` 的，这样它们才能胜出、保留红/橙/紫/蓝/青/绿/灰。
  站点里少数用 `!important` 写死的链接色（`.logo-href` / `.pagination a` / `.comments .title` /
  `div.ttypography a` …）再逐条覆盖。**不要把通用链接规则改成 `!important`**，否则段位色全毁。
- 段位里黑底上看不见的黑字单独改暖色：`.user-black` → 暖灰、`.user-admin` / `.user-4000` →
  暖米白、legendary 首字母 → 暖米白；顺带把偏暗的 `user-blue` / `user-green` 提亮。
- `.roundbox` 与 `.datatable` 的浅色 PNG 圆角贴图（`roundbox-lt/rt/lb/rb`、`datatable .lt/.rt/…`）
  在深色下很突兀，直接 `display:none`，圆角交给站点已有的 `border-radius`。
- 代码语法高亮（prettify：`.prettyprint` / `.lstlisting` 的 `.str` / `.kwd` / `.com` …）
  原本是浅底配色，全部换成暖色系（琥珀关键字、橄榄字符串、暗金注释）。
- `html { color-scheme: dark }` 让原生滚动条 / 表单控件跟着变深色；
  品牌 logo 是深蓝 PNG，加了 `#header img[alt="Codeforces"] { filter: brightness(1.4) }` 提亮。
- 与 HN 一样：不单独加开关，`applyStyle()` 在 document_start 先挂（默认开启，避免闪白），
  init 读到关闭再 `removeStyle()`；只改主题，不做内容隐藏。

（原第 4 个磁贴 Systems Approach 在线书的整套逻辑已迁到 `~/Projects/learn`，
那边的深色主题改成了暖色系，并额外带了 K&R 本地阅读器。）

## 网易云：JS 侧改动（改名 / 文字隐藏 / 全屏封面）

`SIDEBAR_CSS` 只能“隐藏/换肤”，改不了文字，所以下面几件在 JS 里做，统一挂在一个
`MutationObserver`（`document.documentElement`，childList+subtree，400ms 节流）上，
回调跑 `renameItems()`（幂等，只在值变化时写）：

- **侧栏改名**：`SIDEBAR_RENAME` = `#community→FOLLOWING`、`#myFavoriteMusic→FAVORITES`、
  `#myFavorite→COLLECTION`；配套 CSS 加 `text-transform:uppercase` / `letter-spacing`，
  隐藏 `IconWrapper` 与心形装饰。分组标题「创建的歌单」由 `SIDEBAR_GROUP_RENAME` 改成
  `PLAYLISTS`（保留后面的数字），用 `replaceTextDeep()` 限定深度替换文本节点。
- **收藏按钮：只藏底栏**：用户要收藏专辑 / 歌曲，所以 `SIDEBAR_CSS` 里
  `[title="收藏"]` / `[title="取消收藏"]` / `.collect-btn` **全局都不隐藏**；
  `button:has(.cmd-icon-collect)` 与 `[title="收藏到歌单"]` 前面加了
  `[class*="DefaultBarWrapper"]` / `[class*="VinylPageBarWrapper"]` 限定，
  只在底栏生效（全屏条同理）。改收藏可见性时小心别把底栏限定去掉。
- **按文字隐藏**（站点无稳定类名）：`HIDE_TABS_RE`（评论/收藏者/已购专辑）、
  `HIDE_TAG_RE`（现在只藏「已购」；VIP / 音质 SQ 保留不藏，用户要求）。
  - `.cmd-tag` / `[class*="TagWrapper"]` 必须**全页**扫：底栏里的 VIP 在 `main` 之外，
    限定到 `main` 会漏（曾因此让底栏 VIP 重新出现）；`[class*="Tab"]` /
    `[class*="Title"]` 限定到 `#contentContainer` / `main`，且 `main` 侧排除
    `[class*="TitleCell"]`（每行曲目都是 TitleCell，量大且只含歌名）。
  - 这些 VIP 徽标的 class 是 `.cmd-tag...`，**不含 "VIP"**，`[class*="VIP"]` 盖不住，
    真正起作用的是 JS 的 `HIDE_TAG_RE`；`[class*="VIP"]` 已按审计删除。
- **已删的死选择器**（首页/我喜欢/专辑/全屏 4 页命中 0）：`red-star-comment-wrapper`、
  `IconComp`、`DidplayModeEntryStyle`、`VolumnSlider`/`VolumnThumb`、`likenumber`、
  `BasePlayButtonWrapper`、`TrianglePlayButtonWrapper`、`cmd-progress-track*`、`Comment`
  （大写）；全屏歌词类已改名，直接 `VinylPageLayoutContainer > :is(.display,.side,.center)`。
- **不能用 `TreeWalker`**（曾把页面卡死）；只用 `querySelectorAll` + 幂等写入。

**全屏封面**（常量在 `netease.js` 顶部，CSS 在 `SIDEBAR_CSS`）：
- 歌曲全屏封面 `VinylCoverContainer`、播客（声音）全屏封面 `VoiceCoverContainer`
  （内层是 `.cover`）。两者都做：居中、`min(56vh,56vw)`、静止、随底栏移动（底栏滑出 `-6vh`，
  隐藏回正）。JS 里 `COVER_SELECTOR` 同时选中两种封面，`IntersectionObserver` 逐个观察，
  任一可见即算全屏（`setAlbumBgActive`）。
- `.cover-area` 用 `position:fixed + 100vw/100vh`（祖先带 transform，`inset:0` 会算偏）；
  `VinylCoverContainer` 固定 `min(56vh,56vw)` + `translateY(-6vh)`。
- **背景 = 当前封面放大模糊**（Apple Music 式）：`CoverBackgroundContainer` 是整页**祖先**
  （封面在它里面），**blur 不能加它身上**（会把封面一起糊）；改为：容器 `background:#000`
  + `isolation:isolate`，模糊放 `::before`（`filter:blur(60px) saturate(1.5)`，
  `z-index:-1` → 位于容器底与内容之间），`::after` 只留淡暗角。
- 封面 URL 由 JS 写进 `--hush-album-cover`；**用 `IntersectionObserver` 判断全屏可见性**
  （播放器在普通页常驻但 `0×0`），换歌时由 `renameItems` 更新。**背景是静态的**（不做
  动画，省电）。

**全屏底栏自动隐藏**（`startVinylBarWatcher` + `SIDEBAR_CSS` 末尾规则）：
- 两个 `<html>` 类（**不要**用 `body.vinyl-mode`：鼠标移到左上角退出按钮时站点会摘掉它，
  一摘掉旧规则就全失效，底栏于是被“唤醒”）：
  - `hush-vinyl-active`：由 `setAlbumBgActive`（封面可见 = 全屏）维护；
  - `hush-vinyl-bar-show`：`mousemove`（rAF 节流）判断 `clientY >= innerHeight - 120`。
- 隐藏态：`VinylPageBarWrapper` 的 `.side` / `.middle button` /
  `.middle > div:not(:has([class*="Slider"]))` / `.right-side` 透明下移 + 背景透明；
  进度条 `StyledSliderContainer` 是底栏的**兄弟节点**（同在 `RowGap` 里），用
  `translateY(var(--hush-vinyl-bar-h, 80px))` 落到底部（`--hush-vinyl-bar-h` 由
  `updateVinylBarMetrics()` 量底栏高度写入）。
- `html.hush-vinyl-active footer [class*="DefaultBarWrapper"]{display:none}`：站点在 hover
  退出按钮时短暂退出 vinyl-mode，别让普通底栏冒出来。
- **封面居中动效**：底栏隐藏时 `VinylCoverContainer` 从 `translateY(-6vh)` 平滑移到
  `translateY(0)`（视口正中）；`html.hush-vinyl-active:not(.hush-vinyl-bar-show)` 选择器
  权重高于基础规则，两者都 `!important`。
- 站点自身空闲可能把整条底栏 `display:none`；用 `opacity/visibility:visible` 强制保留。
- **全屏顶栏（左上角退出按钮）自动隐藏**：`VinylPageContainer` 内 `.page-header`
  （绝对定位 top:0、h:72px）包住顶部 `Header`（`Container_c1m2d5ze`，退出按钮
  `title="退出全屏纯享"`）。默认 `opacity:0 + translateY(-12px)`，鼠标进入视口顶部
  ~120px 时加第三个 `<html>` 类 `hush-vinyl-topbar-show` 滑出；`.left` 自带
  `pointer-events:all`，隐藏时须对 `.page-header *` 一并 `pointer-events:none`，否则仍可点到。
- 开关关掉时 `stopVinylBarWatcher()` / `stopVinylObserver()` 移除监听与三个 class。

## 插件失灵时的工作流

网易云：

1. 让用户在**已登录**的 WebPlayer 页面 F12 → Console，
   运行 `tools/diagnose.js`，把输出贴回来。
2. 根据输出确认真实 DOM：栏目 ID 是否还在、类名前缀是否变了。
3. 修改 `src/netease.js` 里的 `SIDEBAR_CSS` 模板字符串。
4. 升 `src/manifest.json` 的 version（如 3.0.0 → 3.1.0）。
5. 重新打包（见下），覆盖根目录 `hush.crx`，git 提交并推送。
6. 提醒用户：刷新页面即可（同扩展 ID，拖入新 CRX 直接覆盖，不用先删旧版）。

X：

1. 让用户在 `https://x.com/home` 的 F12 → Console 运行 `tools/diagnose-x.js`，
   把输出贴回来。
2. 确认 `[role="tab"]` /「为你推荐」文字是否还在。
3. 改 `src/x.js` 顶部的 `FOR_YOU_RE` / `FOLLOWING_RE`，必要时放宽扫描范围。

## 打包命令

直接运行 `./pack.sh`（等同下面手动命令 + 扩展 ID 校验 + 生成 hush.zip）。

```bash
cd hush
# 注意：如果有正在运行的 chromium 实例，不带 --user-data-dir 的调用会被转发给已有实例
# 而静默什么都不做；所以打包时最好用独立的 user-data-dir。
chromium --user-data-dir=/tmp/cr-pack-profile --no-first-run --no-default-browser-check \
  --pack-extension=$PWD/src --pack-extension-key=${HUSH_KEY:-$HOME/.local/share/hush/hush.pem}
mv src.crx hush.crx
# 可选的“加载已解压扩展”备用包
rm -f hush.zip && (cd src && zip -qr ../hush.zip .)
```

- 必须用 `--pack-extension-key` 指定签名私钥（`$HUSH_KEY` 或
  `~/.local/share/hush/hush.pem`；仓库里的 `keys/` 已被 .gitignore），
  否则每次生成新密钥 → 扩展 ID 变化 → 用户得删旧重装。
  当前扩展 ID：`mdldpbdafiofeclcekinhcjgfhcnelcg`。
  验证方式：解析 CRX3 头里 `sha256_with_rsa.public_key`，其 SHA256 前 16 字节按
  `a`+nibble 映射即得 ID；新包与旧包应一致。
- 注意 `src/` 目录内不要残留 .pem 文件，否则报"包含密钥文件"错误。
- 产物 `src.crx` 出现在 **src/ 的同级**（即仓库根目录），改名成 `hush.crx` 供本地
  拖拽安装；**crx/zip 不入库**（见 `.gitignore`），只提交源码。

## 约束

- 保持极简：popup 就是垂直堆叠的无文字 ON/OFF 磁贴，撑满整个 popup、相邻磁贴间 1px 细线分割，靠颜色区分功能；加新站点时追加一个 .tile 即可
  （红=网易云，蓝=X，橙=HN，金=Codeforces），别加文字、别加复选框列表；按钮里的 SVG 图标只是标识，不算文字。
- 状态存储：`chrome.storage.sync`，四个独立 key，格式都是 `{ enabled: true|false }`：
  - 网易云：`netease-hider-enabled`（深色主题由同一个开关统一控制，不要单独加开关）；
  - X：`x-hider-enabled`（「隐藏为你推荐」与「白天 9:00–21:00 封锁」共用它）；
  - Hacker News：`hn-hider-enabled`；
  - Codeforces：`cf-hider-enabled`。
- 只管这四个站点：**不要再往这里加 Systems Approach 或任何在线书 / 阅读器功能**，那些在
  `~/Projects/learn`（Learn 扩展，扩展 ID 不同、存储 key 也不同）。
- 不做自动跳转 / 模拟点击（用户明确不要，别加回来）。X 那边也只隐藏「为你推荐」标签，
  不要自动切到「正在关注」。
- 不要用 TreeWalker 全页遍历文本节点（曾把页面卡死）。
