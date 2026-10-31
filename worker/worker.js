/**
 * Emotion Studio · Worker Cloudflare ("emotion-api")
 *
 * Fa da ponte tra l'app e il Google Drive dello studio:
 *  - streaming degli MP3 tramite URL firmati a scadenza (con supporto Range per iPhone)
 *  - download delle versioni, solo se abilitato dall'admin
 *  - creazione cartelle e caricamento file su Drive (solo admin)
 *
 * Chi può fare cosa lo decidono le regole di Firestore: il Worker legge i documenti
 * usando il token dell'utente, quindi se le regole dicono "no", il Worker si ferma.
 *
 * Variabili (Settings → Variables and Secrets):
 *   FIREBASE_PROJECT_ID   testo   es. emotion-studio
 *   ALLOWED_ORIGINS       testo   indirizzi dell'app separati da virgola
 *   GOOGLE_CLIENT_ID      secret
 *   GOOGLE_CLIENT_SECRET  secret
 *   GOOGLE_REFRESH_TOKEN  secret
 *   SIGNING_KEY           secret  stringa casuale lunga (almeno 32 caratteri)
 */

const DRIVE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const MEDIA_TTL_SECONDS = 3 * 60 * 60; // gli URL di ascolto valgono 3 ore
const MAX_PROXY_UPLOAD = 90 * 1024 * 1024;

const enc = new TextEncoder();
const dec = new TextDecoder();

// ───────────── utilità ─────────────

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Content-Range',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(data, status, req, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(req, env) },
  });
}

// ───────────── token Google (account dello studio) ─────────────

let googleToken = { value: null, exp: 0 };

async function getGoogleToken(env, force) {
  if (!force && googleToken.value && Date.now() < googleToken.exp) return googleToken.value;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new HttpError(502, 'Collegamento a Google Drive non riuscito: controlla le chiavi nel Worker.');
  const data = await res.json();
  googleToken = { value: data.access_token, exp: Date.now() + (data.expires_in - 120) * 1000 };
  return googleToken.value;
}

async function driveFetch(env, url, init) {
  init = init || {};
  let token = await getGoogleToken(env);
  let res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    token = await getGoogleToken(env, true);
    res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  }
  return res;
}

// ───────────── verifica dell'utente Firebase ─────────────

let jwks = { keys: null, exp: 0 };

async function getJwks() {
  if (jwks.keys && Date.now() < jwks.exp) return jwks.keys;
  const res = await fetch(JWKS_URL);
  const data = await res.json();
  const m = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') || '');
  jwks = { keys: data.keys, exp: Date.now() + (m ? Number(m[1]) * 1000 : 3600_000) };
  return jwks.keys;
}

async function verifyUser(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Accesso richiesto.');
  let header, payload;
  try {
    header = JSON.parse(dec.decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(dec.decode(b64urlToBytes(parts[1])));
  } catch {
    throw new HttpError(401, 'Sessione non valida. Rientra nell’app.');
  }
  const keys = await getJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk || header.alg !== 'RS256') throw new HttpError(401, 'Sessione non valida. Rientra nell’app.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  const now = Math.floor(Date.now() / 1000);
  const pid = env.FIREBASE_PROJECT_ID;
  if (!ok || payload.aud !== pid || payload.iss !== `https://securetoken.google.com/${pid}`
      || !payload.sub || payload.exp < now || payload.iat > now + 300) {
    throw new HttpError(401, 'Sessione scaduta. Rientra nell’app.');
  }
  return { uid: payload.sub, token };
}

/** Legge un documento Firestore CON IL TOKEN DELL'UTENTE: valgono le regole di sicurezza. */
async function readDocAsUser(env, user, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${user.token}` } });
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, 'Database non raggiungibile.');
  const doc = await res.json();
  const out = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    out[k] = v.stringValue ?? v.booleanValue ?? v.integerValue ?? v.doubleValue ?? null;
  }
  return out;
}

async function requireAdmin(req, env) {
  const user = await verifyUser(req, env);
  const admin = await readDocAsUser(env, user, `admins/${user.uid}`);
  if (!admin) throw new HttpError(403, 'Operazione riservata allo studio.');
  return user;
}

const safeId = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);

// ───────────── URL firmati per l'ascolto ─────────────

async function sign(env, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.SIGNING_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToB64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

async function mediaToken(req, env) {
  const user = await verifyUser(req, env);
  const body = await req.json();
  const { artistId, versionId, download } = body || {};
  if (!safeId(artistId) || !safeId(versionId)) throw new HttpError(400, 'Richiesta non valida.');
  const v = await readDocAsUser(env, user, `artists/${artistId}/versions/${versionId}`);
  if (!v || !v.mp3FileId) throw new HttpError(404, 'Versione non trovata.');
  if (download && v.downloadEnabled !== true) throw new HttpError(403, 'Il download di questa versione non è abilitato.');
  const e = Math.floor(Date.now() / 1000) + MEDIA_TTL_SECONDS;
  const d = download ? '1' : '0';
  const n = (v.fileName || 'brano.mp3').replace(/[^\w.\- ()àèéìòù]/gi, '_').slice(0, 120);
  const s = await sign(env, `${v.mp3FileId}|${e}|${d}|${n}`);
  const base = new URL(req.url).origin;
  const q = new URLSearchParams({ e: String(e), d, n, s });
  return { url: `${base}/media/${v.mp3FileId}?${q}` };
}

async function serveMedia(req, env, fileId) {
  const url = new URL(req.url);
  const e = url.searchParams.get('e') || '';
  const d = url.searchParams.get('d') || '0';
  const n = url.searchParams.get('n') || 'brano.mp3';
  const s = url.searchParams.get('s') || '';
  if (!safeId(fileId) || Number(e) < Date.now() / 1000) return new Response('Link scaduto', { status: 403 });
  if ((await sign(env, `${fileId}|${e}|${d}|${n}`)) !== s) return new Response('Link non valido', { status: 403 });

  const headers = {};
  const range = req.headers.get('Range');
  if (range) headers.Range = range;
  const res = await driveFetch(env, `${DRIVE}/files/${fileId}?alt=media`, { headers });
  if (!res.ok && res.status !== 206) {
    return new Response(res.status === 404 ? 'File non più disponibile (forse archiviato)' : 'Errore Drive', { status: res.status === 404 ? 404 : 502 });
  }
  const out = new Headers();
  for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'ETag', 'Last-Modified']) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  out.set('Accept-Ranges', 'bytes');
  out.set('Cache-Control', 'private, max-age=3600');
  out.set('Access-Control-Allow-Origin', '*');
  out.set('X-Content-Type-Options', 'nosniff');
  if (d === '1') out.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(n)}`);
  return new Response(res.body, { status: res.status, headers: out });
}

// ───────────── Drive: cartelle e upload (solo admin) ─────────────

async function createFolder(req, env) {
  await requireAdmin(req, env);
  const { name, parentId } = await req.json();
  if (!name || typeof name !== 'string') throw new HttpError(400, 'Nome cartella mancante.');
  if (parentId && !safeId(parentId)) throw new HttpError(400, 'Cartella non valida.');
  const res = await driveFetch(env, `${DRIVE}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.slice(0, 200), mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : undefined }),
  });
  if (!res.ok) throw new HttpError(502, 'Non riesco a creare la cartella su Drive.');
  return { id: (await res.json()).id };
}

async function startUpload(req, env) {
  await requireAdmin(req, env);
  const { name, mimeType, size, parentId } = await req.json();
  if (!name || !safeId(parentId) || !(size > 0)) throw new HttpError(400, 'Dati del file mancanti.');
  const res = await driveFetch(env, `${DRIVE_UPLOAD}?uploadType=resumable&fields=id,name,size,mimeType`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType || 'application/octet-stream',
      'X-Upload-Content-Length': String(size),
      Origin: req.headers.get('Origin') || '',
    },
    body: JSON.stringify({ name: String(name).slice(0, 200), parents: [parentId] }),
  });
  const uploadUrl = res.headers.get('Location');
  if (!res.ok || !uploadUrl) throw new HttpError(502, 'Drive non accetta il caricamento. Controlla lo spazio disponibile.');
  return { uploadUrl };
}

/** Piano B: se il browser non può inviare il file direttamente a Google, passa da qui. */
async function proxyUpload(req, env) {
  await requireAdmin(req, env);
  const target = new URL(req.url).searchParams.get('u') || '';
  if (!target.startsWith(`${DRIVE_UPLOAD}?`)) throw new HttpError(400, 'Destinazione non valida.');
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_PROXY_UPLOAD) throw new HttpError(413, 'File troppo grande per questo metodo di caricamento.');
  const body = await req.arrayBuffer();
  const res = await fetch(target, { method: 'PUT', body });
  if (!res.ok) throw new HttpError(502, 'Caricamento su Drive non riuscito.');
  return await res.json();
}

async function health(env) {
  const res = await driveFetch(env, `${DRIVE}/about?fields=storageQuota`);
  if (!res.ok) throw new HttpError(502, 'Drive non raggiungibile.');
  const q = (await res.json()).storageQuota || {};
  const gb = (x) => Math.round((Number(x || 0) / 1e9) * 100) / 100;
  return { ok: true, drive: 'collegato', usedGB: gb(q.usage), limitGB: gb(q.limit) };
}

// ───────────── router ─────────────

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    const { pathname } = new URL(req.url);
    try {
      if (req.method === 'GET' && pathname.startsWith('/media/')) return await serveMedia(req, env, pathname.slice(7));
      if (req.method === 'GET' && pathname === '/health') return json(await health(env), 200, req, env);
      if (req.method === 'POST' && pathname === '/media/token') return json(await mediaToken(req, env), 200, req, env);
      if (req.method === 'POST' && pathname === '/admin/folder') return json(await createFolder(req, env), 200, req, env);
      if (req.method === 'POST' && pathname === '/admin/upload') return json(await startUpload(req, env), 200, req, env);
      if (req.method === 'PUT' && pathname === '/admin/upload-proxy') return json(await proxyUpload(req, env), 200, req, env);
      return json({ error: 'Indirizzo non trovato.' }, 404, req, env);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      return json({ error: err instanceof HttpError ? err.message : 'Errore interno del Worker.' }, status, req, env);
    }
  },
};
