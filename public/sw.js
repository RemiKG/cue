/* Cue service worker — real PWA offline. Precache the app shell + fonts, cache built
   assets on first use, and fall back to the cached shell when the network is down, so
   Cue keeps conducting from the cached score. The /api/* routes are never cached. */
const CACHE = 'cue-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/app-icon.png',
  '/fonts/Rokkitt.ttf',
  '/fonts/SpaceMono-Regular.ttf',
  '/fonts/SpaceMono-Bold.ttf',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
