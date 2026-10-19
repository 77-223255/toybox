# AGENTS.md

Setup and operating instructions for `netease-recommend`, written so that **any** coding agent can configure it from scratch without guessing.

Language: English (agent-facing). 中文速览见文末 [§9](#9-中文速览).

---

## 0. What you are setting up

A NetEase Cloud Music (网易云音乐) recommendation pipeline, shipped as an Agent Skill:

```
netease-recommend/
├── SKILL.md              # agent-facing skill descriptor
└── scripts/
    ├── ncm.mjs           # WEAPI client + cookie loading (only shared module)
    ├── doctor.mjs        # environment self-check
    ├── profile.mjs       # read whole library → taste profile
    ├── discover.mjs      # similar-artist graph → candidate pool
    └── apply.mjs         # clear playlist → fill 20 → rename → verify
```

Pure Node ESM. **No `package.json`, no `node_modules`, no build step.** Do not add dependencies.

Three hardcoded rules. Never change them unless the user explicitly asks:

| Rule | Where |
| --- | --- |
| Exactly **20** tracks per batch | `apply.mjs` → `BATCH` |
| **Clear then fill** (old batch is fully removed) | `apply.mjs` |
| **Rename the playlist every run** from that batch | `apply.mjs` → `/playlist/update/name` |

---

## 1. Prerequisites

Check, do not assume:

```bash
node --version            # need >= 18 (built-in fetch/crypto); tested on 26
command -v secret-tool    # optional, needed for Chromium cookie decryption on Linux
```

No other runtime is required. `mpv`, `yt-dlp`, downloaders: **not used** — this tool never plays or downloads audio.

---

## 2. Install

Install by **symlink**, so `git pull` propagates updates:

```bash
git clone https://github.com/77-223255/toybox.git
ln -s "$PWD/toybox/netease-recommend" ~/.pi/agent/skills/netease-recommend
```

Skills directory by client:

| Client | Path |
| --- | --- |
| pi | `~/.pi/agent/skills/<name>/` |
| Claude Code | `~/.claude/skills/<name>/` |
| Agent Skills spec (portable) | `~/.agents/skills/<name>/` |

Verify discovery (pi): `pi skills list` — `netease-recommend/` must appear.

---

## 3. Authentication

The scripts read a cookie file, not a login flow. Target file:

```
~/.config/neteasecli/profiles/default/session.json
{"MUSIC_U": "<token>"}
```

Pick the first path that applies.

### 3a. Windows / macOS / stock Google Chrome — the easy path

```bash
npm install -g neteasecli
# Log in at https://music.163.com/ in the browser first (no phone/SMS needed).
neteasecli auth login
neteasecli auth check
```

### 3b. Linux + Chromium — needs two workarounds

Both failures below are in `neteasecli` + `@steipete/sweet-cookie`, not in this repo.

1. It only searches `~/.config/google-chrome`, never `~/.config/chromium`.
2. It looks up the keyring as `service="Chrome Safe Storage"`, `account="Chrome"`, but Chromium stores it as **`application=chromium`** with a value that is *itself* the base64 text used as the PBKDF2 password.

Also note: `neteasecli auth login --profile <path>` does **not** work — the subcommand's `--profile` is shadowed by the global account-profile flag, so your path is silently dropped and you get `Chrome cookies database not found`. Call the auth manager directly instead:

```bash
npm install -g neteasecli

PKG="$(npm root -g)/neteasecli"
SECRET="$(secret-tool lookup application chromium)"

SWEET_COOKIE_CHROME_SAFE_STORAGE_PASSWORD="$SECRET" \
node --input-type=module -e "
import { getAuthManager } from '$PKG/dist/auth/manager.js';
await getAuthManager().importFromBrowser(process.env.HOME + '/.config/chromium/Default');
console.log('imported');
"

neteasecli auth check
```

`secret-tool lookup application chromium` should return a 24-char base64 string. If it returns nothing, the keyring is locked or a different `password-store` is in use — run `secret-tool search --all application chromium` to inspect, then fall back to 3c.

<details>
<summary>If decryption still fails: the exact Chromium scheme (Linux, DB version ≥ 24)</summary>

- cookie prefix `v11` → AES-128-CBC, IV = 16 spaces (`0x20`)
- key = `PBKDF2(password = the base64 TEXT as ASCII, salt = "saltysalt", iterations = 1, keylen = 16, sha1)`
- plaintext = 32-byte SHA-256 host hash **+** cookie value → strip the first 32 bytes
- `v10` uses the literal password `peanuts` with the same parameters

Sanity-check in one shot:

```bash
node --input-type=module -e "
import {deriveAes128CbcKeyFromPassword as d, decryptChromiumAes128CbcCookieValue as dec} from '$(npm root -g)/neteasecli/node_modules/@steipete/sweet-cookie/dist/providers/chromeSqlite/crypto.js';
import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(process.env.HOME+'/.config/chromium/Default/Cookies',{readOnly:true});
const r=db.prepare(\"select encrypted_value ev from cookies where name='MUSIC_U'\").get();
console.log(dec(new Uint8Array(r.ev),[d(process.argv[1],{iterations:1})],{stripHashPrefix:true}));
" "$SECRET"
"
```

</details>

### 3c. Manual fallback — no browser automation needed

1. Log in at `https://music.163.com/`.
2. DevTools → Application → Cookies → `https://music.163.com` → copy `MUSIC_U`.
3. Write it:

```bash
mkdir -p ~/.config/neteasecli/profiles/default
printf '{"MUSIC_U":"%s"}\n' "<paste>" > ~/.config/neteasecli/profiles/default/session.json
chmod 600 ~/.config/neteasecli/profiles/default/session.json
```

This is the most robust path and needs no `neteasecli` at all.

`MUSIC_U` expires after a few months. On expiry the client throws `code 301`; re-import.

---

## 4. Verify

```bash
cd netease-recommend/scripts
node doctor.mjs
```

Expected:

```
node v26.x
data /home/<user>/.local/share/netease-recommend

  ok   cookie MUSIC_U present (802 chars)
  ok   authenticated as <nickname> (<uid>)
  ok   3 playlists, 1481 liked tracks
  ok   target playlist: <title> (<id>), 20 tracks   # or "no target playlist yet"
  ...
Ready.
```

Exit code 1 + a `FAIL` line means not ready. Do not continue to §5.

---

## 5. Run the pipeline

```bash
cd netease-recommend/scripts

node profile.mjs            # ~1 min for 1500 liked tracks; 1-day cache; --force to rebuild
node discover.mjs           # ~60-90 s, ~45 requests; prints candidates JSON
#   read ~/.local/share/netease-recommend/profile.md      (compact taste digest)
#   read ~/.local/share/netease-recommend/candidates.json (candidate pool)
#   pick 20 ids, write {"ids":[...]} to /tmp/selection.json
node apply.mjs --name "<batch title>" --file /tmp/selection.json
```

`apply.mjs` exits non-zero and reports `missing: [...]` if the write did not land.

Step-by-step what the agent should do between `discover` and `apply`:

1. Read `profile.md` — note the core artists, followed artists, saved albums, existing playlists, recent plays.
2. Read `candidates.json` — each candidate carries `source` (`new-artist` / `deep-cut` / `similar-song`), `why`, and `artistScore`.
3. Prefer `new-artist` and high `cooccur`. Skip artists the user obviously already knows even if absent from the library (global hits). Include a few `deep-cut` for familiarity anchors.
4. Make the 20 an *arc*, not 20 interchangeable tracks.
5. Title the batch in Chinese, ~10–20 characters, derived from this specific batch.
6. Write the selection file, run `apply.mjs`, report the playlist URL plus per-track reasons, and call out which artists are new faces.

---

## 6. Environment overrides

| Variable | Default | Effect |
| --- | --- | --- |
| `NCM_SESSION` | `~/.config/neteasecli/profiles/default/session.json` | cookie file |
| `NCM_DATA_DIR` | `~/.local/share/netease-recommend` | profile / candidates / playlist state |
| `NCM_PLAYLIST` | `AI 推荐` | name used only when creating the playlist the first time |
| `NCM_PROFILE_CACHE_DAYS` | `1` | `profile.mjs` cache TTL |
| `NCM_MIN_INTERVAL_MS` | `180` | request floor; lower it and NetEase will start throttling |

---

## 7. API gotchas

All verified against the live service. NetEase breaks endpoints quietly; consult this table before adding a request.

| Symptom | Reality | Use instead |
| --- | --- | --- |
| `/weapi/playlist/track/all` → `404 接口未找到` | not a weapi path | `/weapi/v6/playlist/detail` `{id, n, s:8}` → `playlist.trackIds` / `playlist.tracks` |
| `/playlist/update`, `/playlist/name/update`, `/api/playlist/update`, `/weapi/playlist/name/update` → `404` | all gone | **`/weapi/playlist/update/name`** `{id, name}` |
| eapi `/api/playlist/update` → `URL Is Not Allowed To Access` | eapi allowlist | do not use eapi here |
| `/playlist/delete` with `/api` prefix → `400 请求参数错误` | wrong prefix | `/weapi/playlist/delete` `{id}` |
| `/artist/top/song` with `/api` prefix → `400` | wrong prefix | `/weapi/artist/top/song` `{id}` → `songs[]` |
| playlist "duplicated" after a rename | lookups by name fail once renamed | track `playlist.json` by **ID** only |
| `simiArtist` → `{artists: [], code: 200}` | stale/duplicate artist id | use the id from `/song/like/get` → `/v3/song/detail`, not a hand-typed one |
| `/v1/play/record` returns nothing useful | `type` switches the field | `type:1` → `weekData`, `type:0` → `allData` |
| `/v3/song/detail` returns no songs | payload shape | `c: JSON.stringify(ids.map(id => ({id})))`, ≤300 per call |
| `code 301` on any call | cookie expired | re-run §3 |

Notes that save time:

- `csrf_token` is **not** required for any endpoint used here (verified with a `MUSIC_U`-only cookie file). `ncm.mjs` sends it only if `__csrf` happens to be present.
- `simiArtist` returns ~20 artists per call and is the single highest-value endpoint: from 14 seed artists it surfaces ~229 candidates.
- `simiSong` caps out around `limit: 10`.
- Writes need ~0.8–1.2 s to become visible; `apply.mjs` already sleeps before verifying.
- Keep `NCM_MIN_INTERVAL_MS ≥ 180`. Bulk-crawling gets you soft-banned.

---

## 8. Troubleshooting

| Error | Cause | Fix |
| --- | --- | --- |
| `No NetEase session at …` | cookie file missing | §3 |
| `Chrome cookies database not found` | `neteasecli` looks for `google-chrome` only, or `--profile` was shadowed | §3b (call the manager directly) |
| `expected exactly 20 tracks, got N` | wrong batch size | this is intentional — supply 20 |
| `missing: [...]` after `apply` | track unavailable in region / VIP-only | drop those ids and retry with replacements |
| `duplicate track ids in batch` | same song twice | dedupe |
| Profile looks stale | 1-day cache | `node profile.mjs --force` |

---

## 9. 中文速览

**这是什么** —— 让 AI 读完你的网易云音乐库（红心 / 歌单 / 关注歌手 / 收藏专辑 / 最近播放），顺着**相似音乐人图谱**挖你没听过的音乐人，把 **20 首**换进同一个歌单，歌单名每次跟着这批歌改。清空旧的全部再放新的，旧曲下次可能再回来。

**依赖** —— 只有 Node.js ≥ 18，**零 npm 依赖**。不播放、不下载音频。可选 `neteasecli`（自动导 cookie）、Chromium、`secret-tool`。

**安装** ——

```bash
git clone https://github.com/77-223255/toybox.git
ln -s "$PWD/toybox/netease-recommend" ~/.pi/agent/skills/netease-recommend
```

**认证** —— 读 `~/.config/neteasecli/profiles/default/session.json` 里的 `MUSIC_U`。

- 最简单：浏览器登录 music.163.com → DevTools 里复制 `MUSIC_U` → 手写进上面那个 json。
- 自动：`npm i -g neteasecli && neteasecli auth login`。
- **Linux + Chromium 会失败**，有两个坑：它只找 `~/.config/google-chrome`；keyring 实际存在 `application=chromium` 下。而且 `--profile` 被全局选项吃掉。正确做法见 §3b——直接调 auth manager 并传 `SWEET_COOKIE_CHROME_SAFE_STORAGE_PASSWORD="$(secret-tool lookup application chromium)"`。

**验证** —— `node doctor.mjs`，出现 `Ready.` 才继续。

**跑一遍** ——

```bash
cd scripts
node profile.mjs     # 读全库（1 天缓存，--force 强刷）
node discover.mjs    # 挖候选
node apply.mjs --name "歌单标题" --file selection.json
```

**三条铁律** —— 一次 20 首；先清空再写入；歌单名每次都改（所以只认 ID，不认名字）。

**在 agent 里怎么用** —— 说「更新一下推荐歌单」即可，或 `/skill:netease-recommend`。
