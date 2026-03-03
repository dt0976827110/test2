const CACHE_VERSION = 'acs-v' + Date.now();
const STATIC_CACHE  = 'acs-static-v1';

// 安裝：只快取靜態資源（不快取 index.html）
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll([
      './manifest.json',
      './logo(3).png',
      'https://cdn.jsdelivr.net/npm/chart.js'
    ]))
  );
  self.skipWaiting();
});

// 啟動：清除舊快取，立即接管
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 攔截請求
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // index.html → 永遠網路優先，失敗才用快取
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 其他靜態資源 → 快取優先
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
