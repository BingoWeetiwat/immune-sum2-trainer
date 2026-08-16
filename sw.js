/* Immune Sum II — service worker.
   App shell + data are precached so the app opens instantly offline.
   Slides are precached in the background after install, so the first launch is
   fast and the app becomes fully offline within a minute or so. */

const CACHE = 'immune-sum2-2cfb0820';

const SHELL = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'data.js',
  'slidelist.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // background-fill the slides once the shell is live
    warmSlides();
  })());
});

async function warmSlides() {
  try {
    const c = await caches.open(CACHE);
    const res = await c.match('slidelist.js') || await fetch('slidelist.js');
    const txt = await res.text();
    const m = txt.match(/window\.SLIDELIST\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return;
    const list = JSON.parse(m[1]);
    // small concurrent batches so we never saturate a phone connection
    for (let i = 0; i < list.length; i += 6) {
      await Promise.all(list.slice(i, i + 6).map(async (u) => {
        if (await c.match(u)) return;
        try { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) await c.put(u, r); }
        catch (e) {}
      }));
    }
  } catch (e) {}
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // never intercept the sync API — it must always hit the network
  if (url.hostname === 'api.github.com' || url.hostname === 'gist.githubusercontent.com') return;
  if (url.origin !== self.location.origin) return;

  // navigations: network first so an update is picked up, cache as fallback
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('index.html', fresh.clone());
        return fresh;
      } catch (err) {
        return (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  // everything else: cache first, then network, and cache what comes back
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh.ok && fresh.type === 'basic') {
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return Response.error();
    }
  })());
});
