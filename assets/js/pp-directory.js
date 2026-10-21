/* PersianPod: فهرست پادکست‌ها
   جست‌وجو = نوار شیشه‌ای بالا (#q)، دسته‌ها = ستون راست، فیلترها = ستون چپ */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var out = $("#pd-results");
  if (!out) return;

  var FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩";
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  function digits(s) {
    return String(s == null ? "" : s)
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); });
  }
  function norm(s) {
    return digits(s).replace(/[يى]/g, "ی").replace(/ك/g, "ک")
      .replace(/[\u064B-\u065F\u0670]/g, "").replace(/\u200c/g, " ")
      .replace(/\s+/g, " ").toLowerCase().trim();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) {
    var m = digits(v).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  var collator = new Intl.Collator("fa");
  var jy = parseInt(new Intl.DateTimeFormat("fa-IR-u-nu-latn", { year: "numeric" }).format(new Date()), 10) || 1405;
  var FIRST_YEAR = 1379;

  /* ---------- آیکون دسته‌ها و موج صدا ---------- */
  var ICON_RULES = [
    ["coin", ["کسب", "اقتصاد", "مالی", "پول", "سرمایه", "بازار", "کارآفرین", "بیزینس", "استارتاپ"]],
    ["heart", ["سبک زندگی", "روان", "سلامت", "خانواده", "رابطه", "معنوی", "دین", "عشق", "ذهن", "رشد فردی"]],
    ["book", ["کتاب", "ادبیات", "شعر", "تاریخ", "فلسفه", "ادبی", "رمان", "داستان"]],
    ["bulb", ["فناوری", "تکنولوژی", "علم", "آموزش", "خلاق", "برنامه", "هوش", "طراحی", "ایده"]],
    ["headphones", ["روایت", "موسیق", "صوتی", "جنایی", "ترسناک", "رادیو", "درام", "طنز"]]
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
    for (var i = 0; i < ICON_RULES.length; i++)
      for (var j = 0; j < ICON_RULES[i][1].length; j++)
        if (c.indexOf(norm(ICON_RULES[i][1][j])) !== -1) return ICON_RULES[i][0];
    return "mic";
  }
  function iconSvg(name) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || ICONS.mic) + "</svg>";
  }
  var WAVE = (function () {
    var bars = "";
    for (var i = 0; i < 48; i++) {
      var h = 8 + Math.round(Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)) * 26);
      bars += '<rect class="b" style="--i:' + i + '" x="' + (i * 10 + 3) + '" y="' + (20 - h / 2) + '" width="4" height="' + h + '" rx="2"/>';
    }
    return '<div class="pd-wave" aria-hidden="true"><svg viewBox="0 0 480 40" preserveAspectRatio="none" focusable="false">' + bars + "</svg></div>";
  })();

  /* ---------- داده ---------- */
  var data = [], cat = "", sub = "", catRank = {}, geo = null, noIntent = false, lastQ = "";
  var els = {
    q: $("#q"), status: $("#f-status"), city: $("#f-city"), lang: $("#f-lang"),
    country: $("#f-country"), yf: $("#f-yf"), yt: $("#f-yt"), emin: $("#f-emin"), emax: $("#f-emax"),
    lmin: $("#f-lmin"), lmax: $("#f-lmax"), creator: $("#f-creator"), tag: $("#f-tag"),
    sort: $("#f-sort"), group: $("#f-group"), recent: $("#f-recent"), saved: $("#f-saved")
  };

  function prep(p, i) {
    var tags = Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(/[,،]/) : []);
    var y = num(p.start); if (y && y > 1700) y -= 621; // میلادی ← شمسی
    p._id = p.slug || p.url || String(i);
    p._cat = p.category || "سایر";
    p._ep = num(p.episodes) || null;
    p._len = num(p.length) || null;
    p._yr = y || null;
    p._active = (p.status || "active") === "active";
    var subs = Array.isArray(p.subcategories) ? p.subcategories : (p.subcategory ? [p.subcategory] : []);
    p._subs = subs.map(norm);
    p._tags = tags.map(norm);
    p._creator = norm(p.creator);
    p._hay = norm([p.title, p.description, p.category, subs.join(" "), p.city, p.country, p.creator, p.language, tags.join(" ")].join(" "));
    p._lastAt = p.last_at ? Date.parse(p.last_at) || null : null;
    p._rnd = Math.random();
    p._new = window.PPOrder ? window.PPOrder.isNew(p) : false;     // اولین قسمت کمتر از ۳ ماه پیش
    return p;
  }
  function unique(key) {
    var seen = {};
    data.forEach(function (p) { if (p[key]) seen[p[key]] = 1; });
    return Object.keys(seen).sort(collator.compare);
  }
  /* شهرها وابسته به کشور: با انتخاب کشور فقط شهرهای همان کشور نمایش داده می‌شوند */
  function fillCities() {
    var c = els.country ? els.country.value : "", keep = els.city.value, seen = {};
    data.forEach(function (p) { if (p.city && (!c || p.country === c)) seen[p.city] = 1; });
    var names = Object.keys(seen).sort(collator.compare);
    els.city.innerHTML = '<option value="">همه</option>';
    fill(els.city, names);
    if (keep && names.indexOf(keep) !== -1) els.city.value = keep;
  }
  function fill(sel, values, label) {
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = label ? label(v) : v; sel.appendChild(o);
    });
  }

  /* ---------- فیلتر ---------- */
  var indexed = false;
  function ensureIndex() { if (indexed || !window.PPSearch || !data.length) return; indexed = true; PPSearch.build(data); }
  function read() {
    var rawq = els.q ? els.q.value : "";
    if (norm(rawq)) ensureIndex();
    if (rawq !== lastQ) { noIntent = false; lastQ = rawq; }
    var S = (window.PPSearch && norm(rawq)) ? PPSearch.search(rawq, { intents: !noIntent }) : null;
    return {
      q: norm(rawq), S: S, cat: cat, sub: sub,
      status: els.status.value, recent: els.recent ? num(els.recent.value) : null, city: els.city.value, lang: els.lang.value, country: els.country ? els.country.value : "", geo: geo,
      yf: num(els.yf.value), yt: num(els.yt.value),
      emin: num(els.emin.value), emax: num(els.emax.value),
      lmin: num(els.lmin.value), lmax: num(els.lmax.value),
      creator: norm(els.creator.value), tag: norm(els.tag.value),
      sort: els.sort.value, group: els.group.checked,
      saved: !!(els.saved && els.saved.checked)
    };
  }
  function inRange(v, lo, hi) {
    if (lo == null && hi == null) return true;
    if (v == null) return false;
    return (lo == null || v >= lo) && (hi == null || v <= hi);
  }
  function match(p, f, skipCat) {
    if (!skipCat && f.cat && p._cat !== f.cat) return false;
    if (!skipCat && f.sub && p._subs.indexOf(norm(f.sub)) === -1) return false;
    if (f.saved && !(window.PPMem && window.PPMem.isSaved(p.url))) return false;     // فقط ذخیره‌شده‌ها
    if (f.status === "active" && !p._active) return false;
    if (f.status === "inactive" && p._active) return false;
    if (f.recent) {                                        // قسمت جدید در N روز اخیر
      if (!p._lastAt || Date.now() - p._lastAt > f.recent * 864e5) return false;
    }
    if (f.city && p.city !== f.city) return false;
    if (f.country && p.country !== f.country) return false;
    if (f.geo) {                                           // کلیک روی نقشه
      var okGeo = (f.geo.cities && f.geo.cities.indexOf(norm(p.city)) !== -1) ||
                  (f.geo.countries && f.geo.countries.indexOf(norm(p.country)) !== -1);
      if (!okGeo) return false;
    }
    if (f.lang && p.language !== f.lang) return false;
    if (!inRange(p._yr, f.yf, f.yt)) return false;
    if (!inRange(p._ep, f.emin, f.emax)) return false;
    if (!inRange(p._len, f.lmin, f.lmax)) return false;
    if (f.creator && p._creator.indexOf(f.creator) === -1) return false;
    if (f.tag) {
      var ok = p._tags.some(function (t) { return t.indexOf(f.tag) !== -1; }) ||
        p._subs.some(function (t) { return t.indexOf(f.tag) !== -1; }) || norm(p.category).indexOf(f.tag) !== -1;
      if (!ok) return false;
    }
    if (f.q) {
      if (f.S) { if (!f.S.score[p._sid]) return false; }            // موتور جدید: رتبه‌بندی + فهم عبارت + غلط‌یابی
      else {
        var words = f.q.split(" ");
        for (var i = 0; i < words.length; i++) if (p._hay.indexOf(words[i]) === -1) return false;
      }
    }
    return true;
  }
  function advancedCount(f) {
    var n = 0;
    ["status", "recent", "city", "lang", "country", "creator", "tag", "saved"].forEach(function (k) { if (f[k]) n++; });
    ["yf", "yt", "emin", "emax", "lmin", "lmax"].forEach(function (k) { if (f[k] != null) n++; });
    return n;
  }
  function isFiltered(f) { return !!(f.q || f.cat || f.sub || f.geo || advancedCount(f)); }

  /* ---------- نمایش ---------- */
  function badge(t, on) { return '<span class="pd-b' + (on ? " on" : "") + '">' + t + "</span>"; }
  function tagHref(c, sb) { return "?category=" + encodeURIComponent(c) + (sb ? "&sub=" + encodeURIComponent(sb) : ""); }
  function card(p) {
    var subs = (p.subcategories || []).slice(0, 3).map(function (x) {
      return '<a class="pd-b pd-tag" href="' + tagHref(p._cat, x) + '" data-cat="' + esc(p._cat) + '" data-sub="' + esc(x) + '">' + esc(x) + "</a>";
    }).join("");
    var logo = p.logo
      ? '<img src="' + esc(p.logo) + '" alt="" loading="lazy" decoding="async" width="160" height="160">'
      : "<i>" + esc((p.title || "").trim().charAt(0)) + "</i>";
    return '<article class="pd-card"><a class="pd-link" href="' + esc(p.url) + '" title="' + esc(p.description || "") + '"><span class="pd-logo">' + logo + "</span>" +
      '<span class="pd-body"><h3>' + esc(p.title) + "</h3></span></a>" +
      '<span class="pd-meta">' + (p._new ? '<span class="pd-b new">جدید</span>' : "") + '<a class="pd-b pd-tag" href="' + tagHref(p._cat) + '" data-cat="' + esc(p._cat) + '">' + esc(p._cat) + "</a>" + subs +
      (p._active ? "" : '<span class="pd-b off">غیرفعال</span>') + "</span></article>";
  }

  function sortList(list, mode) {
    var l = list.slice();
    if (mode === "alpha") l.sort(function (a, b) { return collator.compare(a.title, b.title); });
    else if (mode === "eps") l.sort(function (a, b) { return (b._ep || 0) - (a._ep || 0); });
    else if (mode === "new") l.sort(function (a, b) { return (b._yr || 0) - (a._yr || 0); });
    else if (window.PPOrder) l = window.PPOrder.order(l, "home:" + (cat || "all") + (sub ? "/" + sub : ""));   // چرخش روزانه، فعال‌ها اول، جدیدها جلو
    else l.sort(function (a, b) { return a._rnd - b._rnd; });
    return l;
  }
  function similarity(a, b) {
    if (a._id === b._id) return 0;
    var s = a._cat === b._cat ? 2 : 0;
    a._tags.forEach(function (t) { if (b._tags.indexOf(t) !== -1) s += 1; });
    if (a.city && a.city === b.city) s += 0.5;
    return s;
  }
  function similarTo(results) {
    var ids = {}; results.forEach(function (p) { ids[p._id] = 1; });
    var base = results.slice(0, 5), scored = [];
    data.forEach(function (c) {
      if (ids[c._id]) return;
      var s = 0; base.forEach(function (b) { s += similarity(b, c); });
      if (s > 0) scored.push({ p: c, s: s });
    });
    scored.sort(function (x, y) { return y.s - x.s; });
    return scored.slice(0, 6).map(function (x) { return x.p; });
  }

  var CHIP_LABELS = {
    q: function (f) { return "جست‌وجو: " + els.q.value.trim(); },
    cat: function (f) { return "دسته: " + f.cat; },
    sub: function (f) { return "زیردسته: " + f.sub; },
    status: function (f) { return f.status === "active" ? "فعال" : "غیرفعال"; },
    city: function (f) { return "شهر: " + f.city; },
    lang: function (f) { return "زبان: " + f.lang; },
    country: function (f) { return "کشور: " + f.country; },
    recent: function (f) { return "قسمت جدید: " + $("#f-recent").selectedOptions[0].textContent; },
    geo: function (f) { return "نقشه: " + f.geo.label; },
    creator: function (f) { return "سازنده: " + els.creator.value.trim(); },
    tag: function (f) { return "برچسب: " + els.tag.value.trim(); }
  };
  function chips(f) {
    var html = "";
    function add(k, label) { html += '<button type="button" class="pd-chip" data-k="' + k + '">' + esc(label) + ' <span aria-hidden="true">×</span><span class="sr">حذف</span></button>'; }
    if (f.q) add("q", CHIP_LABELS.q(f));
    if (f.cat) add("cat", CHIP_LABELS.cat(f));
    if (f.sub) add("sub", CHIP_LABELS.sub(f));
    if (f.saved) add("saved", "فقط ذخیره‌شده‌ها");
    if (f.status) add("status", CHIP_LABELS.status(f));
    if (f.recent) add("recent", CHIP_LABELS.recent(f));
    if (f.city) add("city", CHIP_LABELS.city(f));
    if (f.lang) add("lang", CHIP_LABELS.lang(f));
    if (f.country) add("country", CHIP_LABELS.country(f));
    if (f.geo) add("geo", CHIP_LABELS.geo(f));
    if (f.creator) add("creator", CHIP_LABELS.creator(f));
    if (f.tag) add("tag", CHIP_LABELS.tag(f));
    if (f.yf != null || f.yt != null) add("year", "سال: " + (f.yf != null ? "از " + toFa(f.yf) : "") + (f.yt != null ? " تا " + toFa(f.yt) : ""));
    if (f.emin != null || f.emax != null) add("ep", "اپیزود: " + (f.emin != null ? "از " + toFa(f.emin) : "") + (f.emax != null ? " تا " + toFa(f.emax) : ""));
    if (f.lmin != null || f.lmax != null) add("len", "طول: " + (f.lmin != null ? "از " + toFa(f.lmin) : "") + (f.lmax != null ? " تا " + toFa(f.lmax) : "") + " دقیقه");
    $("#pd-chips").innerHTML = html;
  }

  /* ردیف‌های افقی: فلش‌ها فقط وقتی ردیف از عرض بیشتر است */
  function markScrollable() {
    $$(".pd-row-wrap", out).forEach(function (w) {
      var r = $(".pd-row", w);
      w.classList.toggle("no-scroll", r.scrollWidth <= r.clientWidth + 4);
    });
  }
  window.addEventListener("resize", function () { markScrollable(); });
  out.addEventListener("click", function (e) {
    var a = e.target.closest(".pd-arrow");
    if (a) {
      var row = $(".pd-row", a.parentNode), rtl = getComputedStyle(row).direction === "rtl";
      var sign = (a.getAttribute("data-dir") === "next") === rtl ? -1 : 1;
      row.scrollBy({ left: sign * Math.max(240, row.clientWidth * 0.85), behavior: "smooth" });
      return;
    }
    var t = e.target.closest(".pd-cat-link");
    if (t && !(e.metaKey || e.ctrlKey || e.shiftKey)) {      // کلیک روی نام دسته = باز کردن همان دسته
      e.preventDefault();
      cat = t.getAttribute("data-cat") || "";
      render();
      var h = $(".pd-head"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 90); }

  /* ---------- قسمت‌های مطابق جست‌وجو (عنوان + توضیح قسمت‌ها؛ ایندکس تکه‌تکه‌ی assets/sidx) ----------
     فقط وقتی چیزی تایپ شده کار می‌کند؛ اگر ایندکس هنوز ساخته نشده یا خطا بود، بخش پنهان می‌ماند و بقیه‌ی صفحه دست‌نخورده است. */
  var EP_STEP = 10, epLimit = EP_STEP, epLast = "", epSeq = 0, epTimer = null, epBySlug = null;
  function epPodcast(slug) {
    if (!epBySlug) {
      epBySlug = {};
      data.forEach(function (p) {
        var key = p.slug || String(p.url || "").replace(/\/+$/, "").split("/").pop();
        if (key) epBySlug[key] = p;
      });
    }
    return epBySlug[slug] || null;
  }
  function epCard(r) {
    var pod = epPodcast(r.slug), href = pod ? pod.url : "/podcasts/" + encodeURIComponent(r.slug) + "/";
    return '<a class="pd-ep" href="' + esc(href) + '">' +
      '<b class="pd-ep-t">' + esc(r.title || "قسمت بدون عنوان") + "</b>" +
      (pod ? '<span class="pd-ep-p">' + esc(pod.title) + "</span>" : "") +
      (r.snippet ? '<span class="pd-ep-s">' + esc(r.snippet) + "</span>" : "") + "</a>";
  }
  function epHide() {
    var w = $("#pd-eps-wrap"); if (w) w.hidden = true;
    var b = $("#pd-eps"); if (b) b.innerHTML = "";
  }
  function epRun() {
    var wrap = $("#pd-eps-wrap"), box = $("#pd-eps"), more = $("#pd-eps-more"), title = $("#pd-eps-title");
    if (!wrap || !window.PPEpSearch || !els.q) return;
    var q = els.q.value.trim();
    if (q !== epLast) { epLast = q; epLimit = EP_STEP; }
    if (norm(q).length < 2) { epSeq++; epHide(); return; }
    var my = ++epSeq;
    clearTimeout(epTimer);
    epTimer = setTimeout(function () {
      PPEpSearch.search(q, { limit: epLimit }).then(function (r) {
        if (my !== epSeq) return;                         // جست‌وجوی تازه‌تری شروع شده
        if (!r.results.length) { epHide(); return; }
        title.textContent = r.missing.length
          ? "«" + r.missing.join("» و «") + "» در هیچ قسمتی نبود؛ نزدیک‌ترین قسمت‌ها"
          : r.matched === 0 ? "هیچ قسمتی همه‌ی کلمه‌ها را ندارد؛ نزدیک‌ترین قسمت‌ها"
          : toFa(r.matched) + " قسمت با این جست‌وجو";
        box.innerHTML = r.results.map(epCard).join("");
        more.hidden = r.results.length >= (r.matched || r.total) || r.results.length < epLimit;
        wrap.hidden = false;
      }).catch(function () { if (my === epSeq) epHide(); });
    }, 250);
  }
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "pd-eps-more") { epLimit += EP_STEP; epRun(); }
  });

  /* ---------- بازخورد نتیجه: خلاصه‌ی بالای نتایج + دکمه‌ی «نمایش N پادکست» ---------- */
  function ensureSummary() {
    var s = $("#pd-summary");
    if (!s) {
      s = document.createElement("div");
      s.id = "pd-summary"; s.className = "pd-summary"; s.hidden = true;
      s.setAttribute("role", "status"); s.setAttribute("aria-live", "polite");
      var c = $("#pd-chips"); c.parentNode.insertBefore(s, c);
      s.addEventListener("click", function (e) {
        if (e.target.closest(".pd-clear")) resetAll();
        else if (e.target.closest(".pd-noint")) { noIntent = true; render(); }
        else if (e.target.closest(".pd-useint")) { noIntent = false; render(); }
      });
    }
    return s;
  }
  function intentHtml(S) {
    if (!S) return "";
    var h = "";
    if (S.ignoredIntents) return ' <span class="pd-intent">برداشت خودکار خاموش است <button type="button" class="pd-useint">فعال‌سازی</button></span>';
    if (S.intents.length) {
      var by = {}, order = [];
      S.intents.forEach(function (i) { if (!by[i.dim]) { by[i.dim] = []; order.push(i.dim); } by[i.dim].push(i.label); });
      h += ' <span class="pd-intent">برداشت: <b>' + order.map(function (d) { return esc(by[d].join(" یا ")); }).join("</b> و <b>") + '</b> <button type="button" class="pd-noint">فقط متن را جست‌وجو کن</button></span>';
    }
    if (S.relaxed) h += ' <span class="pd-intent">' + (S.dropped ? "با شرط‌های بالا نتیجه‌ای نبود؛ نزدیک‌ترین‌ها بدون آن شرط‌ها نشان داده شد." : "نتیجه‌ی دقیقی نبود؛ نزدیک‌ترین‌ها نشان داده شد.") + "</span>";
    return h;
  }
  function summary(n, filtered, S) {
    var s = ensureSummary(), ap = $("#pd-apply");
    if (ap) { ap.disabled = !n; ap.textContent = n ? "نمایش " + toFa(n) + " پادکست" : "پادکستی پیدا نشد"; }
    s.hidden = !filtered;
    if (!filtered) return;
    s.innerHTML = n ? "<b>" + toFa(n) + " پادکست</b> مطابق جست‌وجوی شما" : "پادکستی با این انتخاب‌ها پیدا نشد";
    s.innerHTML += intentHtml(S) + ' <button type="button" class="pd-clear">پاک‌کردن همه</button>';
    s.classList.remove("pulse"); void s.offsetWidth; s.classList.add("pulse");
  }
  function scrollToResults() {
    var s = $("#pd-summary"), t = (s && !s.hidden) ? s : out;
    var bar = $(".pp-bar"), off = (bar ? bar.getBoundingClientRect().height : 80) + 14;
    window.scrollTo({ top: Math.max(0, t.getBoundingClientRect().top + window.pageYOffset - off), behavior: "smooth" });
  }
  function applyFilters() {
    render();
    var aside = $("#pd-aside"), tg = $("#pd-ftoggle");
    if (aside) aside.classList.remove("open");
    if (tg) tg.setAttribute("aria-expanded", "false");
    scrollToResults();
  }

  function render() {
    var f = read();
    var list = sortList(data.filter(function (p) { return match(p, f); }), f.sort);
    if (f.S && f.sort === "random") list.sort(function (a, b) { return (f.S.score[b._sid] || 0) - (f.S.score[a._sid] || 0); });   // با جست‌وجو: به ترتیب ارتباط
    var filtered = isFiltered(f);

    $("#pd-count").textContent = toFa(list.length) + " پادکست" + (filtered ? " مطابق جست‌وجوی شما" : "");
    out.removeAttribute("aria-busy");

    if (!list.length) {
      out.innerHTML = f.saved && !(window.PPMem && window.PPMem.list().length)
        ? '<p class="pd-empty">هنوز پادکستی ذخیره نکرده‌ای. روی ♡ کارت پادکست‌ها بزن تا اینجا جمع شوند.</p>'
        : '<p class="pd-empty">پادکستی با این انتخاب‌ها پیدا نشد. انتخاب‌ها را کم کن یا پاک کن.</p>';
    } else if (f.group && !f.cat && !f.sub && !f.S) {
      var groups = {}, order = [];
      list.forEach(function (p) {
        if (!groups[p._cat]) { groups[p._cat] = []; order.push(p._cat); }
        groups[p._cat].push(p);
      });
      if (f.sort === "random" && window.PPOrder) {
        order = window.PPOrder.orderKeys(order, "home");
        order.forEach(function (c) { groups[c] = window.PPOrder.order(groups[c], "home:" + c); });
      } else order.sort(function (a, b) { return f.sort === "random" ? catRank[a] - catRank[b] : collator.compare(a, b); });
      out.innerHTML = order.map(function (c, idx) {
        var items = groups[c];
        return (idx ? WAVE : "") + '<section class="pd-group" aria-label="' + esc(c) + '">' +
          '<h2 class="pd-cat"><a class="pd-cat-link" href="?category=' + encodeURIComponent(c) + '" data-cat="' + esc(c) + '">' +
          '<span class="pd-cat-ic">' + iconSvg(iconFor(c)) + "</span>" + esc(c) + " <small>" + toFa(groups[c].length) + "</small>" +
          '<span class="pd-more">مشاهده‌ی همه <span aria-hidden="true">←</span></span></a></h2>' +
          '<div class="pd-row-wrap">' +
          '<button type="button" class="pd-arrow pd-prev" data-dir="prev" aria-label="قبلی: ' + esc(c) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>' +
          '<div class="pd-row" tabindex="0">' + items.map(card).join("") + "</div>" +
          '<button type="button" class="pd-arrow pd-next" data-dir="next" aria-label="بعدی: ' + esc(c) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>' +
          "</div></section>";
      }).join("");
      markScrollable();
    } else {
      out.innerHTML = '<div class="pd-grid">' + list.map(card).join("") + "</div>";
    }

    var sim = filtered && list.length ? similarTo(list) : [];
    $("#pd-similar-wrap").hidden = !sim.length;
    $("#pd-similar").innerHTML = sim.map(card).join("");

    chips(f);
    summary(list.length, filtered, f.S);
    updateCategories(f);
    var n = advancedCount(f), fc = $("#pd-fcount");
    if (fc) { fc.hidden = !n; fc.textContent = toFa(n); }
    syncUrl(f);
    syncPresets();
    epRun();
  }
  function syncPresets() {
    $$(".pd-fs").forEach(function (fs) {
      var g = fs.getAttribute("data-grp"), lo = num(els[g === "ep" ? "emin" : "lmin"].value), hi = num(els[g === "ep" ? "emax" : "lmax"].value), hit = false;
      $$(".pd-presets button", fs).forEach(function (b) {
        var bl = num(b.getAttribute("data-min")), bh = num(b.getAttribute("data-max"));
        var m = bl === lo && bh === hi; if (m) hit = true;
        b.setAttribute("aria-pressed", m ? "true" : "false");
      });
      var d = $(".pd-custom", fs); if (d && (lo != null || hi != null) && !hit) d.open = true;
    });
    if (window.PPRangeSync) window.PPRangeSync();   // هم‌گام‌سازی اسلایدر با فیلدهای عددی
  }

  /* ستون راست: شمارنده‌ی هر دسته بر اساس بقیه‌ی فیلترها */
  function updateCategories(f) {
    var counts = {}, subCounts = {}, total = 0;
    data.forEach(function (p) {
      if (!match(p, f, true)) return;
      counts[p._cat] = (counts[p._cat] || 0) + 1; total++;
      p._subs.forEach(function (t) { var k = p._cat + "|" + t; subCounts[k] = (subCounts[k] || 0) + 1; });
    });
    $$(".pp-cats a").forEach(function (a) {
      var c = a.getAttribute("data-cat"), sb = a.getAttribute("data-sub"), n, on;
      if (sb) { n = subCounts[c + "|" + norm(sb)] || 0; on = c === cat && sb === sub; }
      else { n = c ? (counts[c] || 0) : total; on = c === cat && !sub && (c !== "" || !cat); }
      var badgeEl = $(".n", a); if (badgeEl) badgeEl.textContent = toFa(n);
      a.classList.toggle("zero", n === 0 && !on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
    $$(".pp-cats li.pp-cat").forEach(function (li) {
      var a = $("a[data-cat]", li), tg = $(".pp-cat-tg", li);
      if (a && tg && a.getAttribute("data-cat") === cat && cat) { li.classList.add("open"); tg.setAttribute("aria-expanded", "true"); }
    });
  }


  /* ---------- آدرس (قابل اشتراک‌گذاری) ---------- */
  var PARAMS = { q: "q", category: "cat", city: "city", lang: "lang", status: "status", yf: "yf", yt: "yt",
    emin: "emin", emax: "emax", lmin: "lmin", lmax: "lmax", creator: "creator", tag: "tag", sort: "sort" };
  function syncUrl(f) {
    var p = new URLSearchParams();
    if (els.q && els.q.value.trim()) p.set("q", els.q.value.trim());
    if (cat) p.set("category", cat);
    if (sub) p.set("sub", sub);
    [["recent", els.recent], ["city", els.city], ["lang", els.lang], ["country", els.country], ["status", els.status], ["yf", els.yf], ["yt", els.yt],
      ["emin", els.emin], ["emax", els.emax], ["lmin", els.lmin], ["lmax", els.lmax],
      ["creator", els.creator], ["tag", els.tag]].forEach(function (x) { if (x[1].value.trim()) p.set(x[0], x[1].value.trim()); });
    if (els.saved && els.saved.checked) p.set("saved", "1");
    if (els.sort.value !== "random") p.set("sort", els.sort.value);
    var s = p.toString();
    try { history.replaceState(null, "", location.pathname + (s ? "?" + s : "")); } catch (e) {}
  }
  function setSelect(sel, value) {
    if (!value) return;
    var want = norm(value);
    $$("option", sel).some(function (o) { if (norm(o.value) === want) { sel.value = o.value; return true; } });
  }
  function fromUrl() {
    var p = new URLSearchParams(location.search);
    if (els.q && p.get("q")) els.q.value = p.get("q");
    if (p.get("category")) {
      var want = norm(p.get("category"));
      var hit = data.filter(function (x) { return norm(x._cat) === want; })[0];
      cat = hit ? hit._cat : p.get("category");
    }
    if (p.get("sub")) {
      var ws = norm(p.get("sub")), sh = "";
      data.some(function (x) { return (x.subcategories || []).some(function (t) { if (norm(t) === ws) { sh = t; return true; } }); });
      sub = sh || p.get("sub");
    }
    setSelect(els.country, p.get("country")); fillCities(); setSelect(els.city, p.get("city")); setSelect(els.lang, p.get("lang"));
    if (els.recent && p.get("recent")) els.recent.value = p.get("recent");
    if (p.get("status")) els.status.value = p.get("status");
    ["yf", "yt", "emin", "emax", "lmin", "lmax", "creator", "tag"].forEach(function (k) { if (p.get(k)) els[k].value = p.get(k); });
    if (p.get("sort")) els.sort.value = p.get("sort");
    if (p.get("saved") && els.saved) els.saved.checked = true;
  }

  /* ---------- رویدادها ---------- */
  function resetAll() {
    $("#pd-filters").reset();
    cat = ""; sub = ""; geo = null;
    if (els.q) els.q.value = "";
    render();
  }
  function clearChip(k) {
    if (k === "q" && els.q) els.q.value = "";
    else if (k === "cat") { cat = ""; sub = ""; }
    else if (k === "sub") sub = "";
    else if (k === "geo") geo = null;
    else if (k === "saved") { if (els.saved) els.saved.checked = false; }
    else if (k === "year") { els.yf.value = ""; els.yt.value = ""; }
    else if (k === "ep") { els.emin.value = ""; els.emax.value = ""; }
    else if (k === "len") { els.lmin.value = ""; els.lmax.value = ""; }
    else if (els[k]) els[k].value = "";
    render();
  }

  function init() {
    fill(els.lang, unique("language"));
    if (els.country) fill(els.country, unique("country"));
    fillCities();
    var years = []; for (var y = jy; y >= FIRST_YEAR; y--) years.push(y);
    fill(els.yf, years, toFa); fill(els.yt, years, toFa);
    /* ایندکس جست‌وجو (حدود ۱۳۰ میلی‌ثانیه روی کامپیوتر و چند برابر آن روی گوشی) بعد از اولین نمایش ساخته می‌شود، نه قبل از آن */
    fromUrl();
    if (els.q && norm(els.q.value)) ensureIndex();
    else if (window.requestIdleCallback) requestIdleCallback(ensureIndex, { timeout: 1500 });
    else setTimeout(ensureIndex, 300);
    data.forEach(function (p) { if (catRank[p._cat] == null) catRank[p._cat] = Math.random(); });

    var form = $("#pd-filters");
    form.addEventListener("input", schedule);
    form.addEventListener("change", function (e) { if (e.target === els.country) fillCities(); render(); });
    form.addEventListener("click", function (e) {            // دکمه‌های آماده‌ی تعداد و طول اپیزود
      var b = e.target.closest && e.target.closest(".pd-presets button"); if (!b) return;
      var g = b.closest(".pd-fs").getAttribute("data-grp"), lo = els[g === "ep" ? "emin" : "lmin"], hi = els[g === "ep" ? "emax" : "lmax"];
      var on = b.getAttribute("aria-pressed") === "true";
      lo.value = on ? "" : b.getAttribute("data-min"); hi.value = on ? "" : b.getAttribute("data-max");
      render();
    });
    form.addEventListener("reset", function () { setTimeout(function () { fillCities(); render(); }, 0); });
    form.addEventListener("submit", function (e) { e.preventDefault(); applyFilters(); });
    var ap = $("#pd-apply"); if (ap) ap.addEventListener("click", applyFilters);
    $("#f-reset").addEventListener("click", resetAll);
    if (els.q) {
      els.q.addEventListener("input", schedule);
      var qf = els.q.form; if (qf) qf.addEventListener("submit", function (e) { e.preventDefault(); render(); scrollToResults(); });
    }
    $$(".pp-cats a").forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        cat = a.getAttribute("data-cat") || ""; sub = a.getAttribute("data-sub") || "";
        render();
        if (window.innerWidth < 800) { var h = $(".pd-head"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); }
      });
    });
    function tagClick(e) {
      var t = e.target.closest && e.target.closest(".pd-tag");
      if (!t || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      cat = t.getAttribute("data-cat") || ""; sub = t.getAttribute("data-sub") || "";
      render();
      var h = $(".pd-head"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    out.addEventListener("click", tagClick);
    var simBox = $("#pd-similar"); if (simBox) simBox.addEventListener("click", tagClick);
    $("#pd-chips").addEventListener("click", function (e) {
      var b = e.target.closest(".pd-chip"); if (b) clearChip(b.getAttribute("data-k"));
    });
    var tg = $("#pd-ftoggle"), aside = $("#pd-aside");
    if (tg) tg.addEventListener("click", function () {
      var open = aside.classList.toggle("open");
      tg.setAttribute("aria-expanded", String(open));
    });
    render();
  }

  /* نقشه: کلیک روی کشور، استان یا شهر فهرست را فیلتر می‌کند */
  window.addEventListener("pp:geo", function (e) {
    var d = e.detail || {};
    geo = { label: d.label || "", cities: (d.cities || []).map(norm), countries: (d.countries || []).map(norm) };
    render();
    var h = $("#pd-results"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  var url = document.body.getAttribute("data-search");
  var ssrCount = out.querySelectorAll(".pd-card").length;     // تعداد کارت‌های HTML تازه‌ی همین صفحه، مرجع درستی داده
  function loadData(bust) {
    var u = bust ? url + (url.indexOf("?") > -1 ? "&" : "?") + "r=" + Date.now() : url;
    return fetch(u, bust ? { cache: "reload" } : undefined).then(function (r) { if (!r.ok) throw 0; return r.json(); });
  }
  loadData(false)
    .then(function (d) {
      /* اگر داده‌ی جست‌وجو از کش قدیمی آمده باشد (مثلاً فقط ۲۰ پادکست)، شمارنده‌ها غلط می‌شوند؛ یک بار از شبکه تازه می‌گیریم */
      if (ssrCount && d.length < ssrCount * 0.9) return loadData(true).then(function (d2) { return d2.length >= d.length ? d2 : d; }).catch(function () { return d; });
      return d;
    })
    .then(function (d) { data = d.map(prep); init(); })
    .catch(function () {
      var note = document.createElement("p");
      note.className = "pd-empty";
      note.textContent = "بارگذاری جست‌وجوی پیشرفته انجام نشد؛ فهرست ساده‌ی پادکست‌ها در همین صفحه در دسترس است.";
      out.parentNode.insertBefore(note, out);
    });
})();
