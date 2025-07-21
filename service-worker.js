self.addEventListener('install', event => {
  self.skipWaiting(); // 安裝完立刻啟用
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim()); // 立刻控制所有頁面
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
