// sw.js - Progressive Web App Service Worker for Lisa Batch Remote
const CACHE_NAME = 'lisa-batch-remote-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './index.html#tablet'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  // SPA navigation fallback: serve cached index.html for page navigations (e.g., /tablet)
  if (event.request.mode === 'navigate' || event.request.url.includes('/tablet')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match('./index.html').then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                cache.put('./index.html', networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              return cachedResponse;
            });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200 && event.request.method === 'GET') {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Return cached response as fallback
            return cachedResponse;
          });
          
        return cachedResponse || fetchPromise;
      });
    })
  );
});
