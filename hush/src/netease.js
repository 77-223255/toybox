// Hush — Netease Content Script
//
// 由 popup 的单个 ON/OFF 开关统一控制，做四类事：
//   1) 隐藏用不到的 UI（侧栏栏目 / logo / 右上角账户区 / 评论 / 收藏 / VIP）
//   2) 换肤：站点自带 design token 主题系统（80 个 token，场景 dark 等）。
//      页面加载前把 localStorage.currentTheme 设成 "dark"（无闪白），
//      再用 <style>!important 把 token 盖成 Apple Music 深色（色板见下面的常量）。
//      全屏页会在容器上重定义整套 token，故 albumTokenResetCss() 再写一份到容器上。
//   3) 侧栏三个栏目改英文名、去图标（JS；SPA 重渲染后由 MutationObserver 重跑）
//   4) 全屏播放页：只留居中的静止封面；背景用「当前封面模糊放大」（Apple Music 式）
//
// 约定：不动会随构建变化的哈希类名，只用稳定 ID / 未混淆语义类名 / 前缀属性选择器。

// ─────────────────────────────────────────────────────────────
// 主题色板
// ─────────────────────────────────────────────────────────────
// Apple Music 深色模式：#000 底 + 近黑面 + 品牌红 #fa2d48
const BG_BASE = '#000000'; // 页面主背景（纯黑）
const BG_SURFACE = '#1c1c1e'; // 卡片 / 弹窗 / 底部播放栏
const BG_ELEVATED = '#2c2c2e'; // 菜单 / 浮层 / 侧滑面板
const BG_TOOLTIP = '#3a3a3c';

// Apple Music 红 #fa2d48
const ACCENT_HEX = '#fa2d48'; // 高亮：图标 / 进度 / hover / 红心
const ACCENT_BRIGHT = '250, 45, 72'; // #fa2d48
const ACCENT_FILL = '250, 45, 72'; // #fa2d48
const ACCENT_FILL_DEEP = '200, 30, 55'; // #c81e37
const ACCENT_TEXT_ON_FILL = '#ffffff'; // 红底上用白字
const SIDEBAR_BG = '#1c1c1e'; // 侧边栏：Apple Music 近黑面

const SIDEBAR_CSS = `
  /* ══════════════════════════════════════════════════════════════
   * Hush · 网易云 WebPlayer 定制
   * 只做两件事：① 按站点真实类名「隐藏 / 换肤」 ② 全屏播放页精简
   * 选择器优先级：稳定 ID > 未混淆语义类名 > 前缀属性选择器
   * ══════════════════════════════════════════════════════════════ */

  /* ── 字体：全站浏览器默认 sans-serif（站点写死的字体栈 + dolphin 数字字体都换掉） ── */
  html body,
  html body * {
    font-family: sans-serif !important;
  }

  /* ── 隐藏用不到的站点 UI ──
     侧栏栏目：#recommend 推荐 / #choice 精选 / #audio 播客 / #privateFm 漫游 /
     #historyPlaylist 最近播放 / #myAudio 我的播客（保留 #community #myFavoriteMusic #myFavorite）
     左上角 logo：#topArea；右上角账户条 div[class^="Bar_"] + 消息/设置/换肤 */
  #recommend,
  #choice,
  #audio,
  #privateFm,
  #historyPlaylist,
  #myAudio,
  #topArea,
  div[class^="Bar_"],
  .MiniModeIconBar_m1jn0mly,
  [title="消息中心"],
  [title="设置"],
  [title="换肤"] {
    display: none !important;
  }
  /* 隐藏 logo 后收掉它预留的整条高度，避免下方空一块 */
  #contentContainer > div:has(> #topArea) {
    height: 0 !important;
    min-height: 0 !important;
  }

  /* ── 侧边栏：Apple Music 近黑底 ── */
  [class*="LeftScrollContainer"] {
    background: ${SIDEBAR_BG} !important;
  }
  /* 三个栏目：去掉前面的图标；「喜欢」后面那个心形装饰也去掉 */
  #community [class*="IconWrapper"],
  #myFavoriteMusic [class*="IconWrapper"],
  #myFavorite [class*="IconWrapper"],
  #myFavoriteMusic [class*="heartBeat"],
  #myFavoriteMusic [class*="HeartBeat"] {
    display: none !important;
  }
  /* 栏目标题：Apple Music 风格 Title Case + 加粗 */
  #community [class*="Title"],
  #myFavoriteMusic [class*="Title"],
  #myFavorite [class*="Title"] {
    font-weight: 600 !important;
  }

  /* ── 普通详情页背景压黑（全屏页的 CoverBackgroundContainer 内联渐变不碰） ── */
  [class*="StyledBackground"] {
    background: ${BG_BASE} !important;
  }

  /* ── 搜索框：深色底 + 反白字（站点默认透明底 + 粉紫渐变环） ── */
  html body .searchbox.searchbox {
    background-color: ${BG_SURFACE} !important;
    background-image: none !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
  }
  html body .searchbox.searchbox::after {
    background: none !important;
  }
  html body .searchbox.searchbox input {
    background-color: ${BG_SURFACE} !important;
    color: #ffffff !important;
    caret-color: #ffffff !important;
  }
  html body .searchbox.searchbox input::placeholder {
    color: rgba(255, 255, 255, 0.4) !important;
  }
  html body .searchbox.searchbox .icon {
    color: rgba(255, 255, 255, 0.45) !important;
  }

  /* ── 按钮：全部去渐变；实心主按钮用强调色前景 ── */
  html body button,
  html body [class*="cmd-button"] {
    background-image: none !important;
  }
  html body .cmd-button-surface-pri,
  html body .cmd-button-surface-pri .icon,
  html body .cmd-button-surface-pri i,
  html body .cmd-button-surface-pri svg,
  html body [class*="playorPauseIconStyle"] .icon,
  html body [class*="playorPauseIconStyle"] i,
  html body [class*="playorPauseIconStyle"] svg {
    color: ${ACCENT_TEXT_ON_FILL} !important;
    fill: ${ACCENT_TEXT_ON_FILL} !important;
  }
  html body .cmd-badge-primary.cmd-badge-solid,
  html body .cmd-badge-primary.cmd-badge-solid .cmd-badge-count {
    color: #000000 !important;
  }
  /* 去掉「我喜欢的音乐」上方的分组分隔线 / 空行 */
  .first-group.show-bottom-border {
    border-bottom: none !important;
    padding-bottom: 0 !important;
    margin-bottom: 0 !important;
  }
  .first-group.show-bottom-border::after {
    display: none !important;
  }
  .tab-area.show-bottom-border {
    padding-top: 0 !important;
    margin-top: 0 !important;
  }

  /* ── 底栏专辑封面：静态（不转）+ 圆角 ── */
  [class*="vinylImgCls"] {
    border-radius: 8px !important;
    background: none !important;
    animation: none !important;
    will-change: auto !important;
    overflow: hidden !important;
  }
  [class*="vinylImgCls"] img {
    width: 100% !important;
    height: 100% !important;
    border-radius: 8px !important;
    object-fit: cover !important;
  }

  /* ── 有图标的按钮：只留图标、隐藏文字（更简洁，也避开中英文字宽差异） ──
     站点已用 .cmd-button-with-icon-left 区分「图标+文字」，文字在
     .cmd-button-content-left / -right 里；隐藏它、保留图标。 */
  html body button.cmd-button-with-icon-left .cmd-button-content-left,
  html body button.cmd-button-with-icon-left .cmd-button-content-right {
    display: none !important;
  }

  /* ── 底栏歌名/作者：统一 22px，整条垂直居中 ── */
  html body [class*="DefaultBarWrapper"] [class*="songPlayInfo"] {
    justify-content: center !important;
    align-items: center !important;
  }
  /* 播客（声音）底栏的 songPlayInfo 里，除了歌名还残留一个 1px 竖分隔线
     （点赞/评论按钮被隐藏后留下的空壳），它占 25px 高，会把歌名顶上去、
     导致整块不垂直居中；只保留 info-wrapper，其余直接子元素隐藏。
     音乐底栏该子元素为空（0x0），不受影响。 */
  html body :is([class*="DefaultBarWrapper"], [class*="VinylPageBarWrapper"]) [class*="songPlayInfo"] > *:not([class*="info-wrapper"]),
  html body :is([class*="DefaultBarWrapper"], [class*="VinylPageBarWrapper"]) [class*="togetherSongPlayInfo"] > *:not([class*="info-wrapper"]) {
    display: none !important;
  }
  html body [class*="DefaultBarWrapper"] .left,
  html body [class*="DefaultBarWrapper"] .left > div,
  html body [class*="DefaultBarWrapper"] [class*="info-wrapper"],
  html body [class*="DefaultBarWrapper"] [class*="TitleWrapper"] {
    align-items: center !important;
  }
  html body [class*="DefaultBarWrapper"] [class*="TitleWrapper"] {
    --t7mtn5s-0: 22px !important;
    --t7mtn5s-1: 22px !important;
  }
  html body [class*="DefaultBarWrapper"] .title,
  html body [class*="DefaultBarWrapper"] .title span,
  html body [class*="DefaultBarWrapper"] .author {
    font-size: 22px !important;
  }

  /* ── 底栏按钮：评论 / 分享 / 收藏 / 点赞 整块隐藏 ──
     收藏按钮**只在底栏**（DefaultBarWrapper / VinylPageBarWrapper）隐藏，
     专辑页 / 歌曲页的收藏按钮保留。播客（声音）底栏的「点赞」也只在底栏隐藏。
     注：音质 SQ / VIP 标识不再隐藏（用户要求保留）。 */
  html body button:has(.cmd-icon-comment_number),
  html body button:has(.cmd-icon-share),
  html body :is([class*="DefaultBarWrapper"], [class*="VinylPageBarWrapper"]) button:has(.cmd-icon-collect),
  html body :is([class*="DefaultBarWrapper"], [class*="VinylPageBarWrapper"]) button:has([title="点赞"]),
  html body :is([class*="DefaultBarWrapper"], [class*="VinylPageBarWrapper"]) button:has([title="取消点赞"]),
  [title="分享"],
  html body :is([class*="DefaultBarWrapper"], [class*="VinylPageBarWrapper"]) [title="收藏到歌单"],
  [title="添加到歌单"],
  [title="添加歌单"] {
    display: none !important;
  }

  /* ── 歌单 / 专辑卡片右上角的播放量数字：全局隐藏 ── */
  [class*="PlayCountContainer"] {
    display: none !important;
  }
  /* ── 我的收藏页：只剩「收藏专辑」一个 tab（已购专辑早已隐藏），整条 tab 区隐藏 ──
     TabSection 外面还包了一层 HeaderSection（只有这一个子节点），两者都藏，否则中间留空隙。 */
  main [class*="HeaderSection"],
  main [class*="TabSection"] {
    display: none !important;
  }
  /* ── 关注页（社区）右上角「发布」按钮隐藏 ── */
  #page_pc_community [class*="HeaderWrapper"] button:has(.post-icon) {
    display: none !important;
  }

  /* ── 控制图标（底栏 + 全屏条）：默认白，hover/激活强调色 ── */
  html body :is([class*="DefaultBarWrapper"], [class*="VinylPageBarWrapper"]) :is([class*="miniBarIcon"], [class*="MiniBarMiddleIcon"], [class*="middleHover"]) {
    color: #ffffff !important;
    fill: #ffffff !important;
  }
  html body [class*="miniBarIconWebpColorStyle"] {
    background: #ffffff !important;
  }
  html body :is([class*="DefaultBarWrapper"], [class*="VinylPageBarWrapper"]) :is([class*="miniBarIcon"], [class*="MiniBarMiddleIcon"]):hover {
    color: ${ACCENT_HEX} !important;
    fill: ${ACCENT_HEX} !important;
  }

  /* ── 进度条 / 音量条：轨道浅灰、已播强调色、滑块白 ── */
  html body [class*="StyledSliderContainer"]::before {
    background: rgba(255, 255, 255, 0.3) !important;
  }
  html body [class*="StyledSliderContainer"] .cache {
    background: rgba(255, 255, 255, 0.15) !important;
  }
  html body [class*="StyledSliderContainer"] .track {
    background: ${ACCENT_HEX} !important;
  }
  html body [class*="StyledSliderContainer"] .thumb {
    background: #ffffff !important;
  }

  /* ── 点赞红心 → 强调色 ── */
  [title^="取消喜欢"],
  [title^="取消喜欢"] svg,
  [title^="取消喜欢"] path,
  [title^="取消喜欢"] i {
    color: ${ACCENT_HEX} !important;
    fill: ${ACCENT_HEX} !important;
  }

  /* ── 评论隐藏（收藏保留，用户要收藏专辑 / 歌曲） ── */
  [class*="comment-count"],
  [title="评论"],
  [title="查看评论"] {
    display: none !important;
  }

  /* ── 主播放键：圆形、淡灰、无渐变 ── */
  html body [class*="playorPauseIconStyle"],
  html body [class*="StyledRoundPlayButton"],
  html body .play-btn,
  html body [class*="play-pause-btn"] {
    background-image: none !important;
    background-color: rgba(255, 255, 255, 0.12) !important;
    border-radius: 50% !important;
  }
  html body [class*="playorPauseIconStyle"] .icon,
  html body [class*="playorPauseIconStyle"] i,
  html body [class*="playorPauseIconStyle"] svg,
  html body .play-btn svg,
  html body [class*="play-pause-btn"] svg {
    color: #ffffff !important;
    fill: #ffffff !important;
  }

  /* ── 全屏播放页：只留一个居中的静止方形封面 ── */
  /* .cover-area 用视口单位铺满（站点祖先带 transform，inset:0 会算偏） */
  html body .cover-area {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    right: auto !important;
    bottom: auto !important;
    width: 100vw !important;
    height: 100vh !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-sizing: border-box !important;
    z-index: 0 !important;
    pointer-events: none !important;
  }
  html body [class*="VinylCoverContainer"] {
    pointer-events: auto !important;
    position: relative !important;
    inset: auto !important;
    transform: translateY(-6vh) !important;
    transition: transform 0.3s ease !important;
    width: min(56vh, 56vw) !important;
    height: min(56vh, 56vw) !important;
    display: block !important;
  }
  /* 底栏隐藏时封面平滑移到视口正中（原 -6vh 是给底栏让位） */
  html.hush-vinyl-active:not(.hush-vinyl-bar-show) body [class*="VinylCoverContainer"] {
    transform: translateY(0) !important;
  }
  html body [class*="VinylCoverContainer"] [class*="cover-container"] {
    width: 100% !important;
    height: 100% !important;
    padding-bottom: 0 !important;
    position: relative !important;
  }
  /* 唱臂 + 两层黑胶唱片层隐藏，只留专辑封面 */
  html body [class*="VinylCoverContainer"] [class*="handle"],
  html body [class*="CenterImg"]:not([class*="Cover"]) {
    display: none !important;
  }

  /* ── 播客（声音）全屏封面：与音乐封面同款 ──
     播客页左槽是 VoiceCoverContainer（不是 VinylCoverContainer），
     内部封面是 .cover（不是 CenterImg），所以单独写一套。
     尺寸 / 居中 / 随底栏移动（-6vh）与音乐全屏保持一致。 */
  html body [class*="VoiceCoverContainer"] {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    right: auto !important;
    bottom: auto !important;
    width: 100vw !important;
    height: 100vh !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-sizing: border-box !important;
    z-index: 0 !important;
    pointer-events: none !important;
  }
  html body [class*="VoiceCoverContainer"] .cover {
    width: min(56vh, 56vw) !important;
    height: min(56vh, 56vw) !important;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    pointer-events: auto !important;
    background-size: cover !important;
    background-position: center !important;
    transform: translateY(-6vh) !important;
    transition: transform 0.3s ease !important;
  }
  /* 底栏隐藏时封面平滑移到视口正中 */
  html.hush-vinyl-active:not(.hush-vinyl-bar-show) body [class*="VoiceCoverContainer"] .cover {
    transform: translateY(0) !important;
  }
  html body [class*="VoiceCoverContainer"] .cover img {
    width: 100% !important;
    height: 100% !important;
    border-radius: 8px !important;
    object-fit: cover !important;
    animation: none !important;
  }
  /* 封面下角「播放量」气泡会跑到视口角落，播客全屏里只留封面 */
  html body [class*="VoiceCoverContainer"] > *:not(.cover) {
    display: none !important;
  }
  html body [class*="CenterImg"][class*="Cover"] {
    position: absolute !important;
    inset: 0 !important;
    margin: auto !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    transform: none !important;
    animation: none !important;
    width: 100% !important;
    height: 100% !important;
  }
  html body [class*="VinylCoverContainer"] [class*="CenterImg"] img {
    border-radius: 8px !important;
  }
  /* 歌词 / 右侧信息 / 右侧操作列 / 空列 全部隐藏（都是直接子元素） */
  html body [class*="VinylPageLayoutContainer"] > :is(.display, .side, .center) {
    display: none !important;
  }

  /* ── 全屏背景：Apple Music 式「模糊封面」 ──
     CoverBackgroundContainer 是整个全屏页的**祖先**（封面等内容都在它里面），
     所以 blur 绝不能加在它身上（会把封面一起糊掉）。
     做法：容器本身不透明黑底（盖住普通页）；模糊只加在 ::before 伪元素上，
     伪元素 z-index:-1 → 位于「容器背景之上、内容之下」，封面保持清晰。
     封面 URL 由 JS 写进 --hush-album-cover。 */
  [class*="CoverBackgroundContainer"] {
    background: ${BG_BASE} !important;
    isolation: isolate;
  }
  [class*="CoverBackgroundContainer"]::before {
    content: "";
    position: absolute;
    inset: -12%;
    z-index: -1;
    background-image: var(--hush-album-cover, none);
    background-size: cover;
    background-position: center;
    filter: blur(60px) saturate(1.5);
    pointer-events: none;
  }
  [class*="CoverBackgroundContainer"]::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background: radial-gradient(120% 120% at 50% 0%, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.32) 100%);
    pointer-events: none;
  }

  /* ── 全屏底栏：平时只留进度条并落到底部，鼠标靠近底部时控制键滑出 ──
     html 上的 .hush-vinyl-active 由 JS（setAlbumBgActive，封面可见=全屏）维护，
     比站点随时会摘掉的 body.vinyl-mode 稳（鼠标移到左上角退出按钮时站点会摘掉
     vinyl-mode，这就是之前“左上角也唤醒底栏”的原因）。
     .hush-vinyl-bar-show 由 mousemove 在鼠标进入视口底部 ~120px 时加。 */
  html.hush-vinyl-active [class*="VinylPageBarWrapper"] .side,
  html.hush-vinyl-active [class*="VinylPageBarWrapper"] [class*="middle"] button,
  html.hush-vinyl-active [class*="VinylPageBarWrapper"] [class*="middle"] > div,
  html.hush-vinyl-active [class*="VinylPageBarWrapper"] [class*="right-side"] {
    transition: opacity 0.28s ease, transform 0.28s ease !important;
  }
  html.hush-vinyl-active:not(.hush-vinyl-bar-show) [class*="VinylPageBarWrapper"] .side,
  html.hush-vinyl-active:not(.hush-vinyl-bar-show) [class*="VinylPageBarWrapper"] [class*="middle"] button,
  html.hush-vinyl-active:not(.hush-vinyl-bar-show) [class*="VinylPageBarWrapper"] [class*="middle"] > div:not(:has([class*="Slider"])),
  html.hush-vinyl-active:not(.hush-vinyl-bar-show) [class*="VinylPageBarWrapper"] [class*="right-side"] {
    opacity: 0 !important;
    transform: translateY(12px) !important;
    pointer-events: none !important;
  }
  /* 隐藏控制键时不留底栏背景 */
  html.hush-vinyl-active:not(.hush-vinyl-bar-show) [class*="VinylPageBarWrapper"] {
    background: transparent !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  /* 进度条：控制键隐藏时下移底栏高度，落到底部；鼠标靠近再滑回原位 */
  html.hush-vinyl-active [class*="StyledSliderContainer"] {
    transition: transform 0.28s ease !important;
    will-change: transform;
  }
  html.hush-vinyl-active:not(.hush-vinyl-bar-show) [class*="StyledSliderContainer"] {
    transform: translateY(var(--hush-vinyl-bar-h, 80px)) !important;
  }
  /* 鼠标靠到左上角退出按钮时站点会退出 vinyl-mode，别让普通底栏冒出来 */
  html.hush-vinyl-active footer [class*="DefaultBarWrapper"] {
    display: none !important;
  }
  /* 不要让站点自身的“空闲自动隐藏”把整条底栏也收走 */
  html.hush-vinyl-active [class*="VinylPageBarWrapper"] {
    opacity: 1 !important;
    visibility: visible !important;
  }

  /* ── 全屏顶栏（左上角「退出全屏纯享」按钮）：默认隐藏，鼠标靠近视口顶部时滑出 ──
     .page-header 是 VinylPageContainer 里包住顶部 Header 的绝对定位层（top:0, h:72px），
     非全屏时 VinylPageContainer 不可见，所以用 .hush-vinyl-active 限定。
     .hush-vinyl-topbar-show 由 mousemove 在鼠标进入视口顶部 ~120px 时加（见 startVinylBarWatcher）。 */
  html.hush-vinyl-active .page-header {
    transition: opacity 0.28s ease, transform 0.28s ease !important;
  }
  html.hush-vinyl-active:not(.hush-vinyl-topbar-show) .page-header {
    opacity: 0 !important;
    transform: translateY(-12px) !important;
    pointer-events: none !important;
  }
  /* .left 自带 pointer-events:all，父级 none 拦不住命中，隐藏时把整棵子树都关掉 */
  html.hush-vinyl-active:not(.hush-vinyl-topbar-show) .page-header * {
    pointer-events: none !important;
  }
`;


// 浅色（站点默认 token）——关闭开关时写回，恢复原样。
const LIGHT_TOKENS = {
  colorBackground: 'rgba(247,249,252,1)',
  colorBackgroundWhite: 'rgba(255,255,255,1)',
  colorBlack1: 'rgba(40,50,72,1)',
  colorBlack10: 'rgba(40,50,72,0.1)',
  colorBlack11: 'rgba(40,50,72,0.06)',
  colorBlack12: 'rgba(40,50,72,0.03)',
  colorBlack2: 'rgba(40,50,72,0.9)',
  colorBlack3: 'rgba(40,50,72,0.8)',
  colorBlack4: 'rgba(40,50,72,0.7)',
  colorBlack5: 'rgba(40,50,72,0.6)',
  colorBlack6: 'rgba(40,50,72,0.5)',
  colorBlack7: 'rgba(40,50,72,0.4)',
  colorBlack8: 'rgba(40,50,72,0.3)',
  colorBlack9: 'rgba(40,50,72,0.25)',
  colorFunction1: 'rgba(40,50,72,0.5)',
  colorFunction10: 'rgba(40,50,72,0.1)',
  colorFunction11: 'rgba(252,59,91,1)',
  colorFunction12: 'rgba(252,61,73,1)',
  colorFunction13: 'rgba(50,119,255,1)',
  colorFunction14: 'rgba(119,88,255,1)',
  colorFunction15: 'rgba(255,255,255,1)',
  colorFunction16: 'rgba(45,45,56,1)',
  colorFunction17: 'rgba(250,250,250,1)',
  colorFunction2: 'rgba(255,255,255,1)',
  colorFunction3: 'rgba(255,255,255,0.8)',
  colorFunction4: 'rgba(255,255,255,1)',
  colorFunction5: 'rgba(40,50,72,0.06)',
  colorFunction6: 'rgba(255,255,255,0.8)',
  colorFunction7: 'rgba(40,50,72,0.8)',
  colorFunction8: 'rgba(40,50,72,1)',
  colorFunction9: 'rgba(40,50,72,0.06)',
  colorMask1: 'rgba(0,0,0,0.7)',
  colorMask2: 'rgba(0,0,0,0.3)',
  colorMask3: 'rgba(0,0,0,0.25)',
  colorMask4: 'rgba(0,0,0,0.1)',
  colorMask5: 'rgba(0,0,0,0)',
  colorPrimary1: 'rgba(255,58,58,1)',
  colorPrimary2: 'rgba(255,58,58,0.9)',
  colorPrimary3: 'rgba(255,58,58,0.8)',
  colorPrimary4: 'rgba(255,58,58,0.6)',
  colorPrimary5: 'rgba(255,58,58,0.4)',
  colorPrimary6: 'rgba(255,58,58,0.3)',
  colorPrimary7: 'rgba(255,58,58,0.1)',
  colorPrimary8: 'rgba(255,58,58,0.08)',
  colorSecondary1_1: 'rgba(252,59,91,1)',
  colorSecondary1_2: 'rgba(252,61,73,1)',
  colorSecondary2_1: 'rgba(255,58,58,1)',
  colorSecondary2_2: 'rgba(89,117,178,1)',
  colorSecondary2_3: 'rgba(54,178,133,1)',
  colorSecondary2_4: 'rgba(54,93,178,1)',
  colorSecondary3_1: 'rgba(252,110,163,1)',
  colorSecondary3_2: 'rgba(255,235,242,1)',
  colorSecondary3_3: 'rgba(50,169,252,1)',
  colorSecondary3_4: 'rgba(230,242,250,1)',
  colorSecondary4: 'rgba(211,160,59,1)',
  colorSidebar1: 'rgba(40,50,72,1)',
  colorSidebar10: 'rgba(252,61,73,1)',
  colorSidebar11: 'rgba(252,59,91,1)',
  colorSidebar12: 'rgba(252,61,73,1)',
  colorSidebar13: 'rgba(255,255,255,1)',
  colorSidebar2: 'rgba(40,50,72,0.7)',
  colorSidebar3: 'rgba(40,50,72,0.6)',
  colorSidebar4: 'rgba(40,50,72,0.4)',
  colorSidebar5: 'rgba(40,50,72,0.1)',
  colorSidebar6: 'rgba(40,50,72,0.06)',
  colorSidebar7: 'rgba(40,50,72,0.03)',
  colorSidebar8: 'rgba(255,255,255,1)',
  colorSidebar9: 'rgba(252,59,91,1)',
  colorWhite1: 'rgba(255,255,255,1)',
  colorWhite10: 'rgba(255,255,255,0.1)',
  colorWhite11: 'rgba(255,255,255,0.06)',
  colorWhite12: 'rgba(255,255,255,0.03)',
  colorWhite2: 'rgba(255,255,255,0.9)',
  colorWhite3: 'rgba(255,255,255,0.8)',
  colorWhite4: 'rgba(255,255,255,0.7)',
  colorWhite5: 'rgba(255,255,255,0.6)',
  colorWhite6: 'rgba(255,255,255,0.5)',
  colorWhite7: 'rgba(255,255,255,0.4)',
  colorWhite8: 'rgba(255,255,255,0.3)',
  colorWhite9: 'rgba(255,255,255,0.25)',
};

// 深色（站点 "dark" 场景 token）——打开开关时写入。
const DARK_TOKENS = {
  colorBackground: 'rgba(19,19,26,1)',
  colorBackgroundWhite: 'rgba(19,19,26,1)',
  colorBlack1: 'rgba(255,255,255,1)',
  colorBlack10: 'rgba(255,255,255,0.1)',
  colorBlack11: 'rgba(255,255,255,0.06)',
  colorBlack12: 'rgba(255,255,255,0.03)',
  colorBlack2: 'rgba(255,255,255,0.9)',
  colorBlack3: 'rgba(255,255,255,0.8)',
  colorBlack4: 'rgba(255,255,255,0.7)',
  colorBlack5: 'rgba(255,255,255,0.6)',
  colorBlack6: 'rgba(255,255,255,0.5)',
  colorBlack7: 'rgba(255,255,255,0.4)',
  colorBlack8: 'rgba(255,255,255,0.3)',
  colorBlack9: 'rgba(255,255,255,0.25)',
  colorFunction1: 'rgba(255,255,255,0.9)',
  colorFunction10: 'rgba(255,255,255,0.15)',
  colorFunction11: 'rgba(252,59,91,1)',
  colorFunction12: 'rgba(252,61,73,1)',
  colorFunction13: 'rgba(50,119,255,1)',
  colorFunction14: 'rgba(119,88,255,1)',
  colorFunction15: 'rgba(52,52,62,1)',
  colorFunction16: 'rgba(255,255,255,1)',
  colorFunction17: 'rgba(45,45,56,1)',
  colorFunction2: 'rgba(255,255,255,0.06)',
  colorFunction3: 'rgba(27,27,36,0.9)',
  colorFunction4: 'rgba(45,45,56,1)',
  colorFunction5: 'rgba(255,255,255,0.2)',
  colorFunction6: 'rgba(27,27,36,0.5)',
  colorFunction7: 'rgba(255,255,255,0.7)',
  colorFunction8: 'rgba(255,255,255,1)',
  colorFunction9: 'rgba(255,255,255,0.08)',
  colorMask1: 'rgba(0,0,0,0.7)',
  colorMask2: 'rgba(0,0,0,0.3)',
  colorMask3: 'rgba(0,0,0,0.25)',
  colorMask4: 'rgba(0,0,0,0.1)',
  colorMask5: 'rgba(0,0,0,0)',
  colorPrimary1: 'rgba(255,58,58,1)',
  colorPrimary2: 'rgba(255,58,58,0.9)',
  colorPrimary3: 'rgba(255,58,58,0.8)',
  colorPrimary4: 'rgba(255,58,58,0.6)',
  colorPrimary5: 'rgba(255,58,58,0.4)',
  colorPrimary6: 'rgba(255,58,58,0.3)',
  colorPrimary7: 'rgba(255,58,58,0.1)',
  colorPrimary8: 'rgba(255,58,58,0.08)',
  colorSecondary1_1: 'rgba(252,59,91,1)',
  colorSecondary1_2: 'rgba(252,61,73,1)',
  colorSecondary2_1: 'rgba(255,58,58,1)',
  colorSecondary2_2: 'rgba(94,124,189,1)',
  colorSecondary2_3: 'rgba(54,178,133,1)',
  colorSecondary2_4: 'rgba(120,158,240,1)',
  colorSecondary3_1: 'rgba(252,110,163,1)',
  colorSecondary3_2: 'rgba(255,255,255,0.1)',
  colorSecondary3_3: 'rgba(50,169,252,1)',
  colorSecondary3_4: 'rgba(255,255,255,0.1)',
  colorSecondary4: 'rgba(211,160,59,1)',
  colorSidebar1: 'rgba(255,255,255,1)',
  colorSidebar10: 'rgba(252,61,73,1)',
  colorSidebar11: 'rgba(252,59,91,1)',
  colorSidebar12: 'rgba(252,61,73,1)',
  colorSidebar13: 'rgba(255,255,255,1)',
  colorSidebar2: 'rgba(255,255,255,0.7)',
  colorSidebar3: 'rgba(255,255,255,0.6)',
  colorSidebar4: 'rgba(255,255,255,0.4)',
  colorSidebar5: 'rgba(255,255,255,0.1)',
  colorSidebar6: 'rgba(255,255,255,0.06)',
  colorSidebar7: 'rgba(255,255,255,0.03)',
  colorSidebar8: 'rgba(255,255,255,1)',
  colorSidebar9: 'rgba(252,59,91,1)',
  colorWhite1: 'rgba(255,255,255,1)',
  colorWhite10: 'rgba(255,255,255,0.1)',
  colorWhite11: 'rgba(255,255,255,0.06)',
  colorWhite12: 'rgba(255,255,255,0.03)',
  colorWhite2: 'rgba(255,255,255,0.9)',
  colorWhite3: 'rgba(255,255,255,0.8)',
  colorWhite4: 'rgba(255,255,255,0.7)',
  colorWhite5: 'rgba(255,255,255,0.6)',
  colorWhite6: 'rgba(255,255,255,0.5)',
  colorWhite7: 'rgba(255,255,255,0.4)',
  colorWhite8: 'rgba(255,255,255,0.3)',
  colorWhite9: 'rgba(255,255,255,0.25)',
};

// 站点官方 dark 主题偏蓝灰（背景 rgba(19,19,26,1) / 表面 rgba(45,45,56,1)），
// 这里在官方 dark 基础上，把所有“背景类”token 换成柔和深灰（不是纯黑），
// 并按层次分层：页面底色 < 卡片/弹窗 < 菜单/浮层 < tooltip。
// 文字 / 图标 / 描边等沿用官方 dark 的反白值。
const SURFACE_OVERRIDES = {
  colorBackground: BG_BASE, // 页面主背景
  colorBackgroundWhite: BG_ELEVATED, // 菜单 / 浮层背景
  colorFunction3: BG_ELEVATED, // StyledMenu 背景
  colorFunction4: BG_SURFACE, // 卡片 / 弹窗 / 底部播放栏等表面
  colorFunction6: BG_ELEVATED, // 侧滑面板
  colorFunction17: BG_SURFACE, // 表面
  colorFunction15: BG_TOOLTIP, // tooltip，保留一点层次
};

// Hacker News 橙强调色：
//   - #FF6600：图标 / 文字 / 进度条 / 小圆点等小面积高亮
//   - #FF6600 → #E65C00：实心按钮 / 播放键渐变填充，配黑字
// 只改“品牌主色”家族；语义色（错误红 / 成功绿 / 蓝 / 黄 / 紫）保持原样。
const ACCENT_OVERRIDES = {
  colorPrimary1: `rgba(${ACCENT_FILL},1)`,
  colorPrimary2: `rgba(${ACCENT_FILL},0.9)`,
  colorPrimary3: `rgba(${ACCENT_FILL},0.8)`,
  colorPrimary4: `rgba(${ACCENT_FILL},0.6)`,
  colorPrimary5: `rgba(${ACCENT_FILL},0.4)`,
  colorPrimary6: `rgba(${ACCENT_FILL},0.3)`,
  colorPrimary7: `rgba(${ACCENT_FILL},0.1)`,
  colorPrimary8: `rgba(${ACCENT_FILL},0.08)`,
  colorSecondary1_1: `rgba(${ACCENT_FILL},1)`,
  colorSecondary1_2: `rgba(${ACCENT_FILL_DEEP},1)`,
  colorFunction11: `rgba(${ACCENT_BRIGHT},1)`,
  colorFunction12: `rgba(${ACCENT_BRIGHT},1)`,
  colorSidebar9: `rgba(${ACCENT_BRIGHT},1)`,
  colorSidebar10: `rgba(${ACCENT_BRIGHT},1)`,
  colorSidebar11: `rgba(${ACCENT_BRIGHT},1)`,
  colorSidebar12: `rgba(${ACCENT_BRIGHT},1)`,
};

// 最终主题 = 官方 dark 场景 + 黑橙背景 + HN 橙强调色
const THEME_TOKENS = Object.assign({}, DARK_TOKENS, SURFACE_OVERRIDES, ACCENT_OVERRIDES);

const STYLE_ID = 'netease-hider-style';
const THEME_STYLE_ID = 'netease-hider-theme';
const STORAGE_KEY = 'netease-hider-enabled';
const THEME_KEY = 'currentTheme';
// 同源 localStorage 镜像：让页面脚本执行前就能同步决定是否进入深色，避免闪白。
const MIRROR_KEY = 'netease-hider-mirror';

// localStorage 在沙箱/禁用第三方 cookie 等情况下会抛异常，统一包一下。
function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    /* ignore */
  }
}
function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

// 用 <style> + !important 写主题变量：站点自己也会往 <html> 写行内 token
// （官方 dark），行内非 important 会被这里的 !important 盖掉，保证永远是我们的主题。
function setThemeStyle(tokens) {
  let style = document.getElementById(THEME_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = THEME_STYLE_ID;
    (document.head || document.documentElement).appendChild(style);
  }
  const body = Object.keys(tokens)
    .map((name) => `--${name}:${tokens[name]} !important;`)
    .join('');
  style.textContent = `:root{${body}}`;
}

function clearThemeStyle() {
  const style = document.getElementById(THEME_STYLE_ID);
  if (style) style.remove();
}

// 关闭时把浅色 token 作为行内样式写回，顶掉站点在挂载时写入的深色行内值。
function applyLightTokensInline() {
  const el = document.documentElement;
  if (!el) return;
  Object.keys(LIGHT_TOKENS).forEach((name) => {
    el.style.setProperty('--' + name, LIGHT_TOKENS[name]);
  });
}

function applyDarkTheme() {
  setThemeStyle(THEME_TOKENS);
  document.documentElement.style.colorScheme = 'dark';
  lsSet(THEME_KEY, 'dark');
}

function applyLightTheme() {
  clearThemeStyle();
  applyLightTokensInline();
  document.documentElement.style.colorScheme = 'light';
  lsSet(THEME_KEY, 'light');
}

// 全屏播放页（VinylPageContainer）会用专辑主色在**容器上**重定义整套 color* token，
// 这层在容器上、:root 的主题盖不过它，于是把我们的主题 token 再写一遍到容器上
// （!important），保证全屏页的按钮/文字也是我们的配色；
// 专辑背景（CoverBackgroundContainer 的内联 linear-gradient）不受影响，仍然随专辑变。
function albumTokenResetCss() {
  const decls = Object.keys(THEME_TOKENS)
    .map((name) => `--${name}:${THEME_TOKENS[name]} !important;`)
    .join('');
  return `[class*="VinylPageContainer"],#root,body{${decls}}`;
}

function applyHidden() {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = SIDEBAR_CSS + albumTokenResetCss();
    (document.head || document.documentElement).appendChild(style);
  }
}

function removeHidden() {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}

// ─────────────────────────────────────────────────────────────
// 侧栏改名：关注 / 喜欢 / 收藏（去掉前面的图标，栏目内页标题同步改）
// 站点是 SPA，导航时会重渲染，用 MutationObserver 节流后重跑；
// 不用 TreeWalker（曾把页面卡死）。
// ─────────────────────────────────────────────────────────────
const SIDEBAR_RENAME = [
  ['#community', 'Following'],
  ['#myFavoriteMusic', 'Favorites'],
  ['#myFavorite', 'Collection'],
];
// 侧栏分组标题（带数量，如「创建的歌单 23」）→ 英文分区标题（Apple Music 式大写），保留数量
const SIDEBAR_GROUP_RENAME = ['创建的歌单', 'PLAYLISTS'];
// 通用 UI 文案 → English（Apple Music 式 Title Case；不含歌名 / 专辑名等动态内容）
const RENAME_TEXT = {
  // 侧栏 / 页面大标题
  '我喜欢的音乐': 'Favorites',
  '我的收藏': 'Collection',
  '我的关注': 'Following',
  '喜欢': 'Likes',
  '收藏': 'Collection',
  '关注': 'Follow',
  '已关注': 'Following',
  '粉丝': 'Followers',
  // 子页面 tab / 标题
  '综合': 'All',
  '单曲': 'Songs',
  '歌单': 'Playlists',
  '声音': 'Podcasts',
  '歌词': 'Lyrics',
  '视频': 'Videos',
  '歌曲': 'Songs',
  '专辑': 'Albums',
  '评论': 'Comments',
  '收藏者': 'Subscribers',
  '全部': 'All',
  '歌手': 'Artists',
  '用户': 'Users',
  '笔记': 'Notes',
  '播客': 'Podcasts',
  '歌手详情': 'Artist Bio',
  '相似歌手': 'Similar Artists',
  '演出': 'Shows',
  // 表格 / 通用控件
  '标题': 'Title',
  '时长': 'Duration',
  '热度': 'Plays',
  '播放全部': 'Play',
  '播放': 'Play',
  '新建歌单': 'New Playlist',
  '后退': 'Back',
  '下载': 'Download',
  '分享': 'Share',
  '更多': 'More',
  '更多操作': 'More',
  '最近一周': 'Past Week',
  '所有时间': 'All Time',
  // 搜索页标签 / 区块
  '播单': 'Shows',
  '最近爱听': 'Recently Played',
  '最近听过': 'Recently Listened',
  '万人评论': '10K+ Comments',
  '万人收藏': '10K+ Saves',
  '纯音乐': 'Instrumental',
};
// 页面内 tab（.cmd-tabs-tab）标题：文字后面常带数字（如「歌曲 50」），
// 用 replaceTextDeep 只换标题文字、保留数字。长词放前面，避免「歌手详情」被「歌手」误伤。
const PAGE_TAB_RENAME = [
  ['专辑详情', 'Details'],
  ['歌手详情', 'Artist Bio'],
  ['综合', 'All'],
  ['单曲', 'Songs'],
  ['歌单', 'Playlists'],
  ['声音', 'Podcasts'],
  ['播单', 'Shows'],
  ['歌词', 'Lyrics'],
  ['视频', 'Videos'],
  ['相似歌手', 'Similar Artists'],
  ['歌曲', 'Songs'],
  ['专辑', 'Albums'],
  ['评论', 'Comments'],
  ['收藏者', 'Subscribers'],
  ['全部', 'All'],
  ['歌手', 'Artists'],
  ['用户', 'Users'],
  ['笔记', 'Notes'],
  ['播客', 'Podcasts'],
  ['关注', 'Following'],
  ['最近一周', 'Past Week'],
  ['所有时间', 'All Time'],
];

let renameObserver = null;
let renameTimer = 0;

// 「评论 / 收藏者 / 已购专辑」标签（tab）无稳定类名，按文字匹配（允许尾部计数）
const HIDE_TABS_RE = /^(评论|收藏者|已购专辑|收藏专辑)\s*\d*$/;
// 小徽标：只藏「已购」（用户要求保留 VIP / 音质 SQ 标识）
const HIDE_TAG_RE = /^已购/;

// 在有限深度内替换文本节点里的子串（不用 TreeWalker，避免卡死）。
function replaceTextDeep(el, from, to, depth) {
  if ((depth || 0) > 3) return false;
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === 3) {
      if (node.textContent.indexOf(from) !== -1) {
        node.textContent = node.textContent.replace(from, to);
        return true;
      }
    } else if (node.nodeType === 1 && replaceTextDeep(node, from, to, (depth || 0) + 1)) {
      return true;
    }
  }
  return false;
}

// 一次扫描同时处理：评论/收藏标签、VIP 标签、栏目内页标题改名。
// 幂等：只在值真的不同时写入，避免无意义的 DOM 变更/重排。
function renameItems() {
  SIDEBAR_RENAME.forEach(([sel, label]) => {
    const item = document.querySelector(sel);
    if (!item) return;
    const title = item.querySelector('[class*="Title"]');
    if (title && title.textContent.trim() !== label) title.textContent = label;
  });
  // 侧栏分组标题：「创建的歌单 23」→「PLAYLISTS 23」（保留数字）
  const groupTitle = document.querySelector('[class*="LeftScrollContainer"] [class*="TitleContent"]');
  if (groupTitle && groupTitle.textContent.indexOf(SIDEBAR_GROUP_RENAME[0]) !== -1) {
    replaceTextDeep(groupTitle, SIDEBAR_GROUP_RENAME[0], SIDEBAR_GROUP_RENAME[1], 0);
  }
  // .cmd-tag / [class*="TagWrapper"] 必须全页扫：底栏里的 VIP 徐标在 main 之外。
  // main [class*="Title"] 排除 TitleCell（每行曲目都是 TitleCell，量大且只含歌名，
  // 不可能是要改名的页面标题；不排除会白遍历整个列表）。
  // 页面内 tab（.cmd-tabs-tab，标题后常带数字 <sup>，如「歌曲 50」）：
  // 只替换标题文字、保留数字。仅当剩余部分是数字时才匹配（避免「歌手详情」被「歌手」误伤）；
  // 命中 HIDE_TABS_RE 的 tab 会被隐藏，跳过改名。
  document.querySelectorAll('.cmd-tabs-tab').forEach((tab) => {
    const text = tab.textContent.replace(/\s+/g, '');
    if (HIDE_TABS_RE.test(text)) return;
    for (let i = 0; i < PAGE_TAB_RENAME.length; i++) {
      const from = PAGE_TAB_RENAME[i][0];
      const rest = text.slice(from.length);
      if (text === from || (text.startsWith(from) && /^\d/.test(rest))) {
        replaceTextDeep(tab, from, PAGE_TAB_RENAME[i][1], 0);
        break;
      }
    }
  });

  // 关注页（社区）左上角标题「关注」→ Following；右上角「发布」按钮隐藏
  const communityTitle = document.querySelector('#page_pc_community [class*="HeaderWrapper"] .title');
  if (communityTitle && communityTitle.textContent.trim() === '关注') {
    communityTitle.textContent = 'Following';
  }
  document.querySelectorAll('#page_pc_community button').forEach((btn) => {
    if (btn.textContent.trim() === '发布' && btn.style.display !== 'none') {
      btn.style.display = 'none';
    }
  });

  // 用户主页计数标签：关注 / 粉丝
  document.querySelectorAll('.sns-cnt .follow, .sns-cnt .fans').forEach((el) => {
    replaceTextDeep(el, '关注', 'Following', 0);
    replaceTextDeep(el, '粉丝', 'Followers', 0);
  });

  // 底部 bar 弹出的播放列表侧栏（#page_pc_playlist）：标题 + 收藏全部 / 清空
  const sheet = document.querySelector('#page_pc_playlist');
  if (sheet) {
    const sheetHead = sheet.querySelector('[class*="HeaderWrapper"] .left');
    if (sheetHead) replaceTextDeep(sheetHead, '播放列表', 'Queue', 0);
    sheet.querySelectorAll('[class*="HeaderWrapper"] .right .icon').forEach((ic) => {
      replaceTextDeep(ic, '收藏全部', 'Save All', 0);
      replaceTextDeep(ic, '清空', 'Clear', 0);
    });
  }

  // 专辑/歌单信息里的日期后缀：「2024-11-10创建」→「… Created」
  document.querySelectorAll('.time').forEach((el) => {
    replaceTextDeep(el, '创建', ' Created', 0);
    replaceTextDeep(el, '发布', ' Released', 0);
  });

  // 搜索页（#page_pc_search_result）：前缀类通用文案
  // （歌手：/ 歌单：/ 单曲: / 粉丝: / 播放：/ 播单：/ 的相关搜索如下）
  const searchRoot = document.querySelector('#page_pc_search_result');
  if (searchRoot) {
    const PREFIX_RENAME = [
      ['的相关搜索如下', 'Related searches'],
      ['歌手：', 'Artist: '], ['歌手:', 'Artist: '],
      ['歌单：', 'Playlist: '], ['歌单:', 'Playlist: '],
      ['单曲:', 'Songs: '], ['单曲：', 'Songs: '],
      ['粉丝:', ' Followers: '], ['粉丝：', ' Followers: '],
      ['播放：', 'Plays: '], ['播放:', 'Plays: '],
      ['播单：', 'Show: '], ['播单:', 'Show: '],
    ];
    searchRoot.querySelectorAll('*').forEach((el) => {
      for (let i = 0; i < el.childNodes.length; i++) {
        const node = el.childNodes[i];
        if (node.nodeType !== 3) continue;
        let t = node.textContent;
        PREFIX_RENAME.forEach(([from, to]) => { if (t.indexOf(from) !== -1) t = t.replace(from, to); });
        if (t !== node.textContent) node.textContent = t;
      }
    });
  }

  // 表格表头：`.th` 的 textContent 会混入排序提示（如「标题默认」），
  // 所以直接改里面的叶子 `.title`，并用单数表头名。
  const TH_RENAME = { '标题': 'Title', '专辑': 'Album', '喜欢': 'Likes', '时长': 'Duration', '热度': 'Plays' };
  document.querySelectorAll('main .th .title').forEach((el) => {
    const t = el.textContent.trim();
    if (TH_RENAME[t]) el.textContent = TH_RENAME[t];
  });

  const nodes = document.querySelectorAll(
    '[role="tab"], .cmd-tabs-tab, .cmd-tag, [class*="TagWrapper"], ' +
    '#contentContainer [class*="Tab"], #contentContainer [class*="Title"], ' +
    'main [class*="Tab"], main [class*="Title"]:not([class*="TitleCell"]), ' +
    'main [class*="TabSection"] button, main .tag .text, main button, h1, h2, h3'
  );
  nodes.forEach((el) => {
    const text = el.textContent.trim();
    if (HIDE_TABS_RE.test(text) || HIDE_TAG_RE.test(text)) {
      if (el.style.display !== 'none') el.style.display = 'none';
      return;
    }
    const next = RENAME_TEXT[text];
    if (!next) return;
    if (el.children.length) {
      // 图标 + 文字的按钮 / 带子节点的标题：只替换文字节点，别动子元素
      replaceTextDeep(el, text, next, 0);
    } else if (el.textContent !== next) {
      el.textContent = next;
    }
  });
  ensureVinylObserver();
  updateAlbumBg();
}

// ─────────────────────────────────────────────────────────────
// 全屏背景：Apple Music 式「模糊封面」
// 把当前封面的 URL 写进 --hush-album-cover 变量，CSS 侧用站点自己的
// CoverBackgroundContainer 当背景（不透明，不会露出普通页/侧边栏）。
// ─────────────────────────────────────────────────────────────
const ALBUM_BG_VAR = '--hush-album-cover';
let albumBgUrl = '';
let albumBgActive = false;
let vinylObserver = null;
let vinylTargets = [];
const vinylVisible = new WeakMap();
// 音乐封面 VinylCoverContainer / 播客（声音）封面 VoiceCoverContainer
const COVER_SELECTOR = '[class*="VinylCoverContainer"], [class*="VoiceCoverContainer"]';

function clearAlbumBg() {
  if (!albumBgUrl) return;
  albumBgUrl = '';
  document.documentElement.style.removeProperty(ALBUM_BG_VAR);
}

// 只有全屏封面可见时才写背景；换歌时由 renameItems 再触发一次更新。
function updateAlbumBg() {
  if (!albumBgActive) {
    clearAlbumBg();
    return;
  }
  const cover = coverEls().find((el) => el.getBoundingClientRect().width > 0);
  if (!cover) {
    clearAlbumBg();
    return;
  }
  // 按封面类型分别取图：逗号选择器列表是按“文档顺序”取第一个匹配，
  // 音乐封面里黑胶盘图的 <img> 会排在专辑封面 <img> 前面，不能用列表 / 裸 img 兜底。
  const isVoice = cover.matches('[class*="VoiceCoverContainer"]');
  const img = isVoice
    ? (cover.querySelector('.cover img') || cover.querySelector('img'))
    : cover.querySelector('[class*="CenterImg"][class*="Cover"] img');
  const src = img && (img.currentSrc || img.src);
  if (!src) {
    clearAlbumBg();
    return;
  }
  if (src !== albumBgUrl) {
    albumBgUrl = src;
    document.documentElement.style.setProperty(ALBUM_BG_VAR, `url("${src}")`);
  }
}

function setAlbumBgActive(active) {
  if (active === albumBgActive) return;
  albumBgActive = active;
  // 用我们自己维护的类驱动全屏底栏样式（站点会在 hover 退出按钮时摘掉 body.vinyl-mode）
  document.documentElement.classList.toggle('hush-vinyl-active', active);
  if (active) {
    updateAlbumBg();
    updateVinylBarMetrics();
  } else {
    clearAlbumBg();
    hideVinylBar();
  }
}

// 用 IntersectionObserver 判断全屏封面是否可见：全屏播放器在普通页常驻但 0×0，
// 可见性变化会回调，无需每秒 getBoundingClientRect（避免强制布局）。
// 音乐 / 播客两种封面容器都观察。
function coverEls() {
  return Array.prototype.slice.call(document.querySelectorAll(COVER_SELECTOR));
}

function ensureVinylObserver() {
  const els = coverEls();
  if (!els.length) return;
  const same = vinylObserver && els.length === vinylTargets.length &&
    els.every((el, i) => el === vinylTargets[i]);
  if (same) return;
  if (vinylObserver) vinylObserver.disconnect();
  vinylTargets = els;
  vinylObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      vinylVisible.set(e.target, e.isIntersecting && e.boundingClientRect.width > 0);
    });
    let any = false;
    vinylTargets.forEach((el) => { if (vinylVisible.get(el)) any = true; });
    setAlbumBgActive(any);
  });
  els.forEach((el) => vinylObserver.observe(el));
}

function stopVinylObserver() {
  if (vinylObserver) {
    vinylObserver.disconnect();
    vinylObserver = null;
  }
  vinylTargets = [];
  albumBgActive = false;
  document.documentElement.classList.remove('hush-vinyl-active');
}

// ─────────────────────────────────────────────────────────────
// 全屏底栏：平时隐藏控制键、只留进度条；鼠标靠近视口底部时滑出
// （具体隐藏/过渡规则在 SIDEBAR_CSS，这里只负责切 <html> 上的 class）
// ─────────────────────────────────────────────────────────────
const VINYL_BAR_CLASS = 'hush-vinyl-bar-show';
const VINYL_TOPBAR_CLASS = 'hush-vinyl-topbar-show';
const VINYL_BAR_ZONE = 120; // px：视口底部多高算「靠近」
const VINYL_TOP_ZONE = 120; // px：视口顶部多高算「靠近」（唤醒左上角退出按钮）
let vinylBarMoveHandler = null;
let vinylBarRaf = 0;

// 量一下底栏实际高度，写进 CSS 变量，供进度条下移用
function updateVinylBarMetrics() {
  const bar = document.querySelector('[class*="VinylPageBarWrapper"]');
  if (!bar) return;
  const h = Math.round(bar.getBoundingClientRect().height);
  if (h > 0) document.documentElement.style.setProperty('--hush-vinyl-bar-h', h + 'px');
}

function hideVinylBar() {
  if (vinylBarRaf) {
    cancelAnimationFrame(vinylBarRaf);
    vinylBarRaf = 0;
  }
  document.documentElement.classList.remove(VINYL_BAR_CLASS);
  document.documentElement.classList.remove(VINYL_TOPBAR_CLASS);
}

function startVinylBarWatcher() {
  if (vinylBarMoveHandler) return;
  updateVinylBarMetrics();
  vinylBarMoveHandler = (e) => {
    if (vinylBarRaf) return;
    vinylBarRaf = requestAnimationFrame(() => {
      vinylBarRaf = 0;
      const show = e.clientY >= window.innerHeight - VINYL_BAR_ZONE;
      const showTop = e.clientY <= VINYL_TOP_ZONE;
      document.documentElement.classList.toggle(VINYL_BAR_CLASS, show);
      document.documentElement.classList.toggle(VINYL_TOPBAR_CLASS, showTop);
    });
  };
  document.addEventListener('mousemove', vinylBarMoveHandler, { passive: true });
  document.documentElement.addEventListener('mouseleave', hideVinylBar);
  window.addEventListener('resize', updateVinylBarMetrics, { passive: true });
}

function stopVinylBarWatcher() {
  if (vinylBarMoveHandler) {
    document.removeEventListener('mousemove', vinylBarMoveHandler);
    document.documentElement.removeEventListener('mouseleave', hideVinylBar);
    window.removeEventListener('resize', updateVinylBarMetrics);
    vinylBarMoveHandler = null;
  }
  hideVinylBar();
}

function startRename() {
  if (renameObserver) return;
  renameItems();
  renameObserver = new MutationObserver(() => {
    if (renameTimer) return;
    renameTimer = window.setTimeout(() => {
      renameTimer = 0;
      renameItems();
    }, 400);
  });
  renameObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function stopRename() {
  if (renameObserver) {
    renameObserver.disconnect();
    renameObserver = null;
  }
  if (renameTimer) {
    clearTimeout(renameTimer);
    renameTimer = 0;
  }
  stopVinylObserver();
}

function enable() {
  applyHidden();
  applyDarkTheme();
  startRename();
  startVinylBarWatcher();
  lsSet(MIRROR_KEY, '1');
}

function disable() {
  removeHidden();
  applyLightTheme();
  stopRename();
  stopVinylBarWatcher();
  clearAlbumBg();
  lsSet(MIRROR_KEY, '0');
}

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || { enabled: true });
    });
  });
}

// 页面脚本执行前同步预判：镜像不是明确的 “0” 就先进深色（扩展默认开启）。
// 若随后从 chrome.storage 读到实际是关闭状态，会在 init 里立刻还原成浅色。
(function preApply() {
  try {
    if (lsGet(MIRROR_KEY) !== '0') {
      applyDarkTheme();
    }
  } catch (e) {
    /* 忽略 */
  }
})();

async function init() {
  const config = await getConfig();
  if (config.enabled) {
    enable();
  } else {
    disable();
  }
}

// 同步注册消息监听，避免 popup 在 getConfig 完成前点击时丢消息。
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateConfig') {
    if (request.enabled) {
      enable();
    } else {
      disable();
    }
    sendResponse({ success: true });
  }
});

init();
