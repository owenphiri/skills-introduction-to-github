/*
 * Service worker: offline app shell + stale-while-revalidate for static
 * assets. API calls are network-only (KPIs must be fresh); the dashboard
 * page itself is cached so the shell opens instantly in the poultry house.
 */
const VERSION = 'primeaxis-v1';
const SHELL = ['/dashboard', '/manifest.json', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept cross-origin (the API) or non-GET requests.
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  // Static assets: cache-first with background refresh.
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fresh = fetch(event.request).then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copy));
          return res;
        });
        return cached ?? fresh;
      }),
    );
    return;
  }

  // Pages: network-first, fall back to cached shell when offline.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached ?? caches.match('/dashboard')),
      ),
  );
});
