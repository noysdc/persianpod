/* PersianPod: صفحه‌ی «مقایسه‌ی اطلاعات پادکست‌ها»
   اصل: فقط داده‌ی قابل اندازه‌گیری؛ بدون امتیاز، بدون برنده، بدون قضاوت درباره‌ی کیفیت.
   هر عدد یک توضیح «ⓘ» دارد تا معلوم باشد از کجا آمده. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var out = $("#cp-out");
  if (!out) return;

  var FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩";
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  function norm(s) {
    return String(s == null ? "" : s).replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\u200c/g, " ").replace(/\s+/g, " ")
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); })
      .toLowerCase().trim();
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(v) {                                   // عدد یا متنی مثل «۴۰ دقیقه»
    if (v == null || v === "") return null;
    var m = String(v).replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).match(/\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function fmt(n) { return toFa(Math.round(n * 10) / 10).replace(".", "٫"); }

  var STATUS = { active: "فعال", paused: "متوقف", inactive: "غیرفعال", ended: "پایان‌یافته" };
  var data = [], sel = { a: null, b: null };

  /* ---------- تعریف شاخص‌ها ----------
     k: کلید، v: مقدار عددی (برای میله و تفاوت)، t: متن نمایشی، i: توضیح شفاف محاسبه */
  var METRICS = [
    { g: "اطلاعات پایه", rows: [
      { l: "دسته‌بندی", t: function (p) { return p.category; }, i: "دسته‌ای که پادکستر هنگام ثبت انتخاب کرده است." },
      { l: "موضوع‌ها", t: function (p) { return (p.subcategories || []).join("، "); }, i: "زیردسته‌هایی که پادکستر ثبت کرده است." },
      { l: "وضعیت", t: function (p) { return STATUS[p.status] || ""; }, i: "اگر RSS ثبت شده باشد، بر اساس تاریخ آخرین قسمت (بیش از ۳ سال بدون قسمت جدید = غیرفعال)؛ وگرنه مقدارِ ثبت‌شده توسط پادکستر." },
      { l: "سال شروع", v: function (p) { return num(p.start); }, t: function (p) { return p.start ? toFa(p.start) : ""; }, i: "سال شمسی اولین قسمت در RSS، یا سالی که پادکستر ثبت کرده است." },
      { l: "شهر و کشور", t: function (p) { return [p.city, p.country].filter(Boolean).join("، "); }, i: "اطلاعات ثبت‌شده توسط پادکستر." },
      { l: "زبان", t: function (p) { return p.language; }, i: "اطلاعات ثبت‌شده توسط پادکستر." }
    ] },
    { g: "انتشار", rows: [
      { l: "تعداد کل قسمت‌ها", v: function (p) { return num(p.episodes); }, t: function (p) { return p.episodes != null ? toFa(p.episodes) : ""; }, bar: 1, i: "تعداد قسمت‌های موجود در RSS (یا عددی که پادکستر ثبت کرده). این عدد به سن پادکست وابسته است؛ برای مقایسه‌ی عادلانه‌تر، ردیف‌های ۱۲ ماه اخیر را هم ببینید." },
      { l: "قسمت‌های ۱۲ ماه اخیر", v: function (p) { return num(p.eps_365); }, t: function (p) { return p.eps_365 != null ? toFa(p.eps_365) : ""; }, bar: 1, i: "تعداد قسمت‌هایی که در ۳۶۵ روز گذشته منتشر شده‌اند (از RSS)." },
      { l: "قسمت‌های ۹۰ روز اخیر", v: function (p) { return num(p.eps_90); }, t: function (p) { return p.eps_90 != null ? toFa(p.eps_90) : ""; }, bar: 1, i: "تعداد قسمت‌هایی که در ۹۰ روز گذشته منتشر شده‌اند (از RSS)." },
      { l: "میانگین فاصله‌ی انتشار", v: function (p) { return num(p.gap); }, t: function (p) { return p.gap != null ? "هر " + fmt(p.gap) + " روز" : ""; }, i: "فاصله‌ی قسمت اول تا آخرِ ۳۶۵ روز گذشته تقسیم بر تعداد فاصله‌ها. اگر در این بازه کمتر از دو قسمت باشد، محاسبه نمی‌شود." },
      { l: "آخرین قسمت", t: function (p) { return p.last ? toFa(p.last) : ""; }, i: "تاریخ شمسی آخرین قسمت در RSS." }
    ] },
    { g: "مدت قسمت‌ها", rows: [
      { l: "میانگین مدت قسمت", v: function (p) { return num(p.avg_length); }, t: function (p) { var n = num(p.avg_length); return n != null ? toFa(Math.round(n)) + " دقیقه" : ""; }, bar: 1, i: "میانگین مدت ۳۰ قسمت آخر که مدت معتبر دارند." },
      { l: "میانه‌ی مدت قسمت", v: function (p) { return num(p.median_length); }, t: function (p) { return p.median_length != null ? toFa(p.median_length) + " دقیقه" : ""; }, bar: 1, i: "میانه‌ی مدت همه‌ی قسمت‌های RSS که مدت معتبر دارند. میانه به قسمت‌های خیلی کوتاه یا خیلی بلند حساس نیست." },
      { l: "کوتاه‌ترین قسمت", v: function (p) { return num(p.min_length); }, t: function (p) { return p.min_length != null ? toFa(p.min_length) + " دقیقه" : ""; }, i: "کوتاه‌ترین قسمتِ دارای مدت معتبر در RSS." },
      { l: "بلندترین قسمت", v: function (p) { return num(p.max_length); }, t: function (p) { return p.max_length != null ? toFa(p.max_length) + " دقیقه" : ""; }, i: "بلندترین قسمتِ دارای مدت معتبر در RSS." }
    ] }
  ];

  /* ---------- انتخاب پادکست ---------- */
  function bySlug(s) { return data.filter(function (p) { return p.slug === s; })[0] || null; }
  function setupSlot(key) {
    var input = $("#cp-in-" + key), list = $("#cp-list-" + key), chosen = $("#cp-ch-" + key), act = -1, shown = [];
    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); act = -1; }
    function open(items) {
      shown = items;
      if (!items.length) { list.innerHTML = '<li class="cp-none" role="presentation">پادکستی پیدا نشد</li>'; }
      else list.innerHTML = items.map(function (p, i) {
        return '<li role="option" id="cp-o-' + key + i + '" data-slug="' + esc(p.slug) + '">' + esc(p.title) + "<small>" + esc(p.category) + "</small></li>";
      }).join("");
      list.hidden = false; input.setAttribute("aria-expanded", "true"); act = -1;
    }
    function query() {
      var q = norm(input.value), other = sel[key === "a" ? "b" : "a"];
      var items = data.filter(function (p) { return !other || p.slug !== other.slug; }).filter(function (p) { return !q || norm(p.title + " " + p.category).indexOf(q) !== -1; });
      open(items.slice(0, 8));
    }
    function pick(slug) {
      var p = bySlug(slug); if (!p) return;
      sel[key] = p; input.value = ""; close(); drawChosen(key); update();
    }
    input.addEventListener("input", query);
    input.addEventListener("focus", query);
    input.addEventListener("keydown", function (e) {
      var opts = list.querySelectorAll("li[data-slug]");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (list.hidden) query(); opts = list.querySelectorAll("li[data-slug]"); if (!opts.length) return;
        act = (act + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
        [].forEach.call(opts, function (o, i) { o.setAttribute("aria-selected", i === act ? "true" : "false"); });
        input.setAttribute("aria-activedescendant", opts[act].id);
      } else if (e.key === "Enter") {
        e.preventDefault(); var t = opts[act >= 0 ? act : 0]; if (t) pick(t.getAttribute("data-slug"));
      } else if (e.key === "Escape") close();
    });
    list.addEventListener("mousedown", function (e) { var li = e.target.closest("li[data-slug]"); if (li) { e.preventDefault(); pick(li.getAttribute("data-slug")); } });
    document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest('[data-slot="' + key + '"]')) close(); });
    chosen.addEventListener("click", function (e) { if (e.target.closest(".cp-x")) { sel[key] = null; drawChosen(key); update(); input.focus(); } });
  }
  function logo(p, c) {
    return p.logo ? '<img class="' + c + '" src="' + esc(p.logo) + '" alt="" width="56" height="56" loading="lazy">' : '<i class="' + c + '">' + esc((p.title || "").trim().charAt(0)) + "</i>";
  }
  function drawChosen(key) {
    var p = sel[key], el = $("#cp-ch-" + key);
    el.innerHTML = p ? logo(p, "cp-lg") + "<b>" + esc(p.title) + '</b><button type="button" class="cp-x" aria-label="حذف ' + esc(p.title) + '">×</button>' : "";
  }

  /* ---------- ساخت مقایسه ---------- */
  function row(r, a, b) {
    var ta = r.t(a), tb = r.t(b);
    if (!ta && !tb) return "";
    var va = r.v ? r.v(a) : null, vb = r.v ? r.v(b) : null, max = Math.max(va || 0, vb || 0);
    function cell(p, t, v) {
      var bar = r.bar && v != null && max > 0 ? '<span class="cp-bar" aria-hidden="true"><span style="width:' + Math.max(3, Math.round(v / max * 100)) + '%"></span></span>' : "";
      return '<td data-p="' + esc(p.title) + '">' + (t ? "<span>" + esc(t) + "</span>" + bar : '<span class="cp-na">اطلاعاتی ثبت نشده</span>') + "</td>";
    }
    return "<tr><th scope=\"row\">" + esc(r.l) + '<button type="button" class="cp-i" aria-label="توضیح: ' + esc(r.l) + '" data-tip="' + esc(r.i) + '">ⓘ</button></th>' + cell(a, ta, va) + cell(b, tb, vb) + "</tr>";
  }
  function trend(a, b) {
    if (!a.recent_30d && !b.recent_30d) return "";
    var max = Math.max.apply(null, (a.recent_30d || [0]).concat(b.recent_30d || [0], [1]));
    /* نام ماه شمسی هر بازه‌ی ۳۰ روزه: ماهی که وسط بازه در آن می‌افتد (بازه‌ها ۳۰ روزه‌اند، نه ماه تقویمی) */
    var months = null;
    try {
      var fm = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long" }), t0 = Date.now();
      months = [];
      for (var k = 0; k < 12; k++) months.push(fm.format(new Date(t0 - ((11 - k) * 30 + 15) * 864e5)));
    } catch (e) { months = null; }
    var mrow = months ? '<div class="cp-months" aria-hidden="true">' + months.map(function (m, k) { return '<span' + (k === 11 ? ' class="now"' : "") + "><i>" + m + "</i></span>"; }).join("") + "</div>" : "";
    function line(p, cls) {
      if (!p.recent_30d) return '<div class="cp-tr-row ' + cls + '"><div class="cp-tr-h"><i class="cp-sw" aria-hidden="true"></i><b>' + esc(p.title) + '</b></div><span class="cp-na">اطلاعات RSS ثبت نشده</span></div>';
      var sum = p.recent_30d.reduce(function (t, n) { return t + (n || 0); }, 0);
      var cols = p.recent_30d.map(function (n, i) {
        return '<span class="cp-col" title="' + toFa(n) + ' قسمت" style="height:' + Math.round(n / max * 100) + '%">' + (n > 0 ? '<span class="cp-v" aria-hidden="true">' + toFa(n) + "</span>" : "") + '<em class="sr">' + toFa(n) + " قسمت</em></span>";
      }).join("");
      return '<div class="cp-tr-row ' + cls + '"><div class="cp-tr-h"><i class="cp-sw" aria-hidden="true"></i><b>' + esc(p.title) + '</b><span class="cp-tr-sum">' + toFa(sum) + ' قسمت در ۱۲ بازه</span></div><div class="cp-cols" role="img" aria-label="تعداد قسمت‌های منتشرشده در ۱۲ بازه‌ی ۳۰ روزه برای ' + esc(p.title) + ": " + p.recent_30d.map(toFa).join("، ") + '">' + cols + "</div>" + mrow + "</div>";
    }
    return '<section class="cp-card"><h2>روند انتشار در ۱۲ بازه‌ی ۳۰ روزه <button type="button" class="cp-i" aria-label="توضیح: روند انتشار" data-tip="تعداد قسمت‌های منتشرشده در هر بازه‌ی ۳۰ روزه‌ی یک سال اخیر؛ ستون آخر ۳۰ روز اخیر است. هر دو نمودار با یک مقیاس رسم شده‌اند.">ⓘ</button></h2>' +
      line(a, "a") + line(b, "b") + "</section>";
  }

  /* جمله‌های تفاوت؛ فقط واقعیت قابل اندازه‌گیری، با آستانه تا تفاوت‌های ناچیز گزارش نشود */
  function facts(a, b) {
    var f = [], N = function (p) { return "«" + p.title + "»"; };
    function cmp(k, ratio, minDiff, fn) {
      var x = num(a[k]), y = num(b[k]);
      if (x == null || y == null || x === y) return;
      var hi = x > y ? a : b, lo = x > y ? b : a, vh = Math.max(x, y), vl = Math.min(x, y);
      if (vh - vl < minDiff || vh < vl * ratio) return;
      f.push(fn(hi, lo, vh, vl));
    }
    cmp("episodes", 1.25, 3, function (h, l, vh, vl) { return N(h) + " آرشیو بزرگ‌تری دارد (" + toFa(vh) + " قسمت در برابر " + toFa(vl) + ")."; });
    cmp("eps_365", 1.2, 3, function (h, l, vh, vl) { return N(h) + " در ۱۲ ماه اخیر قسمت‌های بیشتری منتشر کرده است (" + toFa(vh) + " در برابر " + toFa(vl) + ")."; });
    cmp("avg_length", 1.15, 5, function (h, l, vh, vl) { return "میانگین مدت قسمت‌های " + N(h) + " حدود " + toFa(Math.round(vh - vl)) + " دقیقه بیشتر است (" + toFa(Math.round(vh)) + " در برابر " + toFa(Math.round(vl)) + " دقیقه)."; });
    cmp("gap", 1.3, 1, function (h, l, vh, vl) { return "فاصله‌ی انتشار " + N(l) + " کوتاه‌تر است (هر " + fmt(vl) + " روز در برابر هر " + fmt(vh) + " روز)."; });
    var sa = num(a.start), sb = num(b.start);
    if (sa && sb && sa !== sb) { var older = sa < sb ? a : b, y = Math.min(sa, sb), d = Math.abs(sa - sb); f.push("اولین قسمتِ " + N(older) + " در سال " + toFa(y) + " منتشر شده است؛ " + toFa(d) + " سال زودتر."); }
    if (a.last && b.last && a.last !== b.last) { var nw = a.last > b.last ? a : b; f.push("تاریخ آخرین قسمتِ " + N(nw) + " جدیدتر است (" + toFa(nw.last) + ")."); }
    if (a.category && a.category === b.category) f.push("هر دو در دسته‌ی «" + a.category + "» ثبت شده‌اند.");
    else if (a.category && b.category) f.push(N(a) + " در دسته‌ی «" + a.category + "» و " + N(b) + " در دسته‌ی «" + b.category + "» ثبت شده است.");
    return f;
  }
  /* «اگر دنبال ... هستی»: فقط ترجمه‌ی نیاز به داده، بدون ارزش‌گذاری */
  function needs(a, b) {
    var r = [], N = function (p) { return "«" + p.title + "»"; };
    function pair(k, ratio, minDiff, wantHigh, text, why) {
      var x = num(a[k]), y = num(b[k]); if (x == null || y == null) return;
      var hi = Math.max(x, y), lo = Math.min(x, y); if (hi - lo < minDiff || hi < lo * ratio) return;
      var p = (x > y) === wantHigh ? a : b;
      r.push([text, N(p), why(p)]);
    }
    pair("avg_length", 1.15, 5, false, "اگر قسمت‌های کوتاه‌تر می‌خواهی", function () { return "میانگین مدت قسمت‌ها کمتر است"; });
    pair("avg_length", 1.15, 5, true, "اگر قسمت‌های طولانی‌تر می‌خواهی", function () { return "میانگین مدت قسمت‌ها بیشتر است"; });
    pair("episodes", 1.25, 3, true, "اگر آرشیو بزرگ‌تری برای شنیدن می‌خواهی", function () { return "تعداد کل قسمت‌ها بیشتر است"; });
    pair("eps_365", 1.2, 3, true, "اگر قسمت‌های تازه‌تر و بیشتر می‌خواهی", function () { return "در ۱۲ ماه اخیر قسمت‌های بیشتری منتشر شده"; });
    return r;
  }

  function render() {
    var a = sel.a, b = sel.b;
    var head = '<div class="cp-head"><div class="cp-hp">' + logo(a, "cp-hl") + '<h2><a href="' + esc(a.url) + '">' + esc(a.title) + '</a></h2></div><div class="cp-hvs" aria-hidden="true">×</div><div class="cp-hp">' + logo(b, "cp-hl") + '<h2><a href="' + esc(b.url) + '">' + esc(b.title) + "</a></h2></div></div>";
    var tbl = '<section class="cp-card"><div class="cp-scroll"><table class="cp-t"><thead><tr><th scope="col"><span class="sr">شاخص</span></th><th scope="col">' + esc(a.title) + '</th><th scope="col">' + esc(b.title) + "</th></tr></thead>" +
      METRICS.map(function (g) {
        var rows = g.rows.map(function (r) { return row(r, a, b); }).join("");
        return rows ? '<tbody><tr class="cp-g"><th colspan="3" scope="colgroup">' + esc(g.g) + "</th></tr>" + rows + "</tbody>" : "";
      }).join("") + "</table></div></section>";
    var fs = facts(a, b), ns = needs(a, b);
    var diff = '<section class="cp-card"><h2>تفاوت‌های قابل توجه</h2>' + (fs.length ? "<ul>" + fs.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : '<p class="cp-na">با داده‌های فعلی تفاوت قابل توجهی پیدا نشد یا اطلاعات کافی ثبت نشده است.</p>') + "</section>";
    var nd = ns.length ? '<section class="cp-card"><h2>نیاز تو، داده‌ی آن‌ها</h2><p class="cp-note">این بخش قضاوت نیست؛ فقط می‌گوید هر نیاز با کدام عدد ارتباط دارد.</p><ul class="cp-needs">' +
      ns.map(function (x) { return "<li><b>" + esc(x[0]) + ":</b> " + esc(x[1]) + " — " + esc(x[2]) + ".</li>"; }).join("") + "</ul></section>" : "";
    var miss = (!a.has_rss || !b.has_rss) ? '<p class="cp-note">برای ' + esc(!a.has_rss && !b.has_rss ? "هر دو پادکست" : (!a.has_rss ? a.title : b.title)) + ' هنوز RSS ثبت نشده؛ شاخص‌های وابسته به RSS خالی است. پادکستر می‌تواند لینک RSS را در <a href="/form/">فرم ثبت</a> بدهد.</p>' : "";
    out.innerHTML = head + miss + tbl + trend(a, b) + diff + nd;
  }

  var tip = null;
  out.addEventListener("click", function (e) {
    var i = e.target.closest(".cp-i"); if (!i) return;
    var open = i.getAttribute("aria-expanded") === "true";
    [].forEach.call(out.querySelectorAll(".cp-i[aria-expanded=true]"), function (x) { x.setAttribute("aria-expanded", "false"); });
    if (tip) { tip.remove(); tip = null; }
    if (open) return;
    i.setAttribute("aria-expanded", "true");
    tip = document.createElement("div"); tip.className = "cp-tip"; tip.setAttribute("role", "note"); tip.textContent = i.getAttribute("data-tip");
    (i.closest("th") || i.parentNode).appendChild(tip);
  });

  function sync() {
    var u = new URLSearchParams();
    if (sel.a) u.set("a", sel.a.slug); if (sel.b) u.set("b", sel.b.slug);
    var s = u.toString();
    try { history.replaceState(history.state, "", location.pathname + (s ? "?" + s : "")); } catch (e) {}
  }
  function update() {
    var ready = sel.a && sel.b;
    $("#cp-go").disabled = !ready; $("#cp-swap").disabled = !ready;
    sync();
    if (!ready) { out.innerHTML = ""; $("#cp-msg").textContent = sel.a || sel.b ? "یک پادکست دیگر هم انتخاب کن." : ""; return; }
    $("#cp-msg").textContent = ""; render();
  }
  $("#cp-go").addEventListener("click", function () { if (sel.a && sel.b) { render(); out.scrollIntoView({ behavior: "smooth", block: "start" }); } });
  $("#cp-swap").addEventListener("click", function () { var t = sel.a; sel.a = sel.b; sel.b = t; drawChosen("a"); drawChosen("b"); update(); });

  fetch(window.PP_COMPARE_URL).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
    data = d; setupSlot("a"); setupSlot("b");
    var u = new URLSearchParams(location.search);
    sel.a = bySlug(u.get("a")); sel.b = bySlug(u.get("b"));
    if (sel.a && sel.b && sel.a.slug === sel.b.slug) sel.b = null;
    drawChosen("a"); drawChosen("b"); update();
  }).catch(function () { $("#cp-msg").textContent = "بارگذاری فهرست انجام نشد. صفحه را دوباره باز کنید."; });
})();
