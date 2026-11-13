# netease

一个零依赖的网易云音乐 CLI，作为 [Agent Skill](https://agentskills.io/specification) 提供给**任何** agent（pi / Claude Code / Codex / OpenCode / 自建 agent）。

搜索、读专辑/歌手/歌单/歌词，创建歌单、加歌、删歌、清空、改名。不播放、不下载音频。

- 纯 Node ESM，**没有 `package.json`、没有 `node_modules`、没有构建步骤** —— 拷过去就能跑
- 所有输出是 JSON，agent 直接解析
- 认证只依赖一个 cookie 文件，不需要浏览器自动化

## 安装

```bash
git clone https://github.com/77-223255/toybox.git
```

把目录软链到你的 agent 的 skills 目录（软链的好处：`git pull` 即更新）：

```bash
# pi
ln -s "$PWD/toybox/netease" ~/.pi/agent/skills/netease

# Claude Code
ln -s "$PWD/toybox/netease" ~/.claude/skills/netease

# Agent Skills 通用位置（Codex / OpenCode / 其它）
ln -s "$PWD/toybox/netease" ~/.agents/skills/netease
```

不需要 skill 机制的 agent，直接读 [`SKILL.md`](./SKILL.md) 当说明书，或把 `scripts/` 拷到任何地方调用。

## 认证

脚本按顺序找 cookie：

1. `NCM_COOKIE` 或 `MUSIC_U` 环境变量（`"MUSIC_U=...; __csrf=..."`）
2. `$NCM_SESSION` 指向的 json 文件
3. `~/.config/neteasecli/profiles/default/session.json`

```json
// ~/.config/neteasecli/profiles/default/session.json
{ "MUSIC_U": "…" }
```

**最短路径**：浏览器登录 <https://music.163.com/> → DevTools → Application → Cookies → 复制 `MUSIC_U` → 写进上面那个文件（`chmod 600`）。`MUSIC_U` 几个月过期，过期后接口报 `code 301`，重新导一次。

### 从浏览器自动导入（可选）

```bash
npm install -g neteasecli      # Windows / macOS / 原生 Chrome
neteasecli auth login          # 需先在浏览器登录 music.163.com
```

Linux + Chromium 需要两处绕法（keyring 键名是 `application=chromium`；`auth login --profile` 会被全局 `--profile` 吃掉），完整脚本见 [`../netease-recommend/AGENTS.md`](../netease-recommend/AGENTS.md#3-authentication)。手动兜底永远可用。

## 命令

```bash
cd scripts
node ncm-cli.mjs auth                     # 我是谁
node ncm-cli.mjs me                       # 账号 + 全部歌单
node ncm-cli.mjs search "椎名林檎" --type song --limit 5
node ncm-cli.mjs album 2108583            # 专辑 + 完整曲目
node ncm-cli.mjs artist 5285 --top 10
node ncm-cli.mjs playlist 18436577369      # 歌单 + 曲目
node ncm-cli.mjs songs 22654756 22654754   # 批量详情（含 popularity）
node ncm-cli.mjs lyrics 22654754           # 歌词 + 翻译

node ncm-cli.mjs create "我的新歌单"
node ncm-cli.mjs add <playlistId> --file ids.json
node ncm-cli.mjs del <playlistId> 123 456
node ncm-cli.mjs clear <playlistId>
node ncm-cli.mjs rename <playlistId> "新名字"
```

`node ncm-cli.mjs help` 打印全部命令。

## 例：把一份榜单变成歌单

```bash
# 1. 找专辑
node ncm-cli.mjs search "RCサクセション Rhapsody" --type album --limit 1

# 2. 读曲目，取第一首
node ncm-cli.mjs album 2082676 | jq -r '.tracks[] | "\(.trackNumber)\t\(.id)\t\(.name)"'

# 3. 同一张专辑里挑热度最高的当代表作
node ncm-cli.mjs songs 22654756 22654754 | jq '.songs[] | {id,name,popularity}'

# 4. 建 + 灌
node ncm-cli.mjs create "日本摇滚百佳 · 一辑一首"
node ncm-cli.mjs add <playlistId> --file ids.json
```

## 输出约定

- 成功：`{"ok":true, ...}`；失败：stderr `{"ok":false,"error":"..."}` + exit 1
- `popularity` 是 0–100 的**相对**热度，只在同一张专辑内比较有意义（70 年代的盘整张都在 20–40）
- 写入后命令会重新读回歌单，`trackCount` 是上游的真实结果 —— 网易云写入有延迟，以读回为准
- 歌曲 ID / 专辑 ID / 歌单 ID 全部按字符串处理

## 已知限制

- `cloudsearch` 对「歌手 + 日文专辑名」的长 query 常给 0 条，脚本自动回落 `/search/get`；仍为 0 就拆短 query（`はっぴいえんど` → `Happy End`）
- `/album` 不返回曲目，必须用 `/v1/album`
- 单次 `playlist/manipulate/tracks` 上限约 200 首，脚本自动分批
- 追加的曲目会插到歌单**最前面**（逐首插到第 1 位），所以一次 `add` 一批 ids 出来是**倒序** —— 要正序就先 `clear` 再反序 `add`
- 接口有节流，默认请求间隔 180ms（`NCM_MIN_INTERVAL_MS`）
- 不提供删除歌单接口（避免误删）

## License

MIT —— 见仓库根目录 [`LICENSE`](../LICENSE)。
