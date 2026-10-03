/* PersianPod — صفحه‌ی پلیر: Castbox و یوتیوب با embed */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩";
  // اگر الگوی embed کست‌باکس عوض شد، فقط همین خط را تغییر بده
  var CASTBOX_EMBED = "https://castbox.fm/app/castbox/player/id{ID}?v=8.22.11&autoplay=0";

  function norm(s) {
    return String(s == null ? "" : s).replace(/[يى]/g, "ی").replace(/ك/g, "ک")
      .replace(/[\u064B-\u065F\u0670]/g, "").replace(/\u200c/g, " ")
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); }).toLowerCase().trim();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function castboxSrc(p) {
    if (p.castbox_embed && /^https:\/\/castbox\.fm\//.test(p.castbox_embed)) return p.castbox_embed;
    var m = String(p.castbox || "").match(/(\d{4,})/);
    return m ? CASTBOX_EMBED.replace("{ID}", m[1]) : "";
  }
  function youtubeId(u) {
    var m = String(u || "").match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : "";
  }
  function castboxPage(p) {
    var s = String(p.castbox || "");
    return /^https:\/\/castbox\.fm\//.test(s) ? s : "";
  }

  var data = [], current = null;

  function renderList() {
    var q = norm($("#l-q").value);
    var list = data.filter(function (p) { return !q || norm(p.title).indexOf(q) !== -1; });
    var ul = $("#l-list");
    ul.innerHTML = list.map(function (p) {
      return '<li><button type="button" data-id="' + esc(p.id) + '"' +
        (current && current.id === p.id ? ' aria-current="true"' : "") + ">" +
        (p.logo ? '<img src="' + esc(p.logo) + '" alt="" loading="lazy" width="36" height="36">' : "") +
        "<span>" + esc(p.title) + "</span></button></li>";
    }).join("") || '<li class="pp-empty">پادکستی پیدا نشد.</li>';
  }

  function select(p, pushHash) {
    current = p;
    if (pushHash) history.replaceState(null, "", "#" + encodeURIComponent(p.id));
    var cb = castboxSrc(p), yt = youtubeId(p.youtube);
    var html = '<div class="pp-stage-head">' +
      (p.logo ? '<img src="' + esc(p.logo) + '" alt="" width="64" height="64">' : "") +
      "<h2>" + esc(p.title) + "</h2></div>";
    html += cb ? '<div id="cb-slot"></div>' : "";
    if (yt) {
      html += '<h3 class="pp-stage-sub">قسمت منتخب در یوتیوب</h3><div id="yt-slot"></div>';
    }
    html += '<div class="pp-stage-links"><a href="' + esc(p.url) + '">صفحه‌ی معرفی پادکست</a>';
    var cp = castboxPage(p);
    if (cp) html += '<a href="' + esc(cp) + '" target="_blank" rel="noopener noreferrer">باز کردن در Castbox</a>';
    html += "</div>";
    var stage = $("#l-stage");
    stage.innerHTML = html;

    function mount(id, cls, src, title, extra) {
      var slot = document.getElementById(id); if (!slot) return;
      var f = document.createElement("iframe");
      f.className = "pp-embed " + cls; f.src = src; f.title = title; f.loading = "lazy";
      f.setAttribute("allow", extra || "autoplay; encrypted-media");
      f.setAttribute("allowfullscreen", ""); f.referrerPolicy = "strict-origin-when-cross-origin";
      slot.appendChild(f);
    }
    if (cb) mount("cb-slot", "cb", cb, "پلیر " + p.title);
    if (yt) mount("yt-slot", "yt", "https://www.youtube-nocookie.com/embed/" + yt, "قسمت منتخب " + p.title,
      "accelerometer; encrypted-media; picture-in-picture");
    renderList();
  }

  fetch(window.PP_DATA_URL).then(function (r) { return r.json(); }).then(function (d) {
    data = d.filter(function (p) { return castboxSrc(p) || youtubeId(p.youtube); })
      .sort(function (a, b) { return a.title.localeCompare(b.title, "fa"); });
    if (!data.length) {
      $("#l-stage").innerHTML = '<p class="pp-empty">هنوز پادکستی با لینک پخش ثبت نشده.</p>';
      $("#l-list").innerHTML = ""; return;
    }
    var hash = decodeURIComponent(location.hash.slice(1));
    var first = data.filter(function (p) { return p.id === hash; })[0] || data[Math.floor(Math.random() * data.length)];
    renderList(); select(first, false);
    $("#l-q").addEventListener("input", renderList);
    $("#l-list").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-id]"); if (!b) return;
      var p = data.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (p) select(p, true);
    });
  }).catch(function () {
    $("#l-stage").innerHTML = '<p class="pp-empty">بارگذاری فهرست انجام نشد.</p>';
  });
})();
