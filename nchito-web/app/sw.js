/*
 * Cache-first service worker.
 *
 * Nchito is built around intermittent Zambian connectivity, so the app itself
 * should survive losing signal. Everything is precached on install; once
 * installed the app opens with no network at all.
 */
const CACHE = 'nchito-v2';
// Registered from /app/, so its scope is /app/ and the landing page at the root
// is never intercepted or cached by it.
const ASSETS = [
  './', 'index.html', 'styles.css', 'catalog.js', 'data.js', 'app.js', 'manifest.webmanifest',
  '../brand/logo.svg', '../brand/icon.svg',
  '../brand/icon-32.png', '../brand/icon-180.png',
  '../brand/icon-192.png', '../brand/icon-512.png',
];

self.addEventListener('install', e => {
  // Individual failures must not fail the whole install, or one missing asset
  // leaves the app with no offline support at all.
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      // Cache successful same-origin responses so a first visit online makes
      // every subsequent visit work offline.
      if (res.ok && new URL(e.request.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
