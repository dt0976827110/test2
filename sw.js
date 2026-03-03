const CACHE_NAME = 'acs-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo(3).png',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 安裝：快取所有資源
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 啟動：清除舊快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 攔截請求：優先用快取，失敗再網路
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
