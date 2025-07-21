self.addEventListener('install', (e) => {
  self.skipWaiting(); // 安裝後立即啟用
});

self.addEventListener('activate', (e) => {
  clients.claim(); // 立即接管頁面
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request)) // 總是從網路抓最新的，有錯才用快取
  );
});
