/* PersianPod: حرکت نرم (بدون کتابخانه)
   ۱) .pd-group .pd-row  ← کارت‌ها بادبزنی می‌شوند (صفحه‌ی اصلی و گوش بده)
   ۲) .nw-list .nw-row   ← ردیف‌های «تازه‌ها» هنگام اسکرول از دور به نزدیک می‌آیند
   ردیف‌ها بعد از لود با innerHTML ساخته و هر چند ثانیه دوباره ساخته می‌شوند؛ پس با MutationObserver پیدا می‌شوند. */
(function () {
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = matchMedia("(max-width: 799px)");
  var IO = "IntersectionObserver" in window;

  /* ================= ۱) بادبزنی ظریف ================= */
  // کارت‌ها مستقیم با موقعیت اسکرول حرکت می‌کنند (بدون تأخیر و لرزش). تغییرات خیلی کوچک و با منحنی نرم‌اند.
  function P() {
    return small.matches
      ? { rz: 2.6, ty: 4, sc: 0.04, op: 0.09, px: 5 }
      : { rz: 2.8, ty: 5, sc: 0.045, op: 0.09, px: 7 };
  }
  function soft(x) { var t = Math.min(1, x / 2.4); return t * t * (3 - 2 * t) * 2.4; }   // smoothstep: شروع و پایان نرم

  function layout(row) {
    var cards = row.querySelectorAll(".pd-card"), cx = row.clientWidth / 2, sl = row.scrollLeft, ro = row.offsetLeft, fx = cx;
    if (row.clientWidth < 520 && cards.length > 1) {
      // موبایل: در ابتدا کارت اول «فوکوس» است و با اولین اسکرول، فوکوس نرم به وسط می‌آید
      var x0 = (cards[0].offsetLeft - ro) + cards[0].offsetWidth / 2;
      var x1 = (cards[1].offsetLeft - ro) + cards[1].offsetWidth / 2;
      var D = Math.max(40, Math.abs(x1 - cx));
      var t = Math.min(1, Math.abs(sl) / D);
      fx = x0 + (cx - x0) * t;
    }
    return { cards: cards, cx: cx, fx: fx, sl: sl, ro: ro };
  }
  function nOf(card, L) {                 // فاصله از فوکوس بر حسب «تعداد کارت»؛ از موقعیت چیدمان (نه transform)
    var w = card.offsetWidth || 1;
    return ((card.offsetLeft - L.ro) + w / 2 - L.sl - L.fx) / w;
  }
  function limits(row) {
    var max = Math.max(0, row.scrollWidth - row.clientWidth);
    return getComputedStyle(row).direction === "rtl" ? [-max, 0] : [0, max];
  }

  function paint(row) {
    var L = layout(row), p = P(), sp = row.__spread === undefined ? 1 : row.__spread;
    for (var i = 0; i < L.cards.length; i++) {
      var c = L.cards[i], n = nOf(c, L), an = Math.min(Math.abs(n), 2.4), sg = n < 0 ? -1 : 1;
      if (reduce) { c.style.removeProperty("transform"); continue; }
      var e = soft(an);
      var rz = sg * e * p.rz;
      var ty = e * e * p.ty * 0.5;
      var sc = 1.02 - e * p.sc;
      var tx = sp < 1 ? -n * (c.offsetWidth - 24) * (1 - sp) : 0;       // ورود: کارت‌ها از وسط باز می‌شوند
      c.style.setProperty("transform",
        "translateX(" + tx.toFixed(1) + "px) translateY(" + ty.toFixed(2) + "px) rotate(" + rz.toFixed(2) + "deg) scale(" + sc.toFixed(4) + ")", "important");
      c.style.opacity = (Math.max(0.62, 1 - e * p.op) * (0.25 + 0.75 * sp)).toFixed(3);
      c.style.setProperty("--f", Math.max(0, 1 - an * 1.5).toFixed(3));
      c.style.setProperty("--px", (-Math.max(-1.2, Math.min(1.2, n)) * p.px).toFixed(2) + "px");   // پارالاکس کاور داخل قاب
      c.style.zIndex = String(100 - Math.round(an * 10));
    }
    // دکمه‌ها در ابتدا و انتهای ردیف کم‌رنگ و غیرفعال می‌شوند
    var lim = limits(row), wrap = row.parentNode;
    var atStart = Math.abs(row.scrollLeft - (getComputedStyle(row).direction === "rtl" ? lim[1] : lim[0])) < 2;
    var atEnd = Math.abs(row.scrollLeft - (getComputedStyle(row).direction === "rtl" ? lim[0] : lim[1])) < 2;
    var pv = wrap.querySelector(".pd-prev"), nx = wrap.querySelector(".pd-next");
    if (pv) pv.setAttribute("aria-disabled", atStart ? "true" : "false");
    if (nx) nx.setAttribute("aria-disabled", atEnd ? "true" : "false");
  }

  var queued = [];
  function schedule(row) {
    if (queued.indexOf(row) < 0) queued.push(row);
    if (queued.length === 1) requestAnimationFrame(function () {
      var q = queued; queued = [];
      q.forEach(function (r) { if (r.isConnected) paint(r); });
    });
  }

  function intro(row) {                   // یک بار، وقتی ردیف برای اولین بار دیده می‌شود
    if (reduce || row.__introDone) return;
    row.__introDone = true; row.__spread = 0;
    var t0 = performance.now(), dur = 1500;
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur);
      row.__spread = 1 - Math.pow(1 - t, 4);                 // easeOutQuart
      paint(row);
      if (t < 1 && row.isConnected) requestAnimationFrame(step); else row.__spread = 1;
    })(t0);
  }

  var fanIO = IO ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { intro(e.target); schedule(e.target); } });
  }, { threshold: 0.25 }) : null;

  function addFan(row) {
    if (row.__fan) return;
    row.__fan = true;
    row.addEventListener("scroll", function () { schedule(row); }, { passive: true });
    if (fanIO) fanIO.observe(row);
    schedule(row);
    setTimeout(function () { schedule(row); }, 150);
  }
  window.addEventListener("resize", function () {
    [].forEach.call(document.querySelectorAll(".pd-group .pd-row"), schedule);
  });

  /* ---- دکمه‌های اسلایدر: هر بار دقیقاً یک کارت، با حرکت آرام ---- */
  var anim = new WeakMap();
  function ease(t) { return t * t * t * (t * (t * 6 - 15) + 10); }       // smootherstep: بسیار نرم

  function centeredIndex(row) {
    var L = layout(row), best = 0, bd = 1e9;
    for (var i = 0; i < L.cards.length; i++) { var d = Math.abs(nOf(L.cards[i], L)); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function targetLeft(row, idx) {
    var L = layout(row), c = L.cards[idx], lim = limits(row);
    var to = (c.offsetLeft - L.ro) + c.offsetWidth / 2 - L.cx;
    return Math.max(lim[0], Math.min(lim[1], to));                       // از ابتدا/انتها جلوتر نرود
  }
  function goTo(row, idx) {
    var cards = row.querySelectorAll(".pd-card");
    idx = Math.max(0, Math.min(cards.length - 1, idx));
    var from = row.scrollLeft, to = targetLeft(row, idx);
    var st = anim.get(row); if (st) cancelAnimationFrame(st.raf);
    if (reduce || Math.abs(to - from) < 1) { row.style.scrollSnapType = ""; if (reduce) row.scrollLeft = to; anim.delete(row); return; }
    var dur = 1050, t0 = performance.now();
    row.style.scrollSnapType = "none";                 // وسط حرکت، snap مزاحم نشود
    var rec = { idx: idx, raf: 0 };
    anim.set(row, rec);
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur);
      row.scrollLeft = from + (to - from) * ease(t);
      if (t < 1) rec.raf = requestAnimationFrame(step);
      else { row.style.scrollSnapType = ""; anim.delete(row); }
    })(t0);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".pd-group .pd-arrow");
    if (!a) return;
    var row = a.parentNode.querySelector(".pd-row");
    if (!row) return;
    e.stopImmediatePropagation(); e.preventDefault();   // کلیک را از اسکریپت قدیمی (که چند کارت می‌پرید) می‌گیریم
    if (a.getAttribute("aria-disabled") === "true") return;
    var rec = anim.get(row);
    var cur = rec ? rec.idx : centeredIndex(row);
    goTo(row, cur + (a.getAttribute("data-dir") === "next" ? 1 : -1));
  }, true);

  /* ================= ۲) ورود از دور به نزدیک ================= */
  var seen = {};            // ردیف‌هایی که یک‌بار نمایش داده شده‌اند؛ با بازسازی ۳۰ ثانیه‌ایِ فهرست دوباره حرکت نکنند
  var pending = [];
  var rvIO = IO && !reduce ? new IntersectionObserver(function (es) {
    var vis = es.filter(function (e) { return e.isIntersecting; })
                .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
    vis.forEach(function (e, i) {
      var el = e.target;
      rvIO.unobserve(el);
      el.style.setProperty("--pp-d", Math.min(i, 5) * 0.14 + "s");   // تأخیر کوچک بین ردیف‌های هم‌زمان
      el.classList.add("in-view");
      var done = function () { el.classList.remove("pp-rv", "in-view"); el.style.removeProperty("--pp-d"); };
      el.addEventListener("transitionend", function h(ev) {
        if (ev.propertyName === "transform") { el.removeEventListener("transitionend", h); done(); }
      });
      setTimeout(done, 3600 + i * 140);   // اگر transitionend نیامد
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }) : null;

  function keyOf(li) {
    var h = li.querySelector(".nw-main h2");
    var v = document.querySelector('.nw-tabs [aria-selected="true"]');
    return (v ? v.getAttribute("data-view") : "") + "|" + (li.getAttribute("data-slug") || "") + "|" + (h ? h.textContent : "");
  }
  function addReveal(li) {
    if (li.__rv || !rvIO) return;
    li.__rv = true;
    var k = keyOf(li);
    if (seen[k]) return;          // قبلاً نمایش داده شده: همان‌طور ساده بماند
    seen[k] = 1;
    li.classList.add("pp-rv");    // پیش از اولین رنگ‌آمیزی (microtask) اعمال می‌شود
    rvIO.observe(li);
  }

  /* ================= پیدا کردن عناصر ================= */
  function scan(root) {
    if (root.matches && root.matches(".pd-group .pd-row")) addFan(root);
    if (root.matches && root.matches(".nw-list .nw-row")) addReveal(root);
    if (root.querySelectorAll) {
      [].forEach.call(root.querySelectorAll(".pd-group .pd-row"), addFan);
      [].forEach.call(root.querySelectorAll(".nw-list .nw-row"), addReveal);
    }
  }
  function boot() {
    scan(document);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) scan(n); });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
