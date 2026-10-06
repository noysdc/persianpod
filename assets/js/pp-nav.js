/*
  ناوبری نرم پرشین‌پاد
  وقتی پلیر شناور باز است، کلیک روی لینک‌های داخلی صفحه را از نو لود نمی‌کند؛
  فقط محتوای صفحه عوض می‌شود تا iframe پلیر (و پخش) دست‌نخورده بماند.
  اگر پلیر بسته باشد، یا هر خطایی پیش بیاید، ناوبری عادی مرورگر انجام می‌شود.
*/
(function () {
  "use strict";
  if (!window.fetch || !window.DOMParser || !window.Promise || !history.pushState) return;

  // این اسکریپت‌ها به عنصرهای ثابت صفحه (هدر و ...) وصل شده‌اند و دوباره اجرا نمی‌شوند
  var PERSIST = /\/(pp-tools|pp-digits|pp-float-player|pp-nav|curved-scrollbar|ui|pp-ui)\.js(\?|$)/;
  var busy = 0;
  var cur = location.pathname + location.search;

  function playing() { return !!(window.PPPlayer && window.PPPlayer.isOpen()); }
  function hard(url) { location.href = url; }
  function path(href, base) { try { return new URL(href, base).pathname; } catch (e) { return href; } }

  function go(url, push) {
    var id = ++busy;
    document.documentElement.classList.add("pp-navigating");
    fetch(url, { credentials: "same-origin" })
      .then(function (r) {
        var ct = r.headers.get("content-type") || "";
        if (!r.ok || ct.indexOf("text/html") === -1) throw new Error("skip");
        return r.text().then(function (t) { return { html: t, url: r.url || url }; });
      })
      .then(function (res) { if (id === busy) return swap(res.html, res.url, push); })
      .catch(function () { if (id === busy) hard(url); })
      .then(function () { if (id === busy) document.documentElement.classList.remove("pp-navigating"); });
  }

  function swap(html, url, push) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var nShell = doc.querySelector(".pp-shell"), oShell = document.querySelector(".pp-shell");
    if (!nShell || !oShell || !doc.querySelector(".pp-hero")) return hard(url);

    // ۱) استایل‌های مخصوص صفحه: جدیدها اضافه، قدیمی‌هایی که دیگر لازم نیستند بعد از جابه‌جایی حذف
    var stale = {}, waits = [];
    [].forEach.call(document.head.querySelectorAll('link[rel="stylesheet"]'), function (l) { stale[path(l.getAttribute("href"), location.href)] = l; });
    [].forEach.call(doc.head.querySelectorAll('link[rel="stylesheet"]'), function (n) {
      var k = path(n.getAttribute("href"), url);
      if (stale[k]) { delete stale[k]; return; }
      var el = document.createElement("link");
      el.rel = "stylesheet"; el.href = n.getAttribute("href");
      waits.push(new Promise(function (ok) { el.onload = el.onerror = ok; setTimeout(ok, 3000); }));
      document.head.appendChild(el);
    });

    return Promise.all(waits).then(function () {
      // ۲) عنوان و متادیتا
      document.title = doc.title;
      ["meta[name=description]", "link[rel=canonical]", "meta[property='og:title']", "meta[property='og:description']"].forEach(function (sel) {
        var n = doc.head.querySelector(sel), o = document.head.querySelector(sel);
        if (n && o) o.replaceWith(n.cloneNode(true));
      });
      var nn = doc.querySelector(".pp-nav"), on = document.querySelector(".pp-nav");
      if (nn && on) on.innerHTML = nn.innerHTML;

      // ۳) اسکریپت‌ها را از محتوا جدا می‌کنیم تا بعد از جابه‌جایی به ترتیب اجرا شوند
      var shell = document.importNode(nShell, true), scripts = [];
      function take(s) {
        var t = (s.getAttribute("type") || "").toLowerCase();
        if (t && t.indexOf("javascript") === -1 && t !== "module") return false; // مثل JSON-LD: بی‌اثر است
        scripts.push({ src: s.getAttribute("src"), text: s.textContent, type: t });
        return true;
      }
      [].slice.call(shell.querySelectorAll("script")).forEach(function (s) { if (take(s)) s.remove(); });
      [].slice.call(doc.body.children).forEach(function (s) {
        if (s.tagName !== "SCRIPT") return;
        if (s.src && PERSIST.test(s.getAttribute("src"))) return;
        if (!s.src && /theme|localStorage/.test(s.textContent)) return;
        take(s);
      });

      oShell.replaceWith(shell);
      Object.keys(stale).forEach(function (k) { stale[k].remove(); });

      if (push) history.pushState({ pp: 1 }, "", url);
      cur = location.pathname + location.search;
      var u = new URL(url, location.href), target = u.hash && document.getElementById(decodeURIComponent(u.hash.slice(1)));
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);

      return scripts.reduce(function (p, s) { return p.then(function () { return exec(s); }); }, Promise.resolve());
    }).then(function () {
      var m = document.getElementById("main");
      if (m) { m.setAttribute("tabindex", "-1"); m.focus({ preventScroll: true }); }
      document.dispatchEvent(new CustomEvent("pp:navigate"));
    });
  }

  function exec(s) {
    return new Promise(function (ok) {
      var el = document.createElement("script");
      if (s.type) el.type = s.type;
      if (s.src) { el.async = false; el.onload = el.onerror = ok; el.src = s.src; document.body.appendChild(el); }
      else { el.text = s.text; document.body.appendChild(el); ok(); }
    });
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !playing()) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return;
    if (u.pathname === location.pathname && u.search === location.search) return;       // فقط هش
    if (/\.[a-z0-9]{2,5}$/i.test(u.pathname) && !/\.html?$/i.test(u.pathname)) return;  // فایل (xml، pdf، ...)
    e.preventDefault();
    go(u.href, true);
  });

  // جست‌وجوی بالای صفحه در صفحه‌هایی که فهرست ندارند
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (e.defaultPrevented || !playing() || !f.matches || !f.matches(".pp-search")) return;
    var i = f.querySelector("input[name=q]");
    if (!i) return;
    e.preventDefault();
    var u = new URL(f.getAttribute("action") || "/", location.href);
    u.search = "?q=" + encodeURIComponent(i.value.trim());
    go(u.href, true);
  });

  window.addEventListener("popstate", function () {
    if (location.pathname + location.search === cur) return;
    if (playing()) go(location.href, false); else location.reload();
  });
})();
