// Explore the similar-artist / similar-song graph around the user's taste and
// emit a candidate pool. Does NOT touch the playlist.
//   node discover.mjs [--seeds 14] [--artists 28] [--deep 6]
// Writes: $DATA/candidates.json
import path from 'node:path';
import fs from 'node:fs';
import { api, DATA_DIR, norm, loadJson, saveJson } from './ncm.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d;
};

const SEEDS = arg('seeds', 14);
const NEW_ARTISTS = arg('artists', 28);
const DEEP = arg('deep', 6);

const profile = loadJson(path.join(DATA_DIR, 'profile.json'));
if (!profile) throw new Error('No profile.json — run: node profile.mjs');

const knownArtists = new Set(profile.knownArtistIds);
const knownTracks = new Set(profile.knownTrackIds);
const log = (m) => process.stderr.write(m + '\n');

// --- 1. walk the similar-artist graph from our strongest artists -----------
const seeds = profile.artists.slice(0, SEEDS);
const maxScore = seeds[0]?.score || 1;
const discovered = new Map(); // artistId -> { id, name, alias, cooccur, weight, from:Set }

for (const seed of seeds) {
  let r;
  try {
    r = await api('/discovery/simiArtist', { artistid: seed.id });
  } catch (e) {
    log(`  simiArtist ${seed.name} failed: ${e.message}`);
    continue;
  }
  for (const a of r.artists || []) {
    const id = String(a.id);
    if (id === seed.id) continue;
    const e = discovered.get(id) || { id, name: a.name, alias: a.alias || [], cooccur: 0, weight: 0, from: new Set() };
    e.cooccur += 1;
    e.weight += seed.score / maxScore;
    e.from.add(seed.name);
    discovered.set(id, e);
  }
  log(`  seed ${seed.name} -> ${(r.artists || []).length} similar`);
}

const ranked = [...discovered.values()]
  .map((a) => ({
    ...a,
    from: [...a.from].slice(0, 6),
    known: knownArtists.has(a.id),
    score: Number((a.cooccur * 2.5 + a.weight).toFixed(3)),
  }))
  .sort((a, b) => b.score - a.score);

const freshArtists = ranked.filter((a) => !a.known).slice(0, NEW_ARTISTS);
const knownButClose = ranked.filter((a) => a.known).slice(0, 10);
log(`\ndiscovered ${ranked.length} similar artists; ${freshArtists.length} are new to you`);

// --- 2. candidate tracks --------------------------------------------------
const candidates = [];
const seen = new Set();
const push = (t, meta) => {
  if (knownTracks.has(t.id) || seen.has(t.id)) return;
  seen.add(t.id);
  candidates.push({ ...t, ...meta });
};

for (const a of freshArtists) {
  let top;
  try {
    top = await api('/artist/top/song', { id: a.id });
  } catch (e) {
    log(`  top songs ${a.name} failed: ${e.message}`);
    continue;
  }
  const songs = (top.songs || []).map(norm.track).filter((t) => !knownTracks.has(t.id));
  for (const t of songs.slice(0, 3)) {
    push(t, {
      source: 'new-artist',
      why: `相似于 ${a.from.join('、')}${a.cooccur > 1 ? `（${a.cooccur} 个你常听的歌手都指向他）` : ''}`,
      artistScore: a.score,
      artistKnown: false,
    });
  }
  log(`  ${a.name}: ${songs.length} unheard of top tracks`);
}

// deep cuts from artists you already love but haven't saved
for (const a of profile.artists.slice(0, DEEP)) {
  let top;
  try {
    top = await api('/artist/top/song', { id: a.id });
  } catch {
    continue;
  }
  const songs = (top.songs || []).map(norm.track).filter((t) => !knownTracks.has(t.id));
  for (const t of songs.slice(0, 2)) {
    push(t, {
      source: 'deep-cut',
      why: `你常听 ${a.name}，但这首还没收藏`,
      artistScore: a.score,
      artistKnown: true,
    });
  }
}

// similar songs of a few random high-weight liked tracks (seeded, no Math.random)
const likedSample = profile.artists.slice(0, 6);
const likedIds = [...knownTracks];
for (let i = 0; i < likedSample.length; i++) {
  const id = likedIds[(i * 7919 + 13) % likedIds.length];
  try {
    const r = await api('/discovery/simiSong', { songid: id, limit: 10, offset: 0 });
    for (const s of r.songs || []) {
      const t = norm.track(s);
      push(t, {
        source: 'similar-song',
        why: `和你收藏的某首歌相似`,
        artistScore: 0,
        artistKnown: knownArtists.has(t.artists[0]?.id),
      });
    }
  } catch {
    /* ignore */
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  counts: { discoveredArtists: ranked.length, newArtists: freshArtists.length, candidates: candidates.length },
  newArtists: freshArtists,
  closeButKnown: knownButClose,
  candidates: candidates.sort((a, b) => b.artistScore - a.artistScore),
};
saveJson(path.join(DATA_DIR, 'candidates.json'), out);
log(`\nwrote ${path.join(DATA_DIR, 'candidates.json')} (${candidates.length} candidates)`);
console.log(
  JSON.stringify(
    {
      ...out,
      candidates: out.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        artists: c.artists.map((a) => a.name).join(' / '),
        album: c.album.name,
        source: c.source,
        why: c.why,
      })),
    },
    null,
    2
  )
);
