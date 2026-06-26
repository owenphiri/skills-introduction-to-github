'use strict';
/**
 * SafeGirl EduTrack service worker — makes the app installable on Android and
 * usable offline (critical for rural schools with intermittent connectivity).
 *
 * Strategy:
 *   - App shell (HTML/CSS/JS/icons): cache-first, so the app opens offline.
 *   - API calls: network-only (never serve stale welfare data). The offline
 *     attendance queue lives in the page (app.js) using localStorage and flushes
 *     when connectivity returns.
 */
const CACHE = 'safegirl-shell-v1';
const SHELL = [
  '/', '/index.html', '/styles.css', '/app.js',
  '/manifest.webmanifest', '/assets/icon-192.png', '/assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api')) return; // let the network handle API + the page queue offline writes
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('/index.html'))
    )
  );
});
