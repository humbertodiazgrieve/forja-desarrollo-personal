const CACHE_NAME = 'forja-shell-v2';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/mark.svg'];
const PROTECTED_PATH = /\/(?:auth|rest|functions)(?:\/|$)/;
const SENSITIVE_QUERY = /^(?:access_token|refresh_token|token|code|apikey)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('forja-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isSensitive(url) {
  for (const key of url.searchParams.keys()) if (SENSITIVE_QUERY.test(key)) return true;
  return false;
}

function isExcluded(url) {
  return url.origin !== self.location.origin || PROTECTED_PATH.test(url.pathname) || isSensitive(url);
}

function isStaticAsset(request, url) {
  return (
    SHELL_ASSETS.includes(url.pathname) ||
    url.pathname.startsWith('/performance/') ||
    ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)
  );
}

async function networkFirstNavigation(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      if (url.pathname === '/' || url.pathname === '/index.html') {
        await cache.put('/index.html', response.clone());
      } else if (url.pathname.startsWith('/performance/')) {
        await cache.put(request, response.clone());
      }
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (url.pathname === '/' || url.pathname === '/index.html') return caches.match('/index.html');
    return new Response('Esta página no está disponible sin conexión.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(request) {
  if (new URL(request.url).pathname.startsWith('/performance/')) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw Error('El recurso de Performance no está disponible sin conexión.');
    }
  }
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isExcluded(url)) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (isStaticAsset(request, url)) event.respondWith(cacheFirst(request));
});
