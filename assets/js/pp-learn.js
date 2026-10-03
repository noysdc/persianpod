/* PersianPod — فیلتر و جستجو در صفحه‌ی آموزش‌ها */
(function () {
  "use strict";
  var list = document.getElementById("a-list");
  if (!list) return;
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function norm(s) {
    return String(s || "").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\u200c/g, " ").replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).toLowerCase().trim();
  }
  var items = Array.prototype.slice.call(list.children);
  var active = "";
  var tags = {};
  items.forEach(function (li) {
    (li.dataset.tags || "").split(",").forEach(function (t) { t = t.trim(); if (t) tags[t] = 1; });
  });
  var box = document.getElementById("a-tags");
  Object.keys(tags).sort(function (a, b) { return a.localeCompare(b, "fa"); }).forEach(function (t) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = t; b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () {
      active = active === t ? "" : t;
      box.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.textContent === active)); });
      apply();
    });
    box.appendChild(b);
  });
  function apply() {
    var q = norm(document.getElementById("a-q").value), shown = 0;
    items.forEach(function (li) {
      var ok = (!q || norm(li.dataset.text).indexOf(q) !== -1) &&
        (!active || (li.dataset.tags || "").split(",").map(function (s) { return s.trim(); }).indexOf(active) !== -1);
      li.hidden = !ok; if (ok) shown++;
    });
    document.getElementById("a-empty").hidden = shown > 0;
  }
  document.getElementById("a-q").addEventListener("input", apply);
})();
