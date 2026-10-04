/* PersianPod: موتور پرسشنامه
   سؤال‌ها در pp-form-fields.js هستند. خروجی: فایل .md (+ لوگو) به /api/form (Cloudflare Worker). */
(function () {
  "use strict";
  var ENDPOINT = "/api/form", SITEKEY = "";   // SITEKEY: اگر Turnstile فعال کردی
var S = window.PP_FORM_SCHEMA;

  /* نوع ورودی‌های لاتین (چپ‌به‌راست) برای آسان‌تر شدن تایپ لینک و ایمیل در موبایل */
  var MODE = { email: "email", castbox: "url", rss: "url", yt_ep: "url", other_ep: "url", telegram: "url", instagram: "url", site: "url", sponsor_tg: "text" };
  var LTR = { email: 1, castbox: 1, rss: 1, yt_ep: 1, other_ep: 1, telegram: 1, instagram: 1, site: 1, sponsor_tg: 1, name_en: 1 };
  var SHORT = { text: 1, select: 1 };  // این‌ها در تبلت/دسکتاپ دو ستونه می‌شوند
  var DRAFT_KEY = "pp-form-draft-v1";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var form = $("#f"), box = $("#fields"), msgEl = $("#msg"), btn = $("#go");
  if (!form || !box) return;
  if (!Array.isArray(S) || !S.length) {
    box.innerHTML = '<p class="pf-msg err">سؤال‌های فرم بارگذاری نشد. صفحه را دوباره باز کنید یا به ایمیل ما بنویسید.</p>';
    return;
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- ساخت فرم ---------- */
  function field(f) {
    var k = f[0], l = f[1], ty = f[2], r = f[3], h = f[4], o = f[5];
    var star = r ? ' <span class="pf-req" aria-hidden="true">*</span>' : "";
    var hint = h ? '<span class="pf-h" id="h-' + k + '">' + esc(h) + "</span>" : "";
    var rq = r ? ' required aria-required="true"' : "";
    var desc = h ? ' aria-describedby="h-' + k + '"' : "";
    if (ty === "check")
      return '<label class="pf-o pf-wide"><input type="checkbox" name="' + k + '"' + rq + "> <span>" + esc(l) + star + "</span></label>";
    if (ty === "radio")
      return '<div class="pf pf-wide" role="radiogroup" aria-label="' + esc(l) + '"><span class="pf-l">' + esc(l) + "</span>" + hint +
        o.map(function (v) { return '<label class="pf-o"><input type="radio" name="' + k + '" value="' + esc(v) + '"> <span>' + esc(v) + "</span></label>"; }).join("") + "</div>";
    var cls = "pf" + (SHORT[ty] ? "" : " pf-wide"), ctl;
    if (ty === "area") ctl = '<textarea name="' + k + '" dir="auto" rows="4"' + rq + desc + "></textarea>";
    else if (ty === "select")
      ctl = '<select name="' + k + '"' + rq + desc + '><option value="">انتخاب کنید</option>' + o.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("") + "</select>";
    else if (ty === "file")
      return '<div class="pf pf-wide"><span class="pf-l">' + esc(l) + "</span>" + hint +
        '<label class="pf-drop" id="drop-' + k + '"><input type="file" name="' + k + '" accept="image/png,image/jpeg"' + desc + '>' +
        '<span class="pf-drop-t">انتخاب تصویر</span><img class="pf-prev" alt="" hidden><span class="pf-fn"></span></label></div>';
    else {
      var dir = LTR[k] ? ' dir="ltr"' : ' dir="auto"';
      var im = MODE[k] ? ' inputmode="' + MODE[k] + '" autocapitalize="off" autocomplete="off" spellcheck="false"' : "";
      ctl = '<input type="text" name="' + k + '"' + dir + im + rq + desc + ">";
    }
    return '<label class="' + cls + '"><span class="pf-l">' + esc(l) + star + "</span>" + hint + ctl + "</label>";
  }
  box.innerHTML = S.map(function (sec) {
    return '<fieldset class="pf-set"><legend>' + esc(sec[0]) + '</legend><div class="pf-grid">' + sec[1].map(field).join("") + "</div></fieldset>";
  }).join("");

  var shortEl = form.elements.short;
  if (shortEl) {
    shortEl.maxLength = 200;
    var cnt = document.createElement("span");
    cnt.className = "pf-count"; cnt.setAttribute("aria-hidden", "true");
    shortEl.parentNode.appendChild(cnt);
    var upd = function () { cnt.textContent = shortEl.value.length + " / 200"; };
    shortEl.addEventListener("input", upd); upd();
  }
  if (SITEKEY) {
    var sc = document.createElement("script"); sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"; sc.async = true; document.head.appendChild(sc);
    $("#ts").innerHTML = '<div class="cf-turnstile" data-sitekey="' + SITEKEY + '"></div>';
  }

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

  /* ---------- لوگو ---------- */
  var logoIn = form.elements.logo, drop = $("#drop-logo");
  if (logoIn && drop) {
    logoIn.addEventListener("change", function () {
      var f = logoIn.files[0], prev = $(".pf-prev", drop), fn = $(".pf-fn", drop);
      msg("");
      if (!f) { prev.hidden = true; fn.textContent = ""; return; }
      if (!/^image\/(png|jpeg)$/.test(f.type) || f.size > 5e6) {
        logoIn.value = ""; prev.hidden = true; fn.textContent = "";
        return msg("لوگو باید PNG یا JPG و حداکثر ۵ مگابایت باشد.", "err");
      }
      var url = URL.createObjectURL(f), im = new Image();
      im.onload = function () {
        prev.src = url; prev.hidden = false; fn.textContent = f.name;
        if (im.width < 1000 || im.height < 1000 || im.width !== im.height)
          msg("نکته: لوگوی مربع و حداقل ۱۰۰۰×۱۰۰۰ بهتر است، ولی می‌توانید همین را بفرستید.");
      };
      im.src = url;
    });
  }

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
    var has = Object.keys(d).some(function (k) { return d[k] === true || (typeof d[k] === "string" && d[k].trim() !== ""); });
    try { if (has) localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  function saveDraft() { clearTimeout(dt); dt = setTimeout(writeDraft, 500); }
  window.addEventListener("pagehide", writeDraft);   // اگر زود صفحه بسته شد
  function restoreDraft() {
    var raw; try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) {}
    if (!raw) return false;
    var d; try { d = JSON.parse(raw); } catch (e) { return false; }
    var any = false;
    Object.keys(d).forEach(function (k) {
      var els = form.querySelectorAll('[name="' + k + '"]');
      Array.prototype.forEach.call(els, function (el) {
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
  if (restoreDraft()) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "pf-link"; b.textContent = "پاک‌کردن پیش‌نویس";
    b.onclick = function () { clearDraft(); form.reset(); msg(""); if (shortEl) shortEl.dispatchEvent(new Event("input")); };
    msg("پیش‌نویس قبلی شما در همین مرورگر بازیابی شد. ", "", b);
  }

  /* ---------- ساخت فایل md ---------- */
  function build(fd) {
    var q = JSON.stringify, fm = [], body = [];
    S.forEach(function (sec) {
      var parts = [];
      sec[1].forEach(function (f) {
        var k = f[0], l = f[1], ty = f[2];
        if (ty === "file") return;
        var v = ty === "check" ? !!fd.get(k) : (fd.get(k) || "").toString().trim();
        if (ty === "area") { if (v) parts.push("### " + l + "\n\n" + v + "\n"); }
        else fm.push(k + ": " + (ty === "check" ? v : q(v)));
      });
      if (parts.length) body.push("## " + sec[0] + "\n\n" + parts.join("\n"));
    });
    return "---\n" + fm.join("\n") + "\nsubmitted: " + q(new Date().toISOString()) + "\n---\n\n# " + fd.get("name_fa") + "\n\n" + body.join("\n");
  }

  /* ---------- اعتبارسنجی فارسی ---------- */
  function validate() {
    var missing = [], first = null;
    Array.prototype.forEach.call(form.querySelectorAll("[required]"), function (el) {
      var ok = el.type === "checkbox" ? el.checked : el.value.trim() !== "";
      el.removeAttribute("aria-invalid");
      if (!ok) {
        el.setAttribute("aria-invalid", "true");
        var lab = el.closest("label"), t = lab ? (lab.querySelector(".pf-l") || lab.querySelector("span:last-child")) : null;
        missing.push(t ? t.textContent.replace("*", "").trim() : el.name);
        if (!first) first = el;
      }
    });
    if (missing.length) {
      msg("لطفاً این موارد الزامی را کامل کنید: " + missing.join("، "), "err");
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function () { first.focus({ preventScroll: true }); }, 350);
      return false;
    }
    return true;
  }

  /* ---------- ارسال ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    if (fd.get("hp_url")) return;
    if (!validate()) return;
    var text = build(fd);
    var slug = (fd.get("name_en") || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "podcast-" + Date.now().toString(36);
    var out = new FormData();
    out.append("md", new Blob([text], { type: "text/markdown" }), slug + ".md");
    out.append("title", fd.get("name_fa"));
    var lg = fd.get("logo");
    if (lg && lg.size) out.append("logo", lg, slug + (lg.type === "image/png" ? ".png" : ".jpg"));
    if (SITEKEY) out.append("cf-turnstile-response", fd.get("cf-turnstile-response") || "");

    btn.disabled = true; btn.setAttribute("aria-busy", "true");
    msg("در حال ارسال…");
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 45000);
    fetch(ENDPOINT, { method: "POST", body: out, signal: ctl.signal })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json().catch(function () { return {}; }); })
      .then(function () {
        submitted = true; form.reset(); clearDraft();
        var prev = $(".pf-prev", drop || document); if (prev) prev.hidden = true;
        if (shortEl) shortEl.dispatchEvent(new Event("input"));
        msg("ارسال شد. ممنون از وقتی که گذاشتید 🌱", "ok");
        msgEl.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(function () {
        msg("ارسال انجام نشد. اینترنت را بررسی کنید و دوباره بزنید، یا فایل را دانلود کنید و برای ما بفرستید.", "err", dl(text, slug));
      })
      .then(function () { clearTimeout(to); submitted = false; btn.disabled = false; btn.removeAttribute("aria-busy"); });
  });
})();
