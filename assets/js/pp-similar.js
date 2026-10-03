/* PersianPod — «پادکست‌های مشابه» در صفحه‌ی هر پادکست */
(function () {
  "use strict";
  var host = document.getElementById("pp-similar-page");
  if (!host) return;
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function norm(s) {
    return String(s || "").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ")
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).toLowerCase().trim();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function score(a, b) {
    var s = a.category && a.category === b.category ? 2 : 0;
    var tb = (b.tags || []).map(norm);
    (a.tags || []).map(norm).forEach(function (t) { if (tb.indexOf(t) !== -1) s += 1; });
    if (a.city && a.city === b.city) s += 0.5;
    return s;
  }
  fetch(host.dataset.src).then(function (r) { return r.json(); }).then(function (all) {
    var me = all.filter(function (p) { return p.id === host.dataset.id; })[0];
    if (!me) return;
    var top = all.filter(function (p) { return p.id !== me.id; })
      .map(function (p) { return { p: p, s: score(me, p) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 6);
    if (!top.length) return;
    host.querySelector(".pp-similar-grid").innerHTML = top.map(function (x) {
      var p = x.p;
      return '<a href="' + esc(p.url) + '">' +
        (p.logo ? '<img src="' + esc(p.logo) + '" alt="" loading="lazy" width="56" height="56">' : "") +
        "<strong>" + esc(p.title) + "</strong><small>" + esc(p.category) + "</small></a>";
    }).join("");
    host.hidden = false;
  }).catch(function () {});
})();
