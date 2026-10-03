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


  /* ---------- آیکون دسته‌ها و موج صدا ----------
     اگر نام دسته شامل یکی از کلمه‌های هر ردیف باشد، همان آیکون می‌آید؛
     وگرنه آیکون پیش‌فرض (میکروفون). کلمه‌ها را می‌توانی ویرایش یا اضافه کنی. */
  var ICON_RULES = [
    ["coin",       ["کسب", "اقتصاد", "مالی", "پول", "سرمایه", "بازار", "کارآفرین", "بیزینس", "استارتاپ"]],
    ["heart",      ["سبک زندگی", "روان", "سلامت", "خانواده", "رابطه", "معنوی", "دین", "عشق", "ذهن", "رشد فردی"]],
    ["book",       ["کتاب", "ادبیات", "شعر", "تاریخ", "فلسفه", "ادبی", "رمان"]],
    ["bulb",       ["فناوری", "تکنولوژی", "علم", "آموزش", "خلاق", "برنامه", "هوش", "طراحی", "ایده"]],
    ["headphones", ["داستان", "روایت", "موسیق", "صوتی", "جنایی", "ترسناک", "رادیو", "درام"]]
  ];
  var ICONS = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.4-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.7-2.5 1.8s1.1 1.6 2.5 1.9 2.5.8 2.5 1.9S13.4 15.6 12 15.6c-1.2 0-2.2-.5-2.6-1.4M12 6.5V8m0 7.6v1.9"/>'
  };
  function iconFor(category) {
    var c = norm(category);
    for (var i = 0; i < ICON_RULES.length; i++) {
      for (var j = 0; j < ICON_RULES[i][1].length; j++) {
        if (c.indexOf(norm(ICON_RULES[i][1][j])) !== -1) return ICON_RULES[i][0];
      }
    }
    return "mic";
  }
  function iconSvg(name) {
    return '<svg class="pp-cat-svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (ICONS[name] || ICONS.mic) + "</svg>";
  }
  // موج صدا: ۴۸ میله با ارتفاع پایه‌ی ثابت و تأخیر متفاوت؛ بدون تصادفی تا هر بار یکسان رندر شود
  var WAVE = (function () {
    var bars = "";
    for (var i = 0; i < 48; i++) {
      var h = 8 + Math.round(Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)) * 26);
      bars += '<rect class="b" style="--i:' + i + '" x="' + (i * 10 + 3) + '" y="' + (20 - h / 2) +
        '" width="4" height="' + h + '" rx="2"/>';
    }
    return '<div class="pp-wave" aria-hidden="true"><svg viewBox="0 0 480 40" preserveAspectRatio="none" focusable="false">' +
      bars + "</svg></div>";
  })();

  function card(p) {
    var meta = [];
    if (p.year) meta.push('<span class="pp-badge">از ' + toFa(p.year) + "</span>");
    if (p.episodes) meta.push('<span class="pp-badge">' + toFa(p.episodes) + " اپیزود</span>");
    if (p.length) meta.push('<span class="pp-badge">' + toFa(p.length) + " دقیقه</span>");
    if (p.last) meta.push('<span class="pp-badge">آخرین قسمت ' + toFa(p.last) + "</span>");
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
      box.innerHTML = order.map(function (c, idx) {
        return (idx ? WAVE : "") +
          '<section class="pp-group"><h2 class="pp-cat"><span class="pp-cat-icon">' + iconSvg(iconFor(c)) +
          "</span>" + esc(c) + '</h2><div class="pp-grid">' +
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
