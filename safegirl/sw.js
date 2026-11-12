'use strict';
/* SafeGirl EduTrack service worker — offline-first app shell.
   Bump CACHE when any shell file changes so clients update. */
const CACHE = 'safegirl-v1';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './data.js',
  './manifest.webmanifest',
  './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first for the app shell/assets; network falls back to cache offline. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
