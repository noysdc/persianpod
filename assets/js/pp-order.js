/* PersianPod: ترتیب منصفانه‌ی پادکست‌ها (مشترک بین صفحه‌ی اصلی و «گوش بده»)

   قاعده‌ها
   1) چرخش دایره‌ای روزانه (به وقت تهران): ترتیب پایه‌ی هر گروه ثابت است (بر اساس هش شناسه) و
      نقطه‌ی شروع هر روز یک گام جلو می‌رود. برای همه‌ی بازدیدکننده‌های یک روز ترتیب یکسان است.
   2) فقط پادکست‌هایی که وضعیت صریحاً active دارند در چرخه‌ی فعال‌ها هستند.
      تمام وضعیت‌های دیگر (از جمله inactive، paused و stopped) در چرخه‌ی جداگانه‌ی انتهایی می‌مانند.
   3) مرز دو گروه هرگز جابه‌جا نمی‌شود؛ چرخش یک گروه روی گروه دیگر اثر ندارد.
   scope: نام صفحه/دسته؛ برای اینکه ترتیب هر دسته مستقل باشد. */
(function () {
  "use strict";
  var STEP = 6, KEY_STEP = 3;

  function hash(s) {                                   // FNV-1a ۳۲ بیتی
    s = String(s);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function dayNumber() {                               // شماره‌ی روز به وقت تهران
    var y, m, d;
    try {
      var p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-");
      y = +p[0]; m = +p[1]; d = +p[2];
    } catch (e) { var n = new Date(); y = n.getFullYear(); m = n.getMonth() + 1; d = n.getDate(); }
    return Math.floor(Date.UTC(y, m - 1, d) / 864e5);
  }
  function keyOf(p) { return String(p.slug || p.id || p._id || p.url || p.title || ""); }

  function isActive(p) {
    // اگر status موجود باشد، فقط active (یا معادل فارسی آن) فعال محسوب می‌شود.
    // عمداً از Boolean(value) استفاده نمی‌کنیم؛ چون رشته‌ی "false" و "inactive" هم truthy هستند.
    if (p && p.status != null && String(p.status).trim() !== "") {
      var status = String(p.status).trim().toLowerCase();
      return status === "active" || status === "فعال";
    }
    // سازگاری با داده‌های آماده‌شده‌ی صفحه‌ی فهرست
    if (p && typeof p._active === "boolean") return p._active;
    if (p && typeof p._active === "string") {
      var flag = p._active.trim().toLowerCase();
      return flag === "true" || flag === "active" || flag === "فعال";
    }
    return true; // نبودن وضعیت، مانند قبل، فعال در نظر گرفته می‌شود.
  }

  function isNew() { return false; }
  function base(list) {                                // ترتیب پایه‌ی ثابت
    return list.map(function (p) { var k = keyOf(p); return { p: p, k: k, h: hash(k) }; })
      .sort(function (a, b) { return a.h - b.h || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0); })
      .map(function (x) { return x.p; });
  }
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function stepFor(n, step) {
    for (var s = step; s < step + n; s++) if (gcd(s, n) === 1) return s;
    return 1;
  }
  function rotate(arr, salt, step) {
    var n = arr.length;
    if (n < 2) return arr;
    var k = (((dayNumber() * stepFor(n, step) + hash(salt)) % n) + n) % n;
    return arr.slice(k).concat(arr.slice(0, k));
  }

  function order(list, scope) {
    scope = scope || "all";
    var active = [], inactive = [];
    list.forEach(function (p) {
      if (isActive(p)) active.push(p);
      else inactive.push(p);
    });

    // دو چرخش کاملاً مستقل: هیچ عضو گروه غیرفعال وارد چرخه‌ی فعال‌ها نمی‌شود.
    var activeOrder = rotate(base(active), scope + "|active", STEP);
    var inactiveOrder = rotate(base(inactive), scope + "|inactive", STEP);
    return activeOrder.concat(inactiveOrder);
  }

  function orderKeys(keys, scope) {
    var b = keys.map(function (k) { return { k: k, h: hash(k) }; })
      .sort(function (a, c) { return a.h - c.h || (a.k < c.k ? -1 : a.k > c.k ? 1 : 0); })
      .map(function (x) { return x.k; });
    return rotate(b, (scope || "cats") + "|keys", KEY_STEP);
  }

  window.PPOrder = { order: order, orderKeys: orderKeys, isNew: isNew, dayNumber: dayNumber, NEW_DAYS: 0, NEW_SLOTS: 0 };
})();