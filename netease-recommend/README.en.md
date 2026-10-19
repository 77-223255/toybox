# netease-recommend

Let an AI read your NetEase Cloud Music (网易云音乐) library, walk the **similar-artist graph** to surface artists you have never heard, and swap 20 tracks into one playlist — a fresh batch each time, with the playlist renamed to match that batch.

Ships as an [Agent Skill](https://agentskills.io/specification). Once it sits in your skills directory, any skill-aware agent (pi / Claude Code / …) can trigger it with a single sentence.

中文: [`README.md`](./README.md)

## Fixed rules

| Rule | Value |
| --- | --- |
| Tracks per batch | **20** (hardcoded as `BATCH` in `scripts/apply.mjs`) |
| Update strategy | Clear the old batch, then write the new one (`op: del` → `op: add`) |
| Playlist name | **Renamed every run**, derived from that batch |
| Old tracks | Not blocklisted — they can return in a later batch |
| Audio | Never played or downloaded; playlists only |

## What it reads

- Liked (hearted) tracks
- Your own and saved playlists, with their tracks
- Followed artists
- Saved albums
- Recent plays (this week + all time)

Condensed into a taste profile: `profile.md` (compact, for the model) and `profile.json` (full, for the scripts).

A typical library yields ~1500 liked tracks, 70 followed artists, 445 saved albums, 414 known artists.

## Dependencies

**Required**

- **Node.js ≥ 18** — only built-in `fetch` / `crypto` / `fs`; tested on Node 26
- **A `MUSIC_U` cookie from a NetEase account** — see [Authentication](#authentication)
- **Zero npm dependencies** — no `package.json`, no `node_modules`

**Optional (authentication only)**

- `neteasecli` (global npm package) — imports cookies from your browser
- Chromium / Chrome / Firefox — the cookie source
- `secret-tool` (`libsecret` on Arch) — Chromium's cookie key on Linux

**Not needed:** `mpv` or any downloader.

## Install

```bash
git clone https://github.com/77-223255/toybox.git
```

Then symlink the tool directory into your agent's skills directory, so `git pull` keeps it current:

```bash
# pi
ln -s "$PWD/toybox/netease-recommend" ~/.pi/agent/skills/netease-recommend

# Claude Code
ln -s "$PWD/toybox/netease-recommend" ~/.claude/skills/netease-recommend

# generic Agent Skills location
ln -s "$PWD/toybox/netease-recommend" ~/.agents/skills/netease-recommend
```

## Authentication

Shortest path (macOS / Windows / stock Chrome):

```bash
npm i -g neteasecli
# log in at https://music.163.com/ in your browser first
neteasecli auth login
```

Linux + Chromium needs two workarounds (different keyring attribute, and `--profile` colliding with a global flag). Full steps in [`AGENTS.md`](./AGENTS.md#3-authentication). The pragmatic fallback is to copy `MUSIC_U` out of DevTools and write:

```json
// ~/.config/neteasecli/profiles/default/session.json
{ "MUSIC_U": "…" }
```

## Usage

```bash
cd scripts
node doctor.mjs     # self-check: cookie / account / target playlist / caches
node profile.mjs    # read the whole library → profile (1-day cache, --force, ~1 min)
node discover.mjs   # similar-artist graph → candidate pool (--seeds 14 --artists 28 --deep 6)
node apply.mjs --name "playlist title" --file selection.json
```

`selection.json` looks like `{"ids": ["123", "456", …]}` and must contain exactly 20 ids.

Inside an agent, just say **"更新一下推荐歌单"** (refresh the recommendation playlist), or invoke `/skill:netease-recommend` explicitly.

## How it works

1. **Weight the profile** — followed 5 / saved album 4 / liked 3 / playlist 2 / recent 1
2. **Walk the graph** — starting from your 14 highest-weighted artists, hit `/discovery/simiArtist`; ~229 similar artists come back. Drop anyone already in your library, then rank by **how many** of your artists point at them — co-occurrence beats any single similarity edge.
3. **Collect tracks** — `/artist/top/song` for each surviving new artist, plus `deep-cut` (unheard songs by artists you already love) and `similar-song` (neighbours of liked tracks). ~120 candidates.
4. **Let the model choose** — read `profile.md` + `candidates.json`, pick 20, justify each, name the batch.
5. **Apply** — clear → fill → rename → verify.

## Output files

| Path | Content |
| --- | --- |
| `~/.local/share/netease-recommend/profile.json` | Full profile (~190 KB) |
| `~/.local/share/netease-recommend/profile.md` | Compact digest (~9 KB, read by the model) |
| `~/.local/share/netease-recommend/candidates.json` | Candidate pool |
| `~/.local/share/netease-recommend/playlist.json` | Target playlist ID |

The playlist is tracked by ID, never by name — renaming it does not create a new playlist.

## Contributing

- One subdirectory per tool, each with its own `README.md`; add a matching row to the root `README.md` index table.
- Pure Node ESM. **Do not add npm dependencies** — being copy-pasteable onto any machine is the whole point.
- Run `node doctor.mjs` first, then a full `profile → discover → apply` pass before changing endpoints.
- Use English conventional commit messages (`feat:` / `fix:` / `docs:`), matching repo history.
- When adding or changing an API endpoint, record it under Gotchas in [`AGENTS.md`](./AGENTS.md#5-api-gotchas) — NetEase endpoints break quietly and that file is where the scars live.

## License

MIT — see [`LICENSE`](../LICENSE) at the repository root.
