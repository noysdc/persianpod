/* PersianPod: جست‌وجوی قسمت‌ها (عنوان + توضیح) روی ایندکس تکه‌تکه‌ی assets/sidx
   مرورگر فقط این‌ها را می‌خواند: meta.json (یک‌بار) + یک شارد برای هر کلمه‌ی جست‌وجو + چند فایل کوچک برای نمایش نتیجه‌ها.
   نیاز: pp-search-core.js (نرمال‌سازی و ریشه‌یابی همان است که ایندکس با آن ساخته شده).
   API:  PPEpSearch.search(q, {limit: 20}) → Promise<{
           results: [{slug, ep, title, snippet, score, hits}],   // ep = شماره از قدیمی‌ترین قسمت پادکست (۰ = اولین)
           matched: تعداد قسمت‌هایی که همه‌ی کلمه‌های پیداشده را دارند؛ partial=true یعنی همه‌ی کلمه‌ها جور نشد
                    (یا قسمتی با همه‌شان نیست، یا کلمه‌هایی در missing اصلاً در ایندکس نیستند),
           total: تعداد همه‌ی قسمت‌هایی که دست‌کم یکی از کلمه‌ها را دارند,
           tokens: کلمه‌های جست‌وجوشده, ignored: کلمه‌های خیلی رایجی که نادیده گرفته شدند, tooCommon: true اگر فقط رایج بود }>
         PPEpSearch.url(slug) → آدرس صفحه‌ی پادکست */
(function () {
  "use strict";
  var BASE = String(window.PP_DATA_URL || "/podcasts.json").replace(/podcasts\.json.*$/, "") + "assets/sidx/";
  var cache = {};                    // آدرس → Promise (هر فایل فقط یک‌بار گرفته می‌شود)

  function getJSON(path) {
    if (!cache[path]) {
      cache[path] = fetch(BASE + path).then(function (r) {
        if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
        return r.json();
      });
      cache[path].catch(function () { delete cache[path]; });      // خطا کش نشود
    }
    return cache[path];
  }
  function getOptional(path) {            // فایل نبودن (۴۰۴) یعنی «چیزی نیست»، نه خطا
    return getJSON(path).catch(function (e) { if (e && e.status === 404) return {}; throw e; });
  }

  function prefixName(tk, n) {
    var out = "";
    for (var i = 0; i < n; i++) out += ("0000" + tk.charCodeAt(i).toString(16)).slice(-4);
    return out;
  }
  function decode(enc) {                  // اختلاف‌های مبنای ۳۶ → مقدارهای doc*2+inTitle
    var out = [], acc = 0, parts = enc.split(",");
    for (var i = 0; i < parts.length; i++) { acc += parseInt(parts[i], 36); out.push(acc); }
    return out;
  }

  function tokenize(q) {
    var core = window.PPSearch;
    if (!core || !core._tokens) throw new Error("pp-search-core.js باید قبل از pp-ep-search.js بار شود");
    var seen = {}, out = [];
    core._tokens(q).forEach(function (t) { if (t.length >= 2 && !seen[t]) { seen[t] = 1; out.push(t); } });
    return out.slice(0, 8);               // بیش از هشت کلمه معنایی ندارد
  }

  /* پست‌های یک کلمه: تطابق دقیق؛ اگر نبود و کلمه ≥۳ حرف است، کلمه‌هایی که با آن شروع می‌شوند (حداکثر ۸ کلمه، وزن کمتر) */
  function lookup(meta, tk) {
    if (tk.length < meta.prefix) return Promise.resolve(null);
    return getOptional("t/" + prefixName(tk, meta.prefix) + ".json").then(function (shard) {
      if (shard[tk]) return [{ list: decode(shard[tk]), w: 1 }];
      if (tk.length < 3) return null;
      var keys = Object.keys(shard).filter(function (k) { return k.indexOf(tk) === 0; }).sort().slice(0, 8);
      return keys.length ? keys.map(function (k) { return { list: decode(shard[k]), w: 0.5 }; }) : null;
    });
  }

  function search(q, opts) {
    var limit = (opts && opts.limit) || 20;
    var tks = tokenize(q);
    if (!tks.length) return Promise.resolve({ results: [], matched: 0, partial: false, missing: [], total: 0, tokens: [], ignored: [], tooCommon: false });
    return getJSON("meta.json").then(function (meta) {
      var common = {}; meta.common.forEach(function (c) { common[c] = 1; });
      var ignored = tks.filter(function (t) { return common[t]; });
      var active = tks.filter(function (t) { return !common[t]; });
      if (!active.length) return { results: [], matched: 0, partial: false, missing: [], total: 0, tokens: tks, ignored: ignored, tooCommon: true };

      return Promise.all(active.map(function (t) { return lookup(meta, t); })).then(function (found) {
        var score = {}, hits = {};
        found.forEach(function (groups) {
          if (!groups) return;
          var thisTok = {};               // هر کلمه برای هر قسمت فقط یک‌بار در hits حساب شود
          groups.forEach(function (g) {
            g.list.forEach(function (v) {
              var doc = v >> 1, inTitle = v & 1;
              score[doc] = (score[doc] || 0) + g.w * (inTitle ? 3 : 1);
              if (!thisTok[doc]) { thisTok[doc] = 1; hits[doc] = (hits[doc] || 0) + 1; }
            });
          });
        });
        var need = found.filter(Boolean).length;            // کلمه‌ای که اصلاً در ایندکس نیست (غلط املایی…) شرط حساب نمی‌شود…
        var missing = active.filter(function (t, i) { return !found[i]; });   // …ولی گزارش می‌شود تا رابط صادقانه بگوید
        var docs = Object.keys(score).map(Number);
        docs.sort(function (a, b) { return hits[b] - hits[a] || score[b] - score[a] || b - a; });
        var matched = 0;
        while (matched < docs.length && hits[docs[matched]] === need) matched++;
        var partial = matched === 0 || missing.length > 0;
        var top = docs.slice(0, Math.min(limit, matched === 0 ? docs.length : matched));

        // عنوان و خلاصه از فایل‌های d/ (قسمت‌های یک پادکست کنار هم‌اند، پس معمولاً چند فایل کم)
        var need = {};
        top.forEach(function (d) {
          var si = Math.floor(d / meta.block), old = d % meta.block;
          need[si + "-" + Math.floor(old / meta.dchunk)] = 1;
        });
        var names = Object.keys(need);
        return Promise.all(names.map(function (n) { return getOptional("d/" + n + ".json"); })).then(function (files) {
          var byName = {}; names.forEach(function (n, i) { byName[n] = files[i]; });
          var results = [];
          top.forEach(function (d) {
            var si = Math.floor(d / meta.block), old = d % meta.block, n = Math.floor(old / meta.dchunk);
            var f = byName[si + "-" + n], row = f && f[old - n * meta.dchunk];
            if (!row) return;             // فایل نمایش هنوز نیست (ایندکس نیمه‌کاره)؛ ردیف را نشان نده
            // عنوانِ خالی در RSS بعضی پادکست‌ها واقعاً هست؛ ردیف می‌ماند و رابط جایگزین می‌گذارد
            results.push({ slug: meta.slugs[si], ep: old, title: row[0], snippet: row[1], score: score[d], hits: hits[d] });
          });
          return { results: results, matched: matched, partial: partial, missing: missing, total: docs.length, tokens: tks, ignored: ignored, tooCommon: false };
        });
      });
    });
  }

  window.PPEpSearch = {
    search: search,
    url: function (slug) { return "/podcasts/" + slug + "/"; }
  };
})();
