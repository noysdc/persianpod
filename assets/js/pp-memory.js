/*
  حافظه‌ی شنونده در پرشین‌پاد: فقط روی دستگاه خود شنونده (localStorage)؛ چیزی به سرور فرستاده نمی‌شود.
  ۱) ادامه از همان‌جا که قطع شد: پلیر شناور موقعیت هر قسمت را ذخیره می‌کند (pp-float-player.js)
  ۲) پادکست‌های ذخیره‌شده (♡): دکمه روی کارت‌ها و صفحه‌ی هر پادکست؛ فیلتر «فقط ذخیره‌شده‌ها» در جست‌وجوی پیشرفته
  ۳) پشتیبان‌گیری و بازیابی (فایل JSON) برای انتقال به دستگاه دیگر

  API:  PPMem.isSaved(url) · PPMem.toggle(url) · PPMem.getProg(audioUrl) · PPMem.setProg(...) · PPMem.recent(n) · PPMem.norm(url)
  رویدادها: pp:saved و pp:progress روی document
*/
(function () {
  "use strict";
  if (window.PPMem) return;

  var SK = "pp-saved", PK = "pp-prog", MAXP = 200, FA = "۰۱۲۳۴۵۶۷۸۹";
  var fallback = {};
  function rd(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return fallback[k] !== undefined ? fallback[k] : def; } }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { fallback[k] = v; } }
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[+d]; }); }
  function fire(name, detail) { try { document.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) {} }

  /* کلید پادکست: مسیر صفحه‌اش بدون اسلش پایانی */
  var kc = {};
  function key(u) {
    var c = kc[u]; if (c !== undefined) return c;           // هر آدرس فقط یک بار تجزیه می‌شود (کارت‌ها بارها بررسی می‌شوند)
    var r;
    try { r = decodeURIComponent(new URL(u, location.href).pathname).replace(/\/index\.html$/, "/").replace(/\/+$/, "") || "/"; }
    catch (e) { r = String(u || ""); }
    return (kc[u] = r);
  }
  /* کلید قسمت: آدرس فایل صوتی؛ مثل پلیر، http را https می‌کند */
  function norm(u) {
    try { var x = new URL(String(u || ""), location.href); if (x.protocol === "http:") x.protocol = "https:"; return x.href; } catch (e) { return String(u || ""); }
  }

  /* ---------- ذخیره‌شده‌ها ---------- */
  var saved = null, prog = null, sidx = null;
  function S() { if (!saved) { saved = rd(SK, []); if (!Array.isArray(saved)) saved = []; } return saved; }
  function I() { if (!sidx) { sidx = {}; S().forEach(function (k) { sidx[k] = 1; }); } return sidx; }
  function isSaved(u) { return I()[key(u)] === 1; }
  function toggle(u, force) {
    var k = key(u), a = S(), i = a.indexOf(k), on = force == null ? i === -1 : !!force;
    if (on && i === -1) a.push(k);
    if (!on && i !== -1) a.splice(i, 1);
    sidx = null; wr(SK, a); fire("pp:saved", { key: k, on: on });
    return on;
  }

  /* ---------- موقعیت پخش ---------- */
  function P() { if (!prog) { prog = rd(PK, {}); if (!prog || typeof prog !== "object" || Array.isArray(prog)) prog = {}; } return prog; }
  function prune() {
    var p = P(), ks = Object.keys(p);
    if (ks.length <= MAXP) return;
    ks.sort(function (a, b) { return (p[a].u || 0) - (p[b].u || 0); });
    ks.slice(0, ks.length - MAXP).forEach(function (k) { delete p[k]; });
  }
  function setProg(a, rec, quiet) { var p = P(); rec.u = Date.now(); p[a] = rec; prune(); wr(PK, p); if (!quiet) fire("pp:progress", { a: a }); }
  function getProg(a) { return P()[a] || null; }
  function delProg(a) { var p = P(); if (p[a]) { delete p[a]; wr(PK, p); fire("pp:progress", { a: a }); } }
  function resumeAt(a) { var r = getProg(a); return r && !r.done && r.t > 10 ? r.t : 0; }
  function pct(r) { return !r ? 0 : r.done ? 100 : r.d ? Math.max(0, Math.min(100, Math.round(r.t / r.d * 100))) : 0; }
  function recent(n) {
    var p = P(), out = [];
    Object.keys(p).forEach(function (a) { var r = p[a]; if (r && !r.done && r.t > 10 && r.d && r.t < r.d - 20) out.push({ a: a, r: r }); });
    out.sort(function (x, y) { return (y.r.u || 0) - (x.r.u || 0); });
    return out.slice(0, n || 3);
  }

  /* ---------- پشتیبان ---------- */
  function exportData() { return { app: "persianpod", v: 1, at: new Date().toISOString(), saved: S().slice(), progress: P() }; }
  function importData(o) {
    if (!o || typeof o !== "object" || !Array.isArray(o.saved) || typeof o.progress !== "object") throw new Error("bad");
    var a = S(), added = 0, p = P(), eps = 0;
    o.saved.forEach(function (k) { if (typeof k === "string" && k && a.indexOf(k) === -1) { a.push(k); added++; } });
    Object.keys(o.progress || {}).forEach(function (u) {
      var r = o.progress[u]; if (!r || typeof r !== "object" || typeof r.t !== "number") return;
      if (!p[u] || (r.u || 0) > (p[u].u || 0)) { p[u] = r; eps++; }
    });
    sidx = null; prune(); wr(SK, a); wr(PK, p);
    fire("pp:saved", {}); fire("pp:progress", {});
    return { saved: added, eps: eps };
  }

  window.PPMem = { key: key, norm: norm, isSaved: isSaved, toggle: toggle, list: function () { return S().slice(); },
    getProg: getProg, setProg: setProg, delProg: delProg, resumeAt: resumeAt, pct: pct, recent: recent, exportData: exportData, importData: importData };

  /* همگام بین تب‌ها */
  window.addEventListener("storage", function (e) {
    if (e.key === SK) { saved = null; sidx = null; fire("pp:saved", {}); }
    if (e.key === PK) { prog = null; fire("pp:progress", {}); }
  });

  /* ================= رابط: دکمه‌های ♡، فهرست ادامه، نوار پیشرفت قسمت‌ها ================= */
  var HEART = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  var PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var tpl = null;
  function heartTpl() {
    if (!tpl) { tpl = document.createElement("button"); tpl.type = "button"; tpl.className = "pp-heart"; tpl.innerHTML = HEART; }
    return tpl.cloneNode(true);
  }
  function scan() {
    // کارت‌های فهرست (صفحه‌ی اصلی و «مشابه»)
    $$("article.pd-card:not([data-pp-h])").forEach(function (c) {
      var a = c.querySelector("a.pd-link[href]"); if (!a) return;
      c.setAttribute("data-pp-h", "1");
      var h3 = c.querySelector("h3"), b = heartTpl();
      var href = a.getAttribute("href"), nm = h3 ? h3.textContent.trim() : "";
      b.setAttribute("data-u", href); b.setAttribute("data-n", nm);
      b.setAttribute("aria-pressed", isSaved(href) ? "true" : "false");            // وضعیت از همان ابتدا درست است؛ بدون انیمیشن و بازنویسی
      b.setAttribute("aria-label", "ذخیره‌ی پادکست: " + nm);
      c.appendChild(b);
    });
    // صحنه‌ی صفحه‌ی «گوش بده» (پادکست انتخاب‌شده)؛ با هر انتخاب تازه، سرایند دوباره ساخته می‌شود
    $$("#pl-stage .pl-head:not([data-pp-h])").forEach(function (hd) {
      var a = document.querySelector("#pl-stage .pl-links a[href]"), h2 = hd.querySelector("h2"); if (!a) return;
      hd.setAttribute("data-pp-h", "1");
      var b = document.createElement("button");
      b.type = "button"; b.className = "pp-heart pp-heart-inline"; b.setAttribute("data-u", a.getAttribute("href"));
      b.setAttribute("data-n", h2 ? h2.textContent.trim() : "");
      b.innerHTML = HEART; hd.appendChild(b);
    });
    // صفحه‌ی خود پادکست
    var h1 = document.querySelector("article.pod .pod-main h1");
    if (h1 && !document.querySelector(".pp-save")) {
      var s = document.createElement("button");
      s.type = "button"; s.className = "pp-save"; s.setAttribute("data-u", location.pathname); s.setAttribute("data-n", h1.textContent.trim());
      h1.insertAdjacentElement("afterend", s);
    }
    syncHearts(); decorate(); renderCont();
  }
  function syncHearts() {
    var list = document.getElementsByClassName("pp-heart"), i, bt, on, cur;
    for (i = 0; i < list.length; i++) {                      // فقط وقتی وضعیت واقعاً عوض شده چیزی نوشته می‌شود (کم‌هزینه برای صدها کارت)
      bt = list[i]; on = isSaved(bt.getAttribute("data-u")) ? "true" : "false";
      if (bt.getAttribute("aria-pressed") !== on) bt.setAttribute("aria-pressed", on);
      if (!bt.hasAttribute("aria-label")) bt.setAttribute("aria-label", "ذخیره‌ی پادکست: " + (bt.getAttribute("data-n") || ""));
    }
    var sv = document.querySelector(".pp-save");
    if (sv) {
      on = isSaved(sv.getAttribute("data-u")); cur = sv.getAttribute("data-s");
      if (cur !== (on ? "1" : "0")) {
        sv.setAttribute("data-s", on ? "1" : "0"); sv.setAttribute("aria-pressed", on ? "true" : "false");
        sv.innerHTML = HEART + "<span>" + (on ? "ذخیره شد" : "ذخیره") + "</span>";
        sv.setAttribute("aria-label", (on ? "حذف از ذخیره‌شده‌ها: " : "ذخیره: ") + (sv.getAttribute("data-n") || ""));
      }
    }
    var cnt = document.getElementById("f-saved-n");
    if (cnt) { var n2 = S().length, txt = n2 ? toFa(n2) : ""; if (cnt.textContent !== txt) cnt.textContent = txt; }   // فقط در صورت تغییر؛ وگرنه observer دوباره اسکن را فرا می‌خواند
  }

  /* نوار باریک پیشرفت و علامت «شنیده‌شده» روی قسمت‌ها */
  function decorate() {
    $$(".pp-eplist button[data-pp-audio]").forEach(function (b) {
      var r = getProg(norm(b.getAttribute("data-pp-audio")));
      if (r && (r.done || r.t > 10)) {
        b.setAttribute("data-prog", String(pct(r)));
        b.style.setProperty("--pp-prog", pct(r) + "%");
        if (r.done) b.setAttribute("data-done", "1"); else b.removeAttribute("data-done");
      } else { b.removeAttribute("data-prog"); b.removeAttribute("data-done"); b.style.removeProperty("--pp-prog"); }
    });
  }

  /* «ادامه‌ی گوش‌دادن»: بالای صفحه‌ی اول و «گوش بده» */
  var contSig = "";
  function renderCont() {
    var anchor = document.getElementById("pd-chips") || document.getElementById("pl-stage");
    var box = document.getElementById("pp-cont");
    var items = recent(3);
    if (!anchor || !items.length) { if (box) box.remove(); contSig = ""; return; }
    var sig = items.map(function (it) { return it.a + "|" + it.r.t + "|" + it.r.u; }).join(";");
    if (box && box.nextElementSibling === anchor && sig === contSig) return;
    if (!box) { box = document.createElement("section"); box.id = "pp-cont"; box.className = "pp-cont"; box.setAttribute("aria-label", "ادامه‌ی گوش‌دادن"); }
    if (box.nextElementSibling !== anchor) anchor.parentNode.insertBefore(box, anchor);
    contSig = sig;
    var h = '<h2 class="pp-cont-h">ادامه‌ی گوش‌دادن</h2><ul>';
    items.forEach(function (it) {
      var r = it.r, left = Math.max(1, Math.round((r.d - r.t) / 60)), p = pct(r);
      h += '<li data-pp-playlist data-title="' + esc(r.p) + '" data-eps-url="' + esc(r.eu || "") + '">' +
        '<button type="button" class="pp-cont-b" data-pp-audio="' + esc(it.a) + '" data-t="' + esc(r.e) + '" style="--p:' + p + '%">' +
        '<span class="pp-cont-ic">' + PLAY + "</span>" +
        '<span class="pp-cont-t"><b>' + esc(r.e || "قسمت") + "</b><small>" + esc(r.p) + " · " + toFa(left) + " دقیقه مانده</small></span>" +
        '<span class="pp-cont-bar" aria-hidden="true"></span></button></li>';
    });
    box.innerHTML = h + "</ul>";
  }

  /* ---------- رویدادها ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".pp-heart,.pp-save");
    if (t) {
      e.preventDefault(); e.stopPropagation();
      toggle(t.getAttribute("data-u"));
      return;
    }
    var id = e.target.closest && e.target.closest("#pp-bk-out,#pp-bk-in");
    if (!id) return;
    var msg = document.getElementById("pp-bk-msg");
    if (id.id === "pp-bk-in") { var f = document.getElementById("pp-bk-file"); if (f) f.click(); return; }
    try {
      var blob = new Blob([JSON.stringify(exportData())], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "persianpod-backup.json";
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      if (msg) msg.textContent = "فایل پشتیبان دریافت شد.";
    } catch (err) { if (msg) msg.textContent = "دریافت پشتیبان ناموفق بود."; }
  }, true);
  document.addEventListener("change", function (e) {
    if (!e.target || e.target.id !== "pp-bk-file" || !e.target.files || !e.target.files[0]) return;
    var msg = document.getElementById("pp-bk-msg"), fr = new FileReader();
    fr.onload = function () {
      try { var r = importData(JSON.parse(fr.result)); if (msg) msg.textContent = "بازیابی شد: " + toFa(r.saved) + " پادکست و " + toFa(r.eps) + " قسمت اضافه شد."; }
      catch (err) { if (msg) msg.textContent = "این فایل پشتیبان پرشین‌پاد نیست."; }
    };
    fr.readAsText(e.target.files[0]); e.target.value = "";
  });
  document.addEventListener("pp:saved", syncHearts);
  document.addEventListener("pp:progress", function () { decorate(); renderCont(); });
  document.addEventListener("pp:navigate", function () { setTimeout(scan, 0); });

  var q = 0;
  function schedule() { cancelAnimationFrame(q); q = requestAnimationFrame(scan); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule); else schedule();
  if (window.MutationObserver) new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target, el = t.nodeType === 1 ? t : t.parentElement;
      if (!el || !el.closest || !el.closest(".ppfp,#pp-cont,.pp-heart,.pp-save,#f-saved-n,#pp-bk-msg")) { schedule(); return; }   // تغییرات خود پلیر (هر ثانیه) نادیده گرفته می‌شود
    }
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
