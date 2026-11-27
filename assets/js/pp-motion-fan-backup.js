/* PersianPod: حرکت نرم (بدون کتابخانه)
   ۱) .pd-group .pd-row  ← کارت‌ها «پشته‌ی سه‌بعدی» می‌شوند، دقیقاً مثل کارت‌های اپیزود نویز:
      یک کارت فعال وسط، بقیه پشت آن (چرخش کم، کوچک‌تر، کم‌رنگ‌تر)، شمارنده‌ی «۱ / ۳۰» و دکمه‌های قبلی/بعدی.
      (صفحه‌ی اصلی، «پادکست‌ها» و «گوش بده»)
   ۲) .nw-list .nw-row   ← ردیف‌های «تازه‌ها» هنگام اسکرول از دور به نزدیک می‌آیند
   ردیف‌ها بعد از لود با innerHTML ساخته و هر چند ثانیه دوباره ساخته می‌شوند؛ پس با MutationObserver پیدا می‌شوند. */
(function () {
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = matchMedia("(max-width: 799px)");
  var IO = "IntersectionObserver" in window;
  var VIS = 3, FA = "۰۱۲۳۴۵۶۷۸۹";
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  var memo = {};
  function addStack(row) {
    if (row.__st) return;
    var group = row.closest(".pd-group"), wrap = row.parentNode;
    if (!group || !wrap) return;
    var key = group.getAttribute("aria-label") || "";
    var rtl = getComputedStyle(row).direction === "rtl";
    var SIDE = rtl ? -1 : 1, LEFT_DIR = SIDE === -1 ? 1 : -1, cur = -1;
    function cards() { return [].slice.call(row.querySelectorAll(":scope > .pd-card")); }
    row.classList.add("pp-stack"); row.setAttribute("role", "group");
    row.setAttribute("aria-roledescription", "carousel");
    if (!row.hasAttribute("tabindex")) row.tabIndex = 0;
    var nav = document.createElement("div"); nav.className = "pp-stack-nav";
    nav.innerHTML = '<button type="button" class="pp-stack-btn" data-dir="' + LEFT_DIR + '" aria-label="کارت سمت چپ">\u2039</button><span class="pp-stack-count" aria-live="polite"></span><button type="button" class="pp-stack-btn" data-dir="' + (-LEFT_DIR) + '" aria-label="کارت سمت راست">\u203A</button>';
    wrap.parentNode.insertBefore(nav, wrap.nextSibling);
    var count = nav.querySelector(".pp-stack-count"), btns = [].slice.call(nav.querySelectorAll(".pp-stack-btn"));
    function render() {
      if (!row.isConnected) return;
      var cs = cards(), n = cs.length; if (!n) return;
      if (cur < 0) {
        var sel = -1; cs.forEach(function (c, i) { if (sel < 0 && c.getAttribute("aria-current") === "true") sel = i; });
        cur = memo[key] != null ? memo[key] : (sel >= 0 ? sel : 0);
      }
      cur = Math.max(0, Math.min(n - 1, cur)); memo[key] = cur;
      var W = row.clientWidth || 320, cw = Math.round(Math.max(190, Math.min(260, W * 0.62)));
      row.style.setProperty("--pp-cw", cw + "px");
      var l = Math.min(cur, VIS), r = Math.min(n - 1 - cur, VIS), shift = (r - l) / 2;
      var lim = Math.max(0, (W - cw) / 2 - 6) / (cw * 0.55); shift = Math.max(-lim, Math.min(lim, shift));
      var hmax = 0; cs.forEach(function (c, i) { if (Math.abs(i - cur) <= VIS) hmax = Math.max(hmax, c.offsetHeight); });
      cs.forEach(function (c, i) {
        var d = i - cur, a = Math.abs(d), dc = d < 0 ? -Math.min(a, VIS + 1) : Math.min(a, VIS + 1), ac = Math.abs(dc);
        c.style.setProperty("--pp-t", "translateX(" + ((dc - shift) * 55 * SIDE) + "%) translateZ(" + (-ac * 90) + "px) rotateY(" + (dc * 18 * SIDE) + "deg) rotateZ(" + (dc * 4 * SIDE) + "deg)");
        c.style.zIndex = String(100 - ac); c.style.opacity = a > VIS ? "0" : String(1 - a * 0.18);
        c.style.pointerEvents = a > VIS ? "none" : "auto"; c.style.visibility = a > VIS + 1 ? "hidden" : "";
        c.classList.toggle("is-active", d === 0); c.tabIndex = d === 0 ? 0 : -1;
      });
      row.style.setProperty("--pp-h", Math.ceil(hmax + 34) + "px");
      count.textContent = toFa(cur + 1) + " / " + toFa(n); nav.hidden = n < 2;
      btns.forEach(function (b) { var nx = cur + parseInt(b.getAttribute("data-dir"), 10); b.disabled = nx < 0 || nx > n - 1; });
    }
    function go(k) { var n = cards().length, nk = Math.max(0, Math.min(n - 1, k)); if (nk !== cur) { cur = nk; render(); } }
    var st = row.__st = { go: go, render: render, moved: false, index: function (c) { return cards().indexOf(c); }, SIDE: SIDE, LEFT_DIR: LEFT_DIR, get cur() { return cur; } };
    nav.addEventListener("click", function (e) { var b = e.target.closest("[data-dir]"); if (b && !b.disabled) go(cur + parseInt(b.getAttribute("data-dir"), 10)); });
    row.addEventListener("dragstart", function (e) { e.preventDefault(); });
    var startX = null;
    row.addEventListener("pointerdown", function (e) { startX = e.clientX; st.moved = false; });
    row.addEventListener("pointermove", function (e) { if (startX === null) return; var dx = e.clientX - startX; if (Math.abs(dx) > 60) { go(cur + (dx * SIDE < 0 ? 1 : -1)); startX = e.clientX; st.moved = true; } });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { row.addEventListener(ev, function () { startX = null; }); });
    row.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") { go(cur + LEFT_DIR); e.preventDefault(); } else if (e.key === "ArrowRight") { go(cur - LEFT_DIR); e.preventDefault(); } });
    if (window.MutationObserver) new MutationObserver(function () { render(); }).observe(row, { childList: true });
    window.addEventListener("resize", function onR() { if (!row.isConnected) { window.removeEventListener("resize", onR); return; } render(); });
    render();
  }
  var wheelLock = false;
  document.addEventListener("wheel", function (e) {
    var row = e.target.closest && e.target.closest(".pd-row.pp-stack");
    if (!row || !row.__st || Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 20) return;
    e.preventDefault(); if (wheelLock) return; wheelLock = true;
    row.__st.go(row.__st.cur + (e.deltaX * row.__st.SIDE > 0 ? 1 : -1));
    setTimeout(function () { wheelLock = false; }, 350);
  }, { passive: false });
  document.addEventListener("click", function (e) {
    var card = e.target.closest && e.target.closest(".pd-row.pp-stack > .pd-card");
    if (!card) return; var st = card.parentNode.__st; if (!st) return;
    if (st.moved) { e.preventDefault(); e.stopImmediatePropagation(); st.moved = false; return; }
    if (!card.classList.contains("is-active")) { e.preventDefault(); e.stopImmediatePropagation(); st.go(st.index(card)); }
  }, true);
  var seen = {}, rvIO = IO && !reduce ? new IntersectionObserver(function (es) {
    var vis = es.filter(function (e) { return e.isIntersecting; }).sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
    vis.forEach(function (e, i) {
      var el = e.target; rvIO.unobserve(el); el.style.setProperty("--pp-d", Math.min(i, 5) * 0.14 + "s"); el.classList.add("in-view");
      var done = function () { el.classList.remove("pp-rv", "in-view"); el.style.removeProperty("--pp-d"); };
      el.addEventListener("transitionend", function h(ev) { if (ev.propertyName === "transform") { el.removeEventListener("transitionend", h); done(); } });
      setTimeout(done, 3600 + i * 140);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }) : null;
  function keyOf(li) { var h = li.querySelector(".nw-main h2"), v = document.querySelector('.nw-tabs [aria-selected="true"]'); return (v ? v.getAttribute("data-view") : "") + "|" + (li.getAttribute("data-slug") || "") + "|" + (h ? h.textContent : ""); }
  function addReveal(li) { if (li.__rv || !rvIO) return; li.__rv = true; var k = keyOf(li); if (seen[k]) return; seen[k] = 1; li.classList.add("pp-rv"); rvIO.observe(li); }
  function scan(root) {
    if (root.matches && root.matches(".pd-group .pd-row")) addStack(root);
    if (root.matches && root.matches(".nw-list .nw-row")) addReveal(root);
    if (root.querySelectorAll) { [].forEach.call(root.querySelectorAll(".pd-group .pd-row"), addStack); [].forEach.call(root.querySelectorAll(".nw-list .nw-row"), addReveal); }
  }
  function boot() {
    scan(document);
    new MutationObserver(function (ms) { ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) scan(n); }); }); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();