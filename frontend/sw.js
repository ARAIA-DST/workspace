const CACHE = 'araia-workspace-v5.0.0';
const SHELL = ['./', './index.html', './styles.css', './app.js', './workspace.js', './workflow-ui.js', './workflow-catalog.js', './catalog-ui.js', './module-catalog.js', './offline.js', './csv.js', './data.js', './bridge.js', './config.js', './manifest.webmanifest', './assets/app-mark.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/araia-logo-white.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
