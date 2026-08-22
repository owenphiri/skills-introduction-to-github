// Musenga MIS service worker: offline cache + web push display.
// subscribePush() in index.html only registers a push subscription with the
// (optional, user-configured) gateway server — actually showing the
// notification when a push arrives is this file's job, via the "push" and
// "notificationclick" handlers below.
const CACHE_NAME = "musenga-mis-v540";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE_NAME).then((c) =>
      c.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request)
            .then((res) => {
              if (res.ok) c.put(e.request, res.clone());
              return res;
            })
            .catch(() => caches.match("/"))
      )
    )
  );
});

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
    data = { title: "Musenga MIS", body: e.data ? e.data.text() : "" };
  }
  const title = data.title || "Musenga MIS";
  const options = { body: data.body || "", data: { url: data.url || "/" } };
  if (data.icon) options.icon = data.icon;
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if (w.url.includes(self.registration.scope) && "focus" in w) return w.focus();
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
