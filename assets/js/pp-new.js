/* PersianPod: صفحه‌ی «تازه‌ها»
   فهرست پادکست‌ها بر اساس زمان آخرین قسمت (جدیدترین اول).
   آمار تازه مستقیم از فایل rss_stats.json در GitHub خوانده می‌شود تا منتظر دیپلوی دوباره‌ی سایت نماند.
   تا وقتی صفحه باز است، هر ۲ دقیقه دوباره خوانده می‌شود. */
(function () {
  "use strict";
  var list = document.getElementById("nw-list"), status = document.getElementById("nw-status");
  if (!list) return;

  var FA = "۰۱۲۳۴۵۶۷۸۹";
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

  var meta = [], rows = [], prevOrder = {}, timer = 0, fetchedAt = 0, first = true;

  function merge(stats) {
    rows = meta.map(function (p) {
      var st = (stats && stats[p.slug]) || {};
      var at = st.last_at || p.last_at;
      return { p: p, ms: at ? Date.parse(at) : 0, title: st.last_title || p.last_title || "", link: safe(st.last_link || p.last_link) };
    });
    rows.sort(function (a, b) { return (b.ms || 0) - (a.ms || 0) || a.p.title.localeCompare(b.p.title, "fa"); });
  }

  function render() {
    if (!document.body.contains(list)) return;
    var html = "", sepDone = false;
    rows.forEach(function (r, i) {
      var p = r.p, none = !r.ms;
      if (none && !sepDone) { sepDone = true; html += '<li class="nw-sep" aria-hidden="true">بدون اطلاعات انتشار (RSS ثبت نشده یا خوانده نشد)</li>'; }
      var logo = p.logo ? '<img class="nw-logo" src="' + esc(p.logo) + '" alt="" width="64" height="64" loading="lazy" decoding="async">' : '<i class="nw-logo">' + esc((p.title || "").trim().charAt(0)) + "</i>";
      var isNew = !none && Date.now() - r.ms < 86400000;
      var ep = r.title ? (r.link ? '<a href="' + esc(r.link) + '" target="_blank" rel="noopener noreferrer">' + esc(r.title) + "</a>" : esc(r.title)) : "";
      var moved = prevOrder[p.slug] != null && prevOrder[p.slug] > i;
      html += '<li class="nw-row' + (none ? " nw-none" : "") + (moved ? " moved" : "") + '" data-slug="' + esc(p.slug) + '">' +
        '<span class="nw-rank" aria-hidden="true">' + toFa(i + 1) + "</span>" + logo +
        '<div class="nw-main"><h2><a href="' + esc(p.url) + '">' + esc(p.title) + '</a><span class="nw-cat">' + esc(p.category) + "</span></h2>" + (ep ? '<span class="nw-ep">' + ep + "</span>" : "") + "</div>" +
        '<div class="nw-side"><span class="nw-time">' + (isNew ? '<span class="nw-new">جدید</span>' : "") + (none ? "نامشخص" : esc(ago(r.ms))) + "</span>" +
        '<a class="nw-listen" href="' + esc("/listen/?p=" + encodeURIComponent(p.slug)) + '">گوش بده</a></div></li>';
    });
    list.innerHTML = html;
    var cur = {}; rows.forEach(function (r, i) { cur[r.p.slug] = i; });
    var changed = !first && Object.keys(cur).some(function (k) { return prevOrder[k] !== cur[k]; });
    prevOrder = cur; first = false;
    if (changed) setTimeout(function () { [].forEach.call(list.querySelectorAll(".moved"), function (e) { e.classList.remove("moved"); }); }, 4000);
    status.textContent = fetchedAt ? "آخرین به‌روزرسانی فهرست: " + (fmtTime ? fmtTime.format(new Date(fetchedAt)) : "") : "";
  }

  function load() {
    var bucket = Math.floor(Date.now() / 300000);        // raw.githubusercontent خودش ۵ دقیقه کش می‌کند
    var live = window.PP_STATS_RAW ? fetch(window.PP_STATS_RAW + "?t=" + bucket, { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return null; }) : Promise.resolve(null);
    var base = meta.length ? Promise.resolve(meta) : fetch(window.PP_NEW_URL).then(function (r) { if (!r.ok) throw 0; return r.json(); });
    return Promise.all([base, live]).then(function (res) {
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
