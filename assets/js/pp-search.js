/* PersianPod — جستجوی پیشرفته، فیلتر، ترتیب تصادفی/الفبایی، پادکست‌های مشابه */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  var AR = "٠١٢٣٤٥٦٧٨٩";
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }

  // یکسان‌سازی متن فارسی برای جستجو
  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\u200c/g, " ")
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); })
      .toLowerCase().trim();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? null : n; }

  var jy = parseInt(new Intl.DateTimeFormat("fa-IR-u-nu-latn", { year: "numeric" }).format(new Date()), 10) || 1405;
  var FIRST_YEAR = 1379; // سال میلادی ۲۰۰۰

  var data = [], mode = "random";
  var collator = new Intl.Collator("fa");

  function fillOptions(sel, values, labeler) {
    var el = $(sel);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = labeler ? labeler(v) : v; el.appendChild(o);
    });
  }
  function unique(key) {
    var seen = {};
    data.forEach(function (p) { if (p[key]) seen[p[key]] = 1; });
    return Object.keys(seen).sort(collator.compare);
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function read() {
    return {
      q: norm($("#f-q").value), category: $("#f-category").value, city: $("#f-city").value,
      status: $("#f-status").value,
      yf: num($("#f-year-from").value), yt: num($("#f-year-to").value),
      emin: num($("#f-ep-min").value), emax: num($("#f-ep-max").value),
      lmin: num($("#f-len-min").value), lmax: num($("#f-len-max").value)
    };
  }
  function isFiltered(f) {
    return !!(f.q || f.category || f.city || f.status || f.yf != null || f.yt != null ||
      f.emin != null || f.emax != null || f.lmin != null || f.lmax != null);
  }
  function inRange(v, lo, hi) {
    if (lo == null && hi == null) return true;
    if (v == null || v === "") return false;
    v = Number(v);
    return (lo == null || v >= lo) && (hi == null || v <= hi);
  }
  function match(p, f) {
    if (f.category && p.category !== f.category) return false;
    if (f.city && p.city !== f.city) return false;
    if (f.status && p.status !== f.status) return false;
    if (!inRange(p.year, f.yf, f.yt)) return false;
    if (!inRange(p.episodes, f.emin, f.emax)) return false;
    if (!inRange(p.length, f.lmin, f.lmax)) return false;
    if (f.q) {
      var hay = norm([p.title, p.description, p.category, p.city, p.country, (p.tags || []).join(" ")].join(" "));
      var words = f.q.split(/\s+/);
      for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) === -1) return false;
    }
    return true;
  }

  function card(p) {
    var meta = [];
    if (p.year) meta.push('<span class="pp-badge">از ' + toFa(p.year) + "</span>");
    if (p.episodes) meta.push('<span class="pp-badge">' + toFa(p.episodes) + " اپیزود</span>");
    if (p.length) meta.push('<span class="pp-badge">' + toFa(p.length) + " دقیقه</span>");
    meta.push('<span class="pp-badge ' + (p.status === "active" ? "on" : "") + '">' +
      (p.status === "active" ? "فعال" : "غیرفعال") + "</span>");
    return '<a class="pp-podcast pp-card" href="' + esc(p.url) + '">' +
      (p.logo ? '<img src="' + esc(p.logo) + '" alt="" loading="lazy" width="64" height="64">' : "") +
      "<h3>" + esc(p.title) + "</h3>" +
      (p.description ? "<p>" + esc(p.description) + "</p>" : "") +
      '<div class="pp-meta">' + meta.join("") + "</div></a>";
  }

  // شباهت: دسته‌ی مشترک و موضوع‌های مشترک
  function similarity(a, b) {
    if (a.id === b.id) return 0;
    var s = a.category && a.category === b.category ? 2 : 0;
    var ta = (a.tags || []).map(norm), tb = (b.tags || []).map(norm);
    ta.forEach(function (t) { if (tb.indexOf(t) !== -1) s += 1; });
    if (a.city && a.city === b.city) s += 0.5;
    return s;
  }
  function similarTo(results) {
    var ids = {}; results.forEach(function (p) { ids[p.id] = 1; });
    var base = results.slice(0, 5), scored = [];
    data.forEach(function (c) {
      if (ids[c.id]) return;
      var s = 0; base.forEach(function (b) { s += similarity(b, c); });
      if (s > 0) scored.push({ p: c, s: s });
    });
    scored.sort(function (x, y) { return y.s - x.s; });
    return scored.slice(0, 6).map(function (x) { return x.p; });
  }

  function render() {
    var f = read();
    var list = data.filter(function (p) { return match(p, f); });
    list = mode === "random" ? shuffle(list) : list.sort(function (a, b) { return collator.compare(a.title, b.title); });

    $("#pp-count").textContent = toFa(list.length) + " پادکست" + (isFiltered(f) ? " مطابق فیلترها" : "");

    var box = $("#pp-results");
    if (!list.length) {
      box.innerHTML = '<p class="pp-empty">پادکستی با این فیلترها پیدا نشد. فیلترها را کم کن یا پاک کن.</p>';
    } else if ($("#f-group").checked) {
      var groups = {}, order = [];
      list.forEach(function (p) {
        if (!groups[p.category]) { groups[p.category] = []; order.push(p.category); }
        groups[p.category].push(p);
      });
      // ترتیب دسته‌ها هم در حالت تصادفی عوض می‌شود تا جایگاه ثابت نباشد
      order = mode === "random" ? shuffle(order) : order.sort(collator.compare);
      box.innerHTML = order.map(function (c) {
        return '<section class="pp-group"><h2>' + esc(c) + '</h2><div class="pp-grid">' +
          groups[c].map(card).join("") + "</div></section>";
      }).join("");
    } else {
      box.innerHTML = '<div class="pp-grid">' + list.map(card).join("") + "</div>";
    }

    var wrap = $("#pp-similar-wrap");
    var sim = isFiltered(f) && list.length ? similarTo(list) : [];
    wrap.hidden = !sim.length;
    $("#pp-similar").innerHTML = sim.map(card).join("");
  }

  function setMode(m) {
    mode = m;
    $("#b-random").setAttribute("aria-pressed", String(m === "random"));
    $("#b-alpha").setAttribute("aria-pressed", String(m === "alpha"));
    render();
  }

  function init() {
    fillOptions("#f-category", unique("category"));
    fillOptions("#f-city", unique("city"));
    var years = []; for (var y = jy; y >= FIRST_YEAR; y--) years.push(y);
    fillOptions("#f-year-from", years, toFa);
    fillOptions("#f-year-to", years, toFa);

    // پشتیبانی از لینک‌هایی مثل /podcasts/?city=تهران یا ?q=آلمان (برای نقشه)
    var qs = new URLSearchParams(location.search);
    if (qs.get("q")) $("#f-q").value = qs.get("q");
    if (qs.get("city")) {
      var want = norm(qs.get("city"));
      Array.prototype.some.call($("#f-city").options, function (o) {
        if (norm(o.value) === want) { $("#f-city").value = o.value; return true; }
      });
    }

    $("#pp-filters").addEventListener("input", render);
    $("#pp-filters").addEventListener("submit", function (e) { e.preventDefault(); });
    $("#b-random").addEventListener("click", function () { setMode("random"); });
    $("#b-alpha").addEventListener("click", function () { setMode("alpha"); });
    $("#b-reset").addEventListener("click", function () { $("#pp-filters").reset(); render(); });
    render();
  }

  fetch(window.PP_DATA_URL)
    .then(function (r) { return r.json(); })
    .then(function (d) { data = d; init(); })
    .catch(function () {
      $("#pp-results").innerHTML = '<p class="pp-empty">بارگذاری فهرست پادکست‌ها انجام نشد.</p>';
    });
})();
