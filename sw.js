/* Prism Admin — service worker.
   Strategy: network-first for our own files (so updates appear automatically
   whenever the iPad is online), with a cached fallback so it still works offline.
   Cross-origin assets (fonts, CDN) are cache-first so they don't refetch. */
const CACHE = 'prism-admin-v9';
const CORE = [
  './admin-surface.html',
  './index.html',
  './src/css/prism-grammar.css',
  './src/js/prismdb.js',
  './src/js/prism-sync.js',
  './src/js/prism-ai.js',
  './src/js/prism-curate.js',
  './data/legislation_data.js',
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
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (sameOrigin) {
    // network-first: always try for the freshest copy, fall back to cache offline
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./admin-surface.html')))
    );
  } else {
    // cross-origin (fonts / CDN): cache-first so they load fast + offline
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit))
    );
  }
});
