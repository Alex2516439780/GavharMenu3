const CACHE_NAME = 'gavhar-static-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/menu.html',
  '/offline.html',
  '/styles.css', // Обновлено для использования неминифицированной версии
  '/script.js',  // Обновлено для использования неминифицированной версии
  '/api.js',     // Обновлено для использования неминифицированной версии
  '/manifest.webmanifest',
  '/ELEMENTS/image 2.png',
  '/ELEMENTS/Gavhar logo-02 13.png',
  '/FONT/Athena-Regular (PERSONAL USE ONLY).woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Handle prewarm messages from pages
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'prewarm' || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    try {
      const apiCache = await caches.open('api-cache');
      await Promise.all(data.urls.map(async (u) => {
        try {
          const res = await fetch(u, { cache: 'no-store' });
          if (res && res.ok) await apiCache.put(u, res.clone());
        } catch(_){}
      }));
    } catch(_){}
  })());
});

// Stale-While-Revalidate для статики; network-first для API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const isGET = request.method === 'GET';
  const url = new URL(request.url);

  // Пропускаем кросс-доменные трекеры/шрифты — пусть идут в сеть (или собственный SW-стратегии браузера)
  const isSameOrigin = url.origin === self.location.origin;
  const acceptsHTML = (request.headers.get('accept') || '').includes('text/html');
  const isHTMLNavigation = isSameOrigin && (request.mode === 'navigate' || acceptsHTML) && !url.pathname.startsWith('/api/');

  if (!isGET) return;

  if (isSameOrigin && url.pathname.startsWith('/api/')) {
    // API: network-first с коротким таймаутом, с кэшированием успешных ответов
    event.respondWith(
      (async () => {
        try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 4000);
          const networkResponse = await fetch(request, { signal: controller.signal });
          clearTimeout(id);
          try {
            if (networkResponse && networkResponse.ok && request.method === 'GET') {
              const apiCache = await caches.open('api-cache');
              apiCache.put(request, networkResponse.clone());
            }
          } catch(_) {}
          return networkResponse;
        } catch (_) {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw _;
        }
      })()
    );
    return;
  }

  // Навигация: offline fallback
  if (isHTMLNavigation) {
    event.respondWith((async () => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 4000);
        const networkResponse = await fetch(request, { signal: controller.signal });
        clearTimeout(id);
        return networkResponse;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        const offline = await cache.match('/offline.html');
        return offline || new Response('Вы офлайн', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // Изображения: если сеть недоступна — вернуть плейсхолдер
  if (request.destination === 'image') {
    event.respondWith((async () => {
      try {
        const res = await fetch(request);
        if (res && res.ok) return res;
        const cache = await caches.open(CACHE_NAME);
        const fallback = await cache.match('/ELEMENTS/image 2.png');
        return fallback || res;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        const fallback = await cache.match('/ELEMENTS/image 2.png');
        return fallback || new Response('', { status: 204 });
      }
    })());
    return;
  }

  // Статика: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && (request.url.startsWith(self.location.origin))) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })()
  );
});


