// LoreBook service worker — Phase 10 (PWA pass).
// Hand-written rather than next-pwa/Workbox: next-pwa hooks into webpack,
// and this project builds with `next build --turbopack`, which doesn't run
// webpack plugins, so a build-integrated SW generator wouldn't actually run.
// A plain static file has no such dependency.

const CACHE_NAME = "lorebook-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave Supabase/Groq/etc. alone
  if (url.pathname.startsWith("/api/")) return; // never cache API responses

  // Hashed, immutable build assets — cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Only full page loads get the offline fallback. Client-side navigations
  // (RSC payloads, prefetches) go straight to the network: intercepting them
  // added a service-worker hop plus a cache write to every click.
  if (request.mode !== "navigate") return;

  // Network-first, cached fallback for offline access to pages already opened.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
