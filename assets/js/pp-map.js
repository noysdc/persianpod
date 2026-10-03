/* PersianPod — نقشه‌ی جهان با زوم روی ایران و نمایش شهرها */
(function () {
  "use strict";
  var host = document.getElementById("pp-map");
  if (!host) return;

  var FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩";
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\u200c/g, " ").replace(/\s+/g, " ")
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); })
      .toLowerCase().trim();
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var tip = document.getElementById("pp-map-tip");
  var backBtn = document.getElementById("pp-map-back");
  var hint = document.getElementById("pp-map-hint");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // نام‌های رایج که در Intl نیستند
  var ALIASES = { "آمریکا": "US", "امریکا": "US", "انگلیس": "GB", "امارات": "AE", "کره": "KR",
    "روسیه": "RU", "ترکیه": "TR", "آلمان": "DE", "آذربایجان": "AZ" };

  Promise.all([
    fetch(host.dataset.map).then(function (r) { return r.json(); }),
    fetch(host.dataset.podcasts).then(function (r) { return r.json(); }).catch(function () { return []; })
  ]).then(function (res) { start(res[0], res[1]); })
    .catch(function () { host.innerHTML = '<p style="padding:1rem">بارگذاری نقشه انجام نشد.</p>'; });

  function start(map, podcasts) {
    // نگاشت نام کشور به ISO2
    var dn = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["fa"], { type: "region" }) : null;
    var nameToIso = {};
    map.countries.forEach(function (c) {
      if (!c.iso2) return;
      nameToIso[norm(c.name)] = c.iso2;
      nameToIso[c.iso2.toLowerCase()] = c.iso2;
      try { if (dn) nameToIso[norm(dn.of(c.iso2))] = c.iso2; } catch (e) {}
    });
    Object.keys(ALIASES).forEach(function (k) { nameToIso[norm(k)] = ALIASES[k]; });

    var cityByName = {};
    map.cities.forEach(function (c) { cityByName[norm(c.n)] = c; c.count = 0; });

    var countryCount = {};
    podcasts.forEach(function (p) {
      var iso = p.country ? nameToIso[norm(p.country)] : null;
      var city = p.city ? cityByName[norm(p.city)] : null;
      if (city) { city.count++; if (!iso) iso = "IR"; }
      if (iso) countryCount[iso] = (countryCount[iso] || 0) + 1;
    });

    // ساخت SVG
    var W = map.w, H = map.h, ns = "http://www.w3.org/2000/svg";
    var html = '<svg viewBox="0 0 ' + W + " " + H + '" xmlns="' + ns + '" role="img" aria-label="نقشه‌ی جهان">';
    html += '<g class="countries">';
    map.countries.forEach(function (c, i) {
      var n = c.iso2 ? countryCount[c.iso2] || 0 : 0;
      var cls = "c" + (n ? " has" : "");
      var attrs = n ? ' tabindex="0" role="button" aria-label="' + esc(c.name) + "، " + toFa(n) + ' پادکست"' : "";
      html += '<path class="' + cls + '" data-i="' + i + '" data-iso="' + esc(c.iso2) + '" data-n="' + n + '"' + attrs + ' d="' + c.d + '"/>';
    });
    html += '</g><g class="cities">';
    map.cities.forEach(function (c, i) {
      var r = c.count ? 0.9 + Math.sqrt(c.count) * 0.35 : 0.55;
      var attrs = c.count ? ' tabindex="0" role="button" aria-label="' + esc(c.n) + "، " + toFa(c.count) + ' پادکست"' : "";
      html += '<g class="city' + (c.count ? " has" : "") + '" data-ci="' + i + '"' + attrs + ">" +
        '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + r.toFixed(2) + '"/>' +
        '<text x="' + c.x + '" y="' + (c.y - r - 0.6).toFixed(2) + '">' + esc(c.n) + "</text></g>";
    });
    html += "</g></svg>";
    host.innerHTML = html;

    var svg = host.querySelector("svg");
    var full = [0, 0, W, H];
    var cur = full.slice();
    var zoomed = false;

    // کادر هدف برای ایران، هم‌نسبت با نقشه
    var b = map.iranBox, pad = 0.22;
    var bw = (b[2] - b[0]) * (1 + pad * 2), bh = (b[3] - b[1]) * (1 + pad * 2);
    var ratio = W / H;
    if (bw / bh < ratio) bw = bh * ratio; else bh = bw / ratio;
    var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    var iranView = [cx - bw / 2, cy - bh / 2, bw, bh];

    var anim;
    function setView(v) { cur = v; svg.setAttribute("viewBox", v.map(function (x) { return +x.toFixed(2); }).join(" ")); }
    function flyTo(target, done) {
      cancelAnimationFrame(anim);
      if (reduce) { setView(target); if (done) done(); return; }
      var from = cur.slice(), t0 = performance.now(), dur = 800;
      (function step(t) {
        var k = Math.min((t - t0) / dur, 1);
        var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        setView(from.map(function (f, i) { return f + (target[i] - f) * e; }));
        if (k < 1) anim = requestAnimationFrame(step); else if (done) done();
      })(t0);
    }

    function zoomIran() {
      zoomed = true; host.classList.add("zoomed");
      svg.querySelectorAll(".c").forEach(function (p) { p.classList.toggle("dim", p.dataset.iso !== "IR"); });
      backBtn.hidden = false;
      hint.textContent = "روی شهرِ سبز بزنید تا پادکست‌های آن شهر را ببینید.";
      flyTo(iranView);
    }
    function zoomOut() {
      zoomed = false; host.classList.remove("zoomed");
      svg.querySelectorAll(".c.dim").forEach(function (p) { p.classList.remove("dim"); });
      backBtn.hidden = true;
      hint.textContent = "روی کشورهای سبز بزنید. با کلیک روی ایران، شهرها نمایان می‌شوند.";
      flyTo(full);
    }
    backBtn.addEventListener("click", zoomOut);

    // اعمال فیلتر روی صفحه‌ی فهرست یا رفتن به آن
    function applyFilter(kind, value) {
      var form = document.getElementById("pp-filters");
      if (form) {
        if (kind === "city") {
          var sel = document.getElementById("f-city");
          Array.prototype.some.call(sel.options, function (o) {
            if (norm(o.value) === norm(value)) { sel.value = o.value; return true; }
          });
          sel.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          var q = document.getElementById("f-q"); q.value = value;
          q.dispatchEvent(new Event("input", { bubbles: true }));
        }
        var r = document.getElementById("pp-count") || document.getElementById("pp-results");
        if (r) r.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      } else {
        location.href = host.dataset.listUrl + "?" + (kind === "city" ? "city=" : "q=") + encodeURIComponent(value);
      }
    }

    function onCountry(p) {
      if (!p.classList.contains("has")) return;
      if (p.dataset.iso === "IR") { if (!zoomed) zoomIran(); return; }
      var name = map.countries[+p.dataset.i].name;
      var fa = ""; try { if (dn) fa = dn.of(p.dataset.iso); } catch (e) {}
      applyFilter("q", fa || name);
    }
    function onCity(g) {
      var c = map.cities[+g.dataset.ci];
      if (c.count) applyFilter("city", c.n);
    }

    function act(el) {
      var city = el.closest(".city"); if (city) return onCity(city);
      var p = el.closest(".c"); if (p) onCountry(p);
    }
    svg.addEventListener("click", function (e) { act(e.target); });
    svg.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(e.target); }
    });

    // راهنمای شناور
    function tipText(el) {
      var city = el.closest(".city");
      if (city) { var c = map.cities[+city.dataset.ci]; return c.n + (c.count ? "، " + toFa(c.count) + " پادکست" : ""); }
      var p = el.closest(".c");
      if (p && p.classList.contains("has")) {
        var fa = ""; try { if (dn) fa = dn.of(p.dataset.iso); } catch (e) {}
        return (fa || map.countries[+p.dataset.i].name) + "، " + toFa(p.dataset.n) + " پادکست";
      }
      return "";
    }
    svg.addEventListener("pointermove", function (e) {
      var t = tipText(e.target);
      if (!t) { tip.hidden = true; return; }
      tip.textContent = t; tip.hidden = false;
      tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 180) + "px";
      tip.style.top = e.clientY + 14 + "px";
    });
    svg.addEventListener("pointerleave", function () { tip.hidden = true; });
  }
})();
