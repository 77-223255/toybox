---
name: netease
description: 网易云音乐通用操作：搜索歌曲/专辑/歌手/歌单，读专辑曲目、歌手热门曲、歌单内容、歌词，以及创建歌单、加歌、删歌、清空、改名。单个零依赖 Node CLI，任何 agent 都能直接调用。当用户要求查网易云、点歌、整理/创建/编辑网易云歌单时使用。
---

# 网易云音乐（netease）

一个零依赖的 Node CLI，把网易云音乐网页接口包成 13 个命令。不播放、不下载音频，只读写数据与歌单。

```bash
node scripts/ncm-cli.mjs <command> [args] [--flags]
```

所有命令输出**一个 JSON 对象**（stdout），失败时 stderr 输出 `{"ok":false,"error":...}` 并 exit 1。

## 0. 自检

```bash
node --version                 # 需要 >= 18（内置 fetch/crypto）
node scripts/ncm-cli.mjs auth   # {"authed":true,"uid":...,"nickname":...}
```

`authed:false` 时只能做公开查询（搜索、专辑、歌词、公开歌单），**不能**建歌单/加歌。认证见 [`README.md`](./README.md#认证)。

## 1. 查

| 命令 | 说明 |
| --- | --- |
| `search <query> --type song\|album\|artist\|playlist --limit 10` | 搜索，返回 `items[]`（歌带 `popularity`） |
| `album <albumId>` | 专辑元信息 + 完整曲目（按碟序，带 `trackNumber`） |
| `artist <artistId> --top 10` | 歌手信息 + 热门曲 |
| `playlist <playlistId>` | 歌单元信息 + 全部曲目（`--limit n` 截断） |
| `songs <id...>` / `--file ids.json` | 批量取歌详情，含 `popularity`（0–100） |
| `lyrics <songId>` | 原文 + 中文翻译（LRC） |
| `me` | 当前账号 + 自己的全部歌单（含 ID、曲目数） |

## 2. 写（需登录）

| 命令 | 说明 |
| --- | --- |
| `create <name> [--private]` | 建歌单，返回新 `id` 与链接 |
| `add <playlistId> <songId...>` / `--file ids.json` | 追加歌曲（自动按 200 首分批） |
| `del <playlistId> <songId...>` / `--file ids.json` | 移除歌曲 |
| `clear <playlistId>` | 清空歌单所有曲目 |
| `rename <playlistId> <name>` | 改名 |

`--file` 接受 `["123","456"]` 或 `{"ids":["123","456"]}`。写完后命令会重新读取歌单，返回真实 `trackCount` —— 上游写入有延迟，以读回的曲目数为准。

## 3. 典型流程

**按清单建歌单**（例如「某榜单 100 张专辑」）：

1. `search "<歌手> <专辑>" --type album` 找到 `albumId`（搜不到就只用专辑名再搜一次）
2. `album <albumId>` 拿曲目 → 取 `trackNumber === 1` 的曲子
3. `songs <该专辑全部 id>` 读 `popularity` → 取热度最高的一首当代表作
4. 汇总去重（同一 id 只留一次），写进 `ids.json`
5. `create "<歌单名>"` → `add <playlistId> --file ids.json`
6. 汇报：歌单链接 + 曲目数 + 缺失项

**编辑已有歌单**：`me` 找 ID → `playlist <id>` 看现状 → `add` / `del` / `rename`。

## 4. 坑

- **搜索会漏**：`cloudsearch` 对「歌手 + 日文专辑名」这种混排长 query 常常给 0 条，脚本已自动回落到 `/search/get`；仍为 0 时把 query 拆短（只留专辑名、或换英文团名，如 `はっぴいえんど` → `Happy End`）。
- **专辑详情必须用 `/v1/album`**：`/album` 不返回曲目。
- **`popularity` 是相对热度 0–100**，跨年代不可比（70 年代盘往往只有 20–40），只在同一张专辑内比较。
- **单次 `manipulate/tracks` 上限约 200 首**，脚本已分批；不要自己拼一个 1000 的数组。
- **`code 301` / `-462` = 登录态失效**，重新导入 `MUSIC_U`。
- **接口有节流**：默认请求间隔 180ms（`NCM_MIN_INTERVAL_MS`），别并发轰炸。
- **新歌会插到最前**：`add` 一批 ids 会得到倒序的歌单（网易云逐首插到第 1 位）。要按清单顺序排，先 `clear` 再按**反转后的 ids** 追加。
- **歌单只认 ID**：歌单名可以随时改，别用名字定位。
- **没有删歌单接口**：不提供删除，避免误删用户数据。

## 5. 不要做

- 不下载音频、不转发付费链接、不绕过会员/版权/地区限制
- 不动用户其它歌单，也不改红心
- 不擅自 `clear` 一个已有内容的歌单（除非用户明确要求「整批换掉」）
