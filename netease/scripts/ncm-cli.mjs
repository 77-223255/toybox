#!/usr/bin/env node
// ncm-cli — one small CLI over the NetEase Cloud Music web API.
// Every command prints a single JSON object on stdout; errors go to stderr with exit 1.
//
//   node ncm-cli.mjs auth | me | search | songs | album | artist | playlist
//                    | lyrics | create | add | del | clear | rename
//
// Run `node ncm-cli.mjs help` for the full list.
import fs from 'node:fs';
import { api, authed, norm, chunk, SESSION_FILE } from './ncm.mjs';

const TYPES = { song: 1, album: 10, artist: 100, playlist: 1000 };
const SEARCH_KEYS = { 1: 'songs', 10: 'albums', 100: 'artists', 1000: 'playlists' };

function die(msg, extra) {
  const out = { ok: false, error: msg };
  if (extra) Object.assign(out, extra);
  console.error(JSON.stringify(out, null, 2));
  process.exit(1);
}

function parseArgs(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else args.push(a);
  }
  return { args, flags };
}

function requireAuth() {
  if (!authed) die(`not logged in: no MUSIC_U cookie (looked at $NCM_COOKIE, $NCM_SESSION, ${SESSION_FILE})`);
}

async function trackByIds(ids) {
  const out = [];
  for (const part of chunk(ids, 100)) {
    const r = await api('/v3/song/detail', { c: JSON.stringify(part.map((id) => ({ id: String(id) }))) });
    out.push(...(r.songs || []).map(norm.track));
  }
  return out;
}

async function playlistFull(id) {
  const r = await api('/v6/playlist/detail', { id: String(id), n: 1000, s: 0 });
  const p = r.playlist;
  if (!p) throw new Error(`playlist ${id} not found`);
  return {
    id: String(p.id),
    name: p.name,
    trackCount: p.trackCount,
    creator: p.creator ? { id: String(p.creator.userId), name: p.creator.nickname } : null,
    updateTime: p.updateTime,
    url: `https://music.163.com/#/playlist?id=${p.id}`,
    tracks: (p.tracks || []).map(norm.track),
  };
}

const cmd = {
  help() {
    return {
      usage: 'node ncm-cli.mjs <command> [args] [--flags]',
      commands: {
        auth: 'who is logged in (no args)',
        me: 'account + own playlists',
        'search <query>': '--type song|album|artist|playlist  --limit 10',
        'songs <id...> | --file ids.json': 'song details incl. popularity',
        'album <albumId> [--tracks]': 'album meta + track list',
        'artist <artistId> [--top 20]': 'artist meta + top songs',
        'playlist <playlistId>': 'playlist meta + tracks',
        'lyrics <songId>': 'lyrics (+ translation)',
        'create <name> [--private]': 'create a playlist',
        'add <playlistId> <songId...> | --file ids.json': 'append tracks',
        'del <playlistId> <songId...> | --file ids.json': 'remove tracks',
        'clear <playlistId>': 'remove every track',
        'rename <playlistId> <name>': 'rename a playlist',
      },
      auth: `cookie from $NCM_COOKIE, $NCM_SESSION, or ${SESSION_FILE}`,
    };
  },

  async auth() {
    if (!authed) return { ok: true, authed: false, session: SESSION_FILE };
    const r = await api('/nuser/account/get');
    const p = r.profile || {};
    return { ok: true, authed: true, uid: String(p.userId), nickname: p.nickname, session: SESSION_FILE };
  },

  async me({ flags }) {
    requireAuth();
    const acc = await api('/nuser/account/get');
    const uid = String(acc.profile.userId);
    const r = await api('/user/playlist', { uid, limit: 1000, offset: 0 });
    return {
      ok: true,
      uid,
      nickname: acc.profile.nickname,
      playlists: (r.playlist || []).map((p) => ({
        id: String(p.id),
        name: p.name,
        trackCount: p.trackCount,
        own: String(p.userId) === uid,
        special: { 0: 'liked', 5: 'created' }[String(p.specialType)] || null,
      })),
    };
  },

  async search({ args, flags }) {
    const query = args.join(' ');
    if (!query) die('search needs a query');
    const type = flags.type || 'song';
    const t = TYPES[type];
    if (!t) die(`--type must be one of ${Object.keys(TYPES).join(', ')}`);
    const limit = Number(flags.limit || 10);
    const offset = Number(flags.offset || 0);
    // cloudsearch ranks better; /search/get finds a few albums cloudsearch drops.
    let r = await api('/cloudsearch/pc', { s: query, type: t, limit, offset, total: true });
    if (!r.result || !(r.result[SEARCH_KEYS[t]] || []).length) {
      r = await api('/search/get', { s: query, type: t, limit, offset, total: true });
    }
    const key = SEARCH_KEYS[t];
    const items = (r.result && r.result[key]) || [];
    const shaped =
      type === 'song'
        ? items.map(norm.track)
        : type === 'album'
          ? items.map((a) => ({
              id: String(a.id),
              name: a.name,
              artists: (a.artists || a.ar || []).map((x) => ({ id: String(x.id), name: x.name })),
              publishDate: a.publishTime ? new Date(a.publishTime).toISOString().slice(0, 10) : null,
              trackCount: a.size ?? null,
            }))
          : type === 'artist'
            ? items.map(norm.artist)
            : items.map((p) => ({
                id: String(p.id),
                name: p.name,
                trackCount: p.trackCount,
                creator: p.creator ? p.creator.nickname : null,
              }));
    const total = r.result && (r.result[`${key}Count`] ?? r.result[`${key}Total`]);
    return { ok: true, query, type, total: total ?? shaped.length, items: shaped };
  },

  async songs({ args, flags }) {
    const ids = flags.file ? readIdFile(flags.file) : args;
    if (!ids.length) die('songs needs at least one id');
    return { ok: true, songs: await trackByIds(ids) };
  },

  async album({ args, flags }) {
    const id = args[0];
    if (!id) die('album needs an album id');
    const r = await api(`/v1/album/${id}`);
    const a = r.album || {};
    return {
      ok: true,
      album: {
        id: String(a.id),
        name: a.name,
        artists: (a.artists || []).map((x) => ({ id: String(x.id), name: x.name })),
        publishDate: a.publishTime ? new Date(a.publishTime).toISOString().slice(0, 10) : null,
        company: a.company || null,
        trackCount: (r.songs || []).length,
        description: (a.description || '').slice(0, 400),
        url: `https://music.163.com/#/album?id=${a.id}`,
      },
      tracks: flags.tracks === false ? undefined : (r.songs || []).map(norm.track),
    };
  },

  async artist({ args, flags }) {
    const id = args[0];
    if (!id) die('artist needs an artist id');
    const r = await api(`/artist/${id}`);
    const a = r.artist || {};
    const top = await api('/artist/top/song', { id: String(id) });
    const n = Number(flags.top || 10);
    return {
      ok: true,
      artist: { id: String(a.id), name: a.name, alias: a.alias || [], briefDesc: (a.briefDesc || '').slice(0, 300) },
      topSongs: (top.songs || []).slice(0, n).map(norm.track),
    };
  },

  async playlist({ args, flags }) {
    const id = args[0];
    if (!id) die('playlist needs a playlist id');
    const p = await playlistFull(id);
    const limit = Number(flags.limit || p.tracks.length);
    return { ok: true, ...p, tracks: p.tracks.slice(0, limit) };
  },

  async lyrics({ args }) {
    const id = args[0];
    if (!id) die('lyrics needs a song id');
    const r = await api('/song/lyric', { id: String(id), lv: 1, tv: -1 });
    return {
      ok: true,
      songId: String(id),
      lyric: (r.lrc && r.lrc.lyric) || '',
      translation: (r.tlyric && r.tlyric.lyric) || '',
    };
  },

  async create({ args, flags }) {
    requireAuth();
    const name = args.join(' ');
    if (!name) die('create needs a name');
    const r = await api('/playlist/create', { name, type: 'NORMAL', privacy: flags.private ? 10 : 0 });
    if (!r.id) die('create failed', { upstream: r });
    return { ok: true, id: String(r.id), name, url: `https://music.163.com/#/playlist?id=${r.id}` };
  },

  async add({ args, flags }) {
    requireAuth();
    const pid = args[0];
    const ids = flags.file ? readIdFile(flags.file) : args.slice(1);
    if (!pid || !ids.length) die('add needs <playlistId> <songId...> or --file ids.json');
    const sent = [];
    for (const part of chunk(ids, 200)) {
      const r = await api('/playlist/manipulate/tracks', {
        op: 'add',
        pid: String(pid),
        trackIds: JSON.stringify(part.map(String)),
        imme: 'true',
      });
      sent.push({ count: part.length, code: r.code, added: r.trackIds ? r.trackIds.length : undefined });
    }
    const after = await playlistFull(pid);
    return { ok: true, playlistId: String(pid), requested: ids.length, batches: sent, trackCount: after.trackCount };
  },

  async del({ args, flags }) {
    requireAuth();
    const pid = args[0];
    const ids = flags.file ? readIdFile(flags.file) : args.slice(1);
    if (!pid || !ids.length) die('del needs <playlistId> <songId...> or --file ids.json');
    const sent = [];
    for (const part of chunk(ids, 200)) {
      const r = await api('/playlist/manipulate/tracks', {
        op: 'del',
        pid: String(pid),
        trackIds: JSON.stringify(part.map(String)),
      });
      sent.push({ count: part.length, code: r.code });
    }
    const after = await playlistFull(pid);
    return { ok: true, playlistId: String(pid), requested: ids.length, batches: sent, trackCount: after.trackCount };
  },

  async clear({ args }) {
    requireAuth();
    const pid = args[0];
    if (!pid) die('clear needs a playlist id');
    const p = await playlistFull(pid);
    if (!p.tracks.length) return { ok: true, playlistId: String(pid), removed: 0, trackCount: 0 };
    const removed = p.tracks.length;
    const ids = p.tracks.map((t) => t.id);
    for (const part of chunk(ids, 200)) {
      await api('/playlist/manipulate/tracks', { op: 'del', pid: String(pid), trackIds: JSON.stringify(part) });
    }
    const after = await playlistFull(pid);
    return { ok: true, playlistId: String(pid), removed, trackCount: after.trackCount, tracksLeft: after.tracks.map((t) => t.name) };
  },

  async rename({ args }) {
    requireAuth();
    const pid = args[0];
    const name = args.slice(1).join(' ');
    if (!pid || !name) die('rename needs <playlistId> <name>');
    const r = await api('/playlist/update/name', { id: String(pid), name });
    if (r.code !== 200) die('rename rejected', { upstream: r });
    const after = await playlistFull(pid);
    return { ok: true, playlistId: String(pid), name: after.name, trackCount: after.trackCount };
  },
};

function readIdFile(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(raw)) return raw.map(String);
  if (Array.isArray(raw.ids)) return raw.ids.map(String);
  die(`${file} must be an array of ids or {"ids": [...]}`);
}

const [command = 'help', ...rest] = process.argv.slice(2);
const handler = cmd[command];
if (!handler) die(`unknown command: ${command} (try: node ncm-cli.mjs help)`);
const { args, flags } = parseArgs(rest);
try {
  const out = await handler({ args, flags });
  console.log(JSON.stringify(out, null, 2));
} catch (err) {
  die(err.message, err.auth ? { hint: 'cookie expired or missing — see SKILL.md → auth' } : undefined);
}
