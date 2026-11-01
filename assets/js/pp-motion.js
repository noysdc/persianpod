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
  var SMOOTH = 0.04;                      // کمتر = آهسته‌تر و نرم‌تر
  function P() {
    return small.matches
      ? { angle: 5, drop: 10, shrink: 0.05, fade: 0.22 }   // موبایل: ملایم، تا لبه‌ها بیرون نزنند
      : { angle: 7, drop: 14, shrink: 0.07, fade: 0.28 };
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
      var rr = f.row.getBoundingClientRect();
      var cx = rr.left + rr.width / 2, half = rr.width / 2 || 1;
      var fresh = !f.st;
      if (fresh) f.st = [];

      for (var i = 0; i < cards.length; i++) {
        var b = cards[i].getBoundingClientRect();
        var d = ((b.left + b.width / 2) - cx) / half;            // حدود ۱- تا ۱
        var ad = Math.min(Math.abs(d), 1.2);
        var t = reduce ? { r: 0, y: 0, s: 1, o: 1 } : {
          r: Math.max(-p.angle * 1.2, Math.min(p.angle * 1.2, d * p.angle)),
          y: ad * ad * p.drop,
          s: 1 - ad * p.shrink,
          o: 1 - ad * p.fade
        };
        var s = f.st[i] || (f.st[i] = { r: t.r, y: t.y, s: t.s, o: t.o });   // اولین بار بدون پرش
        for (var key in t) {
          var diff = t[key] - s[key];
          if (Math.abs(diff) > 0.002) busy = true;
          s[key] += diff * (fresh ? 1 : k);
        }
        // important: قانون hover سایت (transform:none !important) نباید حرکت را قطع کند
        cards[i].style.setProperty("transform",
          "translateY(" + s.y.toFixed(2) + "px) rotate(" + s.r.toFixed(2) + "deg) scale(" + s.s.toFixed(4) + ")", "important");
        cards[i].style.opacity = s.o.toFixed(3);
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
