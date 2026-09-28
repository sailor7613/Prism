/* Prism Admin — service worker.
   Strategy: network-first for our own files (so updates appear automatically
   whenever the iPad is online), with a cached fallback so it still works offline.
   Cross-origin assets (fonts, CDN) are cache-first so they don't refetch. */
const CACHE = 'prism-admin-v35';
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
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Live APIs are never cached (2026-07-30): cache-first on the GDELT wire
  // would freeze a repeated ⌕ scan on its first answer forever.
  if (url.hostname === 'api.gdeltproject.org') return;
  // Live data is never cached (2026-09-26, the portal now registers this
  // worker too): Readings, drafts, the register and the gates must always
  // come fresh, or a tester's phone would freeze on its first copy.
  if (/(^|\.)(api\.github\.com|raw\.githubusercontent\.com|workers\.dev|congress\.gov)$/.test(url.hostname)) return;

  if (sameOrigin) {
    // network-first: always try for the freshest copy, fall back to cache offline
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match(url.pathname.includes('/v2/') ? './v2/index.html' : './admin-surface.html')))
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

// ── Push (2026-09-26): a new Reading published ──
// Pushes arrive empty (no per-subscriber encryption needed); the worker reads
// the notice from the push-gate and shows it. Tapping opens the portal.
const PUSH_GATE = 'https://push-gate.shanecorwin.workers.dev';
self.addEventListener('push', (e) => {
  e.waitUntil(
    fetch(PUSH_GATE + '/latest', { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => ({ title: 'Prism', body: 'A new Reading is up.', url: './v2/index.html' }))
      .then((n) => self.registration.showNotification(n.title || 'Prism', {
        body: n.body || 'A new Reading is up.',
        icon: new URL('pwa/icon-192.png', self.registration.scope).href,
        badge: new URL('pwa/icon-192.png', self.registration.scope).href,
        tag: 'prism-reading', renotify: true,
        data: { url: new URL(n.url || './v2/index.html', self.registration.scope).href },
      }))
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || new URL('./v2/index.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const open = wins.find((w) => w.url.includes('/v2/'));
    if (open) { open.navigate(url).catch(() => {}); return open.focus(); }
    return self.clients.openWindow(url);
  }));
});
