/* Prism Admin — service worker (offline app shell) */
const CACHE = 'prism-admin-v1';
const CORE = [
  './admin-surface.html',
  './src/css/prism-grammar.css',
  './src/js/prismdb.js',
  './manifest.webmanifest',
  './pwa/icon-192.png',
  './pwa/icon-512.png',
  './pwa/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first for GETs, then network; runtime-cache successful responses
   (incl. cross-origin fonts) so the app keeps working offline after first load. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      try {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      } catch (_) {}
      return res;
    }).catch(() => caches.match('./admin-surface.html')))
  );
});
