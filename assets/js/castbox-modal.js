/* =========================================================
   PersianPod – باکس شناور کست‌باکس
   با کلیک روی هر لینک castbox.fm یک باکس شناور باز می‌شه که
   پلیر کست‌باکس داخلش هست و زیرش دکمه‌ی «رفتن به کست‌باکس».
   مخاطب اول توی سایت می‌مونه.

   نصب: این فایل رو در assets/js/ بذار و آخر layout (قبل از </body>) اضافه کن:
   <script src="/assets/js/castbox-modal.js" defer></script>
   ========================================================= */
(function () {
  'use strict';

  var EMBED_BASE = 'https://castbox.fm/app/castbox/player/';
  var modal, frameWrap, titleEl, goBtn, lastFocus;

  /* ---- ساخت آدرس embed از لینک کست‌باکس ---- */
  function buildEmbed(url) {
    var ids = String(url).match(/id(\d{3,})/g);
    if (!ids || !ids.length) return null;           // لینک کوتاه یا ناشناس → دست نمی‌زنیم
    var path = ids.slice(0, 2).join('/');           // id کانال [/ id اپیزود]
    return EMBED_BASE + path + '?v=8.22.11&autoplay=0';
  }

  /* ---- ساخت DOM مودال (یک بار) ---- */
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
        '<p class="cbm__hint">اگر پلیر بارگذاری نشد، از دکمه‌ی زیر استفاده کن.</p>' +
        '<a class="cbm__go" target="_blank" rel="noopener noreferrer">رفتن به کست‌باکس ↗</a>' +
      '</div>';
    document.body.appendChild(modal);
    frameWrap = modal.querySelector('.cbm__frame');
    titleEl   = modal.querySelector('.cbm__title');
    goBtn     = modal.querySelector('.cbm__go');

    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-cbm-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!modal.hidden && e.key === 'Escape') close();
    });
  }

  /* ---- باز و بسته کردن ---- */
  function open(href, title, embed) {
    ensureModal();
    lastFocus = document.activeElement;
    titleEl.textContent = title || 'پخش در کست‌باکس';
    goBtn.href = href;

    frameWrap.innerHTML = '';
    var f = document.createElement('iframe');
    f.src = embed;
    f.loading = 'lazy';
    f.title = title || 'Castbox player';
    f.allow = 'autoplay; encrypted-media';
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frameWrap.appendChild(f);

    modal.hidden = false;
    document.documentElement.classList.add('cbm-lock');
    modal.querySelector('.cbm__close').focus();
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    frameWrap.innerHTML = '';                       // پخش متوقف می‌شه
    document.documentElement.classList.remove('cbm-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---- شنود کلیک روی همه‌ی لینک‌های کست‌باکس ---- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="castbox.fm"]');
    if (!a) return;
    if (a.hasAttribute('data-no-modal')) return;    // برای خروج از حالت مودال
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // باز کردن در تب جدید

    var embed = buildEmbed(a.href);
    if (!embed) return;                             // اگه id پیدا نشد، رفتار عادی

    e.preventDefault();
    var holder = a.closest('[data-podcast-title]');
    var title = a.getAttribute('data-title') ||
                (holder && holder.getAttribute('data-podcast-title')) ||
                a.getAttribute('aria-label') ||
                '';
    open(a.href, title, embed);
  });
})();
