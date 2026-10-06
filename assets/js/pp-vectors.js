/*
  وکتور تصادفی پرشین‌پاد
  - در هر بار بارگذاری یک آیکون خطی مینیمال و مرتبط با پادکست، داخل هر ستون کناری
  - پشت محتوا، کم‌رنگ، غیرقابل کلیک، مخفی برای صفحه‌خوان
  - آیکون‌های بار قبل تکرار نمی‌شوند
  - خاموش‌کردن در یک صفحه: <body data-no-vector>
*/
(function () {
  "use strict";

  var S = 'viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

  var ICONS = [
    // میکروفون
    '<svg ' + S + '><rect x="24" y="8" width="16" height="30" rx="8"/><path d="M16 30v2a16 16 0 0 0 32 0v-2M32 48v8M24 56h16"/></svg>',
    // هدفون
    '<svg ' + S + '><path d="M10 40V32a22 22 0 0 1 44 0v8"/><rect x="8" y="38" width="10" height="16" rx="4"/><rect x="46" y="38" width="10" height="16" rx="4"/></svg>',
    // موج صوتی
    '<svg ' + S + '><path d="M8 32v0M16 24v16M24 14v36M32 22v20M40 10v44M48 24v16M56 32v0"/></svg>',
    // پخش زنده (میکروفون با موج)
    '<svg ' + S + '><circle cx="32" cy="30" r="5"/><path d="M22 20a14 14 0 0 0 0 20M42 20a14 14 0 0 1 0 20M14 12a26 26 0 0 0 0 36M50 12a26 26 0 0 1 0 36M32 35v20"/></svg>',
    // رادیو
    '<svg ' + S + '><rect x="8" y="22" width="48" height="30" rx="5"/><path d="M14 22l32-12"/><circle cx="24" cy="37" r="7"/><path d="M38 33h12M38 40h12"/></svg>',
    // بلندگو
    '<svg ' + S + '><path d="M10 26h10l14-12v36L20 38H10z"/><path d="M42 24a11 11 0 0 1 0 16M48 18a19 19 0 0 1 0 28"/></svg>',
    // کاست
    '<svg ' + S + '><rect x="8" y="14" width="48" height="36" rx="5"/><circle cx="22" cy="30" r="5"/><circle cx="42" cy="30" r="5"/><path d="M20 44h24l-4-8H24z"/></svg>',
    // پلی در دایره
    '<svg ' + S + '><circle cx="32" cy="32" r="22"/><path d="M27 22l16 10-16 10z"/></svg>',
    // حباب گفت‌وگو با موج
    '<svg ' + S + '><path d="M10 14h44a2 2 0 0 1 2 2v26a2 2 0 0 1-2 2H30l-12 10V44h-8a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2z"/><path d="M20 29v0M26 25v8M32 22v14M38 25v8M44 29v0"/></svg>',
    // ایربادز
    '<svg ' + S + '><path d="M20 10a8 8 0 0 1 8 8v16a4 4 0 0 1-8 0V28a8 8 0 0 1 0-18zM44 10a8 8 0 0 0-8 8v16a4 4 0 0 0 8 0V28a8 8 0 0 0 0-18z" transform="translate(0 8)"/></svg>',
    // RSS و پخش
    '<svg ' + S + '><circle cx="16" cy="48" r="4"/><path d="M12 28a24 24 0 0 1 24 24M12 12a40 40 0 0 1 40 40"/></svg>',
    // هدست با میکروفون
    '<svg ' + S + '><path d="M12 36V30a20 20 0 0 1 40 0v6"/><rect x="8" y="34" width="10" height="14" rx="4"/><rect x="46" y="34" width="10" height="14" rx="4"/><path d="M51 48v2a6 6 0 0 1-6 6H34"/></svg>'
  ];

  // دو آیکون متفاوت، بدون تکرار آیکون‌های بار قبل
  function pickTwo() {
    var last = [];
    try { last = JSON.parse(sessionStorage.getItem("pp-vec") || "[]"); } catch (e) {}
    var pool = ICONS.map(function (_, i) { return i; }).filter(function (i) { return last.indexOf(i) === -1; });
    var out = [];
    while (out.length < 2 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    try { sessionStorage.setItem("pp-vec", JSON.stringify(out)); } catch (e) {}
    return out;
  }

  function init() {
    if (document.body.hasAttribute("data-no-vector")) return;
    if (document.querySelector(".pp-vector")) return;
    // ستون‌های کناری: راست (محتوای کناری) و چپ (فیلترها، فقط صفحه‌ی فهرست)
    var hosts = [document.querySelector(".pp-side"), document.querySelector(".pp-filters-side")]
      .filter(Boolean);
    var picks = pickTwo();
    hosts.forEach(function (host, n) {
      var el = document.createElement("div");
      el.className = "pp-vector";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = ICONS[picks[n % picks.length]];
      host.appendChild(el);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
