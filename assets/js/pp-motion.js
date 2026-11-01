/* PersianPod: حرکت نرم (بدون کتابخانه)
   ۱) .pd-group .pd-row  ← کارت‌ها بادبزنی می‌شوند (صفحه‌ی اصلی و گوش بده)
   ۲) .nw-list .nw-row   ← ردیف‌های «تازه‌ها» هنگام اسکرول از دور به نزدیک می‌آیند
   ردیف‌ها بعد از لود با innerHTML ساخته و هر چند ثانیه دوباره ساخته می‌شوند؛ پس با MutationObserver پیدا می‌شوند. */
(function () {
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = matchMedia("(max-width: 799px)");
  var IO = "IntersectionObserver" in window;

  /* ================= ۱) بادبزنی ================= */
  var SMOOTH = 0.07;                      // کمتر = آهسته‌تر
  function P() {
    return small.matches
      ? { rz: 3, ry: 30, z: 50, tx: 22, ty: 7, sc: 0.07, op: 0.1 }
      : { rz: 3.5, ry: 30, z: 80, tx: 62, ty: 8, sc: 0.10, op: 0.12 };
  }

  var fans = [];            // ردیف‌های فعال
  var raf = 0, last = 0;

  function addFan(row) {
    if (row.__fan) return;
    row.__fan = { row: row, vis: false, st: null, cards: [] };
    fans.push(row.__fan);
    if (IO) {
      fanIO.observe(row);
    } else {
      row.__fan.vis = true; wake();
    }
    row.addEventListener("scroll", wake, { passive: true });
  }

  var fanIO = IO ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.target.__fan.vis = e.isIntersecting; });
    wake();
  }, { rootMargin: "150px" }) : null;

  function wake() { if (!raf) raf = requestAnimationFrame(tick); }

  function tick(now) {
    var dt = last ? Math.min(now - last, 50) : 16.7;
    last = now;
    var k = 1 - Math.pow(1 - SMOOTH, dt / 16.7);   // نرمی مستقل از نرخ فریم
    var p = P(), busy = false;

    fans = fans.filter(function (f) { return f.row.isConnected; });
    fans.forEach(function (f) {
      if (!f.vis) return;
      var cards = f.row.querySelectorAll(".pd-card");
      if (cards.length !== f.cards.length) { f.st = null; }       // ردیف دوباره ساخته شد
      f.cards = cards;
      var cx = f.row.clientWidth / 2;
      var sl = f.row.scrollLeft, ro = f.row.offsetLeft;
      var fresh = !f.st;
      if (fresh) f.st = [];

      for (var i = 0; i < cards.length; i++) {
        // از موقعیت چیدمان (نه getBoundingClientRect) می‌خوانیم تا transform خودِ کارت روی محاسبه اثر نگذارد
        var w = cards[i].offsetWidth || 1;
        var n = ((cards[i].offsetLeft - ro) + w / 2 - sl - cx) / w;   // فاصله از وسط، بر حسب «تعداد کارت» (۱ = کارت کناری)
        var an = Math.min(Math.abs(n), 3), sg = n < 0 ? -1 : 1;
        var t = reduce ? { rz: 0, ry: 0, z: 0, x: 0, y: 0, s: 1, o: 1, f: 0 } : {
          rz: sg * Math.min(an, 2.2) * p.rz,                 // کمی چرخش مثل بادبزن
          ry: -sg * Math.min(an, 1.6) / 1.6 * p.ry,          // رو به وسط می‌چرخد (کاروسل)
          z: -Math.min(an, 2) * p.z,                         // عقب‌تر می‌رود
          x: -sg * an * p.tx,                                // به هم نزدیک‌تر می‌شوند
          y: an * an * p.ty,
          s: 1.05 - Math.min(an, 2.5) * p.sc,
          o: Math.max(0.45, 1 - an * p.op),
          f: Math.max(0, 1 - an * 1.5)               // کارت وسط کمی درخشان می‌شود
        };
        var s = f.st[i] || (f.st[i] = {});
        for (var key in t) {
          if (s[key] === undefined) s[key] = t[key];          // اولین بار بدون پرش
          var diff = t[key] - s[key];
          if (Math.abs(diff) > 0.003) busy = true;
          s[key] += diff * (fresh ? 1 : k);
        }
        cards[i].style.setProperty("transform",
          "translateX(" + s.x.toFixed(2) + "px) translateY(" + s.y.toFixed(2) + "px) translateZ(" + s.z.toFixed(1) + "px) " +
          "rotateY(" + s.ry.toFixed(2) + "deg) rotate(" + s.rz.toFixed(2) + "deg) scale(" + s.s.toFixed(4) + ")", "important");
        cards[i].style.opacity = s.o.toFixed(3);
        cards[i].style.setProperty("--f", s.f.toFixed(3));
        cards[i].style.zIndex = String(100 - Math.round(an * 10));
      }
    });

    if (busy) { raf = requestAnimationFrame(tick); }
    else { raf = 0; last = 0; }
  }
  window.addEventListener("resize", wake);

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
