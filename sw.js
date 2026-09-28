/**
 * Offline support.
 *
 * App code (HTML/JS/CSS) is network-first: online you always get the version
 * that was last deployed, and the cache is only a fallback for when there is no
 * signal. Icons and other static assets stay cache-first since they rarely
 * change and are the slowest to refetch.
 *
 * An earlier version served everything cache-first, which meant a freshly
 * deployed change did not appear until the second launch.
 */
const CACHE = 'ironlog-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css',
  './js/app.js', './js/router.js', './js/store.js', './js/db.js',
  './js/ui.js', './js/charts.js', './js/theme.js',
  './js/data/exercises.js', './js/data/templates.js',
  './js/views/home.js', './js/views/templates.js', './js/views/session.js',
  './js/views/history.js', './js/views/progress.js', './js/views/settings.js',
  './js/views/picker.js',
  './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Assets that are safe to serve from cache without checking the network. */
const isStaticAsset = (url) => /\/assets\/|\.(png|jpe?g|svg|webp|woff2?)$/i.test(url.pathname);

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (isStaticAsset(url)) {
    // Cache-first: these are immutable in practice.
    e.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      })),
    );
    return;
  }

  // Network-first for app code, so a deploy is live on the very next launch.
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      })
      .catch(async () => {
        // Offline: fall back to the cache, and for a navigation fall back to
        // the app shell so deep links still open.
        const hit = await caches.match(request);
        if (hit) return hit;
        if (request.mode === 'navigate') {
          const shell = await caches.match('./index.html') || await caches.match('./');
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
