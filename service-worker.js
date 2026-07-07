/* AERONAV·FPX service worker
   - App shell: cache-first (works instantly offline once installed)
   - Live airport dataset: network-first, falls back to last cached copy
     if offline (and the app itself already has a baked-in fallback
     dataset if there's no cache either — see flight-planner.html)
*/

const CACHE_NAME = 'aeronav-fpx-v1';
const AIRPORT_DATA_HOST = 'raw.githubusercontent.com';

const APP_SHELL = [
  './flight-planner.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let host = '';
  try { host = new URL(req.url).host; } catch (e) { /* ignore */ }

  // Live airport dataset: try the network first, fall back to cache.
  if (host === AIRPORT_DATA_HOST) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // App shell and everything else: cache-first, network fallback.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => cached);
    })
  );
});
