/* PersianPod: رفتار اسکرول هدر و داک پایین (فقط زیر ۱۲۰۰px).
   - بعد از اسکرول: کلاس pp-scrolled روی <body> → ردیف منوی هدر محو، داک پایین ظاهر.
   - ارتفاع .pp-bar قفل می‌شود تا با محو شدن ردیف منو، محتوای صفحه بالا نپرد.
   - بعد از ناوبری نرم (pp-nav.js)، تب فعال داک به‌روز می‌شود.
   - وقتی کیبورد موبایل باز است داک پنهان می‌شود (pp-kb). */
(function () {
  "use strict";
  var b = document.body, bar = document.querySelector(".pp-bar"), dock = document.querySelector(".pp-dock");
  if (!dock) return;

  var mq = window.matchMedia("(max-width:1199.98px)");
  var scrolled = false, ON = 70, OFF = 30;

  /* ---- قفل ارتفاع هدر ---- */
  function lock() {
    if (!bar) return;
    if (!mq.matches) { bar.style.minHeight = ""; return; }
    if (scrolled) return;
    bar.style.minHeight = "";
    var h = bar.getBoundingClientRect().height, cs = getComputedStyle(bar);
    if (cs.boxSizing === "content-box") h -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    bar.style.minHeight = Math.ceil(h) + "px";
  }
  var lockQ = 0;
  function lockSoon() { cancelAnimationFrame(lockQ); lockQ = requestAnimationFrame(lock); }

  /* ---- اسکرول (با هیسترزیس تا لرزش نداشته باشد) ---- */
  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var s = mq.matches && (scrolled ? y > OFF : y > ON);
    if (s === scrolled) return;
    scrolled = s;
    b.classList.toggle("pp-scrolled", s);
    if (!s) setMenu(false);
    if (!s) lockSoon();
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- دکمه‌ی «همه‌ی صفحه‌ها»: ردیف کامل منو را بعد از اسکرول دوباره باز می‌کند (آموزش، ثبت پادکست، ...) ---- */
  var mbtn = document.getElementById("t-menu"), openY = 0;
  function setMenu(o) {
    if (o === b.classList.contains("pp-menu-open")) return;
    b.classList.toggle("pp-menu-open", o);
    if (mbtn) { mbtn.setAttribute("aria-pressed", o ? "true" : "false"); mbtn.setAttribute("aria-expanded", o ? "true" : "false"); }
    if (o) openY = window.pageYOffset || 0;
  }
  if (mbtn) mbtn.addEventListener("click", function (e) { e.stopPropagation(); setMenu(!b.classList.contains("pp-menu-open")); });
  document.addEventListener("click", function (e) {
    if (!b.classList.contains("pp-menu-open")) return;
    if (e.target.closest && (e.target.closest(".pp-nav a") || !e.target.closest(".pp-glass"))) setMenu(false);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  window.addEventListener("scroll", function () {
    if (b.classList.contains("pp-menu-open") && Math.abs((window.pageYOffset || 0) - openY) > 80) setMenu(false);
  }, { passive: true });

  function onResize() { scrolled = false; b.classList.remove("pp-scrolled"); lock(); onScroll(); }
  window.addEventListener("resize", onResize);
  if (mq.addEventListener) mq.addEventListener("change", onResize); else if (mq.addListener) mq.addListener(onResize);

  if (window.ResizeObserver) {
    var g = document.querySelector(".pp-glass");
    if (g) new ResizeObserver(function () { if (!scrolled) lockSoon(); }).observe(g);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lockSoon);
  window.addEventListener("load", lockSoon);
  lock(); onScroll();

  /* ---- تب فعال داک بعد از ناوبری نرم ---- */
  function syncCurrent() {
    var here = location.pathname.replace(/index\.html$/, "");
    [].forEach.call(dock.querySelectorAll("a"), function (a) {
      var p = "";
      try { p = new URL(a.href, location.href).pathname.replace(/index\.html$/, ""); } catch (e) {}
      if (p === here) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  document.addEventListener("pp:navigate", function () { setMenu(false); syncCurrent(); scrolled = false; b.classList.remove("pp-scrolled"); lockSoon(); onScroll(); });

  /* ---- کیبورد موبایل ---- */
  var field = "input,textarea,select";
  document.addEventListener("focusin", function (e) { if (e.target.matches && e.target.matches(field)) b.classList.add("pp-kb"); });
  document.addEventListener("focusout", function (e) { if (e.target.matches && e.target.matches(field)) b.classList.remove("pp-kb"); });
})();
