const CACHE = "guard-duty-v42";
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll([
          "/",
          "/app.js",
          "/instructions.js",
          "/material.js",
          "/shift-time.js",
          "/patrol-time.js",
          "/vault.js",
          "/style.css",
          "/icon.svg",
          "/icon-192.png",
          "/icon-512.png",
          "/manifest.json",
        ]),
      ),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
          ),
        ),
    ]),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== location.origin ||
    new URL(e.request.url).pathname.startsWith("/api") ||
    new URL(e.request.url).pathname.startsWith("/media")
  )
    return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
