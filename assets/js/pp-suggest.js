/* PersianPod: پیشنهاد خودکار هنگام تایپ در کادر جست‌وجوی بالا (مثل یوتیوب)
   - تایپ: پادکست‌های نزدیک + دسته/برچسب/سازنده/شهر + «جست‌وجوی …»
   - کادر خالی: جست‌وجوهای اخیر (قابل حذف) و دسته‌های پرتعداد
   - کیبورد: ↑ ↓ Enter Esc؛ موبایل: ردیف‌های بزرگ و بدون بسته‌شدن زودهنگام */
(function () {
  "use strict";
  var input = document.getElementById("q");
  if (!input || !window.PPSearch || input.getAttribute("data-sug")) return;
  input.setAttribute("data-sug", "1");

  var box = document.createElement("div");
  box.className = "pp-sug"; box.id = "pp-sug"; box.hidden = true;
  box.innerHTML = '<ul role="listbox" aria-label="پیشنهادهای جست‌وجو"></ul>';
  document.body.appendChild(box);
  var ul = box.firstChild;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", "pp-sug");
  input.setAttribute("aria-expanded", "false");

  var KEY = "pp-recent-q", rows = [], active = -1, loading = null, timer = 0;
  var TYPE = { cat: "دسته", sub: "زیردسته", tag: "برچسب", creator: "سازنده", city: "شهر", country: "کشور" };
  var ICON_S = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  var ICON_C = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var ICON_T = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h6"/></svg>';

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function home() { return (document.querySelector(".pp-search") && document.querySelector(".pp-search").getAttribute("action")) || "/"; }
  function qHref(q) { return home() + "?q=" + encodeURIComponent(q); }
  function recents() { try { return JSON.parse(localStorage.getItem(KEY) || "[]").filter(Boolean).slice(0, 6); } catch (e) { return []; } }
  function saveRecent(q) {
    q = (q || "").trim(); if (!q) return;
    var r = recents().filter(function (x) { return x !== q; }); r.unshift(q);
    try { localStorage.setItem(KEY, JSON.stringify(r.slice(0, 6))); } catch (e) {}
  }
  function dropRecent(q) { try { localStorage.setItem(KEY, JSON.stringify(recents().filter(function (x) { return x !== q; }))); } catch (e) {} }

  function ensureData() {
    if (PPSearch.ready()) return Promise.resolve();
    if (loading) return loading;
    var url = document.body.getAttribute("data-search");
    if (!url) return Promise.resolve();
    loading = fetch(url).then(function (r) { return r.json(); }).then(function (d) { if (!PPSearch.ready()) PPSearch.build(d); }).catch(function () { loading = null; });
    return loading;
  }

  /* ---------- ساخت ردیف‌ها ---------- */
  function shortTitle(t) { return String(t || "").split("؛")[0]; }
  function build(q) {
    var out = [], qn = PPSearch.norm(q);
    if (!qn) {
      recents().forEach(function (r) { out.push({ kind: "recent", label: r, q: r }); });
      PPSearch.popular(6).forEach(function (t) { out.push({ kind: "topic", t: t, label: t.label, q: t.label, hint: "دسته" }); });
      return out;
    }
    var s = PPSearch.suggest(q, 5);
    s.topics.forEach(function (t) { out.push({ kind: "topic", t: t, label: t.label, q: t.label, hint: TYPE[t.type] }); });
    s.podcasts.forEach(function (p) { out.push({ kind: "podcast", p: p, label: shortTitle(p.title), href: p.url }); });
    out.push({ kind: "search", label: q.trim(), q: q.trim(), intents: s.intents });
    return out;
  }
  function topicHref(r) {
    return r.t && r.t.type === "cat" ? home() + "?category=" + encodeURIComponent(r.label) : qHref(r.q);
  }
  function row(r, i) {
    var id = "pp-sug-" + i, inner;
    if (r.kind === "podcast") {
      var p = r.p, logo = p.logo ? '<img src="' + esc(p.logo) + '" alt="" loading="lazy" width="36" height="36">' : "<i>" + esc((p.title || "").trim().charAt(0)) + "</i>";
      inner = '<a href="' + esc(r.href) + '" class="s-a"><span class="s-logo">' + logo + '</span><span class="s-t">' + esc(r.label) + '</span><span class="s-h">' + esc(p.category || "") + "</span></a>";
    } else if (r.kind === "recent") {
      inner = '<a href="' + esc(qHref(r.q)) + '" class="s-a" data-q="' + esc(r.q) + '"><span class="s-ic">' + ICON_C + '</span><span class="s-t">' + esc(r.label) + '</span></a>' +
        '<button type="button" class="s-x" data-del="' + esc(r.q) + '" aria-label="حذف «' + esc(r.label) + '» از جست‌وجوهای اخیر">×</button>';
    } else if (r.kind === "search") {
      inner = '<a href="' + esc(qHref(r.q)) + '" class="s-a" data-q="' + esc(r.q) + '"><span class="s-ic">' + ICON_S + '</span><span class="s-t">جست‌وجوی «' + esc(r.label) + '»</span>' +
        (r.intents && r.intents.length ? '<span class="s-h">' + esc(r.intents.join(" یا ")) + "</span>" : "") + "</a>";
    } else {
      inner = '<a href="' + esc(topicHref(r)) + '" class="s-a" data-q="' + esc(r.q) + '" data-cat="' + (r.t && r.t.type === "cat" ? esc(r.label) : "") + '"><span class="s-ic">' + ICON_T + '</span><span class="s-t">' + esc(r.label) + '</span><span class="s-h">' + esc(r.hint || "") + "</span></a>";
    }
    return '<li role="option" id="' + id + '" data-i="' + i + '" class="s-' + r.kind + '">' + inner + "</li>";
  }
  function render() {
    rows = build(input.value);
    if (!rows.length) { close(); return; }
    var head = !PPSearch.norm(input.value) ? "" : "";
    ul.innerHTML = head + rows.map(row).join("");
    active = -1; input.removeAttribute("aria-activedescendant");
    open();
  }
  function place() {
    var host = document.querySelector(".pp-search") || input, r = host.getBoundingClientRect(), vw = window.innerWidth;
    var w = Math.min(Math.max(r.width, 360), vw - 16), left;
    var rtl = getComputedStyle(document.documentElement).direction === "rtl";
    left = rtl ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    box.style.top = Math.round(r.bottom + 8) + "px"; box.style.left = Math.round(left) + "px"; box.style.width = Math.round(w) + "px";
    box.style.maxHeight = Math.max(200, window.innerHeight - r.bottom - 24) + "px";
  }
  function open() { place(); box.hidden = false; input.setAttribute("aria-expanded", "true"); }
  function close() { box.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; }
  function setActive(i) {
    var items = ul.children; if (!items.length) return;
    active = (i + items.length) % items.length;
    [].forEach.call(items, function (li, k) { li.classList.toggle("on", k === active); });
    input.setAttribute("aria-activedescendant", items[active].id);
    if (items[active].scrollIntoView) items[active].scrollIntoView({ block: "nearest" });
  }

  /* ---------- انتخاب ---------- */
  var onDirectory = function () { return !!((document.getElementById("pd-results") && document.getElementById("pd-filters")) || document.getElementById("pl-results")); };   // فهرست یا «گوش بده»
  function choose(a, e) {
    var q = a.getAttribute("data-q"), cat = a.getAttribute("data-cat");
    if (cat && onDirectory()) {
      var link = [].filter.call(document.querySelectorAll('.pp-cats a[data-cat]:not([data-sub])'), function (x) { return x.getAttribute("data-cat") === cat; })[0];
      if (link) { if (e) e.preventDefault(); input.value = ""; link.click(); close(); input.blur(); return; }
    }
    if (q != null && onDirectory()) {                       // همین صفحه فیلتر می‌شود، بدون بارگذاری دوباره
      if (e) e.preventDefault();
      input.value = q; saveRecent(q);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      close(); input.blur(); return;
    }
    if (q != null) saveRecent(q);                           // صفحه‌ی دیگر: لینک عادی (ناوبری نرم هم کار می‌کند)
    close();
  }
  box.addEventListener("pointerdown", function (e) { e.preventDefault(); });            // فوکوس از کادر نرود
  box.addEventListener("click", function (e) {
    var d = e.target.closest(".s-x");
    if (d) { e.preventDefault(); dropRecent(d.getAttribute("data-del")); render(); return; }
    var a = e.target.closest(".s-a"); if (a) choose(a, e);
  });
  box.addEventListener("pointermove", function (e) {
    var li = e.target.closest("li"); if (li && +li.getAttribute("data-i") !== active) { active = +li.getAttribute("data-i"); [].forEach.call(ul.children, function (x, k) { x.classList.toggle("on", k === active); }); }
  });

  /* ---------- رویدادهای کادر ---------- */
  input.addEventListener("focus", function () { ensureData().then(function () { if (document.activeElement === input) render(); }); });
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { ensureData().then(function () { if (document.activeElement === input) render(); }); }, 70);
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (box.hidden) { render(); }
      e.preventDefault(); setActive(active + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Escape") { close(); }
    else if (e.key === "Enter" && !box.hidden && active >= 0) {
      var a = ul.children[active] && ul.children[active].querySelector(".s-a");
      if (a) { e.preventDefault(); choose(a, null); if (!a.getAttribute("data-q") || !onDirectory()) location.href = a.href; }
    }
  });
  input.addEventListener("blur", function () { setTimeout(function () { if (document.activeElement !== input) close(); }, 120); });
  if (input.form) input.form.addEventListener("submit", function () { saveRecent(input.value); close(); });
  document.addEventListener("pointerdown", function (e) { if (!box.hidden && e.target !== input && !box.contains(e.target)) close(); });
  window.addEventListener("resize", function () { if (!box.hidden) place(); });
  window.addEventListener("scroll", function () { if (!box.hidden) place(); }, { passive: true });
})();
