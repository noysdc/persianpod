/* PersianPod: صفحه‌ی «تازه‌ها»
   دو نمایش: «فید قسمت‌ها» (همه‌ی قسمت‌های اخیر همه‌ی پادکست‌ها، جدیدترین اول)
   و «به تفکیک پادکست» (هر پادکست یک ردیف، بر اساس زمان آخرین قسمت).
   آمار تازه از rss_stats.json خوانده می‌شود؛ اگر GitHub raw در دسترس نبود، نسخه‌ی /new.json (زمان دیپلوی) استفاده می‌شود.
   تا وقتی صفحه باز است، هر ۲ دقیقه دوباره خوانده می‌شود. */
(function () {
  "use strict";
  var list = document.getElementById("nw-list"), status = document.getElementById("nw-status");
  if (!list) return;

  var FA = "۰۱۲۳۴۵۶۷۸۹", FEED_MAX = 60;
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safe(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  var fmtDate = (function () { try { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return null; } })();
  var fmtTime = (function () { try { return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return null; } })();

  function ago(ms) {
    var s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return "همین حالا";
    if (s < 3600) return toFa(Math.floor(s / 60)) + " دقیقه پیش";
    if (s < 86400) return toFa(Math.floor(s / 3600)) + " ساعت پیش";
    if (s < 7 * 86400) return toFa(Math.floor(s / 86400)) + " روز پیش";
    return fmtDate ? fmtDate.format(new Date(ms)) : new Date(ms).toISOString().slice(0, 10);
  }

  var meta = [], rows = [], eps = [], view = "feed", fetchedAt = 0, timer = 0;
  var tabs = [].slice.call(document.querySelectorAll(".nw-tabs [data-view]"));

  /* آمار را بدون توجه به بزرگ/کوچکی حروف slug پیدا می‌کند */
  function statOf(stats, slug) {
    if (!stats) return {};
    if (stats[slug]) return stats[slug];
    var l = String(slug).toLowerCase();
    for (var k in stats) if (k.toLowerCase() === l) return stats[k];
    return {};
  }

  function merge(stats) {
    rows = []; eps = [];
    meta.forEach(function (p) {
      var st = statOf(stats, p.slug);
      var at = st.last_at || p.last_at;
      rows.push({ p: p, ms: at ? Date.parse(at) : 0, title: st.last_title || p.last_title || "", link: safe(st.last_link || p.last_link) });
      var rec = (st.recent && st.recent.length) ? st.recent : (p.recent && p.recent.length) ? p.recent
        : (at ? [{ at: at, title: st.last_title || p.last_title, link: st.last_link || p.last_link }] : []);
      rec.forEach(function (x) {
        var ms = x && x.at ? Date.parse(x.at) : 0;
        if (ms && ms <= Date.now() + 3600000) eps.push({ p: p, ms: ms, title: x.title || "", link: safe(x.link) });
      });
    });
    rows.sort(function (a, b) { return (b.ms || 0) - (a.ms || 0) || a.p.title.localeCompare(b.p.title, "fa"); });
    eps.sort(function (a, b) { return b.ms - a.ms; });
  }

  function logoOf(p) {
    return p.logo ? '<img class="nw-logo" src="' + esc(p.logo) + '" alt="" width="64" height="64" loading="lazy" decoding="async">'
      : '<i class="nw-logo">' + esc((p.title || "").trim().charAt(0)) + "</i>";
  }
  function listenOf(p) { return '<a class="nw-listen" href="' + esc("/listen/?p=" + encodeURIComponent(p.slug)) + '">گوش بده</a>'; }

  function renderFeed() {
    var html = "";
    eps.slice(0, FEED_MAX).forEach(function (r, i) {
      var p = r.p, isNew = Date.now() - r.ms < 86400000;
      var t = r.title || "قسمت جدید";
      var tl = r.link ? '<a href="' + esc(r.link) + '" target="_blank" rel="noopener noreferrer">' + esc(t) + "</a>" : esc(t);
      html += '<li class="nw-row nw-feed" data-slug="' + esc(p.slug) + '"><span class="nw-rank" aria-hidden="true">' + toFa(i + 1) + "</span>" + logoOf(p) +
        '<div class="nw-main"><h2>' + tl + '</h2><span class="nw-ep"><a href="' + esc(p.url) + '">' + esc(p.title) + '</a><span class="nw-cat">' + esc(p.category) + "</span></span></div>" +
        '<div class="nw-side"><span class="nw-time">' + (isNew ? '<span class="nw-new">جدید</span>' : "") + esc(ago(r.ms)) + "</span>" + listenOf(p) + "</div></li>";
    });
    if (!html) html = '<li class="nw-sep">هنوز قسمتی برای نمایش نیست.</li>';
    var missing = rows.filter(function (r) { return !r.ms; });
    if (missing.length) html += '<li class="nw-sep">بدون اطلاعات انتشار (RSS ثبت نشده یا خوانده نشد): ' + missing.map(function (r) { return '<a href="' + esc(r.p.url) + '">' + esc(r.p.title) + "</a>"; }).join("، ") + "</li>";
    return html;
  }

  function renderPods() {
    var html = "", sepDone = false;
    rows.forEach(function (r, i) {
      var p = r.p, none = !r.ms;
      if (none && !sepDone) { sepDone = true; html += '<li class="nw-sep" aria-hidden="true">بدون اطلاعات انتشار (RSS ثبت نشده یا خوانده نشد)</li>'; }
      var isNew = !none && Date.now() - r.ms < 86400000;
      var ep = r.title ? (r.link ? '<a href="' + esc(r.link) + '" target="_blank" rel="noopener noreferrer">' + esc(r.title) + "</a>" : esc(r.title)) : "";
      html += '<li class="nw-row' + (none ? " nw-none" : "") + '" data-slug="' + esc(p.slug) + '"><span class="nw-rank" aria-hidden="true">' + toFa(i + 1) + "</span>" + logoOf(p) +
        '<div class="nw-main"><h2><a href="' + esc(p.url) + '">' + esc(p.title) + '</a><span class="nw-cat">' + esc(p.category) + "</span></h2>" + (ep ? '<span class="nw-ep">' + ep + "</span>" : "") + "</div>" +
        '<div class="nw-side"><span class="nw-time">' + (isNew ? '<span class="nw-new">جدید</span>' : "") + (none ? "نامشخص" : esc(ago(r.ms))) + "</span>" + listenOf(p) + "</div></li>";
    });
    return html;
  }

  function render() {
    if (!document.body.contains(list)) return;
    list.innerHTML = view === "feed" ? renderFeed() : renderPods();
    tabs.forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-view") === view ? "true" : "false"); });
    var withData = rows.filter(function (r) { return r.ms; }).length;
    status.textContent = fetchedAt ? "آخرین به‌روزرسانی فهرست: " + (fmtTime ? fmtTime.format(new Date(fetchedAt)) : "") + " · آمار انتشار برای " + toFa(withData) + " از " + toFa(rows.length) + " پادکست" : "";
  }

  tabs.forEach(function (b) { b.addEventListener("click", function () { view = b.getAttribute("data-view"); render(); }); });

  function load() {
    var bucket = Math.floor(Date.now() / 300000);        // raw.githubusercontent خودش ۵ دقیقه کش می‌کند
    var live = window.PP_STATS_RAW ? fetch(window.PP_STATS_RAW + "?t=" + bucket, { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return null; }) : Promise.resolve(null);
    var base = fetch(window.PP_NEW_URL + "?t=" + bucket, { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return meta.length ? meta : null; });
    return Promise.all([base, live]).then(function (res) {
      if (!res[0]) throw 0;
      meta = res[0]; fetchedAt = Date.now(); merge(res[1]); render();
    }).catch(function () { if (!meta.length) status.textContent = "بارگذاری فهرست انجام نشد. صفحه را دوباره باز کنید."; });
  }

  function loop() {
    clearTimeout(timer);
    if (!document.body.contains(list)) return;            // با ناوبری نرم صفحه عوض شده
    timer = setTimeout(function () { (document.hidden ? Promise.resolve() : load()).then(loop); }, 120000);
  }
  // زمان‌های «n دقیقه پیش» بدون دریافت دوباره تازه می‌شوند
  setInterval(function () { if (rows.length && document.body.contains(list) && !document.hidden) render(); }, 30000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && document.body.contains(list) && Date.now() - fetchedAt > 60000) load(); });

  load().then(loop);
})();
