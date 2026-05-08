const CACHE_NAME = 'chathere-v1';
const OFFLINE_URL = '/';

// Assets to cache for fast loading
const PRECACHE_ASSETS = [
  '/',
  '/style.css?v=PREMIUM_V1',
  '/script.js?v=FINAL_REV5',
  '/logo.png',
  '/favicon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/manifest.json'
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for HTML/API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and socket.io requests
  if (request.method !== 'GET' || request.url.includes('/socket.io/')) return;

  // API calls: network only
  if (request.url.includes('/api/')) return;

  // Static assets (images, fonts, CSS, JS): cache-first
  if (request.url.match(/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|css|js)(\?.*)?$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // HTML: network-first with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request) || caches.match(OFFLINE_URL))
  );
});
