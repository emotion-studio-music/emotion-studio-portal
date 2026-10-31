/* Emotion Studio – service worker: app installabile e caricamento veloce.
   Salva solo i file dell'app (non audio, non dati): quelli arrivano sempre freschi. */
const CACHE = 'emotion-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/logo.png', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // Firebase, Worker, Drive: sempre dalla rete

  // Pagine: prima la rete (versione sempre aggiornata), se offline la copia salvata
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('/index.html', copy));
      return res;
    }).catch(() => caches.match('/index.html')));
    return;
  }

  // File con nome "a impronta" (/assets/…): non cambiano mai, si tengono in cache
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Altri file dell'app: copia salvata subito, aggiornata in background
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
