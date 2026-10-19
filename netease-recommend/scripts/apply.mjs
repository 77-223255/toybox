// Replace the playlist contents with a new batch and rename it to the batch's title.
//   node apply.mjs --name "歌单标题" --ids 123,456,...        (20 ids)
//   node apply.mjs --name "歌单标题" --file selection.json    ({"ids": [...]})
// Clear-then-fill: every old track is removed, so the playlist always holds exactly this batch.
import fs from 'node:fs';
import path from 'node:path';
import { api, account, DATA_DIR, loadJson, saveJson } from './ncm.mjs';

const PLAYLIST_NAME = process.env.NCM_PLAYLIST || 'AI 推荐';
const BATCH = 20;
const STATE_FILE = path.join(DATA_DIR, 'playlist.json');

const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

let ids = arg('ids')?.split(/[,\s]+/).filter(Boolean);
const file = arg('file');
if (file) ids = JSON.parse(fs.readFileSync(file, 'utf8')).ids;
const name = arg('name');

if (!name) throw new Error('missing --name (the playlist title for this batch)');
if (!ids?.length) throw new Error('missing --ids or --file');
if (ids.length !== BATCH) {
  throw new Error(`expected exactly ${BATCH} tracks, got ${ids.length}`);
}
if (new Set(ids).size !== ids.length) throw new Error('duplicate track ids in batch');

const me = await account();

// --- resolve the target playlist ------------------------------------------
// The playlist is renamed every run, so it is tracked by ID, not by name.
const lists = (await api('/user/playlist', { uid: me.uid, limit: 1000, offset: 0 })).playlist;
const byId = (id) => lists.find((p) => String(p.id) === String(id));

const state = loadJson(STATE_FILE, {});
let pl = state.playlistId ? byId(state.playlistId) : null;
if (!pl && !state.playlistId) pl = lists.find((p) => p.name === PLAYLIST_NAME);
if (!pl) {
  const created = await api('/playlist/create', { name: PLAYLIST_NAME, privacy: 0, type: 'NORMAL' });
  pl = created.playlist;
  process.stderr.write(`created playlist ${pl.id}\n`);
}
const pid = String(pl.id);
saveJson(STATE_FILE, { playlistId: pid });

const currentIds = async () => {
  const r = await api('/v6/playlist/detail', { id: pid, n: 1000, s: 8 });
  return (r.playlist.trackIds || []).map((t) => String(t.id));
};

// --- clear ----------------------------------------------------------------
const old = await currentIds();
if (old.length) {
  await api('/playlist/manipulate/tracks', { pid, trackIds: JSON.stringify(old), op: 'del' });
  process.stderr.write(`cleared ${old.length} old tracks\n`);
}

// --- fill -----------------------------------------------------------------
await api('/playlist/manipulate/tracks', { pid, trackIds: JSON.stringify(ids), op: 'add' });

// --- rename ---------------------------------------------------------------
await api('/playlist/update/name', { id: pid, name });

// --- verify ---------------------------------------------------------------
await new Promise((r) => setTimeout(r, 800));
const after = await currentIds();
const afterName = (await api('/user/playlist', { uid: me.uid, limit: 1000, offset: 0 })).playlist.find(
  (p) => String(p.id) === pid
)?.name;

const missing = ids.filter((id) => !after.includes(id));
console.log(
  JSON.stringify(
    {
      playlistId: pid,
      name: afterName,
      requested: ids.length,
      inPlaylist: after.length,
      removed: old.length,
      missing,
      url: `https://music.163.com/#/playlist?id=${pid}`,
      ok: after.length === BATCH && missing.length === 0 && afterName === name,
    },
    null,
    2
  )
);
if (after.length !== BATCH || missing.length) process.exitCode = 1;
