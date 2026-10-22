// The service worker of the web app. The build (vite.config.ts) fills in the
// version and the list of files, and serves this as /sw.js. It is plain
// JavaScript because it runs outside the app, in the browser's worker.
//
// The app's own files are kept on install, so the app opens with no network.
// The page itself is fetched fresh when possible, so updates arrive. Requests
// to other sites (Supabase, Google Drive) are never touched.

const VERSION = "__VERSION__";
const FILES = __FILES__;
const CACHE = `notemax-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener("activate", (event) => {
  // Older versions' files go once this one is in charge.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("notemax-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "update") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;

  // The page: the network first, so a new version shows; the kept copy when offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/", { ignoreSearch: true })));
    return;
  }

  // Everything else of the app's own: the kept copy first, else the network, kept for next time.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
