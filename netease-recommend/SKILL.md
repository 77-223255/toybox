---
name: netease-recommend
description: 更新网易云音乐的「AI 推荐」歌单——读取用户全部音乐收藏与偏好（红心/歌单/关注歌手/收藏专辑/最近播放），用相似音乐人图谱发掘没听过的音乐人，挑 20 首替换进一个固定歌单并把歌单改名。仅当用户明确要求更新/刷新/换一批网易云推荐歌单时使用。
---

# 网易云 AI 推荐歌单

把用户音乐库里的一切读一遍，顺着**相似音乐人图谱**挖出他没听过的音乐人，选 **20 首** 换进同一个歌单，歌单名改成这批歌的内容概括。

**三条铁律**（不要改）：每次 **20 首**；**清空旧的全部再放新的**；**歌单名每次都改**。

所有命令在**本 skill 目录的 `scripts/`** 下用 `node` 执行。

## 1. 自检

```bash
node scripts/doctor.mjs
```

必须出现 `Ready.`。出现 `FAIL` 或缺 cookie 时，按 `AGENTS.md` 的认证章节处理（Linux + Chromium 有两个坑），**不要**继续。

## 2. 读画像（默认缓存 1 天）

```bash
node scripts/profile.mjs            # 加 --force 强制重建；约 1 分钟
```

读 `~/.local/share/netease-recommend/profile.md` —— 给模型看的紧凑摘要：核心歌手权重、关注歌手、收藏专辑、歌单构成、最近播放。
权重 = 关注 5 / 收藏专辑 4 / 红心 3 / 歌单 2 / 最近 1。

## 3. 顺着相似图谱挖候选

```bash
node scripts/discover.mjs           # 可选 --seeds 14 --artists 28 --deep 6
```

读打印结果或 `~/.local/share/netease-recommend/candidates.json`。三类来源：

- `new-artist` —— 从最核心的歌手出发的相似歌手，**用户没听过的**，取其热门曲
- `deep-cut` —— 用户常听的歌手，但还没收藏的歌
- `similar-song` —— 用户收藏歌曲的相似曲

每个候选带 `why`（相似于谁、几个歌手同时指向）和 `artistScore`。

## 4. 你来选 20 首

- **优先 `new-artist`**，这是这个歌单的意义；看 `cooccur`，多个常听歌手同时指向的优先
- 剔除用户**肯定听过**的全球大热（Nirvana / Oasis / Led Zeppelin 一类），哪怕不在库里
- 留 2~4 首 `deep-cut` 做熟悉锚点
- 20 首要成**一条弧线**，不是 20 首同质曲
- 参考 `profile.md` 里用户已有歌单（如 "POSITIVE & FUTURE"）和关注歌手 —— 那是显式偏好
- 每首写一句给用户看的理由
- 歌单标题 = 这批歌的内容概括，中文，10~20 字，带画面感

## 5. 写入

```bash
# /tmp/selection.json = {"ids": ["123", "456", ...]}   必须正好 20 个
node scripts/apply.mjs --name "歌单标题" --file /tmp/selection.json
```

脚本会：清空旧曲 → 加新曲 → 改名 → 校验，输出 `ok: true`。
歌单按 **ID** 记录在 `~/.local/share/netease-recommend/playlist.json`，**不要**靠名字找它（名字每次都变）。

## 6. 报告

给用户：歌单标题、链接（`https://music.163.com/#/playlist?id=<playlistId>` 取自输出）、20 首清单（歌名 — 音乐人 + 一句理由），并点出**哪几位是新面孔**。

## 不要做

- 不下载音频、不播放
- 不动用户其它歌单、不改红心
- 不改 20 这个数量和「先清空」的行为
