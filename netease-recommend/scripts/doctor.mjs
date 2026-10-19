// Setup self-check. Exits non-zero when the environment is not usable.
//   node doctor.mjs
import fs from 'node:fs';
import path from 'node:path';
import { account, api, DATA_DIR, readCookies, loadJson } from './ncm.mjs';

const ok = [];
const bad = [];
const note = (arr, m) => arr.push(m);

try {
  const cookies = readCookies();
  if (cookies.MUSIC_U) note(ok, `cookie MUSIC_U present (${cookies.MUSIC_U.length} chars)`);
  else note(bad, 'session.json exists but has no MUSIC_U');
} catch (e) {
  note(bad, e.message.split('\n')[0]);
}

let me = null;
try {
  me = await account();
  note(ok, `authenticated as ${me.nickname} (${me.uid})`);
} catch (e) {
  note(bad, `auth failed: ${e.message}`);
}

if (me) {
  try {
    const lists = (await api('/user/playlist', { uid: me.uid, limit: 1000, offset: 0 })).playlist;
    note(ok, `${lists.length} playlists, ${lists.find((p) => p.specialType === 5)?.trackCount ?? '?'} liked tracks`);

    const state = loadJson(path.join(DATA_DIR, 'playlist.json'), {});
    const target = state.playlistId && lists.find((p) => String(p.id) === String(state.playlistId));
    if (state.playlistId && !target) note(bad, `playlist.json points at ${state.playlistId}, which no longer exists`);
    else if (target) note(ok, `target playlist: ${target.name} (${target.id}), ${target.trackCount} tracks`);
    else note(ok, 'no target playlist yet — apply.mjs will create one');
  } catch (e) {
    note(bad, `playlist access failed: ${e.message}`);
  }
}

for (const f of ['profile.json', 'profile.md', 'candidates.json']) {
  const p = path.join(DATA_DIR, f);
  if (fs.existsSync(p)) note(ok, `${f} (${(fs.statSync(p).size / 1024).toFixed(1)} KB, ${new Date(fs.statSync(p).mtimeMs).toISOString().slice(0, 16)})`);
  else note(ok, `${f} — not built yet`);
}

console.log(`node ${process.version}`);
console.log(`data ${DATA_DIR}\n`);
for (const m of ok) console.log(`  ok   ${m}`);
for (const m of bad) console.log(`  FAIL ${m}`);
if (bad.length) {
  console.log('\nNot ready. See AGENTS.md → "Authentication".');
  process.exitCode = 1;
} else {
  console.log('\nReady.');
}
