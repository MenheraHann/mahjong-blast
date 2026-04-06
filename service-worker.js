// service-worker.js - PWA service worker for offline caching

caches.delete('mahjong-game-v1');

cacheName = 'mahjong-game-v1';
coreAssets = [
  './',
  './index.html',
  './manifest.json',
  './js/game.js',
  './js/scenes/home.js',
  './js/scenes/game.js',
  './js/scenes/results.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(cacheName)
      .then(cache => cache.addAll(coreAssets))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== cacheName)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});