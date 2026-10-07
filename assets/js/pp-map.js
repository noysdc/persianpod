/* PersianPod: نقشه‌ی جهان با زوم خودکار روی ایران و نمایش استان‌ها
   - وقتی بخش نقشه وارد دید می‌شود، روی ایران زوم می‌کند و استان‌ها و شهرها پیدا می‌شوند.
   - کلیک روی کشور، استان یا شهر، فهرست پادکست‌های بالای صفحه را فیلتر می‌کند.
   - داده‌ی مرزها: assets/data/pp-map-data.json (ساخته‌شده با scripts/build_map_data.py از Natural Earth). */
(function () {
  "use strict";
  var host = document.getElementById("pp-map");
  if (!host) return;

  var FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩", NS = "http://www.w3.org/2000/svg";
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\u200c/g, " ").replace(/\s+/g, " ")
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); }).toLowerCase().trim();
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var tip = document.getElementById("pp-map-tip");
  var backBtn = document.getElementById("pp-map-back"), iranBtn = document.getElementById("pp-map-iran");
  var hint = document.getElementById("pp-map-hint");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // نام‌های رایج که در داده‌ی کشورها دقیقاً این‌طور نیستند
  var ALIASES = { "آمریکا": "US", "امریکا": "US", "ایالات متحده": "US", "انگلیس": "GB", "انگلستان": "GB", "بریتانیا": "GB",
    "امارات": "AE", "کره": "KR", "کره جنوبی": "KR", "روسیه": "RU", "ترکیه": "TR", "آلمان": "DE", "آذربایجان": "AZ",
    "هلند": "NL", "سوئد": "SE", "استرالیا": "AU", "فرانسه": "FR", "کانادا": "CA", "ژاپن": "JP", "ایتالیا": "IT", "اسپانیا": "ES" };

  /* همان فرمول Natural Earth 1 که در scripts/build_map_data.py هست */
  function ne1(lon, lat) {
    var l = lon * Math.PI / 180, p = lat * Math.PI / 180, p2 = p * p, p4 = p2 * p2;
    return [l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
      p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))];
  }

  var cities = [];
  try { cities = JSON.parse(document.getElementById("pp-cities").textContent) || []; } catch (e) {}

  Promise.all([
    fetch(host.dataset.map).then(function (r) { if (!r.ok) throw 0; return r.json(); }),
    fetch(host.dataset.podcasts).then(function (r) { return r.json(); }).catch(function () { return []; })
  ]).then(function (res) { start(res[0], res[1]); })
    .catch(function () { host.innerHTML = '<p class="pp-map-err">بارگذاری نقشه انجام نشد.</p>'; });

  function start(map, podcasts) {
    var P = map.proj;
    function project(lon, lat) { var q = ne1(lon, lat); return [P.ox + P.k * q[0], P.oy - P.k * q[1]]; }

    /* نام کشور ← ISO */
    var nameToIso = {};
    map.countries.forEach(function (c) { if (c.i) { nameToIso[norm(c.n)] = c.i; nameToIso[c.i.toLowerCase()] = c.i; } });
    Object.keys(ALIASES).forEach(function (k) { nameToIso[norm(k)] = ALIASES[k]; });

    /* ساخت SVG */
    var W = map.w, H = map.h, PAD = 70;                      // حاشیه‌ی بالا و پایین تا نقشه ۱۶:۹ شود
    var h = [];
    h.push('<svg viewBox="0 ' + (-PAD) + " " + W + " " + (H + PAD * 2) + '" xmlns="' + NS + '" role="img" aria-label="نقشه‌ی جهان و ایران">');
    h.push('<g class="countries">');
    map.countries.forEach(function (c, i) { h.push('<path class="c" data-i="' + i + '" data-iso="' + esc(c.i) + '" d="' + c.d + '"/>'); });
    h.push('</g><g class="provinces">');
    map.provinces.forEach(function (p, i) { h.push('<path class="p" data-pi="' + i + '" d="' + p.d + '"/>'); });
    h.push('</g><g class="plabels" aria-hidden="true">');
    map.provinces.forEach(function (p) { h.push('<text x="' + p.lx + '" y="' + p.ly + '">' + esc(p.n) + "</text>"); });
    h.push('</g><g class="pins"></g></svg>');
    host.innerHTML = h.join("");

    var svg = host.querySelector("svg");
    var cPaths = svg.querySelectorAll(".c"), pPaths = svg.querySelectorAll(".p"), pinsG = svg.querySelector(".pins");

    /* تشخیص استان/کشور شهر با هندسه‌ی خود داده (مستقل از رندر مرورگر؛ isPointInFill روی عناصر با pointer-events:none جواب نمی‌دهد) */
    function ringsOf(o) {
      if (o._r) return o._r;
      var out = [], re = /([Mlz])([^Mlz]*)/g, m, cur = null, x = 0, y = 0;
      while ((m = re.exec(o.d))) {
        var nums = m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/g) || [];
        if (m[1] === "M") { cur = []; out.push(cur); x = +nums[0]; y = +nums[1]; cur.push([x, y]); }
        else if (m[1] === "l" && cur) for (var i = 0; i + 1 < nums.length; i += 2) { x += +nums[i]; y += +nums[i + 1]; cur.push([x, y]); }
      }
      return (o._r = out);
    }
    function inRings(rs, x, y) {
      var ins = false;
      rs.forEach(function (r) {
        for (var i = 0, j = r.length - 1; i < r.length; j = i++)
          if (((r[i][1] > y) !== (r[j][1] > y)) && (x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) ins = !ins;
      });
      return ins;
    }

    /* شهرها: مختصات، استان و شمارش پادکست */
    var cityMap = {};
    cities.forEach(function (c) {
      if (typeof c.lat !== "number" || typeof c.lon !== "number") return;
      var xy = project(c.lon, c.lat);
      var o = { n: c.name, x: xy[0], y: xy[1], count: 0, prov: -1, iso: "" };
      for (var i = 0; i < map.provinces.length; i++) if (inRings(ringsOf(map.provinces[i]), o.x, o.y)) { o.prov = i; break; }
      if (o.prov < 0) for (var j = 0; j < map.countries.length; j++) if (inRings(ringsOf(map.countries[j]), o.x, o.y)) { o.iso = map.countries[j].i || ""; break; }
      if (o.prov >= 0) o.iso = "IR";
      if (o.prov < 0 && o.iso === "IR") {                    // شهر ساحلی که کمی بیرون مرز افتاده: نزدیک‌ترین استان
        var best = 1e9;
        map.provinces.forEach(function (p, i) { var d = Math.hypot(p.lx - o.x, p.ly - o.y); if (d < best) { best = d; o.prov = i; } });
      }
      cityMap[norm(c.name)] = o;
    });

    /* شمارش پادکست‌ها */
    var countryCount = {}, provCount = {}, provCities = {}, countryCities = {};
    podcasts.forEach(function (p) {
      var iso = p.country ? nameToIso[norm(p.country)] : "";
      var city = p.city ? cityMap[norm(p.city)] : null;
      if (city) {
        city.count++;
        if (!iso) iso = city.iso || "";
        if (city.prov >= 0 && (iso === "IR" || city.iso === "IR")) {
          provCount[city.prov] = (provCount[city.prov] || 0) + 1;
          (provCities[city.prov] = provCities[city.prov] || {})[norm(p.city)] = 1;
        }
      }
      if (iso) { countryCount[iso] = (countryCount[iso] || 0) + 1; (countryCities[iso] = countryCities[iso] || {})[norm(p.country || "")] = 1; }
    });

    cPaths.forEach(function (el) {
      var n = countryCount[el.dataset.iso] || 0;
      if (n) {
        el.classList.add("has"); el.setAttribute("data-n", n);
        el.setAttribute("tabindex", "0"); el.setAttribute("role", "button");
        el.setAttribute("aria-label", map.countries[+el.dataset.i].n + "، " + toFa(n) + " پادکست");
      }
    });
    pPaths.forEach(function (el, i) {
      var n = provCount[i] || 0;
      if (n) {
        el.classList.add("has"); el.setAttribute("data-n", n);
        el.setAttribute("tabindex", "-1"); el.setAttribute("role", "button");
        el.setAttribute("aria-label", "استان " + map.provinces[i].n + "، " + toFa(n) + " پادکست");
      }
    });

    /* پین شهرها (فقط شهرهای دارای پادکست). اندازه‌ی دایره و نوشته را ui() بر پایه‌ی زوم تنظیم می‌کند */
    var pinHtml = "";
    Object.keys(cityMap).forEach(function (k) {
      var c = cityMap[k]; if (!c.count) return;
      pinHtml += '<g class="pin' + (c.iso === "IR" ? " ir" : "") + '" data-city="' + esc(k) + '" tabindex="-1" role="button" aria-label="' + esc(c.n) + "، " + toFa(c.count) + ' پادکست">' +
        '<circle cx="' + c.x.toFixed(2) + '" cy="' + c.y.toFixed(2) + '" r="1"/>' +
        '<text x="' + c.x.toFixed(2) + '" y="' + c.y.toFixed(2) + '">' + esc(c.n) + "</text></g>";
    });
    pinsG.innerHTML = pinHtml;
    var pinEls = [];
    pinsG.querySelectorAll(".pin").forEach(function (g) {
      var c = cityMap[g.dataset.city];
      pinEls.push({ g: g, c: c, circle: g.querySelector("circle"), text: g.querySelector("text") });
    });
    var pLabelEls = [];
    svg.querySelectorAll(".plabels text").forEach(function (t, i) {
      pLabelEls.push({ t: t, x: map.provinces[i].lx, y: map.provinces[i].ly, n: map.provinces[i].n, has: !!provCount[i] });
    });

    /* دوربین */
    var BASE = svg.getAttribute("viewBox").split(" ").map(Number);
    var cur = BASE.slice(), zoomed = false, anim = null, autoDone = false;
    function setView(v) { cur = v; svg.setAttribute("viewBox", v.map(function (x) { return +x.toFixed(2); }).join(" ")); ui(); }

    /* اندازه‌ها بر حسب پیکسل صفحه ثابت می‌مانند، هر قدر زوم کنیم (واحد SVG ÷ پیکسل = k) */
    function viewScale() {
      var cw = host.clientWidth || 800, ch = host.clientHeight || 450, sc = Math.min(cw / cur[2], ch / cur[3]);
      return { s: sc, cw: cw, ch: ch, ox: (cw - cur[2] * sc) / 2, oy: (ch - cur[3] * sc) / 2 };
    }
    function sizes() { var narrow = (host.clientWidth || 800) < 520; return { pin: narrow ? 0.85 : 1, fc: narrow ? 10.5 : 11.5, fp: narrow ? 9.5 : 10.5 }; }
    function pinR(c, z) { return Math.min(10, 4.5 + Math.sqrt(Math.max(c.count - 1, 0)) * 1.6) * z; }
    function ui() {
      var v = viewScale(), k = 1 / v.s, z = sizes();
      host.style.setProperty("--fp", (z.fp * k).toFixed(3) + "px");
      host.style.setProperty("--fc", (z.fc * k).toFixed(3) + "px");
      host.style.setProperty("--halo", (3 * k).toFixed(3) + "px");
      pinEls.forEach(function (p) {
        var r = pinR(p.c, z.pin) * k;
        p.circle.setAttribute("r", r.toFixed(3));
        p.text.setAttribute("y", (p.c.y - r - 3 * k).toFixed(3));
      });
    }
    /* چیدن نوشته‌ها بدون هم‌پوشانی: اول دایره‌ها، بعد نام شهرها، بعد نام استان‌ها در جاهای خالی */
    function layoutLabels() {
      if (!zoomed) return;
      var v = viewScale(), z = sizes(), placed = [];
      function px(x, y) { return [(x - cur[0]) * v.s + v.ox, (y - cur[1]) * v.s + v.oy]; }
      function toY(ypx) { return cur[1] + (ypx - v.oy) / v.s; }
      function hit(b) {
        if (b[0] < 2 || b[1] < 2 || b[2] > v.cw - 2 || b[3] > v.ch - 2) return true;
        for (var i = 0; i < placed.length; i++) { var q = placed[i]; if (b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]) return true; }
        return false;
      }
      var pins = pinEls.slice().sort(function (a, b) { return b.c.count - a.c.count; });
      pins.forEach(function (p) {
        var q = px(p.c.x, p.c.y), r = pinR(p.c, z.pin);
        p.q = q; p.r = r; placed.push([q[0] - r - 1, q[1] - r - 1, q[0] + r + 1, q[1] + r + 1]);
      });
      pins.forEach(function (p) {
        var w = p.c.n.length * z.fc * 0.58 + 8, h = z.fc + 5, q = p.q, r = p.r;
        var up = [q[0] - w / 2, q[1] - r - 2 - h, q[0] + w / 2, q[1] - r - 2];
        var dn = [q[0] - w / 2, q[1] + r + 2, q[0] + w / 2, q[1] + r + 2 + h];
        var b = !hit(up) ? up : (!hit(dn) ? dn : null);
        if (!b) { p.text.style.display = "none"; return; }
        p.text.style.display = "";
        p.text.setAttribute("y", toY(b === up ? q[1] - r - 4 : q[1] + r + 2 + z.fc).toFixed(3));
        placed.push(b);
      });
      pLabelEls.slice().sort(function (a, b) { return (b.has ? 1 : 0) - (a.has ? 1 : 0); }).forEach(function (p) {
        var q = px(p.x, p.y), w = p.n.length * z.fp * 0.58 + 6, h = z.fp + 4;
        var b = [q[0] - w / 2, q[1] - h / 2, q[0] + w / 2, q[1] + h / 2];
        if (hit(b)) { p.t.style.display = "none"; return; }
        p.t.style.display = ""; placed.push(b);
      });
      host.classList.add("laid");
    }
    function flyTo(target, done) {
      cancelAnimationFrame(anim);
      if (reduce) { setView(target); if (done) done(); return; }
      var from = cur.slice(), t0 = performance.now(), dur = 1100;
      (function step(t) {
        var k = Math.min((t - t0) / dur, 1), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        setView(from.map(function (f, i) { return f + (target[i] - f) * e; }));
        if (k < 1) anim = requestAnimationFrame(step); else if (done) done();
      })(t0);
    }
    function iranView() {
      var b = map.iranBox, pad = 0.07, w = host.clientWidth || 800, hh = host.clientHeight || 450, ratio = w / hh;
      var bw = (b[2] - b[0]) * (1 + pad * 2), bh = (b[3] - b[1]) * (1 + pad * 2);
      if (bw / bh < ratio) bw = bh * ratio; else bh = bw / ratio;
      var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      return [cx - bw / 2, cy - bh / 2, bw, bh];
    }
    function setMode(z) {
      zoomed = z; host.classList.toggle("zoomed", z);
      backBtn.hidden = !z; iranBtn.hidden = z;
      cPaths.forEach(function (p) { p.classList.toggle("dim", z && p.dataset.iso !== "IR"); });
      pPaths.forEach(function (p) { if (p.classList.contains("has")) p.setAttribute("tabindex", z ? "0" : "-1"); });
      svg.querySelectorAll(".pin").forEach(function (g) { g.setAttribute("tabindex", z ? "0" : "-1"); });
      hint.textContent = z ? "استان‌ها و شهرهای سبز پادکستر دارند. روی هرکدام بزنید تا فهرست همان منطقه باز شود."
                           : "کشورهای سبز پادکستر دارند. با کلیک روی هر کشور، فهرست همان کشور باز می‌شود.";
    }
    function zoomIran() { host.classList.remove("laid"); setMode(true); flyTo(iranView(), layoutLabels); }
    function zoomWorld() { host.classList.remove("laid"); setMode(false); flyTo(BASE); }
    backBtn.addEventListener("click", zoomWorld);
    iranBtn.addEventListener("click", zoomIran);
    iranBtn.hidden = false;
    window.addEventListener("resize", function () { if (zoomed) { setView(iranView()); layoutLabels(); } else ui(); });
    ui();

    /* ورود به دید: یک‌بار خودکار روی ایران زوم کن */
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting && !autoDone) {
            autoDone = true; io.disconnect();
            setTimeout(function () { if (!zoomed) zoomIran(); }, reduce ? 0 : 700);
          }
        });
      }, { threshold: 0.45 });
      io.observe(host);
    }

    /* فیلتر فهرست */
    function emit(detail) { window.dispatchEvent(new CustomEvent("pp:geo", { detail: detail })); }
    function act(el) {
      var pin = el.closest(".pin");
      if (pin) { var c = cityMap[pin.dataset.city]; return emit({ label: c.n, cities: [c.n] }); }
      var pr = el.closest(".p");
      if (pr && pr.classList.contains("has") && zoomed) {
        var i = +pr.dataset.pi, names = [];
        Object.keys(cityMap).forEach(function (k) { if (cityMap[k].prov === i && cityMap[k].count) names.push(cityMap[k].n); });
        return emit({ label: "استان " + map.provinces[i].n, cities: names });
      }
      var c2 = el.closest(".c");
      if (c2 && c2.classList.contains("has")) {
        if (c2.dataset.iso === "IR" && !zoomed) return zoomIran();
        var cn = map.countries[+c2.dataset.i].n;
        var names2 = [cn]; Object.keys(ALIASES).forEach(function (k) { if (ALIASES[k] === c2.dataset.iso) names2.push(k); });
        emit({ label: cn, countries: names2 });
      }
    }
    svg.addEventListener("click", function (e) { act(e.target); });
    svg.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(e.target); } });

    /* راهنمای شناور */
    function tipText(el) {
      var pin = el.closest(".pin"); if (pin) { var c = cityMap[pin.dataset.city]; return c.n + "، " + toFa(c.count) + " پادکست"; }
      var pr = el.closest(".p"); if (pr && zoomed) { var i = +pr.dataset.pi; return "استان " + map.provinces[i].n + (provCount[i] ? "، " + toFa(provCount[i]) + " پادکست" : ""); }
      var c2 = el.closest(".c"); if (c2 && c2.classList.contains("has")) return map.countries[+c2.dataset.i].n + "، " + toFa(c2.dataset.n) + " پادکست";
      return "";
    }
    svg.addEventListener("pointermove", function (e) {
      var t = tipText(e.target);
      if (!t) { tip.hidden = true; return; }
      tip.textContent = t; tip.hidden = false;
      tip.style.left = Math.max(8, Math.min(e.clientX + 14, window.innerWidth - 190)) + "px";
      tip.style.top = e.clientY + 16 + "px";
    });
    svg.addEventListener("pointerleave", function () { tip.hidden = true; });
    window.PPMap = { zoomIran: zoomIran, zoomWorld: zoomWorld };
  }
})();
