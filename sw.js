/* PersianPod service worker (v2)
   قبلاً: همه‌ی CSS/JS/JSON «اول شبکه» بدون مهلت بود (در اینترنت ضعیف صفحه تا قطع کامل اتصال منتظر می‌ماند)،
   هر کاور در هر نمایش یک درخواست تازه‌سازی می‌زد، و کش پوسته با هر دیپلوی (پارامتر ?v=) بی‌پایان بزرگ می‌شد؛
   در حالت آفلاین هم قدیمی‌ترین search.json برمی‌گشت (از همین‌جا عدد «۲۰ پادکست»).
   حالا:
   - صفحه‌ها و داده‌ها (json): اول شبکه با مهلت ۴ ثانیه، بعد کش؛ کلید کش = فقط مسیر، پس همیشه آخرین نسخه نگه داشته می‌شود
   - CSS/JS نسخه‌دار (?v=) و فونت: اول کش (محتوای هر نسخه ثابت است)
   - کاورها: اول کش، بدون تازه‌سازی در هر نمایش؛ سقف ۴۰۰ تصویر
   - ایندکس قسمت‌ها (assets/sidx) و فایل قسمت‌ها (assets/eps) و درخواست‌های بیرونی دست‌نخورده می‌مانند */
const V = 'pp-v2';
const SHELL = V + '-shell', STATIC = V + '-static', IMG = V + '-img';
const PRECACHE = ['/offline/', '/assets/img/pwa-192.png', '/assets/img/persianpod-icon.svg'];
const IMG_LIMIT = 400, NET_TIMEOUT = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(V)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

let puts = 0;
async function trim(cacheName, max) {
  const c = await caches.open(cacheName), keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
const keyOf = (url) => new Request(url.origin + url.pathname);   // بدون ?query: هر مسیر فقط یک نسخه (جدیدترین)

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

/* شبکه با مهلت؛ اگر دیر کرد از کش جواب می‌دهیم و درخواست شبکه برای بار بعد تمام می‌شود */
async function networkFirst(req, url, fallbackUrl) {
  const c = await caches.open(SHELL), key = keyOf(url);
  const net = fetch(req).then((res) => { if (res && res.ok) c.put(key, res.clone()); return res; });
  try {
    return await withTimeout(net, NET_TIMEOUT);
  } catch (err) {
    net.catch(() => {});                                   // خطای بعدیِ همان درخواست بی‌صدا
    const hit = await c.match(key);
    if (hit) return hit;
    if (req.mode === 'navigate' && fallbackUrl) { const off = await c.match(fallbackUrl); if (off) return off; }
    return net;                                            // کشی نبود: منتظر همان درخواست می‌مانیم
  }
}

async function cacheFirst(req, cacheName, limit) {
  const c = await caches.open(cacheName), hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) {
    c.put(req, res.clone());
    if (limit && ++puts % 25 === 0) trim(cacheName, limit);
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname.startsWith('/api/') || req.headers.has('range')) return;
  if (url.pathname.startsWith('/assets/sidx/') || url.pathname.startsWith('/assets/eps/')) return;

  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, url, '/offline/')); return; }
  if (/\.(?:png|jpe?g|webp|gif|ico)$/i.test(url.pathname)) { e.respondWith(cacheFirst(req, IMG, IMG_LIMIT)); return; }
  if (/\.(?:woff2?|ttf|svg)$/i.test(url.pathname)) { e.respondWith(cacheFirst(req, STATIC, 120)); return; }
  if (/\.(?:css|js)$/i.test(url.pathname)) {
    /* نسخه‌دار (?v=): محتوا ثابت است، اول کش. بدون نسخه: مثل داده‌ها اول شبکه */
    if (url.searchParams.has('v')) e.respondWith(cacheFirst(req, STATIC, 120)); else e.respondWith(networkFirst(req, url));
    return;
  }
  if (/\.(?:json|webmanifest)$/i.test(url.pathname)) { e.respondWith(networkFirst(req, url)); return; }
});
