/* BM33 Trainer — service worker for the Infectious dashboard site.
   Network first for everything, so an update is always picked up; each page
   is cached as it is visited, so the dashboard and any trainer already opened
   keep working offline. The sync API is never intercepted. */
const CACHE = 'bm33-site-v3';
const SHELL = ['./', 'index.html', 'Infectious SUM II — MCQ Dashboard.html', 'Infectious SUM I — MCQ Dashboard.html', 'manifest.webmanifest',
               'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // GitHub API goes straight out
  e.respondWith((async () => {
    try {
      // no-cache = always revalidate with the server (ETag), never trust the
      // browser's 10-minute HTTP cache — an update must show on the next open
      const fresh = await fetch(req, { cache: 'no-cache' });
      if (fresh.ok && fresh.type === 'basic') {
        const c = await caches.open(CACHE); c.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return (await caches.match(req, { ignoreSearch: true })) ||
             (req.mode === 'navigate' ? await caches.match('Infectious SUM II — MCQ Dashboard.html') : null) || Response.error();
    }
  })());
});
