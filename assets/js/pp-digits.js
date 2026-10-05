/*
  اعداد در پرشین‌پاد
  قاعده: در فایل‌ها و داده‌ها همیشه عدد لاتین (1403)؛ هنگام نمایش فارسی (۱۴۰۳).
  دلیل: فیلتر، مرتب‌سازی و پارس‌کردن عدد با ارقام فارسی خراب می‌شود.

  PPDigits.fa(x)     -> ارقام فارسی (برای نمایش)
  PPDigits.en(x)     -> ارقام لاتین (برای جست‌وجو و فیلتر؛ فارسی و عربی را هم می‌خواند)
  PPDigits.num(x)    -> عدد (NaN اگر عدد نبود)؛ "۴۰ دقیقه" و "40 دقیقه" هر دو 40
  PPDigits.convertDom(root) -> تبدیل متن‌های صفحه به ارقام فارسی
  PPDigits.faDate("2026-09") -> "شهریور ۱۴۰۵" (تاریخ شمسی از مقدار میلادی)
*/
(function () {
  "use strict";

  var FA = "۰۱۲۳۴۵۶۷۸۹";
  var AR = "٠١٢٣٤٥٦٧٨٩";

  function fa(x) {
    return String(x == null ? "" : x).replace(/\d/g, function (d) {
      return FA[+d];
    });
  }

  function en(x) {
    return String(x == null ? "" : x)
      .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); });
  }

  function num(x) {
    var m = en(x).replace(/[,٬،\s]/g, "").match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }

  // کلمه‌ی لاتین (مثل ADE 651 یا آدرس‌ها) دست‌نخورده می‌ماند؛ فقط عددهای متن فارسی تبدیل می‌شوند.
  var TOKEN = /[A-Za-z][A-Za-z0-9._\-\/:@%#?=&+]*(?:[ \t]+\d+)?|\d+/g;
  var SKIP = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, KBD: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1 };

  function convertText(s) {
    return s.replace(TOKEN, function (t) {
      return /^\d+$/.test(t) ? fa(t) : t;
    });
  }

  function convertDom(root) {
    root = root || document.body;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!/\d/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        for (var p = n.parentNode; p && p !== root; p = p.parentNode) {
          if (SKIP[p.nodeName] || (p.hasAttribute && p.hasAttribute("data-keep-digits")))
            return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (t) { t.nodeValue = convertText(t.nodeValue); });
  }

  // "2026-09" یا "2026-09-14" (میلادی) -> "شهریور ۱۴۰۵"
  function faDate(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!m) return fa(iso);
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 15, 12));
    var parts = {};
    new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric", month: "long", day: "numeric", timeZone: "UTC"
    }).formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
    // ترتیب ثابت: [روز] ماه سال (مستقل از نسخه‌ی مرورگر)
    return (m[3] ? parts.day + " " : "") + parts.month + " " + parts.year;
  }

  window.PPDigits = { fa: fa, en: en, num: num, convertDom: convertDom, faDate: faDate };

  // اجرای خودکار روی محتوای صفحه (برای خاموش‌کردن: <html data-no-digits>)
  function auto() {
    if (document.documentElement.hasAttribute("data-no-digits")) return;
    convertDom(document.body);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
  else auto();
})();
