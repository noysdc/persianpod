/* PersianPod: ترتیب منصفانه‌ی پادکست‌ها (مشترک بین صفحه‌ی اصلی و «گوش بده»)

   قاعده‌ها
   1) چرخش دایره‌ای روزانه (به وقت تهران): ترتیب پایه‌ی هر گروه ثابت است (بر اساس هش شناسه) و
      نقطه‌ی شروع هر روز یک ردیف (STEP) جلو می‌رود. پس برای همه‌ی بازدیدکننده‌های یک روز ترتیب یکسان است،
      فردا عوض می‌شود، و در طول زمان همه‌ی پادکست‌ها به‌اندازه‌ی هم به ردیف اول می‌رسند.
   2) فعال‌ها اول، غیرفعال‌ها (بیش از ۳ سال بدون قسمت) بعد؛ هرکدام چرخش جدا. هیچ‌کس حذف نمی‌شود.
   3) «جدید»: اولین قسمت (first_at، از RSS) کمتر از NEW_DAYS روز پیش و پادکست فعال باشد.
      جدیدها تا NEW_SLOTS جایگاه ابتدای فهرست را می‌گیرند (بین خودشان هم روزانه می‌چرخند)؛ NEW_SLOTS = 0 خاموشش می‌کند.
   scope: نام صفحه/دسته؛ برای اینکه ردیف اول هر دسته و هر صفحه با بقیه فرق کند. */
(function () {
  var NEW_DAYS = 90, NEW_SLOTS = 2, STEP = 6, KEY_STEP = 3;

  function hash(s) {                                   // FNV-1a ۳۲ بیتی
    s = String(s);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function dayNumber() {                               // شماره‌ی روز به وقت تهران؛ نیمه‌شب تهران همه با هم عوض می‌شوند
    var y, m, d;
    try {
      var p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-");
      y = +p[0]; m = +p[1]; d = +p[2];
    } catch (e) { var n = new Date(); y = n.getFullYear(); m = n.getMonth() + 1; d = n.getDate(); }
    return Math.floor(Date.UTC(y, m - 1, d) / 864e5);
  }
  function keyOf(p) { return String(p.slug || p.id || p._id || p.url || p.title || ""); }
  function isActive(p) { return p._active != null ? !!p._active : String(p.status || "active") === "active"; }
  function isNew(p) {
    if (!p || !p.first_at) return false;
    var t = Date.parse(p.first_at);
    if (isNaN(t)) return false;
    var age = Date.now() - t;
    return age >= 0 && age <= NEW_DAYS * 864e5 && isActive(p);
  }
  function base(list) {                                // ترتیب پایه‌ی ثابت
    return list.map(function (p) { var k = keyOf(p); return { p: p, k: k, h: hash(k) }; })
      .sort(function (a, b) { return a.h - b.h || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0); })
      .map(function (x) { return x.p; });
  }
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function stepFor(n, step) {                          // گامی نزدیک به step که با n نسبت به هم اول باشد باشد تا نوبت اول هم دقیقاً برابر بچرخد
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
    var news = [], act = [], off = [];
    list.forEach(function (p) { if (!isActive(p)) off.push(p); else if (isNew(p)) news.push(p); else act.push(p); });
    news = rotate(base(news), scope + "|new", STEP);
    var front = news.slice(0, NEW_SLOTS);
    act = rotate(base(act.concat(news.slice(NEW_SLOTS))), scope + "|act", STEP);
    off = rotate(base(off), scope + "|off", STEP);
    return front.concat(act, off);
  }
  function orderKeys(keys, scope) {                    // ترتیب دسته‌ها: همان چرخش روزانه
    var b = keys.map(function (k) { return { k: k, h: hash(k) }; })
      .sort(function (a, c) { return a.h - c.h || (a.k < c.k ? -1 : a.k > c.k ? 1 : 0); })
      .map(function (x) { return x.k; });
    return rotate(b, (scope || "cats") + "|keys", KEY_STEP);
  }

  window.PPOrder = { order: order, orderKeys: orderKeys, isNew: isNew, dayNumber: dayNumber, NEW_DAYS: NEW_DAYS, NEW_SLOTS: NEW_SLOTS };
})();
