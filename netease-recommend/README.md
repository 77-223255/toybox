# netease-recommend

让 AI 读懂你的网易云音乐库，顺着**相似音乐人图谱**挖出你还没听过的音乐人，把 20 首一次性换进同一个歌单——每次换一批，歌单名也跟着这批歌换。

以 [Agent Skill](https://agentskills.io/specification) 形式提供。装进 skills 目录后，任何支持 skills 的 agent（pi / Claude Code / …）都能用一句「更新一下推荐歌单」触发。

English: [`README.en.md`](./README.en.md)

## 固定规则

| 规则 | 值 |
| --- | --- |
| 每次曲目数 | **20**（写死在 `scripts/apply.mjs` 的 `BATCH`） |
| 更新方式 | 先清空旧曲，再写入新批（`op: del` → `op: add`） |
| 歌单名 | **每次都改**，取自这批歌的内容概括 |
| 旧曲 | 不永久排除，后续批次可能再进来 |
| 音频 | 不播放、不下载，只读写歌单 |

## 它读取什么

- 红心歌曲
- 自建 / 收藏歌单及其曲目
- 关注的歌手
- 收藏的专辑
- 最近播放（本周 + 全部）

汇总成一张口味画像：`profile.md`（紧凑，给模型读）+ `profile.json`（全量，给脚本读）。

当前实现能拿到约 1500 首红心、70 位关注歌手、445 张收藏专辑、414 位已知歌手。

## 依赖

**必需**

- **Node.js ≥ 18** —— 只用内置 `fetch` / `crypto` / `fs`；仅在 Node 26 实测
- **一个网易云账号的 `MUSIC_U` cookie** —— 见[认证](#认证)
- **零 npm 依赖** —— 没有 `package.json`，没有 `node_modules`

**可选（仅认证环节用）**

- `neteasecli`（npm 全局包）—— 从浏览器自动导入 cookie
- Chromium / Chrome / Firefox —— cookie 来源
- `secret-tool`（Arch: `libsecret`）—— Linux 上 Chromium cookie 的解密密钥

**不需要** `mpv` 或任何下载工具。

## 安装

```bash
git clone https://github.com/77-223255/toybox.git
```

然后把工具目录链进 agent 的 skills 目录（用软链，`git pull` 即可自动更新）：

```bash
# pi
ln -s "$PWD/toybox/netease-recommend" ~/.pi/agent/skills/netease-recommend

# Claude Code
ln -s "$PWD/toybox/netease-recommend" ~/.claude/skills/netease-recommend

# 通用 Agent Skills 位置
ln -s "$PWD/toybox/netease-recommend" ~/.agents/skills/netease-recommend
```

## 认证

最短路径（macOS / Windows / 标准 Chrome）：

```bash
npm i -g neteasecli
# 先在浏览器登录 https://music.163.com/
neteasecli auth login
```

Linux + Chromium 需要两处绕法（keyring 键名不同、`--profile` 撞全局选项），完整步骤见 [`AGENTS.md`](./AGENTS.md#3-authentication)。最省事的手动兜底：浏览器 DevTools 复制 `MUSIC_U`，写进

```json
// ~/.config/neteasecli/profiles/default/session.json
{ "MUSIC_U": "…" }
```

## 使用

```bash
cd scripts
node doctor.mjs     # 自检：cookie / 账号 / 目标歌单 / 缓存
node profile.mjs    # 读全库 → 画像（1 天缓存，--force 强刷，约 1 分钟）
node discover.mjs   # 相似图谱 → 候选池（可选 --seeds 14 --artists 28 --deep 6）
node apply.mjs --name "歌单标题" --file selection.json
```

`selection.json` 形如 `{"ids": ["123", "456", …]}`，必须正好 20 个。

在 agent 里只需说：**「更新一下推荐歌单」**，或显式 `/skill:netease-recommend`。

## 工作原理

1. **画像加权** —— 关注 5 / 收藏专辑 4 / 红心 3 / 歌单 2 / 最近播放 1
2. **顺图谱挖人** —— 从权重最高的 14 位歌手出发打 `/discovery/simiArtist`，一次能收 ~229 位相似歌手；剔掉库内已有的，按「被几个你常听的歌手**同时**指向」排序（共现次数是比单次相似更强的信号）
3. **取歌** —— 对留下的新歌手取 `/artist/top/song`；另外补 `deep-cut`（老爱将的遗珠）和 `similar-song`（红心歌的相似曲），共约 120 个候选
4. **模型挑选** —— 模型读 `profile.md` + `candidates.json`，挑 20 首、给每首写理由、给整批起名
5. **写入** —— 清空 → 写入 → 改名 → 校验

## 输出文件

| 路径 | 内容 |
| --- | --- |
| `~/.local/share/netease-recommend/profile.json` | 全量画像（~190 KB） |
| `~/.local/share/netease-recommend/profile.md` | 紧凑摘要（~9 KB，给模型读） |
| `~/.local/share/netease-recommend/candidates.json` | 候选池 |
| `~/.local/share/netease-recommend/playlist.json` | 目标歌单 ID |

歌单名每次都变，所以只认 ID —— 改名不会让它变成「另一个歌单」。

## 仓库贡献

- 每个工具一个子目录，自带 `README.md`；根 `README.md` 的目录表要同步加一行。
- 纯 Node ESM，**不要引入 npm 依赖** —— 这是它能拷到任何机器直接跑的原因。
- 改接口先跑 `node doctor.mjs`，再走一次完整的 `profile → discover → apply`。
- Commit message 用英文 conventional 风格（`feat:` / `fix:` / `docs:`），与仓库历史一致。
- 新增或改动 API 端点，请补进 [`AGENTS.md`](./AGENTS.md#5-api-gotchas) 的 Gotchas —— 网易云接口会悄悄失效，这里记的是踩过的坑。

## License

MIT
