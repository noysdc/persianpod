/*
  پلیر شناور پرشین‌پاد
  - قابل جابه‌جایی (کشیدن نوار عنوان) و تغییر اندازه (گوشه‌ی پایین‌راست)
  - کوچک‌کردن به نوار عنوان بدون قطع پخش
  - موقعیت و اندازه در localStorage ذخیره می‌شود
  - روی موبایل به پایین صفحه می‌چسبد

  استفاده:
    <button data-pp-embed="https://.../embed-url" data-title="نام پادکست">پخش</button>
  یا از جاوااسکریپت:
    PPPlayer.open({ src: "https://.../embed-url", title: "نام پادکست" });
*/
(function () {
  "use strict";

  var STORE_KEY = "pp-float-player";
  var MOBILE_MQ = window.matchMedia("(max-width: 600px)");
  var MIN_W = 260;
  var MIN_H = 150;
  var DEFAULT = { w: 360, h: 220 };

  var root, bar, titleEl, frame, minBtn, statusEl, statusMsg, pageLink;
  var curSrc = "", reloadN = 0, watchdog = 0, loaded = false;
  var LOAD_TIMEOUT = 12000; // اگر پلیر (مثلاً Castbox در ایران) تا این مدت بالا نیامد، دکمه‌ی بارگذاری دوباره نشان داده می‌شود
  var state = loadState();

  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (s && typeof s.w === "number") return s;
    } catch (e) {}
    return { w: DEFAULT.w, h: DEFAULT.h, x: null, y: null, min: false };
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function safeUrl(src) {
    try {
      var u = new URL(src, location.href);
      return u.protocol === "https:" ? u.href : null;
    } catch (e) {
      return null;
    }
  }

  function build() {
    if (root) return;

    root = document.createElement("div");
    root.className = "ppfp";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "پلیر پادکست");

    root.innerHTML =
      '<div class="ppfp__bar" tabindex="0" aria-label="جابه‌جایی پلیر؛ با کلیدهای جهت‌دار هم می‌شود جابه‌جا کرد">' +
      '<svg class="ppfp__grip" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<circle cx="8" cy="6" r="1.7"/><circle cx="16" cy="6" r="1.7"/>' +
      '<circle cx="8" cy="12" r="1.7"/><circle cx="16" cy="12" r="1.7"/>' +
      '<circle cx="8" cy="18" r="1.7"/><circle cx="16" cy="18" r="1.7"/></svg>' +
      '<span class="ppfp__title"></span>' +
      '<button type="button" class="ppfp__btn ppfp__reload" aria-label="بارگذاری دوباره پلیر" title="بارگذاری دوباره پلیر">↻</button>' +
      '<button type="button" class="ppfp__btn ppfp__min" aria-label="کوچک کردن">–</button>' +
      '<button type="button" class="ppfp__btn ppfp__close" aria-label="بستن پلیر">✕</button>' +
      "</div>" +
      '<div class="ppfp__body">' +
      '<iframe class="ppfp__frame" title="پلیر پادکست" loading="lazy" ' +
      'allow="autoplay; encrypted-media; fullscreen" ' +
      'referrerpolicy="strict-origin-when-cross-origin" ' +
      'sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"></iframe>' +
      '<div class="ppfp__status" role="status" aria-live="polite" hidden>' +
      '<p class="ppfp__msg"></p>' +
      '<div class="ppfp__acts"><button type="button" class="ppfp__retry">بارگذاری دوباره پلیر</button>' +
      '<a class="ppfp__ext" target="_blank" rel="noopener noreferrer" hidden>باز کردن در سایت پادکست</a></div></div>' +
      '<div class="ppfp__resize" tabindex="0" role="separator" aria-label="تغییر اندازه"></div>' +
      "</div>";

    document.body.appendChild(root);

    bar = root.querySelector(".ppfp__bar");
    titleEl = root.querySelector(".ppfp__title");
    frame = root.querySelector(".ppfp__frame");
    minBtn = root.querySelector(".ppfp__min");
    statusEl = root.querySelector(".ppfp__status");
    statusMsg = root.querySelector(".ppfp__msg");
    pageLink = root.querySelector(".ppfp__ext");

    frame.addEventListener("load", function () {
      if (!frame.getAttribute("src") || frame.getAttribute("src") === "about:blank") return;
      loaded = true; clearTimeout(watchdog); showStatus("");
    });
    root.querySelector(".ppfp__reload").addEventListener("click", reload);
    root.querySelector(".ppfp__retry").addEventListener("click", reload);

    root.querySelector(".ppfp__close").addEventListener("click", close);
    minBtn.addEventListener("click", function () {
      setMin(!state.min);
    });

    enableDrag();
    enableResize(root.querySelector(".ppfp__resize"));
    window.addEventListener("resize", applyGeometry);
    MOBILE_MQ.addEventListener
      ? MOBILE_MQ.addEventListener("change", applyGeometry)
      : MOBILE_MQ.addListener(applyGeometry);
  }

  function applyGeometry() {
    if (!root || root.hidden) return;
    if (MOBILE_MQ.matches) {
      root.style.width = root.style.height = "";
      if (!state.min) root.style.height = "220px";
      return;
    }
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var w = clamp(state.w, MIN_W, vw - 8);
    var h = clamp(state.h, MIN_H, vh - 8);
    var x = state.x == null ? 16 : state.x; // پیش‌فرض: پایین-چپ
    var y = state.y == null ? vh - h - 16 : state.y;
    x = clamp(x, 0, Math.max(0, vw - w));
    y = clamp(y, 0, Math.max(0, vh - (state.min ? 44 : h)));
    root.style.width = w + "px";
    root.style.height = state.min ? "" : h + "px";
    root.style.left = x + "px";
    root.style.top = y + "px";
    root.style.right = root.style.bottom = "auto";
  }

  function setMin(v) {
    state.min = !!v;
    root.classList.toggle("ppfp--min", state.min);
    document.body.classList.toggle("ppfp-min", state.min);
    minBtn.textContent = state.min ? "▢" : "–";
    minBtn.setAttribute("aria-label", state.min ? "بزرگ کردن" : "کوچک کردن");
    applyGeometry();
    saveState();
  }

  function enableDrag() {
    var sx, sy, ox, oy, pid;

    bar.addEventListener("pointerdown", function (e) {
      if (MOBILE_MQ.matches || e.target.closest(".ppfp__btn")) return;
      pid = e.pointerId;
      bar.setPointerCapture(pid);
      var r = root.getBoundingClientRect();
      sx = e.clientX;
      sy = e.clientY;
      ox = r.left;
      oy = r.top;
      root.classList.add("ppfp--dragging");
    });

    bar.addEventListener("pointermove", function (e) {
      if (!root.classList.contains("ppfp--dragging") || e.pointerId !== pid) return;
      var r = root.getBoundingClientRect();
      state.x = clamp(ox + e.clientX - sx, 0, window.innerWidth - r.width);
      state.y = clamp(oy + e.clientY - sy, 0, window.innerHeight - 44);
      applyGeometry();
    });

    function end(e) {
      if (!root.classList.contains("ppfp--dragging")) return;
      root.classList.remove("ppfp--dragging");
      try {
        bar.releasePointerCapture(e.pointerId);
      } catch (err) {}
      saveState();
    }
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);

    // جابه‌جایی با کیبورد
    bar.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 40 : 12;
      var dx = 0, dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;
      e.preventDefault();
      var r = root.getBoundingClientRect();
      state.x = r.left + dx;
      state.y = r.top + dy;
      applyGeometry();
      saveState();
    });
  }

  function enableResize(handle) {
    var sx, sy, ow, oh, pid;

    handle.addEventListener("pointerdown", function (e) {
      if (MOBILE_MQ.matches) return;
      pid = e.pointerId;
      handle.setPointerCapture(pid);
      var r = root.getBoundingClientRect();
      sx = e.clientX;
      sy = e.clientY;
      ow = r.width;
      oh = r.height;
      root.classList.add("ppfp--resizing");
      e.preventDefault();
    });

    handle.addEventListener("pointermove", function (e) {
      if (!root.classList.contains("ppfp--resizing") || e.pointerId !== pid) return;
      var r = root.getBoundingClientRect();
      state.w = clamp(ow + e.clientX - sx, MIN_W, window.innerWidth - r.left);
      state.h = clamp(oh + e.clientY - sy, MIN_H, window.innerHeight - r.top);
      applyGeometry();
    });

    function end(e) {
      if (!root.classList.contains("ppfp--resizing")) return;
      root.classList.remove("ppfp--resizing");
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch (err) {}
      saveState();
    }
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);

    handle.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 40 : 12;
      if (e.key === "ArrowRight") state.w += step;
      else if (e.key === "ArrowLeft") state.w -= step;
      else if (e.key === "ArrowDown") state.h += step;
      else if (e.key === "ArrowUp") state.h -= step;
      else return;
      e.preventDefault();
      applyGeometry();
      saveState();
    });
  }

  function showStatus(msg, failed) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.classList.toggle("ppfp__status--fail", !!failed);
    statusMsg.textContent = msg || "";
    root.querySelector(".ppfp__retry").hidden = !failed;
  }

  function withParams(src, n) {
    // فقط برای بارگذاری دوباره: پارامتر بی‌اثر می‌گذاریم تا نسخه‌ی کش‌شده‌ی ناقص استفاده نشود
    if (!n) return src;
    return src + (src.indexOf("?") === -1 ? "?" : "&") + "pp_r=" + n;
  }

  function load(n) {
    loaded = false;
    clearTimeout(watchdog);
    showStatus("در حال بارگذاری پلیر…", false);
    frame.setAttribute("src", withParams(curSrc, n));
    watchdog = setTimeout(function () {
      if (loaded) return;
      showStatus("پلیر بالا نیامد. گاهی Castbox در ایران دیر یا اصلاً لود نمی‌شود. بدون بارگذاری دوباره‌ی کل صفحه، همین‌جا دوباره تلاش کنید.", true);
    }, LOAD_TIMEOUT);
  }

  function reload() {
    if (!root || !curSrc) return;
    reloadN += 1;
    frame.setAttribute("src", "about:blank");
    setTimeout(function () { load(reloadN); }, 80);
  }

  function open(opts) {
    var src = safeUrl(opts && opts.src);
    if (!src) return;
    build();
    // پخش خودکار فقط وقتی کاربر خودش دکمه‌ی پخش را زده است (Castbox این پارامتر را می‌شناسد)
    if (opts && opts.autoplay !== false && /castbox\.fm\/app\/castbox\/player/.test(src)) src = src.replace("autoplay=0", "autoplay=1");
    titleEl.textContent = (opts && opts.title) || "در حال پخش";
    var ext = safeUrl(opts && opts.page);
    if (ext) { pageLink.href = ext; pageLink.hidden = false; } else { pageLink.hidden = true; }
    root.hidden = false;
    document.body.classList.add("ppfp-open");
    setMin(false);
    applyGeometry();
    // اگر همان پادکست در حال پخش است، دوباره بارگذاری نکن
    if (curSrc !== src || !loaded) { curSrc = src; reloadN = 0; load(0); }
  }

  function close() {
    if (!root) return;
    clearTimeout(watchdog);
    frame.setAttribute("src", "about:blank"); // پخش را قطع می‌کند
    frame.removeAttribute("src");
    curSrc = ""; loaded = false;
    showStatus("");
    root.hidden = true;
    document.body.classList.remove("ppfp-open", "ppfp-min");
  }

  function isOpen() { return !!root && !root.hidden; }

  // اتصال خودکار: هر عنصری با data-pp-embed
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-pp-embed]");
    if (!el) return;
    e.preventDefault();
    open({
      src: el.getAttribute("data-pp-embed"),
      title: el.getAttribute("data-title") || el.textContent.trim(),
      page: el.getAttribute("data-page") || "",
    });
  });

  window.PPPlayer = { open: open, close: close, reload: reload, isOpen: isOpen, minimize: function () { build(); setMin(true); } };
})();
