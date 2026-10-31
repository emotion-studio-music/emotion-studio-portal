/**
 * Emotion Studio · Worker Cloudflare ("emotion-api")
 *
 * Fa da ponte tra l'app e il Google Drive dello studio:
 *  - streaming degli MP3 tramite URL firmati a scadenza (con supporto Range per iPhone)
 *  - download delle versioni, solo se abilitato dall'admin
 *  - creazione cartelle e caricamento file su Drive (versioni: admin · demo: artista)
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
 *   FIREBASE_SA_JSON      secret  chiave JSON del service account Firebase: serve per creare gli account
 *                                 e per cambiare nome utente / password degli artisti
 *   CALENDAR_ICS_URL      secret  (facoltativo) "indirizzo segreto in formato iCal" del Google Calendar dello studio
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
  const { artistId, versionId, demoId, projectId, download } = body || {};
  if (!safeId(artistId) || !(safeId(versionId) || safeId(demoId) || safeId(projectId))) throw new HttpError(400, 'Richiesta non valida.');
  let fileId, fileName;
  if (projectId) {
    // Copertina originale del progetto: l'artista la scarica solo se lo studio l'ha permesso.
    const p = await readDocAsUser(env, user, `artists/${artistId}/projects/${projectId}`);
    if (!p || !p.coverFileId || !safeId(p.coverFileId)) throw new HttpError(404, 'Copertina non disponibile.');
    if (p.coverDownload !== true && !(await readDocAsUser(env, user, `admins/${user.uid}`))) {
      throw new HttpError(403, 'La copertina non è ancora scaricabile.');
    }
    fileId = p.coverFileId;
    fileName = p.coverFileName || `${p.title || 'copertina'}.jpg`;
  } else if (demoId) {
    // Demo caricata dall'artista: il file deve essere davvero una demo di QUESTO artista.
    const d = await readDocAsUser(env, user, `artists/${artistId}/demos/${demoId}`);
    if (!d || !d.fileId || !safeId(d.fileId)) throw new HttpError(404, 'Demo non trovata.');
    const meta = await driveFetch(env, `${DRIVE}/files/${d.fileId}?fields=appProperties`);
    const props = meta.ok ? (await meta.json()).appProperties || {} : {};
    if (props.emotionDemoOf !== artistId) throw new HttpError(403, 'File non valido.');
    fileId = d.fileId; fileName = d.fileName || 'demo.m4a';
  } else {
    const v = await readDocAsUser(env, user, `artists/${artistId}/versions/${versionId}`);
    if (!v || !v.mp3FileId) throw new HttpError(404, 'Versione non trovata.');
    if (download && v.downloadEnabled !== true) throw new HttpError(403, 'Il download di questa versione non è abilitato.');
    fileId = v.mp3FileId; fileName = v.fileName || 'brano.mp3';
  }
  const e = Math.floor(Date.now() / 1000) + MEDIA_TTL_SECONDS;
  const d = download ? '1' : '0';
  const n = String(fileName).replace(/[^\w.\- ()àèéìòù]/gi, '_').slice(0, 120);
  const s = await sign(env, `${fileId}|${e}|${d}|${n}`);
  const base = new URL(req.url).origin;
  const q = new URLSearchParams({ e: String(e), d, n, s });
  return { url: `${base}/media/${fileId}?${q}` };
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

// ───────────── account artisti (facoltativo: serve il service account) ─────────────

let saToken = { value: null, exp: 0 };

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getServiceToken(env) {
  if (saToken.value && Date.now() < saToken.exp) return saToken.value;
  let sa;
  try { sa = JSON.parse(env.FIREBASE_SA_JSON); } catch { throw new HttpError(500, 'Chiave del service account non leggibile.'); }
  const now = Math.floor(Date.now() / 1000);
  const head = bytesToB64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = bytesToB64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })));
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', b64ToBytes(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = bytesToB64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${claim}`)));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  });
  if (!res.ok) throw new HttpError(502, 'Il service account non è stato accettato da Google.');
  const data = await res.json();
  saToken = { value: data.access_token, exp: Date.now() + (data.expires_in - 120) * 1000 };
  return saToken.value;
}

/** Crea l'account dell'artista dal server: così la registrazione dall'esterno può restare chiusa. */
async function createUser(req, env) {
  await requireAdmin(req, env);
  if (!env.FIREBASE_SA_JSON) return { skipped: true };
  const { email, password } = await req.json();
  if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'Email o password non valide.');
  }
  const token = await getServiceToken(env);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error?.message || '';
    if (code.includes('EMAIL_EXISTS')) throw new HttpError(409, 'Esiste già un account con questa email.');
    throw new HttpError(502, 'Non riesco a creare l’account.');
  }
  return { uid: data.localId };
}

/** Cambia nome utente (email interna) e/o password di un artista. Solo studio, serve il service account. */
async function updateUser(req, env) {
  await requireAdmin(req, env);
  if (!env.FIREBASE_SA_JSON) throw new HttpError(501, 'Per cambiare password o nome utente serve la chiave del service account nel Worker (vedi README, Fase F).');
  const { uid, email, password } = await req.json();
  if (!safeId(uid)) throw new HttpError(400, 'Utente non valido.');
  const body = { localId: uid };
  if (email !== undefined) {
    if (typeof email !== 'string' || !email.includes('@')) throw new HttpError(400, 'Nome utente non valido.');
    body.email = email.trim().toLowerCase();
  }
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'La password deve avere almeno 8 caratteri.');
    body.password = password;
  }
  const token = await getServiceToken(env);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:update`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error?.message || '';
    if (code.includes('EMAIL_EXISTS')) throw new HttpError(409, 'Questo nome utente è già usato da un altro artista.');
    throw new HttpError(502, 'Non riesco ad aggiornare l’account.');
  }
  return { ok: true };
}

// ───────────── Google Calendar dello studio (indirizzo segreto iCal) ─────────────

const SESSION_WORDS = [['registrazione', 'Registrazione'], ['rec', 'Registrazione'], ['mixing', 'Mix'], ['mix', 'Mix'],
  ['mastering', 'Mastering'], ['master', 'Mastering'], ['produzione', 'Produzione'], ['prod', 'Produzione'],
  ['scrittura', 'Scrittura'], ['video', 'Video'], ['consulenza', 'Consulenza']];
let icsCache = { at: 0, events: null };

function romeParts(d) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const o = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return `${o.year}-${o.month}-${o.day}T${o.hour === '24' ? '00' : o.hour}:${o.minute}`;
}

/** Valore DTSTART → "AAAA-MM-GGTHH:mm" ora di Roma + timestamp per ordinare */
function icsTime(value, params) {
  if (/VALUE=DATE/.test(params) || /^\d{8}$/.test(value)) {
    const local = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T09:00`;
    return { local, allDay: true, ms: Date.parse(`${local}:00Z`) - 3600_000 };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!m) return null;
  if (m[7] === 'Z') {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return { local: romeParts(d), allDay: false, ms: d.getTime() };
  }
  // ora "di parete" (TZID=Europe/Rome o senza fuso): la teniamo così com'è
  const local = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  return { local, allDay: false, ms: Date.parse(`${local}:00Z`) - 3600_000 };
}

function unescapeIcs(t) { return t.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim(); }

/** Prossima ricorrenza (solo DAILY/WEEKLY, i casi tipici di uno studio) */
function nextOccurrence(start, rrule, now) {
  const r = Object.fromEntries(rrule.split(';').map((kv) => kv.split('=')));
  const step = r.FREQ === 'DAILY' ? 86_400_000 : r.FREQ === 'WEEKLY' ? 7 * 86_400_000 : 0;
  if (!step) return start.ms >= now ? start : null;
  const interval = (Number(r.INTERVAL) || 1) * step;
  let k = start.ms >= now ? 0 : Math.ceil((now - start.ms) / interval);
  if (r.COUNT && k >= Number(r.COUNT)) return null;
  const ms = start.ms + k * interval;
  if (r.UNTIL) { const u = icsTime(r.UNTIL, ''); if (u && ms > u.ms) return null; }
  const shifted = new Date(Date.parse(`${start.local}:00Z`) + k * interval);
  const local = shifted.toISOString().slice(0, 16);
  return { local, allDay: start.allDay, ms };
}

async function calendarEvents(env) {
  if (!env.CALENDAR_ICS_URL) return null;
  if (icsCache.events && Date.now() - icsCache.at < 5 * 60_000) return icsCache.events;
  const res = await fetch(env.CALENDAR_ICS_URL);
  if (!res.ok) throw new HttpError(502, 'Non riesco a leggere Google Calendar. Controlla l’indirizzo iCal nel Worker.');
  const text = (await res.text()).replace(/\r?\n[ \t]/g, '');
  const now = Date.now() - 3 * 3600_000; // teniamo anche le sessioni iniziate da poco
  const horizon = Date.now() + 60 * 86_400_000;
  const events = [];
  for (const block of text.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    const get = (name) => {
      const m = new RegExp(`^${name}([;:][^\\r\\n]*)$`, 'm').exec(body);
      if (!m) return null;
      const line = m[1];
      const i = line.indexOf(':');
      return { params: line.slice(0, i), value: line.slice(i + 1) };
    };
    if ((get('STATUS')?.value || '').toUpperCase() === 'CANCELLED') continue;
    const ds = get('DTSTART');
    if (!ds) continue;
    let start = icsTime(ds.value.trim(), ds.params);
    if (!start) continue;
    const rr = get('RRULE');
    if (rr) start = nextOccurrence(start, rr.value.trim(), now);
    if (!start || start.ms < now || start.ms > horizon) continue;
    const title = unescapeIcs(get('SUMMARY')?.value || '');
    if (!title) continue;
    events.push({ at: start.local, allDay: start.allDay, ms: start.ms, title });
  }
  events.sort((a, b) => a.ms - b.ms);
  icsCache = { at: Date.now(), events };
  return events;
}

function sessionType(title) {
  const t = title.toLowerCase();
  const hit = SESSION_WORDS.find(([w]) => new RegExp(`\\b${w}\\b`).test(t));
  return hit ? hit[1] : '';
}

const matchesArtist = (title, name) => name && new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu').test(title);

/** Prossima sessione di un artista: solo gli eventi con il suo nome nel titolo. */
async function calendarNext(req, env) {
  const user = await verifyUser(req, env);
  const { artistId } = await req.json();
  if (!safeId(artistId)) throw new HttpError(400, 'Richiesta non valida.');
  const artist = await readDocAsUser(env, user, `artists/${artistId}`);
  if (!artist) throw new HttpError(403, 'Non hai accesso a questo artista.');
  const events = await calendarEvents(env);
  if (!events) return { configured: false, session: null };
  const ev = events.find((e) => matchesArtist(e.title, artist.stageName));
  return { configured: true, session: ev ? { at: ev.at, type: sessionType(ev.title), allDay: ev.allDay } : null };
}

/** Per la vista "Oggi": le prossime sessioni del calendario (solo studio). */
async function calendarUpcoming(req, env) {
  await requireAdmin(req, env);
  const events = await calendarEvents(env);
  if (!events) return { configured: false, events: [] };
  return { configured: true, events: events.slice(0, 50).map((e) => ({ at: e.at, title: e.title, allDay: e.allDay, type: sessionType(e.title) })) };
}

// ───────────── cartelle dell'artista (stesse per admin e artista) ─────────────

const FOLDER = 'application/vnd.google-apps.folder';

async function findByProp(env, key, value) {
  const q = `appProperties has { key='${key}' and value='${value}' } and mimeType='${FOLDER}' and trashed=false`;
  const res = await driveFetch(env, `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  if (!res.ok) return null;
  const files = (await res.json()).files || [];
  return files[0]?.id || null;
}

async function makeFolder(env, name, parentId, props) {
  const res = await driveFetch(env, `${DRIVE}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: String(name).slice(0, 200), mimeType: FOLDER, parents: parentId ? [parentId] : undefined, appProperties: props }),
  });
  if (!res.ok) throw new HttpError(502, 'Non riesco a creare la cartella su Drive.');
  return (await res.json()).id;
}

/** Trova o crea: Emotion Studio – App / Artista. Usa prima gli ID già salvati nell'app. */
async function resolveArtistFolder(env, user, artistId) {
  const artist = await readDocAsUser(env, user, `artists/${artistId}`);
  if (!artist) throw new HttpError(403, 'Non hai accesso a questo artista.');
  if (artist.driveFolderId) return { artist, artistFolderId: artist.driveFolderId, rootId: null };
  const found = await findByProp(env, 'emotionArtist', artistId);
  if (found) return { artist, artistFolderId: found, rootId: null };
  const settings = await readDocAsUser(env, user, 'settings/drive');
  let rootId = settings?.rootFolderId || await findByProp(env, 'emotionRoot', '1');
  if (!rootId) rootId = await makeFolder(env, 'Emotion Studio – App', null, { emotionRoot: '1' });
  const artistFolderId = await makeFolder(env, artist.stageName || 'Artista', rootId, { emotionArtist: artistId });
  return { artist, artistFolderId, rootId };
}

async function adminArtistFolder(req, env) {
  const user = await requireAdmin(req, env);
  const { artistId } = await req.json();
  if (!safeId(artistId)) throw new HttpError(400, 'Artista non valido.');
  const { artistFolderId, rootId } = await resolveArtistFolder(env, user, artistId);
  return { artistFolderId, rootId };
}

const MAX_DEMO = 100 * 1024 * 1024;

/** L'artista carica una demo: va nella sua cartella "Demo", di proprietà dello studio. */
async function artistUpload(req, env) {
  const user = await verifyUser(req, env);
  const { artistId, name, mimeType, size } = await req.json();
  if (!safeId(artistId) || !name || !(size > 0)) throw new HttpError(400, 'Dati del file mancanti.');
  if (size > MAX_DEMO) throw new HttpError(413, 'Il file supera i 100 MB.');
  if (mimeType && !/^(audio|video)\//.test(mimeType)) throw new HttpError(415, 'Carica un file audio.');
  const { artistFolderId } = await resolveArtistFolder(env, user, artistId);
  let demos = await findByProp(env, 'emotionDemos', artistId);
  if (!demos) demos = await makeFolder(env, 'Demo', artistFolderId, { emotionDemos: artistId });
  const res = await driveFetch(env, `${DRIVE_UPLOAD}?uploadType=resumable&fields=id,name,size,mimeType`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType || 'audio/mp4',
      'X-Upload-Content-Length': String(size),
      Origin: req.headers.get('Origin') || '',
    },
    body: JSON.stringify({ name: String(name).slice(0, 200), parents: [demos], appProperties: { emotionDemoOf: artistId } }),
  });
  const uploadUrl = res.headers.get('Location');
  if (!res.ok || !uploadUrl) throw new HttpError(502, 'Drive non accetta il caricamento. Riprova più tardi.');
  return { uploadUrl };
}

async function artistUploadProxy(req, env) {
  const user = await verifyUser(req, env);
  const url = new URL(req.url);
  const target = url.searchParams.get('u') || '';
  const artistId = url.searchParams.get('a') || '';
  if (!safeId(artistId) || !target.startsWith(`${DRIVE_UPLOAD}?`)) throw new HttpError(400, 'Destinazione non valida.');
  if (!(await readDocAsUser(env, user, `artists/${artistId}`))) throw new HttpError(403, 'Non hai accesso a questo artista.');
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_PROXY_UPLOAD) throw new HttpError(413, 'File troppo grande per questo metodo di caricamento.');
  const res = await fetch(target, { method: 'PUT', body: await req.arrayBuffer() });
  if (!res.ok) throw new HttpError(502, 'Caricamento su Drive non riuscito.');
  return await res.json();
}

/** Lo studio elimina una demo: il file va nel Cestino di Drive (recuperabile per 30 giorni). */
async function trashDemo(req, env) {
  const user = await requireAdmin(req, env);
  const { artistId, demoId } = await req.json();
  if (!safeId(artistId) || !safeId(demoId)) throw new HttpError(400, 'Richiesta non valida.');
  const d = await readDocAsUser(env, user, `artists/${artistId}/demos/${demoId}`);
  if (!d || !d.fileId || !safeId(d.fileId)) return { ok: true, trashed: false };
  const meta = await driveFetch(env, `${DRIVE}/files/${d.fileId}?fields=appProperties`);
  const props = meta.ok ? (await meta.json()).appProperties || {} : {};
  if (props.emotionDemoOf !== artistId) throw new HttpError(403, 'File non valido.');
  const res = await driveFetch(env, `${DRIVE}/files/${d.fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok && res.status !== 404) throw new HttpError(502, 'Non riesco a spostare il file nel Cestino di Drive.');
  return { ok: true, trashed: true };
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
      if (req.method === 'POST' && pathname === '/admin/artist-folder') return json(await adminArtistFolder(req, env), 200, req, env);
      if (req.method === 'POST' && pathname === '/calendar/next') return json(await calendarNext(req, env), 200, req, env);
      if (req.method === 'POST' && pathname === '/admin/calendar') return json(await calendarUpcoming(req, env), 200, req, env);
      if (req.method === 'POST' && pathname === '/admin/update-user') return json(await updateUser(req, env), 200, req, env);
      if (req.method === 'POST' && pathname === '/admin/create-user') return json(await createUser(req, env), 200, req, env);
      if (req.method === 'POST' && pathname === '/admin/demo-trash') return json(await trashDemo(req, env), 200, req, env);
      if (req.method === 'POST' && pathname === '/artist/upload') return json(await artistUpload(req, env), 200, req, env);
      if (req.method === 'PUT' && pathname === '/artist/upload-proxy') return json(await artistUploadProxy(req, env), 200, req, env);
      return json({ error: 'Indirizzo non trovato.' }, 404, req, env);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      return json({ error: err instanceof HttpError ? err.message : 'Errore interno del Worker.' }, status, req, env);
    }
  },
};
