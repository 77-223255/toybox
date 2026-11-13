// Minimal NetEase Cloud Music WEAPI client. No dependencies, Node >= 18.
//
// Auth sources, first one that works:
//   1. MUSIC_U / NCM_COOKIE env var   ("MUSIC_U=...; __csrf=...")
//   2. $NCM_SESSION                   (path to a cookie json)
//   3. ~/.config/neteasecli/profiles/default/session.json   (neteasecli)
//
// Public read endpoints work without a cookie; playlists, likes and writes need one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const IV = '0102030405060708';
const PRESET_KEY = '0CoJUm6Qyw8W8jud';
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';

export const SESSION_FILE =
  process.env.NCM_SESSION ||
  path.join(os.homedir(), '.config', 'neteasecli', 'profiles', 'default', 'session.json');

/** Cookie jar for this process. Empty object = anonymous. */
export function readCookies() {
  const inline = process.env.NCM_COOKIE || process.env.MUSIC_U;
  if (inline) {
    const jar = {};
    for (const part of inline.split(';')) {
      const i = part.indexOf('=');
      if (i > 0) jar[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    if (Object.keys(jar).length) return jar;
  }
  if (fs.existsSync(SESSION_FILE)) return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  return {};
}

function aesEncrypt(text, key) {
  const c = crypto.createCipheriv('aes-128-cbc', key, IV);
  return Buffer.concat([c.update(text, 'utf8'), c.final()]).toString('base64');
}

function rsaEncrypt(text) {
  const reversed = text.split('').reverse().join('');
  const buf = Buffer.alloc(128, 0);
  Buffer.from(reversed).copy(buf, 128 - Buffer.byteLength(reversed));
  return crypto
    .publicEncrypt({ key: PUBLIC_KEY, padding: crypto.constants.RSA_NO_PADDING }, buf)
    .toString('hex');
}

function weapi(data) {
  const secret = Array.from(crypto.randomBytes(16))
    .map((b) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62])
    .join('');
  const params = aesEncrypt(aesEncrypt(JSON.stringify(data), PRESET_KEY), secret);
  return { params, encSecKey: rsaEncrypt(secret) };
}

const cookies = readCookies();
const csrf = cookies.__csrf || '';
export const authed = Boolean(cookies.MUSIC_U);

function cookieHeader() {
  return ['os=pc', 'appver=8.9.70', ...Object.entries(cookies).map(([k, v]) => `${k}=${v}`)].join('; ');
}

// NetEase throttles aggressive callers; keep a floor between requests.
let lastCall = 0;
const MIN_INTERVAL = Number(process.env.NCM_MIN_INTERVAL_MS || 180);
async function throttle() {
  const wait = lastCall + MIN_INTERVAL - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/** POST a WEAPI endpoint and return the decoded json. Throws on auth/code errors. */
export async function api(endpoint, data = {}, { retries = 2 } = {}) {
  const payload = { ...data };
  // Mutating endpoints require the csrf token echoed back in the body.
  if (csrf && payload.csrf_token === undefined) payload.csrf_token = csrf;

  const body = new URLSearchParams(weapi(payload)).toString();
  for (let attempt = 0; ; attempt++) {
    await throttle();
    try {
      const res = await fetch(`https://music.163.com/weapi${endpoint}`, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          Referer: 'https://music.163.com',
          Origin: 'https://music.163.com',
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookieHeader(),
        },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} on ${endpoint}`);
      const json = await res.json();
      if (json.code && json.code !== 200) {
        const err = new Error(`${json.message || json.msg || 'request failed'} (code ${json.code}) on ${endpoint}`);
        if (json.code === 301 || json.code === -462) err.auth = true;
        throw err;
      }
      return json;
    } catch (err) {
      if (attempt >= retries || err.auth) throw err;
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
}

export const norm = {
  track(s) {
    const ar = s.ar || s.artists || [];
    const al = s.al || s.album || {};
    return {
      id: String(s.id),
      name: s.name,
      artists: ar.map((a) => ({ id: String(a.id), name: a.name })),
      album: { id: String(al.id ?? ''), name: al.name ?? '' },
      durationMs: s.dt ?? s.duration ?? null,
      popularity: s.pop ?? s.popularity ?? null,
      trackNumber: s.no ?? null,
    };
  },
  artist(a) {
    return { id: String(a.id), name: a.name, alias: a.alias || a.alia || a.aliases || [] };
  },
};

export function artistLine(t) {
  return t.artists.map((a) => a.name).join(' / ');
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
