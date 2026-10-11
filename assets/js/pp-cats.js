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

  function init() {
    applyOrder();
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
