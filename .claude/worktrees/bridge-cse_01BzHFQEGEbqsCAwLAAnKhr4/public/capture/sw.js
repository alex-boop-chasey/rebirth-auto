/*
 * Capture PWA service worker — SCOPED TO /capture ONLY.
 * ---------------------------------------------------------------------------
 * This file lives at /capture/sw.js, so its DEFAULT max scope is `/capture/` —
 * a service worker can never control a path above its own directory. It is also
 * registered with an explicit `{ scope: '/capture/' }`. Both facts mean it can
 * NEVER intercept or cache the shopper site at `/` — the fetch handler below
 * additionally hard-guards to same-origin GETs under `/capture` and bails on
 * everything else. This is deliberate: the main site must never get a SW (see
 * docs/briefs/dealer-pwa.md — no caching surprises on the shopper site).
 *
 * Offline SHELL only. There is NO offline data sync (no queued API writes, no
 * background sync) — that is noted as future work. API calls (/api/capture/*)
 * are never cached; they always hit the network.
 */
const CACHE = 'capture-shell-v1';
const SHELL = ['/capture', '/capture/manifest.webmanifest', '/capture/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Hard scope guard: only ever touch same-origin GETs under /capture. Anything
  // else (the shopper site, other origins, non-GET) falls through to the network
  // untouched — the SW is invisible outside its surface.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/capture')) return;

  // Never cache the capture API — always network so drafts/lookups stay live.
  if (url.pathname.startsWith('/capture/') && url.pathname.includes('/api/')) return;

  // Network-first for the shell, cache fallback so an installed PWA opens offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/capture'))),
  );
});
