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

/**
 * How long the page waits for the network before opening the kept copy. A
 * weak signal can leave a request hanging far longer than the app takes to
 * open, and the kept copy is the version already running here.
 */
const PAGE_WAIT_MS = 1500;

async function pageFor(request) {
  const network = fetch(request);
  const kept = await caches.match("/", { ignoreSearch: true });
  if (!kept) return network;
  const late = new Promise((resolve) => setTimeout(() => resolve(kept), PAGE_WAIT_MS));
  return Promise.race([network.catch(() => kept), late]);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  // The installers and their version files always come fresh from the network.
  if (url.pathname.startsWith("/desktop/") || url.pathname.startsWith("/android/")) return;

  // The page: the network first, so a new version shows; the kept copy when offline.
  if (request.mode === "navigate") {
    event.respondWith(pageFor(request));
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
