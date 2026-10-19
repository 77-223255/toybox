// Read the whole music library and build a taste profile.
//   node profile.mjs
// Writes: $DATA/profile.json (machine) + $DATA/profile.md (compact digest for the model)
import fs from 'node:fs';
import path from 'node:path';
import { api, account, allPages, DATA_DIR, norm, saveJson } from './ncm.mjs';

const OUT_JSON = path.join(DATA_DIR, 'profile.json');
const OUT_MD = path.join(DATA_DIR, 'profile.md');

const log = (m) => process.stderr.write(m + '\n');
const CACHE_DAYS = Number(process.env.NCM_PROFILE_CACHE_DAYS || 1);

const W = { followed: 5, album: 4, liked: 3, playlist: 2, recent: 1 };

async function fetchSongs(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 300) {
    const batch = ids.slice(i, i + 300);
    const r = await api('/v3/song/detail', { c: JSON.stringify(batch.map((id) => ({ id }))) });
    out.push(...(r.songs || []).map(norm.track));
    log(`  songs ${Math.min(i + 300, ids.length)}/${ids.length}`);
  }
  return out;
}

async function build() {
  const me = await account();
  log(`account: ${me.nickname} (${me.uid})`);

  const artistW = new Map();
  const knownArtistIds = new Set();
  const knownTrackIds = new Set();
  const bump = (a, field, n = 1) => {
    knownArtistIds.add(a.id);
    const e = artistW.get(a.id) || {
      id: a.id, name: a.name, alias: a.alias || [],
      followed: 0, album: 0, liked: 0, playlist: 0, recent: 0, score: 0,
    };
    if (!e.name && a.name) e.name = a.name;
    e[field] += n;
    e.score += W[field] * n;
    artistW.set(a.id, e);
  };

  // --- liked songs -------------------------------------------------------
  log('liked songs ...');
  const likedIds = (await api('/song/like/get')).ids.map(String);
  const liked = await fetchSongs(likedIds);
  for (const t of liked) {
    knownTrackIds.add(t.id);
    for (const a of t.artists) bump(a, 'liked');
  }
  log(`liked: ${liked.length}`);

  // --- playlists ---------------------------------------------------------
  log('playlists ...');
  const pls = await api('/user/playlist', { uid: me.uid, limit: 1000, offset: 0 });
  const playlists = [];
  for (const p of pls.playlist) {
    const isLikedList = p.specialType === 5;
    const tracks = isLikedList ? [] : ((await api('/v6/playlist/detail', { id: p.id, n: 1000, s: 8 })).playlist.tracks || []).map(norm.track);
    const topArtists = new Map();
    for (const t of tracks) {
      knownTrackIds.add(t.id);
      for (const a of t.artists) {
        bump(a, 'playlist');
        topArtists.set(a.name, (topArtists.get(a.name) || 0) + 1);
      }
    }
    playlists.push({
      id: String(p.id),
      name: p.name,
      trackCount: p.trackCount,
      isLikedList,
      tags: p.tags || [],
      topArtists: [...topArtists].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, n]) => ({ name, n })),
    });
    log(`  ${p.name}: ${tracks.length}`);
  }

  // --- followed artists --------------------------------------------------
  log('followed artists ...');
  const followedRaw = await allPages('/artist/sublist', {}, { key: 'data', limit: 50 });
  const followedArtists = followedRaw.map(norm.artist);
  for (const a of followedArtists) bump(a, 'followed');
  log(`followed: ${followedArtists.length}`);

  // --- saved albums ------------------------------------------------------
  log('saved albums ...');
  const albumsRaw = await allPages('/album/sublist', {}, { key: 'data', limit: 100 });
  for (const al of albumsRaw) {
    for (const a of al.artists || []) bump({ id: String(a.id), name: a.name }, 'album');
  }
  log(`saved albums: ${albumsRaw.length}`);

  // --- recently played ---------------------------------------------------
  log('recent plays ...');
  const recentTracks = [];
  for (const type of [1, 0]) {
    try {
      const r = await api('/v1/play/record', { uid: me.uid, type, limit: 100, offset: 0 });
      const data = type === 1 ? r.weekData : r.allData;
      for (const d of data || []) {
        if (!d.song) continue;
        const t = norm.track(d.song);
        recentTracks.push({ ...t, playCount: d.playCount, week: type === 1 });
        for (const a of t.artists) bump(a, 'recent');
      }
    } catch (e) {
      log(`  record type=${type} failed: ${e.message}`);
    }
  }
  log(`recent: ${recentTracks.length}`);

  const artists = [...artistW.values()].sort((a, b) => b.score - a.score);
  const profile = {
    generatedAt: new Date().toISOString(),
    me,
    counts: {
      liked: liked.length, playlists: playlists.length,
      followedArtists: followedArtists.length, savedAlbums: albumsRaw.length,
      recentPlays: recentTracks.length, knownArtists: knownArtistIds.size,
      knownTracks: knownTrackIds.size,
    },
    artists,
    knownArtistIds: [...knownArtistIds],
    knownTrackIds: [...knownTrackIds],
    playlists,
    followedArtists,
    savedAlbumArtists: [...albumsRaw.reduce((m, al) => {
      for (const a of al.artists || []) m.set(a.name, (m.get(a.name) || 0) + 1);
      return m;
    }, new Map())].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    recentTracks,
  };
  saveJson(OUT_JSON, profile);
  fs.writeFileSync(OUT_MD, renderDigest(profile));
  log(`\nwrote ${OUT_JSON}\nwrote ${OUT_MD}`);
}

function renderDigest(p) {
  const L = [];
  const a = (n, label, key) => p.artists.filter((x) => x[key] > 0).length && L.push(`- ${label}: ${n} 位`, ...p.artists.filter((x) => x[key] > 0).sort((x, y) => y[key] - x[key]).slice(0, n).map((x) => `  - ${x.name}${x.alias?.length ? ` (${x.alias.join('/')})` : ''} ×${x[key]}`), '');
  L.push(`# 音乐库画像 — ${p.me.nickname}`, `生成于 ${p.generatedAt}`, '');
  L.push(`红心 ${p.counts.liked} 首 · 歌单 ${p.counts.playlists} 个 · 关注歌手 ${p.counts.followedArtists} 位 · 收藏专辑 ${p.counts.savedAlbums} 张 · 最近播放 ${p.counts.recentPlays} 条 · 已知歌手 ${p.counts.knownArtists} 位`, '');

  L.push(`## 最核心的歌手（按综合权重，权重=关注5/专辑4/红心3/歌单2/最近1）`, '');
  L.push(...p.artists.slice(0, 70).map((x, i) => {
    const d = [x.followed && `关注${x.followed}`, x.album && `专辑${x.album}`, x.liked && `红心${x.liked}`, x.playlist && `歌单${x.playlist}`, x.recent && `最近${x.recent}`].filter(Boolean).join(' ');
    return `${String(i + 1).padStart(2)}. ${x.name}${x.alias?.length ? ` [${x.alias.join('/')}]` : ''} — ${d} (${x.score})`;
  }), '');

  L.push(`## 我关注的歌手（显式偏好，${p.followedArtists.length}）`, '');
  L.push(p.followedArtists.map((x) => x.name).join('、'), '');

  L.push(`## 我收藏的专辑 — 按歌手聚合（${p.savedAlbums ?? p.counts.savedAlbums} 张）`, '');
  L.push(p.savedAlbumArtists.slice(0, 60).map((x) => `${x.name}(×${x.n})`).join('、'), '');

  L.push(`## 我的歌单`, '');
  for (const pl of p.playlists) {
    L.push(`- **${pl.name}**${pl.isLikedList ? '（红心系统歌单）' : ''} — ${pl.trackCount} 首${pl.tags?.length ? `，标签: ${pl.tags.join('/')}` : ''}`);
    if (pl.topArtists.length) L.push(`  主要歌手: ${pl.topArtists.map((t) => `${t.name}(${t.n})`).join('、')}`);
  }
  L.push('');

  L.push(`## 最近播放（近期口味）`, '');
  L.push(...p.recentTracks.slice(0, 40).map((t) => `- ${t.name} — ${t.artists.map((x) => x.name).join('/')}${t.week ? ' [本周]' : ''}`), '');
  return L.join('\n');
}

const fresh = fs.existsSync(OUT_JSON) && (Date.now() - fs.statSync(OUT_JSON).mtimeMs) < CACHE_DAYS * 864e5;
if (fresh && !process.argv.includes('--force')) {
  log(`profile.json is fresh (<${CACHE_DAYS}d). Use --force to rebuild.`);
} else {
  await build();
}
