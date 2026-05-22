const CACHE_NAME = 'chathere-v3';
const OFFLINE_URL = '/';

// Minimal precache - just the offline fallback
const PRECACHE_ASSETS = [
  '/',
  '/logo.png',
  '/favicon.png',
  '/manifest.json'
];

// Install: cache minimal assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete ALL old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for everything, cache fallback only for offline
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET, socket.io, and API requests
  if (request.method !== 'GET') return;
  if (request.url.includes('/socket.io/')) return;
  if (request.url.includes('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for offline fallback
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
  );
});
