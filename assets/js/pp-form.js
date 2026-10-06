/* PersianPod: موتور پرسشنامه
   سؤال‌ها در pp-form-fields.js هستند. خروجی: فایل .md (+ کاور) به /api/form (Cloudflare Worker). */
(function () {
  "use strict";
  var ENDPOINT = "/api/form", SITEKEY = "";   // SITEKEY: اگر Turnstile فعال کردی
  var DRAFT_KEY = "pp-form-draft-v2";
  var S = window.PP_FORM_SCHEMA;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var form = $("#f"), box = $("#fields"), msgEl = $("#msg"), btn = $("#go");
  if (!form || !box) return;
  if (!Array.isArray(S) || !S.length) {
    box.innerHTML = '<p class="pf-msg err">سؤال‌های فرم بارگذاری نشد. صفحه را دوباره باز کنید یا به ایمیل ما بنویسید.</p>';
    return;
  }

  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  function digits(s) { return String(s).replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- ساخت فرم ---------- */
  function attrsFor(x, name) {
    x = x || {};
    var ltr = x.ltr || x.v === "url" || x.v === "email" || x.v === "latin" || x.v === "embed";
    var a = ltr ? ' dir="ltr"' : ' dir="auto"';
    var mode = x.mode || (x.v === "email" ? "email" : x.v === "url" || x.v === "embed" ? "url" : "");
    if (mode) a += ' inputmode="' + mode + '"';
    if (ltr || mode) a += ' autocapitalize="off" spellcheck="false"';
    a += x.ac ? ' autocomplete="' + x.ac + '"' : ' autocomplete="off"';
    return a;
  }
  function errSlot(id) { return '<span class="pf-err" id="e-' + id + '" role="alert" hidden></span>'; }

  function multiRow(k, cfg, i) {
    var cols = cfg.cols.map(function (c) {
      var name = k + "__" + i + "__" + c.k, req = (i === 0 && c.req) ? " required" : "";
      var single = cfg.cols.length === 1;
      var lab = single ? cfg.item + " " + toFa(i + 1) : c.l;
      return '<label class="pf pf-c' + (c.wide ? " pf-wide" : "") + '"><span class="pf-l' + (single ? " sr" : "") + '">' + esc(lab) +
        (i === 0 && c.req ? ' <span class="pf-req" aria-hidden="true">*</span>' : "") + "</span>" +
        '<input type="text" name="' + name + '"' + attrsFor(c, name) + (c.ph ? ' placeholder="' + esc(c.ph) + '"' : "") + req +
        ' data-multi="' + k + '" data-ck="' + c.k + '" data-i="' + i + '"' + (c.req ? ' data-creq="1"' : "") + ">" + errSlot(name) + "</label>";
    }).join("");
    return '<div class="pf-row" data-i="' + i + '"><div class="pf-row-h"><span>' + esc(cfg.item) + " " + toFa(i + 1) + "</span>" +
      (i ? '<button type="button" class="pf-rm" data-k="' + k + '" aria-label="حذف ' + esc(cfg.item) + " " + toFa(i + 1) + '">حذف</button>' : "") +
      '</div><div class="pf-grid pf-grid-in' + (cfg.cols.length === 1 ? " pf-grid-1" : "") + '">' + cols + "</div></div>";
  }

  function field(f) {
    var k = f[0], l = f[1], ty = f[2], r = f[3], h = f[4], o = f[5], x = f[6];
    var star = r ? ' <span class="pf-req" aria-hidden="true">*</span>' : "";
    var hint = h ? '<span class="pf-h" id="h-' + k + '">' + esc(h) + "</span>" : "";
    var rq = r ? ' required aria-required="true"' : "";
    var dsc = ' aria-describedby="' + (h ? "h-" + k + " " : "") + 'e-' + k + '"';

    if (ty === "subcat") {
      var groups = (o || []).map(function (c, ci) {
        return '<div class="pf-subs" data-cat="' + esc(c.name) + '" hidden>' + (c.subcategories || []).map(function (s, si) {
          return '<label class="pf-chip"><input type="checkbox" name="subcat__' + ci + '__' + si + '" value="' + esc(s) + '"><span>' + esc(s) + "</span></label>";
        }).join("") + "</div>";
      }).join("");
      return '<div class="pf pf-wide pf-subwrap" role="group" aria-label="' + esc(l) + '"><span class="pf-l">' + esc(l) + "</span>" + hint +
        '<p class="pf-subs-empty">اول دسته‌ی اصلی را انتخاب کنید تا زیردسته‌هایش نمایش داده شود.</p>' + groups +
        '<p class="pf-sub-note" id="sub-note" role="status" hidden></p></div>';
    }

    if (ty === "check")
      return '<div class="pf pf-wide"><label class="pf-o"><input type="checkbox" name="' + k + '"' + rq + dsc + "> <span>" + esc(l) + star + "</span></label>" + errSlot(k) + "</div>";

    if (ty === "radio")
      return '<div class="pf pf-wide" role="radiogroup" aria-label="' + esc(l) + '"><span class="pf-l">' + esc(l) + "</span>" + hint +
        o.map(function (v) { return '<label class="pf-o"><input type="radio" name="' + k + '" value="' + esc(v) + '"> <span>' + esc(v) + "</span></label>"; }).join("") + "</div>";

    if (ty === "multi")
      return '<div class="pf pf-wide pf-multi" data-k="' + k + '" data-max="' + o.max + '" role="group" aria-label="' + esc(l) + '"><span class="pf-l">' + esc(l) + star + "</span>" + hint +
        '<div class="pf-rows">' + multiRow(k, o, 0) + '</div><button type="button" class="pf-add" data-k="' + k + '">+ ' + esc(o.add) + "</button></div>";

    if (ty === "file")
      return '<div class="pf pf-wide"><span class="pf-l">' + esc(l) + star + "</span>" + hint +
        '<label class="pf-drop" id="drop-' + k + '"><input type="file" name="' + k + '" accept="image/png,image/jpeg"' + rq + dsc + ">" +
        '<span class="pf-drop-t">انتخاب تصویر</span><img class="pf-prev" alt="" hidden><span class="pf-fn"></span></label>' + errSlot(k) + "</div>";

    var wide = (ty === "area" || (x && x.wide)) ? " pf-wide" : "";
    var ctl;
    if (ty === "area") ctl = '<textarea name="' + k + '" dir="auto" rows="4"' + rq + dsc + "></textarea>";
    else if (ty === "select")
      ctl = '<select name="' + k + '"' + rq + dsc + '><option value="">انتخاب کنید</option>' + o.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("") + "</select>";
    else ctl = '<input type="text" name="' + k + '"' + attrsFor(x, k) + rq + dsc + ">";
    // فیلدهای لینک و ایمیل کل عرض را می‌گیرند تا راحت‌تر دیده شوند
    if (x && (x.v === "url" || x.v === "embed" || x.v === "email")) wide = " pf-wide";
    return '<label class="pf' + wide + '"><span class="pf-l">' + esc(l) + star + "</span>" + hint + ctl + errSlot(k) + "</label>";
  }

  box.innerHTML = S.map(function (sec, i) {
    var id = "sec-" + i;
    return '<section class="pf-set" aria-labelledby="' + id + '"><h2 class="pf-title" id="' + id + '">' + esc(sec[0]) + "</h2>" +
      (sec[2] ? '<p class="pf-note">' + esc(sec[2]) + "</p>" : "") +
      '<div class="pf-grid">' + sec[1].map(field).join("") + "</div></section>";
  }).join("");

  var multiCfg = {};
  S.forEach(function (sec) { sec[1].forEach(function (f) { if (f[2] === "multi") multiCfg[f[0]] = f[5]; }); });

  /* ---------- زیردسته‌ها (وابسته به دسته‌ی اصلی، حداکثر ۳ مورد) ---------- */
  var MAX_SUBS = 3, catSel = form.elements.category, subTimer = 0;
  function selectedSubs() {
    var g = $(".pf-subs:not([hidden])", box);
    return g ? $$("input:checked", g).map(function (i) { return i.value; }).slice(0, MAX_SUBS) : [];
  }
  function syncSubs() {
    var cat = catSel ? catSel.value : "", shown = false;
    $$(".pf-subs", box).forEach(function (g) {
      var on = cat !== "" && g.getAttribute("data-cat") === cat;
      g.hidden = !on; if (on) shown = true;
      if (!on) $$("input", g).forEach(function (i) { i.checked = false; });
    });
    var empty = $(".pf-subs-empty", box); if (empty) empty.hidden = shown;
  }
  function subNote(t) {
    var n = $("#sub-note"); if (!n) return;
    n.textContent = t; n.hidden = !t; clearTimeout(subTimer);
    if (t) subTimer = setTimeout(function () { n.hidden = true; }, 3000);
  }
  if (catSel) catSel.addEventListener("change", syncSubs);
  box.addEventListener("change", function (e) {
    var t = e.target, g = t && t.closest ? t.closest(".pf-subs") : null;
    if (g && t.checked && $$("input:checked", g).length > MAX_SUBS) { t.checked = false; subNote("حداکثر ۳ زیردسته را می‌توانید انتخاب کنید."); }
  });
  form.addEventListener("reset", function () { setTimeout(syncSubs, 0); });

  var shortEl = form.elements.short;
  if (shortEl) {
    shortEl.maxLength = 200;
    var cnt = document.createElement("span");
    cnt.className = "pf-count"; cnt.setAttribute("aria-hidden", "true");
    shortEl.parentNode.insertBefore(cnt, shortEl.nextSibling);
    var upd = function () { cnt.textContent = toFa(shortEl.value.length) + " / " + toFa(200); };
    shortEl.addEventListener("input", upd); upd();
  }
  if (SITEKEY) {
    var sc = document.createElement("script"); sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"; sc.async = true; document.head.appendChild(sc);
    $("#ts").innerHTML = '<div class="cf-turnstile" data-sitekey="' + SITEKEY + '"></div>';
  }

  /* ---------- ردیف‌های قابل افزودن (لینک‌ها و پادکست‌ها) ---------- */
  function rowsOf(k) { return $$(".pf-multi[data-k=\"" + k + "\"] .pf-row"); }
  function addRow(k) {
    var cfg = multiCfg[k], wrap = $(".pf-multi[data-k=\"" + k + "\"]"), rows = rowsOf(k);
    if (rows.length >= cfg.max) return null;
    var i = rows.length;
    var tmp = document.createElement("div"); tmp.innerHTML = multiRow(k, cfg, i);
    var row = tmp.firstChild; $(".pf-rows", wrap).appendChild(row);
    syncAddButton(k);
    return row;
  }
  function syncAddButton(k) {
    var cfg = multiCfg[k], b = $(".pf-add[data-k=\"" + k + "\"]");
    var n = rowsOf(k).length;
    b.hidden = n >= cfg.max;
  }
  function removeRow(k, btnEl) {
    var row = btnEl.closest(".pf-row"); if (!row) return;
    row.parentNode.removeChild(row);
    // شماره‌ها را دوباره بچین تا همیشه ۰،۱،۲ باشند
    rowsOf(k).forEach(function (r, i) {
      r.setAttribute("data-i", i);
      $(".pf-row-h span", r).textContent = multiCfg[k].item + " " + toFa(i + 1);
      $$("input", r).forEach(function (inp) {
        var ck = inp.getAttribute("data-ck");
        inp.name = k + "__" + i + "__" + ck; inp.setAttribute("data-i", i);
        var e = $(".pf-err", inp.parentNode); if (e) e.id = "e-" + inp.name;
      });
    });
    syncAddButton(k); saveDraft(); progress();
  }
  box.addEventListener("click", function (e) {
    var a = e.target.closest(".pf-add");
    if (a) {
      var row = addRow(a.getAttribute("data-k"));
      if (row) { var first = $("input", row); if (first) first.focus(); }
      progress(); return;
    }
    var rm = e.target.closest(".pf-rm");
    if (rm) { removeRow(rm.getAttribute("data-k"), rm); var add = $(".pf-add[data-k=\"" + rm.getAttribute("data-k") + "\"]"); if (add && !add.hidden) add.focus(); }
  });

  /* ---------- پیام‌ها ---------- */
  function msg(t, kind, extra) {
    msgEl.textContent = t || "";
    msgEl.className = "pf-msg" + (kind ? " " + kind : "");
    if (extra) msgEl.appendChild(extra);
  }
  function dl(text, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    a.download = name + ".md"; a.textContent = " دانلود فایل"; return a;
  }

  /* ---------- کاور ---------- */
  var logoIn = form.elements.logo, drop = $("#drop-logo");
  if (logoIn && drop) {
    logoIn.addEventListener("change", function () {
      var f = logoIn.files[0], prev = $(".pf-prev", drop), fn = $(".pf-fn", drop);
      msg(""); clearErr(logoIn);
      if (!f) { prev.hidden = true; fn.textContent = ""; progress(); return; }
      if (!/^image\/(png|jpeg)$/.test(f.type) || f.size > 2 * 1024 * 1024) {
        logoIn.value = ""; prev.hidden = true; fn.textContent = ""; progress();
        return showErr(logoIn, "کاور باید PNG یا JPG و حداکثر ۲ مگابایت باشد.");
      }
      var url = URL.createObjectURL(f), im = new Image();
      im.onload = function () {
        prev.src = url; prev.hidden = false; fn.textContent = f.name;
        if (im.width < 1000 || im.height < 1000 || im.width !== im.height)
          msg("نکته: کاور مربع و حداقل ۱۰۰۰×۱۰۰۰ پیکسل بهتر است، ولی می‌توانید همین را بفرستید.");
      };
      im.src = url; progress();
    });
  }

  /* ---------- لینک، ایمیل و امبد ---------- */
  function normUrl(v) {
    v = String(v || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[^\s\/]+\.[a-z]{2,}([\/?#].*)?$/i.test(v)) return "https://" + v;
    return v;
  }
  function validUrl(v) {
    if (/\s/.test(v)) return false;
    try { var u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.indexOf(".") > 0; } catch (e) { return false; }
  }
  function embedSrc(v) {            // کد iframe یا لینک ساده
    v = String(v || "").trim();
    var m = v.match(/src\s*=\s*["']([^"']+)["']/i);
    return normUrl(m ? m[1] : v);
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---------- خطای هر فیلد ---------- */
  function slotFor(el) {
    var n = el.name || ""; var s = document.getElementById("e-" + n);
    if (!s) { var p = el.closest(".pf"); s = p && $(".pf-err", p); }
    return s;
  }
  function showErr(el, text) {
    el.setAttribute("aria-invalid", "true");
    var s = slotFor(el); if (s) { s.textContent = text; s.hidden = false; }
  }
  function clearErr(el) {
    el.removeAttribute("aria-invalid");
    var s = slotFor(el); if (s) { s.textContent = ""; s.hidden = true; }
  }

  /* ---------- اعتبارسنجی ---------- */
  function labelOf(el) {
    var g = el.closest(".pf-multi");
    if (g) return g.getAttribute("aria-label");
    var l = el.closest("label.pf") || el.closest(".pf");
    var t = l && (l.querySelector(".pf-l") || l.querySelector(".pf-o span:last-child"));
    return t ? t.textContent.replace("*", "").trim() : el.name;
  }
  function validateField(f) {
    var k = f[0], ty = f[2], req = f[3], x = f[6] || {}, el, v, problems = [];
    if (ty === "radio" || ty === "subcat") return problems;
    if (ty === "multi") {
      var cfg = f[5];
      rowsOf(k).forEach(function (row, i) {
        var inputs = $$("input", row);
        var any = inputs.some(function (inp) { return inp.value.trim() !== ""; });
        inputs.forEach(function (inp) {
          var ck = inp.getAttribute("data-ck"), c = cfg.cols.filter(function (z) { return z.k === ck; })[0], val = inp.value.trim();
          var needed = c.req && (i === 0 ? req : any);
          if (needed && !val) problems.push([inp, "این مورد را کامل کنید."]);
          else if (val && c.v === "url" && !validUrl(normUrl(val))) problems.push([inp, "لینک معتبر نیست؛ باید با https:// شروع شود یا آدرس سایت باشد."]);
        });
      });
      return problems;
    }
    el = form.elements[k]; if (!el) return problems;
    if (ty === "check") { if (req && !el.checked) problems.push([el, "برای ادامه باید این مورد را تأیید کنید."]); return problems; }
    if (ty === "file") { if (req && !(el.files && el.files.length)) problems.push([el, "لطفاً کاور پادکست را انتخاب کنید."]); return problems; }
    v = el.value.trim();
    if (!v) { if (req) problems.push([el, "پر کردن این مورد الزامی است."]); return problems; }
    if (x.v === "email" && !EMAIL_RE.test(v)) problems.push([el, "ایمیل معتبر نیست؛ مثلاً name@example.com"]);
    else if (x.v === "url" && !validUrl(normUrl(v))) problems.push([el, "لینک معتبر نیست؛ باید با https:// شروع شود یا آدرس سایت باشد."]);
    else if (x.v === "embed" && !validUrl(embedSrc(v))) problems.push([el, "امبد معتبر نیست؛ کد iframe یا لینک Embed را بچسبانید."]);
    else if (x.v === "latin" && !/[A-Za-z]/.test(v)) problems.push([el, "نام انگلیسی را با حروف لاتین بنویسید."]);
    return problems;
  }
  function validateAll() {
    var bad = [];
    $$(".pf-err", box).forEach(function (s) { s.hidden = true; s.textContent = ""; });
    $$("[aria-invalid]", box).forEach(function (e) { e.removeAttribute("aria-invalid"); });
    S.forEach(function (sec) { sec[1].forEach(function (f) { validateField(f).forEach(function (p) { bad.push(p); }); }); });
    bad.forEach(function (p) { showErr(p[0], p[1]); });
    return bad;
  }

  /* ---------- نوار پیشرفت (فقط موارد الزامی) ---------- */
  var progWrap = $("#pf-progress"), progBar = $("#pf-bar"), progTxt = $("#pf-ptext");
  function progress() {
    var total = 0, done = 0;
    S.forEach(function (sec) { sec[1].forEach(function (f) {
      var k = f[0], ty = f[2]; if (!f[3]) return;
      total++;
      if (ty === "multi") {
        var row = rowsOf(k)[0], cols = f[5].cols.filter(function (c) { return c.req; });
        var ok = row && cols.every(function (c) { var i = $("input[data-ck=\"" + c.k + "\"]", row); return i && i.value.trim() !== ""; });
        if (ok) done++;
      } else if (ty === "check") { if (form.elements[k].checked) done++; }
      else if (ty === "file") { var fe = form.elements[k]; if (fe.files && fe.files.length) done++; }
      else if (form.elements[k] && form.elements[k].value.trim() !== "") done++;
    }); });
    if (progTxt) progTxt.textContent = toFa(done) + " از " + toFa(total) + " مورد الزامی تکمیل شده";
    if (progBar) progBar.style.width = (total ? Math.round(done / total * 100) : 0) + "%";
    if (progWrap) { progWrap.setAttribute("aria-valuenow", String(done)); progWrap.setAttribute("aria-valuemax", String(total)); }
  }
  // خطای یک فیلد را به‌محض اصلاح پاک کن
  box.addEventListener("input", function (e) { var t = e.target; if (t.getAttribute && t.getAttribute("aria-invalid")) { clearErr(t); } progress(); });
  box.addEventListener("change", function (e) { var t = e.target; if (t.getAttribute && t.getAttribute("aria-invalid")) { clearErr(t); } progress(); });
  box.addEventListener("focusout", function (e) {
    var t = e.target; if (!t.name || t.type === "file" || t.type === "checkbox" || t.type === "radio") return;
    if (t.value.trim() === "") return;               // خالی‌بودن را فقط هنگام ارسال گوشزد کن
    var bad = null;
    S.forEach(function (sec) { sec[1].forEach(function (f) {
      validateField(f).forEach(function (p) { if (p[0] === t) bad = p[1]; });
    }); });
    if (bad) showErr(t, bad); else clearErr(t);
  });

  /* ---------- پیش‌نویس خودکار (فقط در همین مرورگر) ---------- */
  function draft() {
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === "file" || el.name === "hp_url") return;
      if (el.type === "checkbox") d[el.name] = el.checked;
      else if (el.type === "radio") { if (el.checked) d[el.name] = el.value; }
      else d[el.name] = el.value;
    });
    return d;
  }
  var dt = null, submitted = false;
  function writeDraft() {
    if (submitted) return;
    var d = draft();
    var any = Object.keys(d).some(function (k) { return d[k] === true || (typeof d[k] === "string" && d[k].trim() !== ""); });
    try { if (any) localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  function saveDraft() { clearTimeout(dt); dt = setTimeout(writeDraft, 500); }
  window.addEventListener("pagehide", writeDraft);
  function restoreDraft() {
    var raw; try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) {}
    if (!raw) return false;
    var d; try { d = JSON.parse(raw); } catch (e) { return false; }
    // ردیف‌های اضافه را قبل از پر کردن بساز
    Object.keys(multiCfg).forEach(function (k) {
      var maxI = 0;
      Object.keys(d).forEach(function (n) { var m = n.match(new RegExp("^" + k + "__(\\d+)__")); if (m && d[n]) maxI = Math.max(maxI, +m[1]); });
      for (var i = 1; i <= maxI; i++) addRow(k);
    });
    var any = false;
    Object.keys(d).forEach(function (k) {
      Array.prototype.forEach.call(form.querySelectorAll('[name="' + k + '"]'), function (el) {
        if (el.type === "checkbox") { el.checked = !!d[k]; if (d[k]) any = true; }
        else if (el.type === "radio") { el.checked = el.value === d[k]; if (el.checked) any = true; }
        else if (d[k]) { el.value = d[k]; any = true; }
      });
    });
    if (shortEl) shortEl.dispatchEvent(new Event("input"));
    return any;
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);

  function resetRows() {
    Object.keys(multiCfg).forEach(function (k) {
      rowsOf(k).slice(1).forEach(function (r) { r.parentNode.removeChild(r); });
      syncAddButton(k);
    });
  }
  if (restoreDraft()) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "pf-link"; b.textContent = "پاک‌کردن پیش‌نویس";
    b.onclick = function () { clearDraft(); form.reset(); resetRows(); msg(""); if (shortEl) shortEl.dispatchEvent(new Event("input")); progress(); };
    msg("پیش‌نویس قبلی شما در همین مرورگر بازیابی شد. ", "", b);
  }
  syncSubs();
  progress();

  /* ---------- ساخت فایل md ---------- */
  function multiValues(k) {
    var cfg = multiCfg[k], out = [];
    rowsOf(k).forEach(function (row) {
      var o = {}, any = false;
      cfg.cols.forEach(function (c) {
        var inp = $("input[data-ck=\"" + c.k + "\"]", row), v = inp ? inp.value.trim() : "";
        if (c.v === "url") v = normUrl(v);
        if (v) any = true; o[c.k] = v;
      });
      if (any) out.push(o);
    });
    return out;
  }
  /* ساخت خودکار پلیر از لینک پادکست (Castbox، اسپاتیفای، اپل پادکست)؛ نیازی به امبد دستی نیست */
  function deriveEmbed(fd) {
    var keys = ["podcast_link", "castbox", "platforms", "site"], text = keys.map(function (k) { return (fd.get(k) || "").toString(); }).join(" ");
    var m = text.match(/castbox\.fm\/(?:ch|channel|vh)\/([^\s\/?#]+)/i), id = m && (m[1].match(/(\d{4,})$/) || [])[1];
    if (!id) { var c = (fd.get("castbox") || "").toString().trim().match(/^\D{0,3}(\d{4,})\D{0,3}$/); id = c && c[1]; }
    if (id) return { embed: "https://castbox.fm/app/castbox/player/id" + id + "?v=8.22.11&autoplay=0", castbox_id: id };
    m = text.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?show\/([A-Za-z0-9]+)/i);
    if (m) return { embed: "https://open.spotify.com/embed/show/" + m[1] };
    m = text.match(/podcasts\.apple\.com\/([a-z]{2})\/podcast\/([^\s\/?#]+)\/(id\d+)/i);
    if (m) return { embed: "https://embed.podcasts.apple.com/" + m[1] + "/podcast/" + m[2] + "/" + m[3] };
    return null;
  }
  function build(fd) {
    var q = JSON.stringify, fm = [], body = [];
    S.forEach(function (sec) {
      var parts = [];
      sec[1].forEach(function (f) {
        var k = f[0], l = f[1], ty = f[2], x = f[6] || {};
        if (ty === "file") return;
        if (ty === "subcat") { fm.push(k + ": " + q(selectedSubs())); return; }
        if (ty === "multi") {
          var arr = multiValues(k);
          fm.push(k + ": " + q(arr));
          if (arr.length) {
            var cols = f[5].cols;
            var lines = arr.map(function (o) {
              if (cols.length === 1) return "- " + o[cols[0].k];
              return "- [" + (o.name || o.link) + "](" + o.link + ")" + (o.note ? " — " + o.note : "");
            });
            parts.push("### " + l + "\n\n" + lines.join("\n") + "\n");
          }
          return;
        }
        var v = ty === "check" ? !!fd.get(k) : (fd.get(k) || "").toString().trim();
        if (ty !== "check" && x.v === "url") v = normUrl(v);
        if (ty !== "check" && x.v === "embed") v = embedSrc(v);
        if (k === "started" || k === "episodes") v = digits(v);        // داده همیشه با عدد لاتین ذخیره می‌شود؛ نمایش فارسی با pp-digits.js
        if (ty !== "check" && x.list) {                 // «برچسب‌ها» به‌صورت آرایه (حداکثر ۵ مورد)
          var arr2 = v.split(/[،,؛;\n]/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 5);
          fm.push(k + ": " + q(arr2)); return;
        }
        if (ty === "area") { if (v) parts.push("### " + l + "\n\n" + v + "\n"); }
        else fm.push(k + ": " + (ty === "check" ? v : q(v)));
      });
      if (parts.length) body.push("## " + sec[0] + "\n\n" + parts.join("\n"));
    });
    var de = deriveEmbed(fd);
    if (de) { fm.push("embed: " + q(de.embed)); if (de.castbox_id) fm.push("castbox_id: " + q(de.castbox_id)); }
    return "---\n" + fm.join("\n") + "\nsubmitted: " + q(new Date().toISOString()) + "\n---\n\n# " + fd.get("name_fa") + "\n\n" + body.join("\n");
  }

  /* ---------- پنجره‌ی تشکر ---------- */
  var modal = $("#pf-modal"), mBox = modal && $(".pf-modal-box", modal), lastFocus = null;
  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false; document.body.classList.add("pf-lock");
    requestAnimationFrame(function () { modal.classList.add("open"); });
    var c = $("#pf-m-close"); if (c) c.focus();
  }
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.classList.remove("open"); modal.hidden = true; document.body.classList.remove("pf-lock");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  if (modal) {
    modal.addEventListener("click", function (e) { if (e.target === modal || e.target.closest("[data-close]")) closeModal(); });
    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
      if (e.key === "Tab") {                               // فوکوس داخل پنجره بماند
        var f = $$("a[href],button:not([disabled])", mBox);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- ارسال ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    if (fd.get("hp_url")) return;

    var bad = validateAll();
    if (bad.length) {
      var uniq = [], seen = {};
      bad.forEach(function (p) { var l = labelOf(p[0]); if (!seen[l]) { seen[l] = 1; uniq.push(l); } });
      msg("لطفاً " + toFa(uniq.length) + " مورد را اصلاح یا تکمیل کنید: " + uniq.slice(0, 6).join("، ") + (uniq.length > 6 ? " و …" : ""), "err");
      var first = bad[0][0];
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (x) {} }, 350);
      return;
    }

    var text = build(fd);
    var slug = (fd.get("name_en") || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "podcast-" + Date.now().toString(36);
    var out = new FormData();
    out.append("md", new Blob([text], { type: "text/markdown" }), slug + ".md");
    out.append("title", fd.get("name_fa"));
    var lg = fd.get("logo");
    if (lg && lg.size) out.append("logo", lg, slug + (lg.type === "image/png" ? ".png" : ".jpg"));
    if (SITEKEY) out.append("cf-turnstile-response", fd.get("cf-turnstile-response") || "");

    btn.disabled = true; btn.setAttribute("aria-busy", "true");
    msg("در حال ارسال… لطفاً صفحه را نبندید.");
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 45000);
    fetch(ENDPOINT, { method: "POST", body: out, signal: ctl.signal })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json().catch(function () { return {}; }); })
      .then(function () {
        submitted = true; form.reset(); clearDraft(); resetRows();
        var prev = $(".pf-prev", drop || document); if (prev) prev.hidden = true;
        var fn = $(".pf-fn", drop || document); if (fn) fn.textContent = "";
        if (shortEl) shortEl.dispatchEvent(new Event("input"));
        msg(""); progress(); openModal();
      })
      .catch(function () {
        msg("ارسال انجام نشد. اینترنت خود را بررسی کنید و دوباره بزنید، یا فایل را دانلود کنید و برای ما بفرستید.", "err", dl(text, slug));
      })
      .then(function () { clearTimeout(to); submitted = false; btn.disabled = false; btn.removeAttribute("aria-busy"); });
  });
})();
