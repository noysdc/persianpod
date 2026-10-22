/*
  پلیر شناور پرشین‌پاد
  - قابل جابه‌جایی (کشیدن نوار عنوان) و تغییر اندازه (گوشه‌ی پایین‌راست)
  - کوچک‌کردن به نوار عنوان بدون قطع پخش
  - موقعیت و اندازه در localStorage ذخیره می‌شود
  - روی موبایل به پایین صفحه می‌چسبد
  - پخش مستقیم قسمت‌ها (mode=audio): ظاهر قرص شناور، شبیه پلیر اپل (کنترل‌ها سمت چپ، نوار پیشرفت، فهرست قسمت‌ها)؛ پلیر iframe بیرونی همان پنجره‌ی قبلی است

  استفاده:
    <button data-pp-embed="https://.../embed-url" data-title="نام پادکست">پخش</button>
  یا از جاوااسکریپت:
    PPPlayer.open({ src: "https://.../embed-url", title: "نام پادکست" });

  پلیر داخلی (پخش مستقیم فایل صوتی قسمت‌ها، بدون سرویس بیرونی):
    <div data-pp-playlist data-title="نام پادکست">
      <button data-pp-audio="https://.../ep.mp3" data-t="عنوان قسمت">...</button> ...
    </div>
  یا: PPPlayer.open({ eps: [{ t: "عنوان", a: "https://.../ep.mp3" }, ...], index: 0, title: "نام پادکست" });
*/
(function () {
  "use strict";

  var STORE_KEY = "pp-float-player";
  var MOBILE_MQ = window.matchMedia("(max-width: 600px)");
  var MIN_W = 260;
  var MIN_H = 150;
  var DEFAULT = { w: 360, h: 300 };

  var root, bar, titleEl, frame, minBtn, statusEl, statusMsg, pageLink;
  var pillEl, playBtn, seekEl, curEl, durEl, epTEl, podEl, rateBtn, volBtn, volEl, listBtn, infoA, hintEl, seeking = false;
  var lastSave = 0, pendingSeek = 0, hintT = 0;
  var curEpsUrl = "";
  var selRate, selSleep, leftEl, rate = 1, sleepT = 0, sleepTick = 0, sleepAt = 0, sleepEnd = false;
  var RATE_KEY = "pp-rate", RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
  var audioWrap, audioEl, nowEl, epsEl, mode = "frame", eps = [], epI = 0;
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
      '<button type="button" class="ppfp__hint" hidden></button>' +
      '<div class="ppfp__pill" dir="ltr">' +
      '<div class="ppfp__ctl">' +
      '<button type="button" class="ppfp__pb ppfp__rate-b" aria-label="سرعت پخش" title="سرعت پخش">۱×</button>' +
      '<button type="button" class="ppfp__pb ppfp__skip" data-s="-15" aria-label="۱۵ ثانیه عقب" title="۱۵ ثانیه عقب"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4.5h4.5"/><text x="12" y="15.2" text-anchor="middle" font-size="7.2" font-weight="700" fill="currentColor" stroke="none">۱۵</text></svg></button>' +
      '<button type="button" class="ppfp__pb ppfp__play" aria-label="پخش"></button>' +
      '<button type="button" class="ppfp__pb ppfp__skip" data-s="30" aria-label="۳۰ ثانیه جلو" title="۳۰ ثانیه جلو"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v4.5h-4.5"/><text x="12" y="15.2" text-anchor="middle" font-size="7.2" font-weight="700" fill="currentColor" stroke="none">۳۰</text></svg></button>' +
      "</div>" +
      '<div class="ppfp__mid" dir="rtl">' +
      '<div class="ppfp__meta"><b class="ppfp__ept"></b><span class="ppfp__pod"></span></div>' +
      '<div class="ppfp__prog" dir="ltr"><span class="ppfp__cur">۰:۰۰</span>' +
      '<input type="range" class="ppfp__seek" min="0" max="1000" value="0" step="1" aria-label="موقعیت پخش">' +
      '<span class="ppfp__dur">۰:۰۰</span></div>' +
      "</div>" +
      '<div class="ppfp__side">' +
      '<a class="ppfp__pb ppfp__info" target="_blank" rel="noopener noreferrer" aria-label="صفحه‌ی پادکست" title="صفحه‌ی پادکست" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg></a>' +
      '<button type="button" class="ppfp__pb ppfp__list" aria-label="قسمت‌ها و تنظیمات" aria-expanded="false" title="قسمت‌ها و تنظیمات"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg></button>' +
      '<span class="ppfp__volw"><button type="button" class="ppfp__pb ppfp__vol" aria-label="صدا"></button><input type="range" class="ppfp__vslider" min="0" max="100" value="100" aria-label="میزان صدا"></span>' +
      '<button type="button" class="ppfp__pb ppfp__x" aria-label="بستن پلیر" title="بستن"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      "</div>" +
      "</div>" +
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
      '<div class="ppfp__audio" hidden>' +
      '<div class="ppfp__now" aria-live="polite"></div>' +
      '<audio class="ppfp__au" controls preload="none" controlsList="nodownload noplaybackrate noremoteplayback" disablePictureInPicture></audio>' +
      '<div class="ppfp__tools">' +
      '<label class="ppfp__tool"><span class="sr">سرعت پخش</span><select class="ppfp__rate" aria-label="سرعت پخش">' +
      '<option value="0.75">۰٫۷۵×</option><option value="1">۱×</option><option value="1.25">۱٫۲۵×</option><option value="1.5">۱٫۵×</option><option value="1.75">۱٫۷۵×</option><option value="2">۲×</option></select></label>' +
      '<label class="ppfp__tool"><span class="sr">تایمر خواب</span><select class="ppfp__sleep" aria-label="تایمر خواب">' +
      '<option value="0">تایمر خواب</option><option value="15">۱۵ دقیقه</option><option value="30">۳۰ دقیقه</option><option value="45">۴۵ دقیقه</option><option value="60">۶۰ دقیقه</option><option value="end">پایان این قسمت</option></select></label>' +
      '<span class="ppfp__left" aria-live="off"></span></div>' +
      '<ol class="ppfp__eps" aria-label="قسمت‌ها"></ol></div>' +
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
    audioWrap = root.querySelector(".ppfp__audio");
    audioEl = root.querySelector(".ppfp__au");
    nowEl = root.querySelector(".ppfp__now");
    epsEl = root.querySelector(".ppfp__eps");
    selRate = root.querySelector(".ppfp__rate");
    selSleep = root.querySelector(".ppfp__sleep");
    leftEl = root.querySelector(".ppfp__left");
    rate = loadRate(); selRate.value = String(rate);
    selRate.addEventListener("change", function () {
      rate = parseFloat(selRate.value) || 1;
      try { localStorage.setItem(RATE_KEY, String(rate)); } catch (e) {}
      applyRate();
    });
    selSleep.addEventListener("change", function () { setSleep(selSleep.value); });
    audioEl.addEventListener("loadedmetadata", applyRate);
    audioEl.addEventListener("contextmenu", function (e) { e.preventDefault(); });   // «ذخیره‌ی صدا به‌عنوان…» نشان داده نشود
    audioEl.addEventListener("playing", function () { showStatus(""); if (!sleepAt && !sleepEnd && leftEl) leftEl.textContent = ""; });
    audioEl.addEventListener("ended", function () {
      if (sleepEnd) { sleepFire(); return; }                  // «پایان این قسمت»: قسمت بعدی شروع نشود
      if (eps[epI + 1]) playEp(epI + 1);
    });
    audioEl.addEventListener("timeupdate", function () { if (sleepAt && Date.now() >= sleepAt) sleepFire(); });   // اگر تایمر مرورگر در پس‌زمینه کند شد
    audioEl.addEventListener("error", function () {
      if (mode !== "audio" || !audioEl.getAttribute("src")) return;
      showStatus("این قسمت پخش نشد. دوباره تلاش کنید یا قسمت دیگری را انتخاب کنید.", true);
    });

    buildPill();   // قرص شناور (بعد از اتصال audioEl و selRate)

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

  /* ---------- قرص شناور (شبیه اپل): پخش/توقف، ۱۵ثانیه عقب، ۳۰ثانیه جلو، نوار پیشرفت، سرعت، صدا، فهرست ---------- */
  var ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.3" height="15" rx="1.3" fill="currentColor" stroke="none"/><rect x="13.7" y="4.5" width="4.3" height="15" rx="1.3" fill="currentColor" stroke="none"/></svg>';
  var ICON_VOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>';
  var ICON_MUTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';

  function fmtT(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return faNum((h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (x < 10 ? "0" : "") + x);
  }
  function setPop(on) {
    if (!root) return;
    root.classList.toggle("ppfp--pop", !!on);
    if (listBtn) listBtn.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) { var cur = epsEl && epsEl.querySelector(".on"); if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ block: "nearest" }); } catch (e) {} } }
  }
  function syncPlay() {
    if (!playBtn || !audioEl) return;
    var p = !audioEl.paused && !audioEl.ended;
    playBtn.innerHTML = p ? ICON_PAUSE : ICON_PLAY;
    playBtn.setAttribute("aria-label", p ? "توقف" : "پخش");
    root.classList.toggle("ppfp--playing", p);
  }
  function syncPill() {
    if (!seekEl || !audioEl) return;
    var d = audioEl.duration, t = audioEl.currentTime || 0, ok = isFinite(d) && d > 0;
    curEl.textContent = fmtT(t);
    durEl.textContent = ok ? fmtT(d) : "۰:۰۰";
    if (!seeking) {
      var v = ok ? Math.round(t / d * 1000) : 0;
      seekEl.value = v;
      seekEl.style.setProperty("--p", (v / 10) + "%");
    }
  }
  function syncRate() {
    if (!rateBtn) return;
    rateBtn.textContent = faNum(String(rate).replace(".", "٫")) + "×";
  }
  function syncVol() {
    if (!volBtn || !audioEl) return;
    var m = audioEl.muted || audioEl.volume === 0;
    volBtn.innerHTML = m ? ICON_MUTE : ICON_VOL;
    volBtn.setAttribute("aria-label", m ? "فعال‌کردن صدا" : "بی‌صدا");
    var v = Math.round((m ? 0 : audioEl.volume) * 100);
    volEl.value = v; volEl.style.setProperty("--p", v + "%");
  }
  function buildPill() {
    pillEl = root.querySelector(".ppfp__pill");
    playBtn = root.querySelector(".ppfp__play");
    seekEl = root.querySelector(".ppfp__seek");
    curEl = root.querySelector(".ppfp__cur");
    durEl = root.querySelector(".ppfp__dur");
    epTEl = root.querySelector(".ppfp__ept");
    podEl = root.querySelector(".ppfp__pod");
    rateBtn = root.querySelector(".ppfp__rate-b");
    volBtn = root.querySelector(".ppfp__vol");
    volEl = root.querySelector(".ppfp__vslider");
    listBtn = root.querySelector(".ppfp__list");
    infoA = root.querySelector(".ppfp__info");

    playBtn.addEventListener("click", function () {
      if (audioEl.paused) { var pr = audioEl.play(); if (pr && pr.catch) pr.catch(function () {}); } else audioEl.pause();
    });
    [].forEach.call(root.querySelectorAll(".ppfp__skip"), function (b) {
      b.addEventListener("click", function () {
        var d = audioEl.duration, t = (audioEl.currentTime || 0) + (parseInt(b.getAttribute("data-s"), 10) || 0);
        try { audioEl.currentTime = Math.max(0, isFinite(d) ? Math.min(d, t) : t); } catch (e) {}
      });
    });
    seekEl.addEventListener("input", function () {
      var d = audioEl.duration; if (!isFinite(d) || d <= 0) return;
      seeking = true;
      var v = +seekEl.value; seekEl.style.setProperty("--p", (v / 10) + "%");
      curEl.textContent = fmtT(v / 1000 * d);
      try { audioEl.currentTime = v / 1000 * d; } catch (e) {}
    });
    ["change", "pointerup", "keyup", "touchend", "blur"].forEach(function (ev) { seekEl.addEventListener(ev, function () { seeking = false; syncPill(); }); });
    rateBtn.addEventListener("click", function () {
      rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
      selRate.value = String(rate);
      try { localStorage.setItem(RATE_KEY, String(rate)); } catch (e) {}
      applyRate(); syncRate();
    });
    selRate.addEventListener("change", syncRate);
    volBtn.addEventListener("click", function () { audioEl.muted = !audioEl.muted; if (!audioEl.muted && audioEl.volume === 0) audioEl.volume = 0.6; });
    volEl.addEventListener("input", function () { audioEl.volume = (+volEl.value) / 100; audioEl.muted = +volEl.value === 0; });
    listBtn.addEventListener("click", function () { setPop(!root.classList.contains("ppfp--pop")); });
    root.querySelector(".ppfp__x").addEventListener("click", close);

    ["play", "pause", "ended", "emptied"].forEach(function (ev) { audioEl.addEventListener(ev, syncPlay); });
    ["timeupdate", "loadedmetadata", "durationchange", "emptied"].forEach(function (ev) { audioEl.addEventListener(ev, syncPill); });
    audioEl.addEventListener("volumechange", syncVol);
    audioEl.addEventListener("ratechange", syncRate);

    // حافظه‌ی پخش
    hintEl = root.querySelector(".ppfp__hint");
    hintEl.addEventListener("click", function () {
      try { audioEl.currentTime = 0; } catch (e) {}
      if (window.PPMem) window.PPMem.delProg(srcKey());
      hintEl.hidden = true;
    });
    audioEl.addEventListener("loadedmetadata", function () {
      var t = pendingSeek; pendingSeek = 0;
      if (t > 0 && isFinite(audioEl.duration) && t < audioEl.duration - 20) {
        try { audioEl.currentTime = t; } catch (e) {}
        showHint(t);
      }
    });
    audioEl.addEventListener("timeupdate", function () { if (Date.now() - lastSave > 5000) saveProg(true); });
    ["pause", "ended"].forEach(function (ev) { audioEl.addEventListener(ev, function () { saveProg(false); }); });
    window.addEventListener("pagehide", function () { saveProg(true); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") saveProg(true); });

    // انتخاب قسمت در موبایل: فهرست بسته شود
    epsEl.addEventListener("click", function (e) { if (e.target.closest(".ppfp__ep") && window.innerWidth < 800) setPop(false); });
    // بستن فهرست با کلیک بیرون و Escape
    document.addEventListener("click", function (e) { if (root && root.classList.contains("ppfp--pop") && !root.contains(e.target)) setPop(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && root && root.classList.contains("ppfp--pop")) { setPop(false); if (listBtn) listBtn.focus(); } });
    syncPlay(); syncVol(); syncRate();
  }

  function applyGeometry() {
    if (!root || root.hidden) return;
    if (root.classList.contains("ppfp--pill")) {          // قرص با CSS جای می‌گیرد؛ مختصات قدیمی پاک می‌شود
      root.style.width = root.style.height = root.style.left = root.style.top = root.style.right = root.style.bottom = "";
      return;
    }
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var minW = Math.min(MIN_W, vw - 8);
    var w = clamp(state.w, minW, vw - 8);
    var h = clamp(state.h, MIN_H, vh - 8);
    var x = state.x == null ? (MOBILE_MQ.matches ? (vw - w) / 2 : 16) : state.x; // پیش‌فرض: پایین؛ موبایل وسط، دسکتاپ چپ
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
      if (e.target.closest(".ppfp__btn")) return;
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
      state.w = clamp(ow + e.clientX - sx, Math.min(MIN_W, window.innerWidth - 8), window.innerWidth - r.left);
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
      showStatus("پلیر بالا نیامد. بدون بارگذاری دوباره‌ی کل صفحه، همین‌جا دوباره تلاش کنید.", true);
    }, LOAD_TIMEOUT);
  }

  function reload() {
    if (root && mode === "audio") {
      showStatus("");
      var t = audioEl.currentTime || 0;
      audioEl.load();
      audioEl.addEventListener("loadedmetadata", function seek() { audioEl.removeEventListener("loadedmetadata", seek); try { if (t > 1) audioEl.currentTime = t; } catch (e) {} });
      var pr = audioEl.play(); if (pr && pr.catch) pr.catch(function () {});
      return;
    }
    if (!root || !curSrc) return;
    reloadN += 1;
    frame.setAttribute("src", "about:blank");
    setTimeout(function () { load(reloadN); }, 80);
  }

  /* ---------- پلیر داخلی: پخش مستقیم فایل صوتی قسمت‌ها ---------- */
  function httpsUrl(u) {
    try {
      var x = new URL(String(u || ""), location.href);
      if (x.protocol === "http:") x.protocol = "https:";     // صفحه https است؛ http توسط مرورگر بلاک می‌شود
      return x.protocol === "https:" ? x.href : null;
    } catch (e) { return null; }
  }
  /* ---------- سرعت پخش و تایمر خواب ---------- */
  function faNum(n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); }
  function loadRate() {
    try { var r = parseFloat(localStorage.getItem(RATE_KEY)); if (RATES.indexOf(r) > -1) return r; } catch (e) {}
    return 1;
  }
  function applyRate() { if (!audioEl) return; audioEl.defaultPlaybackRate = rate; audioEl.playbackRate = rate; }
  function clearSleep() {
    clearTimeout(sleepT); clearInterval(sleepTick);
    sleepT = 0; sleepTick = 0; sleepAt = 0; sleepEnd = false;
    if (selSleep) selSleep.value = "0";
    if (leftEl) leftEl.textContent = "";
  }
  function sleepFire() {
    if (audioEl) audioEl.pause();
    clearSleep();
    if (leftEl) leftEl.textContent = "تایمر خواب تمام شد";
  }
  function setSleep(v) {
    clearTimeout(sleepT); clearInterval(sleepTick);
    sleepT = 0; sleepTick = 0; sleepAt = 0; sleepEnd = false; leftEl.textContent = "";
    if (v === "end") { sleepEnd = true; leftEl.textContent = "تا پایان این قسمت"; return; }
    var m = parseInt(v, 10);
    if (!m) return;
    sleepAt = Date.now() + m * 60000;
    function fmt(ms) { var s = Math.max(0, Math.round(ms / 1000)), mm = Math.floor(s / 60); s = s % 60; return faNum((mm < 10 ? "0" : "") + mm + ":" + (s < 10 ? "0" : "") + s); }
    leftEl.textContent = fmt(m * 60000);
    sleepT = setTimeout(sleepFire, m * 60000);
    sleepTick = setInterval(function () { var left = sleepAt - Date.now(); if (left <= 0) sleepFire(); else leftEl.textContent = fmt(left); }, 1000);
  }
  function cleanEps(list) {
    return (list || []).map(function (e) { return { t: String((e && (e.t || e.title)) || "").trim(), a: httpsUrl(e && (e.a || e.audio)) }; })
      .filter(function (e) { return e.a; });
  }
  function setMode(m) {
    mode = m;
    frame.hidden = m === "audio";
    audioWrap.hidden = m !== "audio";
    root.classList.toggle("ppfp--pill", m === "audio");
    document.body.classList.toggle("ppfp-pill", m === "audio");
    if (m !== "audio") setPop(false);
    if (m === "audio") { syncPlay(); syncPill(); syncRate(); syncVol(); }
  }
  function renderEps() {
    epsEl.innerHTML = "";
    eps.forEach(function (e, i) {
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.className = "ppfp__ep" + (i === epI ? " on" : "");
      b.textContent = e.t || "قسمت " + (i + 1); b.title = e.t || "";
      if (i === epI) b.setAttribute("aria-current", "true");
      b.addEventListener("click", function () { playEp(i); });
      li.appendChild(b); epsEl.appendChild(li);
    });
    var on = epsEl.querySelector(".on"); if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: "nearest" }); } catch (e) {} }
  }
  function mediaMeta(e) {
    try {
      if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: e.t || "", artist: titleEl.textContent || "پرشین‌پاد" });
      navigator.mediaSession.setActionHandler("nexttrack", eps[epI + 1] ? function () { playEp(epI + 1); } : null);
      navigator.mediaSession.setActionHandler("previoustrack", epI > 0 ? function () { playEp(epI - 1); } : null);
    } catch (x) {}
  }
  /* ---------- ادامه از همان‌جا که قطع شد (حافظه‌ی همین دستگاه؛ PPMem در pp-memory.js) ---------- */
  function srcKey() { var s = audioEl && audioEl.getAttribute("src"); return s ? (window.PPMem ? window.PPMem.norm(s) : s) : ""; }
  function saveProg(quiet) {
    if (!window.PPMem || !audioEl || mode !== "audio") return;
    var a = srcKey(); if (!a) return;
    var t = audioEl.currentTime || 0, d = audioEl.duration;
    if (!isFinite(d) || d <= 0 || t < 3) return;              // هنوز بارگذاری نشده یا تازه شروع شده
    var cur = eps[epI] || {}, done = d - t < 15;
    window.PPMem.setProg(a, { t: done ? 0 : Math.floor(t), d: Math.floor(d), e: cur.t || "", p: titleEl.textContent || "", eu: curEpsUrl || "", done: done }, quiet);
    lastSave = Date.now();
  }
  function showHint(t) {
    if (!hintEl) return;
    hintEl.textContent = "ادامه از " + fmtT(t) + " · از ابتدا";
    hintEl.hidden = false;
    clearTimeout(hintT); hintT = setTimeout(function () { hintEl.hidden = true; }, 7000);
  }

  function playEp(i) {
    if (!eps[i]) return;
    saveProg(false);                                   // موقعیت قسمت قبلی
    epI = i;
    var e = eps[i];
    nowEl.textContent = e.t || "";
    if (epTEl) { epTEl.textContent = e.t || ""; epTEl.title = e.t || ""; }
    showStatus("");
    audioEl.src = e.a;
    pendingSeek = window.PPMem ? window.PPMem.resumeAt(window.PPMem.norm(e.a)) : 0;   // اگر قبلاً نیمه‌کاره مانده بود
    applyRate();
    var pr = audioEl.play(); if (pr && pr.catch) pr.catch(function () {});   // اگر مرورگر پخش خودکار را نداد، کاربر با دکمه‌ی پخش شروع می‌کند
    renderEps(); mediaMeta(e);
  }
  function stopFrame() {
    clearTimeout(watchdog);
    if (frame) { frame.setAttribute("src", "about:blank"); frame.removeAttribute("src"); }
    curSrc = ""; loaded = false;
  }
  function stopAudio() {
    saveProg(false);
    clearSleep(); curEpsUrl = "";
    if (!audioEl) return;
    audioEl.pause(); audioEl.removeAttribute("src"); try { audioEl.load(); } catch (e) {}
  }
  function openAudio(opts, list) {
    build();
    stopFrame(); setMode("audio");
    var idx = Math.max(0, Math.min(list.length - 1, (opts && opts.index) | 0));
    var same = eps.length && eps[0].a === list[0].a && audioEl.getAttribute("src") === list[idx].a;
    eps = list;
    titleEl.textContent = (opts && opts.title) || "در حال پخش";
    if (podEl) podEl.textContent = titleEl.textContent;
    var ext = safeUrl(opts && opts.page);
    if (ext) { pageLink.href = ext; pageLink.hidden = false; } else { pageLink.hidden = true; }
    if (infoA) { infoA.hidden = !ext; if (ext) infoA.href = ext; }
    root.hidden = false;
    document.body.classList.add("ppfp-open");
    setMin(false);
    applyGeometry();
    if (same) { epI = idx; renderEps(); var pr = audioEl.play(); if (pr && pr.catch) pr.catch(function () {}); }
    else playEp(idx);
    loadAllEps(opts && opts.epsUrl);
  }
  /* فهرست کامل قسمت‌ها (assets/eps/<slug>.json) بعد از شروع پخش بار می‌شود و جای فهرست کوتاه می‌نشیند */
  function fetchEps(url) {
    return fetch(url, { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { return cleanEps(j); });
  }
  function loadAllEps(url) {
    curEpsUrl = url || "";
    if (!url || !window.fetch) return;
    fetchEps(url).then(function (list) {
      if (curEpsUrl !== url || mode !== "audio" || list.length <= eps.length) return;
      var cur = audioEl.getAttribute("src"), at = -1;
      list.forEach(function (e, i) { if (e.a === cur) at = i; });
      eps = list; epI = at > -1 ? at : 0;
      renderEps();
    }).catch(function () {});
  }

  function open(opts) {
    var list = cleanEps(opts && opts.eps);
    if (list.length) return openAudio(opts, list);
    var src = safeUrl(opts && opts.src);
    if (!src) return;
    build();
    stopAudio(); setMode("frame"); eps = [];
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
    stopAudio(); eps = [];
    showStatus("");
    root.hidden = true;
    document.body.classList.remove("ppfp-open", "ppfp-min", "ppfp-pill");
    root.classList.remove("ppfp--pill");
    setPop(false);
  }

  function isOpen() { return !!root && !root.hidden; }

  // اتصال خودکار: هر عنصری با data-pp-embed
  document.addEventListener("click", function (e) {
    var au = e.target.closest("[data-pp-audio]");
    if (au) {
      e.preventDefault();
      var box = au.closest("[data-pp-playlist]") || au.parentNode;
      var items = Array.prototype.slice.call(box.querySelectorAll("[data-pp-audio]"));
      open({
        eps: items.map(function (x) { return { t: x.getAttribute("data-t") || x.textContent.trim(), a: x.getAttribute("data-pp-audio") }; }),
        index: items.indexOf(au),
        title: box.getAttribute("data-title") || "",
        page: box.getAttribute("data-page") || "",
        epsUrl: box.getAttribute("data-eps-url") || "",
      });
      return;
    }

    var el = e.target.closest("[data-pp-embed]");
    if (!el) return;
    e.preventDefault();
    open({
      src: el.getAttribute("data-pp-embed"),
      title: el.getAttribute("data-title") || el.textContent.trim(),
      page: el.getAttribute("data-page") || "",
    });
  });

  /* ---------- فهرست قسمت‌ها: اسکرولی؛ با نزدیک شدن به ته، قسمت‌های بعدی اضافه می‌شوند ---------- */
  var CHUNK = 40, PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  function epLi(ep) {
    var li = document.createElement("li"), b = document.createElement("button"), sp = document.createElement("span");
    b.type = "button"; b.setAttribute("data-pp-audio", ep.a); b.setAttribute("data-t", ep.t || ""); b.title = ep.t || "";
    b.innerHTML = PLAY_ICON; sp.textContent = ep.t || ""; b.appendChild(sp); li.appendChild(b);
    return li;
  }
  function fillList(ul, list, skipUrl) {
    var items = (list || []).filter(function (e) { return e && e.a && e.a !== skipUrl; }), n = 0;
    function more() { var end = Math.min(items.length, n + CHUNK); for (; n < end; n++) ul.appendChild(epLi(items[n])); }
    if (ul._ppScroll) ul.removeEventListener("scroll", ul._ppScroll);
    ul.innerHTML = ""; more();
    ul._ppScroll = function () { if (n < items.length && ul.scrollTop + ul.clientHeight > ul.scrollHeight - 140) more(); };
    ul.addEventListener("scroll", ul._ppScroll, { passive: true });
  }
  /* صفحه‌ی پادکست: فهرست کامل خودکار بار می‌شود (بدون دکمه)؛ تا آماده شدن، ۸ قسمت اول دیده می‌شود */
  function autoLists() {
    if (!window.fetch) return;
    var boxes = document.querySelectorAll("[data-pp-auto][data-eps-url]:not([data-pp-done])");
    Array.prototype.forEach.call(boxes, function (box) {
      box.setAttribute("data-pp-done", "1");
      var ul = box.querySelector(".pp-eplist"), first = box.querySelector("[data-pp-audio]");
      if (!ul) return;
      fetchEps(box.getAttribute("data-eps-url")).then(function (list) {
        if (list.length > ul.children.length + 1) fillList(ul, list, first ? first.getAttribute("data-pp-audio") : "");
      }).catch(function () {});
    });
  }
  var autoQueued = false;
  function queueAuto() { if (autoQueued) return; autoQueued = true; requestAnimationFrame(function () { autoQueued = false; autoLists(); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", queueAuto); else queueAuto();
  if (window.MutationObserver) new MutationObserver(queueAuto).observe(document.body || document.documentElement, { childList: true, subtree: true });   // با تعویض صفحه‌ها بدون بارگذاری کامل هم کار می‌کند

  window.PPPlayer = { open: open, close: close, reload: reload, isOpen: isOpen, fillList: fillList, minimize: function () { build(); setMin(true); } };
})();
