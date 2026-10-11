/*
  نوار دسته‌ها (چیپ‌ها)
  ۱) چیدمان تصادفی: با هر بار لود صفحه، جای دسته‌ها عوض می‌شود تا هیچ دسته‌ای همیشه اول یا آخر نباشد («همه» همیشه اول می‌ماند).
     ترتیب در طول گشت‌وگذار نرم (بدون لود کامل) ثابت می‌ماند و فقط با لود دوباره‌ی صفحه عوض می‌شود.
  ۲) دسکتاپ: چیپ‌ها یک ردیف کشیدنی‌اند؛ با ماوس می‌شود گرفت و کشید (در موبایل با انگشت، خودِ مرورگر).
  ۳) دسته‌ی انتخاب‌شده در ردیف به وسط می‌آید.
*/
(function () {
  "use strict";

  var order = null;                       // ترتیب این بار لود (کلید = data-cat)
  var obs = null;

  function listEl() { return document.querySelector(".pp-cats > ul"); }
  function keyOf(li) { var a = li.querySelector(":scope > a[data-cat]"); return a ? a.getAttribute("data-cat") : null; }

  function rnd() {
    try { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); }
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function applyOrder() {
    var ul = listEl(); if (!ul) return;
    var items = [].slice.call(ul.children).filter(function (li) { return li.classList.contains("pp-cat"); });
    var all = items.filter(function (li) { return keyOf(li) === ""; })[0];          // «همه»
    var rest = items.filter(function (li) { return li !== all && keyOf(li) !== null; });
    if (!order) order = shuffle(rest.map(keyOf));
    var by = {}; rest.forEach(function (li) { by[keyOf(li)] = li; });
    var frag = document.createDocumentFragment();
    if (all) frag.appendChild(all);
    order.forEach(function (k) { if (by[k]) { frag.appendChild(by[k]); delete by[k]; } });
    Object.keys(by).forEach(function (k) { frag.appendChild(by[k]); });             // دسته‌ی تازه که در ترتیب نبود
    ul.appendChild(frag);
  }

  function centerActive(smooth) {
    var ul = listEl(); if (!ul || ul.scrollWidth <= ul.clientWidth + 2) return;
    var a = ul.querySelector("a[aria-current][data-cat]:not([data-sub])");
    if (!a || a.getAttribute("data-cat") === "") { return; }
    var ur = ul.getBoundingClientRect(), ar = a.getBoundingClientRect();
    var delta = (ar.left + ar.width / 2) - (ur.left + ur.width / 2);
    if (Math.abs(delta) < 4) return;
    ul.scrollTo({ left: ul.scrollLeft + delta, behavior: smooth ? "smooth" : "auto" });
  }

  /* ---------- فلش‌های چپ و راست (دسکتاپ) + چرخ ماوس ---------- */
  var ICON = {
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function rooms(ul) {                    // چقدر جا برای اسکرول به چپ و راست مانده (مستقل از RTL/LTR)
    var max = ul.scrollWidth - ul.clientWidth, pos = Math.abs(ul.scrollLeft);
    var rtl = getComputedStyle(ul).direction === "rtl";
    return rtl ? { left: max - pos, right: pos } : { left: pos, right: max - pos };
  }
  function updateArrows() {
    var nav = document.querySelector(".pp-cats"), ul = listEl(); if (!nav || !ul) return;
    var l = nav.querySelector(".pp-cat-arrow.l"), r = nav.querySelector(".pp-cat-arrow.r"); if (!l || !r) return;
    var over = ul.scrollWidth > ul.clientWidth + 2, rm = rooms(ul);
    nav.classList.toggle("has-arrows", over);
    l.hidden = !over || rm.left < 2; r.hidden = !over || rm.right < 2;
  }
  function scrollStrip(dir) {
    var ul = listEl(); if (!ul) return;
    ul.scrollBy({ left: dir * Math.max(160, ul.clientWidth * 0.6), behavior: "smooth" });
  }
  function ensureArrows() {
    var nav = document.querySelector(".pp-cats"), ul = listEl(); if (!nav || !ul) return;
    if (!nav.querySelector(".pp-cat-arrow")) {
      [["l", "left", -1, "دسته‌های سمت چپ"], ["r", "right", 1, "دسته‌های سمت راست"]].forEach(function (a) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "pp-cat-arrow " + a[0]; b.hidden = true;
        b.setAttribute("aria-label", a[3]); b.innerHTML = ICON[a[1]];
        b.addEventListener("click", function () { scrollStrip(a[2]); });
        nav.appendChild(b);
      });
    }
    if (!ul.__ppArrows) {
      ul.__ppArrows = true;
      ul.addEventListener("scroll", updateArrows, { passive: true });
      ul.addEventListener("wheel", function (e) {      // چرخ عمودی ماوس روی نوار، آن را افقی می‌لغزاند
        if (ul.scrollWidth <= ul.clientWidth + 2) return;
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        e.preventDefault(); ul.scrollBy({ left: e.deltaY });
      }, { passive: false });
      if (window.ResizeObserver) new ResizeObserver(updateArrows).observe(ul);
    }
    updateArrows();
  }
  window.addEventListener("resize", updateArrows);

  function init() {
    applyOrder();
    ensureArrows();
    var nav = document.querySelector(".pp-cats");
    if (obs) obs.disconnect();
    if (nav && window.MutationObserver) {
      obs = new MutationObserver(function () { centerActive(true); });
      obs.observe(nav, { subtree: true, attributes: true, attributeFilter: ["aria-current"] });
    }
    centerActive(false);
  }

  /* ---------- کشیدن با ماوس ---------- */
  var drag = null, moved = false;

  document.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    var ul = e.target.closest && e.target.closest(".pp-cats > ul");
    if (!ul || ul.scrollWidth <= ul.clientWidth + 2) return;
    drag = { ul: ul, x: e.clientX, left: ul.scrollLeft, rtl: getComputedStyle(ul).direction === "rtl" };
    moved = false;
  });
  window.addEventListener("mousemove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    if (!moved && Math.abs(dx) < 5) return;
    moved = true;
    drag.ul.classList.add("is-dragging");
    drag.ul.scrollLeft = drag.rtl ? drag.left + dx : drag.left - dx;
    e.preventDefault();
  });
  function stop() {
    if (!drag) return;
    drag.ul.classList.remove("is-dragging");
    drag = null;
    setTimeout(function () { moved = false; }, 0);   // کلیکِ بعد از کشیدن نادیده گرفته شود
  }
  window.addEventListener("mouseup", stop);
  window.addEventListener("blur", stop);
  document.addEventListener("click", function (e) {
    if (moved && e.target.closest && e.target.closest(".pp-cats > ul")) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("dragstart", function (e) {
    if (e.target.closest && e.target.closest(".pp-cats > ul")) e.preventDefault();   // لینک‌ها با درگ بومی جابه‌جا نشوند
  });

  document.addEventListener("pp:navigate", init);
  init();
})();
