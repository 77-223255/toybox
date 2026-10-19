// Minimal NetEase Cloud Music WEAPI client.
// Auth: reuses the cookie that `neteasecli` already imported from the browser.
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

const SESSION_FILE =
  process.env.NCM_SESSION ||
  path.join(os.homedir(), '.config', 'neteasecli', 'profiles', 'default', 'session.json');

export const DATA_DIR =
  process.env.NCM_DATA_DIR || path.join(os.homedir(), '.local', 'share', 'netease-recommend');

export function readCookies() {
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error(
      `No NetEase session at ${SESSION_FILE}\nRun: neteasecli auth login  (after logging in at music.163.com in Chromium)`
    );
  }
  return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
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

let cookies = null;
let csrf = null;
function cookieHeader() {
  if (!cookies) {
    cookies = readCookies();
    csrf = cookies.__csrf || '';
  }
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

export async function api(endpoint, data = {}, { retries = 2, prefix = '/weapi' } = {}) {
  const payload = { ...data };
  // Mutating endpoints require the csrf token echoed back in the body.
  if (csrf && payload.csrf_token === undefined) payload.csrf_token = csrf;

  const body = new URLSearchParams(weapi(payload)).toString();
  for (let attempt = 0; ; attempt++) {
    await throttle();
    try {
      const res = await fetch(`https://music.163.com${prefix}${endpoint}`, {
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.code && json.code !== 200) {
        const msg = json.message || json.msg || 'request failed';
        const err = new Error(`${msg} (code ${json.code}) on ${endpoint}`);
        // 301 = not logged in
        if (json.code === 301) err.auth = true;
        throw err;
      }
      return json;
    } catch (err) {
      if (attempt >= retries || err.auth) throw err;
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
}

export async function account() {
  const r = await api('/nuser/account/get');
  return { uid: String(r.profile.userId), nickname: r.profile.nickname };
}

/** Fetch every page of a paginated endpoint until we run out. */
export async function allPages(endpoint, data, { key, limit = 100, max = 20 } = {}) {
  const out = [];
  for (let page = 0; page < max; page++) {
    const r = await api(endpoint, { ...data, limit, offset: page * limit });
    const batch = key ? r[key] : r;
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < limit) break;
  }
  return out;
}

export const norm = {
  track(s) {
    const artists = s.ar || s.artists || [];
    const album = s.al || s.album || {};
    return {
      id: String(s.id),
      name: s.name,
      artists: artists.map((a) => ({ id: String(a.id), name: a.name })),
      album: { id: String(album.id ?? ''), name: album.name ?? '' },
    };
  },
  artist(a) {
    return { id: String(a.id), name: a.name, alias: a.alias || a.alia || [] };
  },
};

export function saveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export function loadJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
