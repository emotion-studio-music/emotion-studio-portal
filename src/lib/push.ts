import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';
import { getLang, t } from './i18n';

const VAPID = ((import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '').trim();
const BASE = (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export type PushState = 'non-supportato' | 'installa-prima' | 'non-configurato' | 'bloccato' | 'spento' | 'attivo';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

function keyToBytes(b64: string) {
  const clean = b64.replace(/[^A-Za-z0-9_\-+/]/g, '');
  const s = clean.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (clean.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  // La chiave giusta è di 65 byte: se ne è stato incollato un carattere in più, iPhone la rifiuta
  return bytes.length > 65 && bytes[0] === 4 ? bytes.slice(0, 65) : bytes;
}

const sameKey = (a: ArrayBuffer | null, b: Uint8Array) => {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
};

// Errori del telefono/browser → messaggio chiaro (con il nome tecnico, utile allo studio)
function pushError(e: unknown): Error {
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError') return new Error('Permesso non concesso. Puoi attivarlo dalle impostazioni del browser o del telefono.');
  return new Error(t('Attivazione non riuscita ({codice}). Chiudi del tutto l’app, riaprila e riprova.', { codice: name || 'errore' }));
}

async function subId(endpoint: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(h)).slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIOS() && !isStandalone() ? 'installa-prima' : 'non-supportato';
  }
  if (isIOS() && !isStandalone()) return 'installa-prima';
  if (!VAPID) return 'non-configurato';
  if (Notification.permission === 'denied') return 'bloccato';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'attivo' : 'spento';
}

/** Chiede il permesso, iscrive questo dispositivo e lo salva nel tuo profilo. */
export async function enablePush() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sessione scaduta.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permesso non concesso. Puoi attivarlo dalle impostazioni del browser o del telefono.');
  let sub: PushSubscription;
  try {
    if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register('/sw.js');
    const reg = await navigator.serviceWorker.ready; // serve il service worker già attivo
    const key = keyToBytes(VAPID);
    const old = await reg.pushManager.getSubscription();
    // iscrizione rimasta da prima con un'altra chiave: la tolgo e ne faccio una nuova
    if (old && !sameKey(old.options.applicationServerKey, key)) await old.unsubscribe();
    const cur = old && sameKey(old.options.applicationServerKey, key) ? old : null;
    sub = cur ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  } catch (e) {
    throw pushError(e);
  }
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await setDoc(doc(db, 'users', uid, 'push', await subId(j.endpoint)), {
    endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: navigator.userAgent.slice(0, 160), createdAt: serverTimestamp(),
  });
  return j;
}

export async function disablePush() {
  const uid = auth.currentUser?.uid;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    if (uid) await deleteDoc(doc(db, 'users', uid, 'push', await subId(sub.endpoint))).catch(() => undefined);
    await sub.unsubscribe();
  }
}

/** Notifica di prova inviata subito dal Worker a questo dispositivo. */
export async function testPush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) throw new Error('Prima attiva le notifiche.');
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${BASE}/push/test`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), lang: getLang() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Invio non riuscito.');
}
