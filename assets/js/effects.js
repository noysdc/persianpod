/* =====================================================
   PersianPod – افکت‌های حرکتی (بدون کتابخانه)
   ===================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileMQ = window.matchMedia('(max-width: 640px)');

  /* ---------- ۱) بادبزنی ---------- */
  // کمتر = آهسته‌تر و نرم‌تر. (مستقل از نرخ فریم گوشی/مانیتور)
  var SMOOTH = 0.035;

  function params() {
    return mobileMQ.matches
      ? { angle: 9,  drop: 22, shrink: 0.08, fade: 0.28 }   // موبایل: ملایم‌تر
      : { angle: 15, drop: 36, shrink: 0.12, fade: 0.35 };
  }

  function initFanRow(row) {
    if (row.__fanReady) return;
    row.__fanReady = true;

    var cards = [].slice.call(row.querySelectorAll('.fan-card'));
    if (!cards.length) return;

    var state = cards.map(function () { return { r: 0, y: 0, s: 1, o: 1 }; });
    var visible = false, raf = 0, last = 0, settled = false;

    function tick(now) {
      var dt = last ? Math.min(now - last, 50) : 16.67;
      last = now;
      var k = 1 - Math.pow(1 - SMOOTH, dt / 16.67);   // ضریب نرم‌سازی مستقل از fps
      var P = params();

      var rr = row.getBoundingClientRect();
      var cx = rr.left + rr.width / 2;
      var half = rr.width / 2 || 1;
      var moving = false;

      for (var i = 0; i < cards.length; i++) {
        var b = cards[i].getBoundingClientRect();
        var d = ((b.left + b.width / 2) - cx) / half;   // حدوداً بین -1 و 1
        var ad = Math.min(Math.abs(d), 1.2);

        var t = reduceMotion
          ? { r: 0, y: 0, s: 1, o: 1 }
          : {
              r: Math.max(-P.angle * 1.3, Math.min(P.angle * 1.3, d * P.angle)),
              y: ad * ad * P.drop,
              s: 1 - ad * P.shrink,
              o: 1 - ad * P.fade
            };

        var st = state[i];
        for (var key in t) {
          var diff = t[key] - st[key];
          if (Math.abs(diff) > 0.002) moving = true;
          st[key] += diff * k;
        }

        cards[i].style.transform =
          'translateY(' + st.y.toFixed(2) + 'px) rotate(' + st.r.toFixed(2) + 'deg) scale(' + st.s.toFixed(4) + ')';
        cards[i].style.opacity = st.o.toFixed(3);
      }

      // وقتی ردیف دیده نمی‌شود و حرکت تمام شده، حلقه را متوقف کن (صرفه‌جویی باتری)
      if (visible || moving) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0; last = 0;
      }
    }

    function start() { if (!raf) raf = requestAnimationFrame(tick); }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) start();
      }, { rootMargin: '200px' }).observe(row);
    } else {
      visible = true; start();
    }

    row.addEventListener('scroll', start, { passive: true });
    window.addEventListener('resize', start);
    start();
  }

  /* ---------- ۲) ورود از دور به نزدیک ---------- */
  var revealIO = null;

  function getRevealIO() {
    if (revealIO) return revealIO;
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          revealIO.unobserve(e.target);   // فقط یک‌بار
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    return revealIO;
  }

  var revealCount = 0;
  function initReveal(el) {
    if (el.__revealReady) return;
    el.__revealReady = true;

    if (!('IntersectionObserver' in window) || reduceMotion) {
      el.classList.add('in-view');
      return;
    }
    el.style.setProperty('--delay', ((revealCount++ % 3) * 0.12) + 's');
    getRevealIO().observe(el);
  }

  /* ---------- راه‌اندازی ---------- */
  function scan(root) {
    root = root || document;
    [].forEach.call(root.querySelectorAll('.fan-row'), initFanRow);
    [].forEach.call(root.querySelectorAll('.episode-box'), initReveal);
  }

  function centerRow(row) {
    // شروع از اولین کارت در مرکز (در RTL اولین کارت سمت راست است)
    var first = row.querySelector('.fan-card');
    if (first && first.scrollIntoView) {
      first.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }

  function boot() {
    scan(document);
    [].forEach.call(document.querySelectorAll('.fan-row'), centerRow);

    // کارت یا اپیزود جدیدی که بعداً (fetch / بارگذاری بیشتر) اضافه شود خودکار شناسایی می‌شود
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        [].forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches('.fan-row')) { initFanRow(n); centerRow(n); }
          if (n.matches && n.matches('.episode-box')) initReveal(n);
          scan(n);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.PersianPodFX = { scan: scan, initFanRow: initFanRow, initReveal: initReveal };
})();
