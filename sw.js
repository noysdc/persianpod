/* PersianPod service worker
   - صفحه‌ها، CSS، JS و داده‌ها: اول شبکه (همیشه تازه)، اگر آفلاین بود از حافظه
   - تصویر و فونت: اول حافظه، پشت‌صحنه تازه می‌شود
   - هیچ درخواست بیرونی (پخش صدا، RSS، فرم) دست‌کاری نمی‌شود */
const V = 'pp-v1';
const SHELL = V + '-shell', IMG = V + '-img';
const PRECACHE = ['/', '/offline/', '/assets/img/pwa-192.png', '/assets/img/persianpod-icon.svg'];
const IMG_LIMIT = 150;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(V)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName), keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function networkFirst(req, fallbackUrl) {
  const c = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: req.mode !== 'navigate' });
    if (hit) return hit;
    if (fallbackUrl) { const off = await c.match(fallbackUrl); if (off) return off; }
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(IMG), hit = await c.match(req);
  const net = fetch(req).then((res) => {
    if (res && res.ok) { c.put(req, res.clone()); trim(IMG, IMG_LIMIT); }
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname.startsWith('/api/') || req.headers.has('range')) return;

  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, '/offline/')); return; }
  if (/\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf)$/i.test(url.pathname)) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (/\.(?:css|js|json|webmanifest)$/i.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
});
