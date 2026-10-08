/* =========================================================
   PersianPod – باکس شناور (نسخه‌ی ۲)
   ۱) لینک‌های castbox.fm  → باکس شناور با پلیر + دکمه‌ی «رفتن به کست‌باکس»
   ۲) لینک‌های پیشنهادی / پادکست حمایت‌شده / پادکست نوپا (و هر لینک دلخواه)
      → باکس شناور معرفی + دکمه‌ی «رفتن به ...»
   مخاطب اول توی سایت می‌مونه، بعد اگه خواست می‌ره.

   نصب: assets/js/castbox-modal.js و قبل از </body>:
   <script src="/assets/js/castbox-modal.js" defer></script>
   ========================================================= */
(function () {
  'use strict';

  /* ---------- تنظیمات ----------
     سلکتور بخش‌هایی که لینک‌هاشون باید اول شناور باز بشن.
     اسم کلاس‌ها رو با کلاس‌های واقعی سایتت عوض کن.
     هر لینکی هم که data-float داشته باشه خودکار شناور می‌شه. */
  var FLOAT_SELECTORS = [
    'a[data-float]',
    '.suggested-links a',     // لینک‌های پیشنهادی
    '.sponsored a',           // پادکست حمایت‌شده
    '.newbie a'               // پادکست نوپا
  ];

  var EMBED_BASE = 'https://castbox.fm/app/castbox/player/';
  var modal, bodyEl, titleEl, goBtn, hintEl, lastFocus;

  function buildEmbed(url) {
    var ids = String(url).match(/id(\d{3,})/g);
    if (!ids || !ids.length) return null;
    return EMBED_BASE + ids.slice(0, 2).join('/') + '?v=8.22.11&autoplay=0';
  }

  function ensureModal() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'cbm';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="cbm__backdrop" data-cbm-close></div>' +
      '<div class="cbm__dialog" role="dialog" aria-modal="true" aria-labelledby="cbm-title">' +
        '<button type="button" class="cbm__close" data-cbm-close aria-label="بستن">×</button>' +
        '<h3 class="cbm__title" id="cbm-title"></h3>' +
        '<div class="cbm__frame"></div>' +
        '<p class="cbm__hint"></p>' +
        '<a class="cbm__go" target="_blank" rel="noopener noreferrer"></a>' +
      '</div>';
    document.body.appendChild(modal);
    bodyEl  = modal.querySelector('.cbm__frame');
    titleEl = modal.querySelector('.cbm__title');
    goBtn   = modal.querySelector('.cbm__go');
    hintEl  = modal.querySelector('.cbm__hint');

    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-cbm-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!modal.hidden && e.key === 'Escape') close();
    });
  }

  function show(opts) {
    ensureModal();
    lastFocus = document.activeElement;
    titleEl.textContent = opts.title || '';
    goBtn.href = opts.href;
    goBtn.textContent = opts.cta;
    hintEl.textContent = opts.hint || '';
    hintEl.style.display = opts.hint ? '' : 'none';
    bodyEl.innerHTML = '';
    bodyEl.appendChild(opts.content);
    modal.hidden = false;
    document.documentElement.classList.add('cbm-lock');
    modal.querySelector('.cbm__close').focus();
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    bodyEl.innerHTML = '';                 // پخش متوقف می‌شه
    document.documentElement.classList.remove('cbm-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function pickTitle(a) {
    var holder = a.closest('[data-podcast-title]');
    return a.getAttribute('data-title') ||
           (holder && holder.getAttribute('data-podcast-title')) ||
           a.getAttribute('aria-label') ||
           (a.textContent || '').trim();
  }

  /* ---------- حالت ۱: پلیر کست‌باکس ---------- */
  function openCastbox(a, embed) {
    var f = document.createElement('iframe');
    f.src = embed;
    f.loading = 'lazy';
    f.title = pickTitle(a) || 'Castbox player';
    f.allow = 'autoplay; encrypted-media';
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    show({
      title: pickTitle(a) || 'پخش در کست‌باکس',
      href: a.href,
      cta: 'رفتن به کست‌باکس ↗',
      hint: 'اگر پلیر بارگذاری نشد، از دکمه‌ی زیر استفاده کن.',
      content: f
    });
  }

  /* ---------- حالت ۲: کارت معرفی (پیشنهادی / حمایت‌شده / نوپا) ---------- */
  function openInfo(a) {
    var card = document.createElement('div');
    card.className = 'cbm__info';

    var imgSrc = a.getAttribute('data-img');
    var imgEl  = a.querySelector('img');
    if (!imgSrc && imgEl) imgSrc = imgEl.currentSrc || imgEl.src;
    if (imgSrc) {
      var wrap = document.createElement('span');
      wrap.className = 'cover-ring cbm__cover';
      var im = document.createElement('img');
      im.src = imgSrc; im.alt = '';
      wrap.appendChild(im);
      card.appendChild(wrap);
    }

    var badge = a.getAttribute('data-badge');       // مثلا «پادکست حمایت‌شده»
    if (badge) {
      var b = document.createElement('span');
      b.className = 'cbm__badge';
      b.textContent = badge;
      card.appendChild(b);
    }

    var desc = a.getAttribute('data-desc') || a.getAttribute('title');
    if (desc) {
      var p = document.createElement('p');
      p.className = 'cbm__desc';
      p.textContent = desc;
      card.appendChild(p);
    }

    var host = '';
    try { host = new URL(a.href, location.href).hostname.replace(/^www\./, ''); } catch (e) {}
    show({
      title: pickTitle(a),
      href: a.href,
      cta: a.getAttribute('data-cta') || ('رفتن به ' + (host || 'لینک') + ' ↗'),
      hint: host ? 'این لینک شما را به سایت دیگری می‌برد: ' + host : '',
      content: card
    });
  }

  /* ---------- شنود کلیک ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var a = t.closest('a[href]');
    if (!a || a.hasAttribute('data-no-modal')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;

    if (/castbox\.fm/i.test(a.href)) {
      var embed = buildEmbed(a.href);
      if (!embed) return;
      e.preventDefault();
      openCastbox(a, embed);
      return;
    }
    if (a.matches(FLOAT_SELECTORS.join(','))) {
      e.preventDefault();
      openInfo(a);
    }
  });
})();
