const CACHE_NAME = 'chathere-v12';
const OFFLINE_URL = '/';

const PRECACHE_ASSETS = [
  '/',
  '/logo.png',
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache bypass for dynamic assets to ensure instant updates and no lag
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET, socket.io, and API requests
  if (request.method !== 'GET') return;
  if (request.url.includes('/socket.io/')) return;
  if (request.url.includes('/api/')) return;

  const url = new URL(request.url);

  // If it's a precached static branding asset, serve from cache with network fallback
  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Otherwise, bypass the Service Worker entirely to leverage standard HTTP caching.
  // This completely resolves reload lag and prevents obsolete cache version bugs!
  return;
});
