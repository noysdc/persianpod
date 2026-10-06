/* PersianPod: صفحه‌ی «گوش بده»
   - پلیر از embed، castbox_embed، شناسه‌ی Castbox یا لینک Spotify ساخته می‌شود.
   - پلیرها مثل پادکست‌ها دسته‌بندی دارند: ردیف افقی برای هر دسته، با نام کلیک‌پذیر.
   - ترتیب دسته‌ها و پلیرها در هر بار باز شدن صفحه عوض می‌شود. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var out = $("#pl-results"), stage = $("#pl-stage");
  if (!out || !stage) return;

  var FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩";
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  function norm(s) {
    return String(s == null ? "" : s).replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\u200c/g, " ").replace(/\s+/g, " ")
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); })
      .toLowerCase().trim();
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var collator = new Intl.Collator("fa");

  /* ---------- منبع پلیر ---------- */
  // فقط سرویس‌های پادکستی شناخته‌شده اجازه‌ی iframe دارند
  var ALLOWED = /^https:\/\/(castbox\.fm|open\.spotify\.com|embed\.podcasts\.apple\.com|podcasts\.apple\.com|w\.soundcloud\.com|www\.youtube\.com|www\.youtube-nocookie\.com|player\.podbean\.com|www\.podbean\.com|anchor\.fm|podcasters\.spotify\.com|embed\.acast\.com|share\.transistor\.fm|www\.buzzsprout\.com|player\.fireside\.fm|html5-player\.libsyn\.com|player\.simplecast\.com)\//;
  function embedSrc(v) {                       // کد iframe یا لینک ساده
    v = String(v || "").trim();
    var m = v.match(/src\s*=\s*["']([^"']+)["']/i);
    return m ? m[1] : v;
  }
  function playerSrc(p) {
    var e = embedSrc(p.embed) || embedSrc(p.castbox_embed);
    if (e && ALLOWED.test(e)) return e;
    var c = String(p.castbox || ""), m = c.match(/-id(\d{4,})/) || c.match(/\/vh\/(\d{4,})/) || c.match(/^\D{0,3}(\d{4,})\D{0,3}$/);
    if (m) return "https://castbox.fm/app/castbox/player/id" + m[1] + "?v=8.22.11&autoplay=0";
    var s = String(p.spotify || "").match(/\/show\/([A-Za-z0-9]+)/);
    if (s) return "https://open.spotify.com/embed/show/" + s[1];
    return fromLink(p.podcast_link);
  }
  // پلیر خودکار از «لینک پادکست» (Castbox، اسپاتیفای، اپل پادکست)
  function fromLink(u) {
    u = String(u || "");
    var m = u.match(/castbox\.fm\/(?:ch|channel|vh)\/([^\s\/?#]+)/i), id = m && (m[1].match(/(\d{4,})$/) || [])[1];
    if (id) return "https://castbox.fm/app/castbox/player/id" + id + "?v=8.22.11&autoplay=0";
    m = u.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?show\/([A-Za-z0-9]+)/i);
    if (m) return "https://open.spotify.com/embed/show/" + m[1];
    m = u.match(/podcasts\.apple\.com\/([a-z]{2})\/podcast\/([^\s\/?#]+)\/(id\d+)/i);
    if (m) return "https://embed.podcasts.apple.com/" + m[1] + "/podcast/" + m[2] + "/" + m[3];
    return "";
  }
  function kindOf(src) { return /castbox/.test(src) ? "castbox" : /spotify/.test(src) ? "spotify" : "other"; }
  function castboxPage(p) {
    var c = String(p.castbox || ""), m = c.match(/-id(\d{4,})/) || c.match(/\/vh\/(\d{4,})/) || c.match(/^\D{0,3}(\d{4,})\D{0,3}$/);
    if (m) return "https://castbox.fm/vh/" + m[1];
    return /castbox\.fm\//i.test(String(p.podcast_link || "")) ? String(p.podcast_link) : "";
  }
  function youtubeId(u) {
    var m = String(u || "").match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : "";
  }

  /* ---------- ترتیب تصادفی مستقل ----------
     فقط برای همین صفحه است؛ هیچ مقدار تصادفی با صفحه‌ی پادکست‌ها مشترک نیست.
     اگر ترتیب تازه با ترتیب دفعه‌ی قبلِ همین صفحه یکی شد، دوباره می‌چینیم. */
  function rnd() {
    try { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); }
  }
  function signature() {
    var firstOf = {};
    data.slice().sort(function (a, b) { return a._rnd - b._rnd; }).forEach(function (p) { if (!firstOf[p._cat]) firstOf[p._cat] = p.id; });
    return Object.keys(firstOf).sort(function (a, b) { return catRank[a] - catRank[b]; }).map(function (c) { return firstOf[c]; }).join("|");
  }
  function shuffleAll() {
    var prev = ""; try { prev = localStorage.getItem("pp-listen-order") || ""; } catch (e) {}
    for (var t = 0; t < 4; t++) {
      catRank = {};
      data.forEach(function (p) { p._rnd = rnd(); });
      data.forEach(function (p) { if (catRank[p._cat] == null) catRank[p._cat] = rnd(); });
      if (data.length < 3 || signature() !== prev) break;
    }
    try { localStorage.setItem("pp-listen-order", signature()); } catch (e) {}
  }

  /* ---------- حالت ---------- */
  var data = [], cat = "", current = null, catRank = {};
  var qEl = $("#q");
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  var HEAD = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>';

  function prep(p) {
    p._src = playerSrc(p);
    p._cat = p.category || "سایر";
    p._hay = norm([p.title, p.description, p.category, p.city, (p.tags || []).join(" ")].join(" "));
    p._rnd = 0;
    return p;
  }
  function match(p, f, skipCat) {
    if (!skipCat && f.cat && p._cat !== f.cat) return false;
    if (f.q) { var w = f.q.split(" "); for (var i = 0; i < w.length; i++) if (p._hay.indexOf(w[i]) === -1) return false; }
    return true;
  }
  function read() { return { q: norm(qEl ? qEl.value : ""), cat: cat }; }

  /* ---------- نمایش ---------- */
  function card(p) {
    var logo = p.logo ? '<img src="' + esc(p.logo) + '" alt="" loading="lazy" decoding="async" width="72" height="72">' : "<i>" + esc((p.title || "").trim().charAt(0)) + "</i>";
    return '<button type="button" class="pd-card pl-card" data-id="' + esc(p.id) + '"' + (current && current.id === p.id ? ' aria-current="true"' : "") + ">" +
      '<span class="pd-logo">' + logo + "</span>" +
      '<span class="pd-body"><h3>' + esc(p.title) + "</h3>" +
      (p.description ? '<span class="pd-desc">' + esc(p.description) + "</span>" : "") +
      '<span class="pl-play">' + PLAY + "پخش</span></span></button>";
  }
  function render() {
    var f = read();
    var list = data.filter(function (p) { return match(p, f); }).sort(function (a, b) { return a._rnd - b._rnd; });
    $("#pl-count").textContent = toFa(list.length) + " پلیر" + (f.q || f.cat ? " مطابق فیلترها" : "");

    if (!list.length) {
      out.innerHTML = '<p class="pd-empty">پلیری با این فیلتر پیدا نشد.</p>';
    } else if (!f.cat) {
      var groups = {}, order = [];
      list.forEach(function (p) { if (!groups[p._cat]) { groups[p._cat] = []; order.push(p._cat); } groups[p._cat].push(p); });
      order.sort(function (a, b) { return catRank[a] - catRank[b]; });
      out.innerHTML = order.map(function (c) {
        return '<section class="pd-group" aria-label="' + esc(c) + '"><h2 class="pd-cat">' +
          '<a class="pd-cat-link" href="?category=' + encodeURIComponent(c) + '" data-cat="' + esc(c) + '"><span class="pd-cat-ic">' + HEAD + "</span>" +
          esc(c) + " <small>" + toFa(groups[c].length) + '</small><span class="pd-more">مشاهده‌ی همه ‹</span></a></h2>' +
          '<div class="pd-row-wrap">' +
          '<button type="button" class="pd-arrow pd-prev" data-dir="prev" aria-label="قبلی: ' + esc(c) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>' +
          '<div class="pd-row pl-row" tabindex="0">' + groups[c].map(card).join("") + "</div>" +
          '<button type="button" class="pd-arrow pd-next" data-dir="next" aria-label="بعدی: ' + esc(c) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>' +
          "</div></section>";
      }).join("");
    } else {
      out.innerHTML = '<div class="pd-grid">' + list.map(card).join("") + "</div>";
    }
    markScrollable(); chips(f); counts(f);
  }
  function markScrollable() {
    $$(".pd-row-wrap", out).forEach(function (w) { var r = $(".pd-row", w); w.classList.toggle("no-scroll", r.scrollWidth <= r.clientWidth + 4); });
  }
  window.addEventListener("resize", markScrollable);

  function chips(f) {
    var h = "";
    function add(k, t) { h += '<button type="button" class="pd-chip" data-k="' + k + '">' + esc(t) + ' <span aria-hidden="true">×</span><span class="sr">حذف</span></button>'; }
    if (f.q) add("q", "جست‌وجو: " + qEl.value.trim());
    if (f.cat) add("cat", "دسته: " + f.cat);
    $("#pl-chips").innerHTML = h;
  }
  /* شمارنده‌ی ستون راست = تعداد پلیرهای هر دسته */
  function counts(f) {
    var by = {}, total = 0;
    data.forEach(function (p) { if (match(p, f, true)) { by[p._cat] = (by[p._cat] || 0) + 1; total++; } });
    $$(".pp-cats a").forEach(function (a) {
      var c = a.getAttribute("data-cat"), n = c ? (by[c] || 0) : total, b = $(".n", a);
      if (b) b.textContent = toFa(n);
      a.classList.toggle("zero", n === 0 && c !== cat);
      if (c === cat) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }

  /* ---------- صحنه‌ی پخش ---------- */
  function select(p, scroll) {
    current = p;
    try { history.replaceState(null, "", location.pathname + "?p=" + encodeURIComponent(p.id)); } catch (e) {}
    var src = p._src, kind = kindOf(src), yt = youtubeId(p.youtube), cb = castboxPage(p);
    stage.innerHTML =
      '<div class="pl-head">' + (p.logo ? '<img src="' + esc(p.logo) + '" alt="" width="68" height="68">' : "<i>" + esc((p.title || "").trim().charAt(0)) + "</i>") +
      "<div><h2>" + esc(p.title) + "</h2><small>" + esc(p._cat) + "</small></div></div>" +
      '<div id="pl-slot">' + (window.PPPlayer ? '<p class="pp-poster-note">پلیر به‌صورت شناور باز می‌شود و هنگام گشت‌وگذار در سایت هم پخش ادامه دارد.</p><button type="button" class="pp-poster-btn" id="pl-play">' + PLAY + 'پخش ' + esc(p.title) + "</button>" : "") + "</div>" +
      (yt ? '<h3 class="pl-sub">قسمت منتخب در یوتیوب</h3><div id="pl-yt"></div>' : "") +
      '<div class="pl-links"><a href="' + esc(p.url) + '">صفحه‌ی معرفی پادکست</a>' +
      (cb ? '<a href="' + esc(cb) + '" target="_blank" rel="noopener noreferrer">باز کردن در Castbox</a>' : "") + "</div>";
    function mount(id, cls, url, title, allow) {
      var slot = document.getElementById(id); if (!slot) return;
      var f = document.createElement("iframe");
      f.className = cls; f.src = url; f.title = title; f.loading = "lazy";
      f.setAttribute("allow", allow || "autoplay; encrypted-media; clipboard-write");
      f.setAttribute("allowfullscreen", ""); f.referrerPolicy = "strict-origin-when-cross-origin";
      f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation");
      slot.appendChild(f);
    }
    if (window.PPPlayer) {
      var pb = document.getElementById("pl-play");
      if (pb) pb.addEventListener("click", function () { playFloat(p); });
    } else mount("pl-slot", "e-" + kind, src, "پلیر " + p.title);
    if (yt) mount("pl-yt", "e-youtube", "https://www.youtube-nocookie.com/embed/" + yt, "قسمت منتخب " + p.title, "accelerometer; encrypted-media; picture-in-picture");
    $$(".pl-card", out).forEach(function (b) { if (b.getAttribute("data-id") === p.id) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
    if (scroll) stage.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function playFloat(p) {
    if (!window.PPPlayer || !p._src) return;
    window.PPPlayer.open({ src: p._src, title: p.title, page: castboxPage(p) || p.podcast_link || "" });
  }

  /* ---------- رویدادها ---------- */
  function setCat(c) { cat = c || ""; render(); }
  out.addEventListener("click", function (e) {
    var a = e.target.closest(".pd-arrow");
    if (a) {
      var row = $(".pd-row", a.parentNode), rtl = getComputedStyle(row).direction === "rtl";
      var sign = (a.getAttribute("data-dir") === "next") === rtl ? -1 : 1;
      row.scrollBy({ left: sign * Math.max(240, row.clientWidth * 0.85), behavior: "smooth" });
      return;
    }
    var t = e.target.closest(".pd-cat-link");
    if (t && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); setCat(t.getAttribute("data-cat")); var h = $(".pd-head"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    var b = e.target.closest(".pl-card");
    if (b) { var p = data.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0]; if (p) { select(p, true); playFloat(p); } }
  });
  $("#pl-chips").addEventListener("click", function (e) {
    var b = e.target.closest(".pd-chip"); if (!b) return;
    if (b.getAttribute("data-k") === "q" && qEl) qEl.value = ""; else cat = "";
    render();
  });
  $$(".pp-cats a").forEach(function (a) {                      // ستون راست روی همین صفحه فیلتر می‌کند
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); setCat(a.getAttribute("data-cat"));
    });
  });
  if (qEl) {
    var t0; qEl.addEventListener("input", function () { clearTimeout(t0); t0 = setTimeout(render, 90); });
    if (qEl.form) qEl.form.addEventListener("submit", function (e) { e.preventDefault(); render(); });
  }

  /* ---------- شروع ---------- */
  fetch(window.PP_DATA_URL)
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (d) {
      data = d.map(prep).filter(function (p) { return p._src; });
      if (!data.length) {
        stage.innerHTML = '<p class="pd-empty">هنوز پادکستی با پلیر ثبت نشده. پلیر از «لینک پادکست» (Castbox، اسپاتیفای یا اپل پادکست) ساخته می‌شود.</p>';
        out.innerHTML = ""; return;
      }
      shuffleAll();                       // ترتیب این صفحه مستقل از صفحه‌ی پادکست‌هاست و هر بار لود عوض می‌شود
      var u = new URLSearchParams(location.search), want = u.get("p") || decodeURIComponent(location.hash.slice(1));
      var qs = u.get("category"); if (qs) { var n = norm(qs); data.some(function (p) { if (norm(p._cat) === n) { cat = p._cat; return true; } }); }
      var first = data.filter(function (p) { return p.id === want; })[0] || data[Math.floor(rnd() * data.length)];
      render(); select(first, false);
    })
    .catch(function () { stage.innerHTML = '<p class="pd-empty">بارگذاری فهرست انجام نشد. صفحه را دوباره باز کنید.</p>'; });
})();
