(function () {
  var d = document, r = d.documentElement, b = d.body;
  function $(i) { return d.getElementById(i); }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* سال جاری؛ هر سال خودکار به‌روز می‌شود */
  Array.prototype.forEach.call(d.querySelectorAll("[data-year]"), function (el) { el.textContent = String(new Date().getFullYear()); });

  /* day / night */
  var th = $('t-theme');
  if (th) th.addEventListener('click', function () {
    var t = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', t); save('pp-theme', t);
  });

  /* font size */
  function size(delta) {
    var f = parseFloat(getComputedStyle(r).getPropertyValue('--fs')) || 1;
    f = Math.min(1.5, Math.max(0.85, Math.round((f + delta) * 100) / 100));
    r.style.setProperty('--fs', f); save('pp-fs', f);
  }
  var plus = $('t-fs-plus'), minus = $('t-fs-minus');
  if (plus) plus.addEventListener('click', function () { size(0.1); });
  if (minus) minus.addEventListener('click', function () { size(-0.1); });

  /* reading mode */
  var read = $('t-read');
  function setRead(on) {
    b.classList.toggle('reading', on);
    if (read) read.setAttribute('aria-pressed', on ? 'true' : 'false');
    try { sessionStorage.setItem('pp-read', on ? '1' : ''); } catch (e) {}
  }
  if (read) read.addEventListener('click', function () { setRead(!b.classList.contains('reading')); });
  try { if (sessionStorage.getItem('pp-read')) setRead(true); } catch (e) {}

  /* header search: on pages that filter live (home, listen) it never navigates */
  var form = d.querySelector('.pp-search');
  if (form && (d.getElementById('pd-results') || d.getElementById('pl-results')))
    form.addEventListener('submit', function (e) { e.preventDefault(); });

  /* glow under the glass bar after scrolling */
  function sc() { b.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', sc, { passive: true }); sc();
})();

/* درخت دسته‌ها: باز و بسته‌کردن زیردسته‌ها (واگذاری رویداد؛ بعد از ناوبری نرم هم کار می‌کند) */
(function () {
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.pp-cat-tg');
    if (!t) return;
    var li = t.closest('.pp-cat'); if (!li) return;
    var open = li.classList.toggle('open');
    t.setAttribute('aria-expanded', String(open));
  });
})();

/* PWA: ثبت service worker و دکمه‌ی «نصب روی گوشی» */
(function () {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
  var deferred = null;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  function sync() {
    var li = document.querySelector('.pp-install');
    if (!li) return;
    li.hidden = standalone || !(deferred || ios);
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; sync(); });
  window.addEventListener('appinstalled', function () { deferred = null; standalone = true; sync(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#pp-install');
    if (!b) return;
    if (deferred) { deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; sync(); }); }
    else if (ios) { var h = document.querySelector('.pp-install-hint'); if (h) h.hidden = !h.hidden; }
  });
  document.addEventListener('pp:navigate', sync);
  if (document.readyState !== 'loading') sync(); else document.addEventListener('DOMContentLoaded', sync);
})();
