/* PersianPod: موتور جست‌وجو (مشترک بین فهرست، هدر و پیشنهادهای خودکار)
   - نرمال‌سازی فارسی، حذف کلمه‌های کم‌ارزش («پادکست»، «با»، «اپیزود»…) و ریشه‌یابی سبک
   - فهم عبارت: «کوتاه»، «بلند»، «بیش از ۳۰ دقیقه»، «فعال»، «متوقف»، «پرقسمت»، «قدیمی»…
   - رتبه‌بندی وزنی (نام > سازنده > برچسب > دسته > توضیح > متن مقاله)، غلط‌یابی و هم‌معنی‌ها
   API: PPSearch.build(list) · PPSearch.create() (نمونه‌ی جدا برای صفحه‌هایی مثل «گوش بده») · search(q, {intents:false}) · suggest(q) · norm(s) */
(function () {
  "use strict";
  function make() {
  var FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩";
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
  function digits(s) {
    return String(s == null ? "" : s).replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); });
  }
  function norm(s) {
    return digits(s).replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ؤ/g, "و")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[\u200c\u200f\u200e]/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").toLowerCase().trim();
  }
  function num(v) { var m = digits(v).match(/\d+/); return m ? parseInt(m[0], 10) : null; }

  /* کلمه‌هایی که معنای جست‌وجو را عوض نمی‌کنند (همه‌چیز اینجا «پادکست فارسی» است) */
  var STOP = {};
  ("پادکست پادکستی پادکستها پادکستهای با و یا یا از در به برای که این آن اون یک را تا هم می رو من میخوام میخواهم بده بدی بهم دنبال " +
   "چیزی چیز مثل مثلا مثلاً درباره راجع در مورد اپیزود اپیزودها اپیزودهای قسمت قسمتها قسمتهای فارسی بهترین خوب خوبی معرفی پیشنهاد خیلی کمی " +
   "های ها هایی هاش هست هستن باشه باشد دارای داره دارد کدوم کدام ببینم پیدا کن کنید کنم").split(" ").forEach(function (w) { if (w) STOP[norm(w)] = 1; });

  /* ریشه‌یابی سبک: «داستانی» ≈ «داستان»، «پادکست‌ها» ≈ «پادکست» */
  function stem(w) {
    if (w.length > 5 && /(های|ها)$/.test(w)) w = w.replace(/(های|ها)$/, "");
    else if (w.length > 4 && /(ان|ات)$/.test(w)) w = w.replace(/(ان|ات)$/, "");
    if (w.length >= 5 && /ی$/.test(w)) w = w.slice(0, -1);
    return w;
  }
  function tokens(s, keepStop) {
    var out = [];
    norm(s).split(" ").forEach(function (w) {
      if (!w || (!keepStop && STOP[w])) return;
      out.push(stem(w));
    });
    return out;
  }

  /* هم‌معنی‌ها: هر گروه یک مفهوم است؛ کلمه‌ی کاربر با بقیه‌ی گروه هم (با وزن کمتر) جور می‌شود */
  var GROUPS = [
    "داستان قصه روایت روایی قصه‌گویی داستانی افسانه",
    "جنایی جنایت قتل پلیسی کارآگاه پرونده",
    "تاریخ تاریخی باستان گذشته",
    "روانشناسی روان ذهن روانکاوی خودشناسی توسعه‌فردی رشد انگیزشی",
    "کتاب کتابخوانی چکیده خلاصه",
    "هنر نقاشی طراحی عکاسی",
    "علم علمی دانشمند فناوری تکنولوژی",
    "جامعه اجتماعی سیاست سیاسی جامعه‌شناسی فرهنگ",
    "مستند مستندی گزارش تحقیقی",
    "طنز کمدی خنده سرگرمی شوخی",
    "اقتصاد بیزینس کسب‌وکار استارتاپ مالی سرمایه",
    "مصاحبه گفتگو گفت‌وگو",
    "ادبیات شعر رمان شاعر نویسنده",
    "کودک کودکانه نوجوان",
    "جاسوسی جاسوس امنیتی اطلاعاتی",
    "مهاجرت مهاجر غربت خارج",
    "رابطه ازدواج عشق خانواده",
    "زنان زن فمینیسم"
  ].map(function (g) { return g.split(" ").map(function (w) { return stem(norm(w)); }); });
  var SYN = {};
  GROUPS.forEach(function (g, i) { g.forEach(function (w) { (SYN[w] = SYN[w] || []).push(i); }); });
  function synonyms(w) {
    var out = {}, gs = SYN[w] || [];
    gs.forEach(function (i) { GROUPS[i].forEach(function (x) { if (x !== w) out[x] = 1; }); });
    return Object.keys(out);
  }

  var jy = parseInt(new Intl.DateTimeFormat("fa-IR-u-nu-latn", { year: "numeric" }).format(new Date()), 10) || 1405;
  var SHORT_MAX = 25, LONG_MIN = 60;

  /* ---------- فهم عبارت ---------- */
  var INTENT_RULES = [
    { id: "short", dim: "len", label: "اپیزود کوتاه (تا " + toFa(SHORT_MAX) + " دقیقه)", re: /(?:^| )(?:کوتاه|مختصر|کپسولی|فشرده|سریع)(?= |$)/, test: function (p) { return p.len != null && p.len <= SHORT_MAX; } },
    { id: "long", dim: "len", label: "اپیزود بلند (از " + toFa(LONG_MIN) + " دقیقه)", re: /(?:^| )(?:بلند|طولانی|مفصل|مفصل|دراز)(?= |$)/, test: function (p) { return p.len != null && p.len >= LONG_MIN; } },
    { id: "active", dim: "status", label: "فعال", re: /(?:^| )(?:فعال|زنده|بروز|به روز)(?= |$)/, test: function (p) { return p.active; } },
    { id: "inactive", dim: "status", label: "غیرفعال", re: /(?:^| )(?:غیرفعال|متوقف|تمام شده|پایان یافته|تعطیل)(?= |$)/, test: function (p) { return !p.active; } },
    { id: "many", dim: "eps", label: "پرقسمت (بیش از ۱۰۰)", re: /(?:^| )(?:پر ?قسمت|پر ?اپیزود|زیاد ?قسمت)(?= |$)/, test: function (p) { return p.eps != null && p.eps >= 100; } },
    { id: "few", dim: "eps", label: "کم‌قسمت (تا ۲۰)", re: /(?:^| )(?:کم ?قسمت|کم ?اپیزود|مینی ?سریال)(?= |$)/, test: function (p) { return p.eps != null && p.eps <= 20; } },
    { id: "old", dim: "age", label: "قدیمی (شروع پیش از " + toFa(jy - 5) + ")", re: /(?:^| )(?:قدیمی|کهنه|پیشکسوت)(?= |$)/, test: function (p) { return p.yr != null && p.yr <= jy - 5; } },
    { id: "new", dim: "age", label: "نوپا (شروع از " + toFa(jy - 1) + ")", re: /(?:^| )(?:نوپا|تازه تاسیس|تازه راه افتاده)(?= |$)/, test: function (p) { return p.yr != null && p.yr >= jy - 1; } }
  ];
  /* عددی‌ها: «زیر ۱۵ دقیقه»، «بیش از ۳۰ دقیقه»، «۲۰ دقیقه‌ای»، «بیش از ۵۰ قسمت» */
  function numericIntents(q, found) {
    var rest = q, m;
    function take(re, fn) { rest = rest.replace(re, function () { fn.apply(null, arguments); return " "; }); }
    take(/(?:زیر|کمتر از|حداکثر|تا) (\d+) (?:دقیقه|min)(?: ?ای)?/g, function (_, n) { n = +n; found.push({ id: "len<=" + n, dim: "len", label: "تا " + toFa(n) + " دقیقه", test: function (p) { return p.len != null && p.len <= n; } }); });
    take(/(?:بالای|بیش از|بیشتر از|حداقل|بیش) (\d+) (?:دقیقه|min)(?: ?ای)?/g, function (_, n) { n = +n; found.push({ id: "len>=" + n, dim: "len", label: "از " + toFa(n) + " دقیقه", test: function (p) { return p.len != null && p.len >= n; } }); });
    take(/(\d+) (?:دقیقه ?ای|دقیقه)/g, function (_, n) { n = +n; found.push({ id: "len~" + n, dim: "len", label: "حدود " + toFa(n) + " دقیقه", test: function (p) { return p.len != null && Math.abs(p.len - n) <= Math.max(5, n * 0.25); } }); });
    take(/(?:بیش از|بیشتر از|بالای|حداقل) (\d+) (?:قسمت|اپیزود)/g, function (_, n) { n = +n; found.push({ id: "eps>=" + n, dim: "eps", label: "حداقل " + toFa(n) + " قسمت", test: function (p) { return p.eps != null && p.eps >= n; } }); });
    take(/(?:کمتر از|زیر|حداکثر) (\d+) (?:قسمت|اپیزود)/g, function (_, n) { n = +n; found.push({ id: "eps<=" + n, dim: "eps", label: "حداکثر " + toFa(n) + " قسمت", test: function (p) { return p.eps != null && p.eps <= n; } }); });
    take(/(?:از|بعد از|شروع) (?:سال )?(1[34]\d\d)(?: به بعد)?/g, function (_, n) { n = +n; found.push({ id: "yr>=" + n, dim: "age", label: "شروع از " + toFa(n), test: function (p) { return p.yr != null && p.yr >= n; } }); });
    return rest;
  }
  function parseIntents(qn) {
    var found = [], rest = numericIntents(" " + qn + " ", found).replace(/\s+/g, " ").trim();
    INTENT_RULES.forEach(function (r) {
      if (r.re.test(" " + rest + " ")) {
        found.push({ id: r.id, dim: r.dim, label: r.label, test: r.test });
        rest = (" " + rest + " ").replace(r.re, " ").replace(/\s+/g, " ").trim();
      }
    });
    return { intents: found, rest: rest };
  }
  function passIntents(p, intents) {                // در هر بُعد «یا»، بین بُعدها «و»
    var by = {};
    intents.forEach(function (i) { (by[i.dim] = by[i.dim] || []).push(i); });
    return Object.keys(by).every(function (d) { return by[d].some(function (i) { return i.test(p._sx); }); });
  }

  /* ---------- فهرست ---------- */
  var FIELDS = [["title", 10], ["title_en", 8], ["creator", 7], ["tags", 5], ["subs", 5], ["cat", 4], ["place", 3], ["desc", 3], ["lang", 2], ["body", 1]];
  var W = {}; FIELDS.forEach(function (f) { W[f[0]] = f[1]; });
  var LIST = [], BYID = {}, VOCAB = null;

  function build(list) {
    LIST = list || []; BYID = {}; VOCAB = null;
    LIST.forEach(function (p) {
      var tags = Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(/[,،]/) : []);
      var subs = Array.isArray(p.subcategories) ? p.subcategories : (p.subcategory ? [p.subcategory] : []);
      var y = num(p.start || p.year); if (y && y > 1700) y -= 621;
      var st = (p.status || "active");
      var texts = {
        title: p.title, title_en: p.title_en, creator: [p.creator, p.host].join(" "), tags: tags.join(" "), subs: subs.join(" "),
        cat: p.category, place: [p.city, p.country].join(" "), desc: p.description, lang: p.language, body: p.body
      };
      var ix = {}, raw = {};
      Object.keys(texts).forEach(function (k) {
        var t = tokens(texts[k] || "", false); raw[k] = norm(texts[k] || "");
        var set = {}; t.forEach(function (w) { set[w] = 1; });
        ix[k] = { list: Object.keys(set), n: raw[k] };
      });
      p._sx = { ix: ix, len: num(p.length), eps: num(p.episodes), yr: y || null, active: st === "active" };
      p._sid = p.slug || p.url || p.id || String(Math.random());
      BYID[p._sid] = p;
    });
  }

  /* ---------- فاصله‌ی ویرایشی کران‌دار (غلط‌یابی) ---------- */
  function within(a, b, max) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return false;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i; var best = cur[0];
      for (j = 1; j <= lb; j++) {
        var c = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) cur[j] = Math.min(cur[j], prev[j - 2] + 1);
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return false;
      var t = prev; prev = cur; cur = t;
    }
    return prev[lb] <= max;
  }
  /* کیفیت تطابق یک کلمه با فهرست کلمه‌های یک فیلد: ۱ دقیق، ۰٫۷۵ پیشوند، ۰٫۵ غلط‌یابی، ۰٫۴۵ زیررشته */
  function quality(t, words, fuzz) {
    var best = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w === t) return 1;
      if (t.length >= 2 && w.indexOf(t) === 0) best = Math.max(best, 0.75);
      else if (t.length >= 3 && w.indexOf(t) !== -1) best = Math.max(best, 0.45);
      else if (fuzz && best < 0.5) {
        var d = t.length >= 7 ? 2 : (t.length >= 4 ? 1 : 0);
        if (d && within(t, w, d)) best = Math.max(best, 0.5);
      }
    }
    return best;
  }
  function termScore(p, t, fuzz) {
    var syn = synonyms(t), best = 0, extra = 0;
    FIELDS.forEach(function (f) {
      var words = p._sx.ix[f[0]].list;
      var q = quality(t, words, fuzz && f[0] !== "body"), sq = 0;
      syn.forEach(function (s) { var x = quality(s, words, false); if (x === 1) sq = Math.max(sq, 0.6); });
      var v = Math.max(q, sq) * f[1];
      if (v > best) { extra += best * 0.2; best = v; } else extra += v * 0.2;
    });
    return best ? best + Math.min(extra, best * 0.5) : 0;
  }

  /* ---------- جست‌وجو ---------- */
  function search(q, opts) {
    opts = opts || {};
    var qn = norm(q), res = { score: {}, order: [], intents: [], terms: [], relaxed: false, ignoredIntents: false };
    if (!qn) return res;
    var parsed = parseIntents(qn), intents = opts.intents === false ? [] : parsed.intents;
    if (opts.intents === false) { parsed = { intents: parsed.intents, rest: qn }; res.ignoredIntents = parsed.intents.length > 0; res.intents = parsed.intents; }
    else res.intents = intents;
    var terms = tokens(parsed.rest, false);
    if (!terms.length && !intents.length) terms = tokens(qn, true);          // فقط کلمه‌های کم‌ارزش نوشته شده
    res.terms = terms;
    var phrase = terms.join(" ");

    function run(useIntents, minCover) {
      var out = [];
      LIST.forEach(function (p) {
        if (useIntents && intents.length && !passIntents(p, intents)) return;
        var sum = 0, hit = 0;
        terms.forEach(function (t) { var s = termScore(p, t, true); if (s > 0) { hit++; sum += s; } });
        if (terms.length) {
          if (!hit || hit < Math.ceil(terms.length * minCover)) return;
          var s2 = sum * (0.5 + 0.5 * hit / terms.length);
          if (terms.length > 1 && p._sx.ix.title.n.indexOf(phrase) !== -1) s2 += 25;           // عبارت کامل در نام
          else if (terms.length > 1 && (p._sx.ix.desc.n + " " + p._sx.ix.tags.n).indexOf(phrase) !== -1) s2 += 8;
          if (p._sx.ix.title.n === norm(q)) s2 += 40;
          out.push([p._sid, s2]);
        } else out.push([p._sid, 1]);                                                               // فقط فهم عبارت (مثلاً «کوتاه»)
      });
      return out;
    }
    var out = run(true, 0.6);
    if (!out.length && terms.length > 1) { out = run(true, 0); res.relaxed = out.length > 0; }
    if (!out.length && intents.length && terms.length) { out = run(false, 0.6); if (out.length) { res.relaxed = true; res.dropped = true; } }
    out.sort(function (a, b) { return b[1] - a[1]; });
    out.forEach(function (x) { res.score[x[0]] = x[1]; res.order.push(x[0]); });
    return res;
  }

  /* ---------- پیشنهاد خودکار ---------- */
  function vocab() {
    if (VOCAB) return VOCAB;
    var seen = {}, out = [];
    function add(label, type) { var n = norm(label); if (!n) return; var k = type + "|" + n; if (seen[k]) { seen[k].c++; return; } seen[k] = { label: label, n: n, type: type, c: 1 }; out.push(seen[k]); }
    LIST.forEach(function (p) {
      add(p.category, "cat");
      (Array.isArray(p.subcategories) ? p.subcategories : []).forEach(function (s) { add(s, "sub"); });
      (Array.isArray(p.tags) ? p.tags : []).forEach(function (s) { add(s, "tag"); });
      add(p.city, "city"); add(p.country, "country"); add(p.creator || p.host, "creator");
    });
    VOCAB = out; return out;
  }
  var TYPE_RANK = { cat: 0, sub: 1, tag: 2, creator: 3, city: 4, country: 4 };
  function suggest(q, max) {
    var qn = norm(q), r = { podcasts: [], topics: [] };
    if (!qn) return r;
    var s = search(q), top = s.order.slice(0, max || 5);
    r.podcasts = top.map(function (id) { return BYID[id]; });
    var topics = [];
    vocab().forEach(function (v) {
      var i = v.n.indexOf(qn);
      if (i === -1) return;
      topics.push({ v: v, rank: (i === 0 ? 0 : 5) + TYPE_RANK[v.type] });
    });
    topics.sort(function (a, b) { return a.rank - b.rank || b.v.c - a.v.c; });
    r.topics = topics.slice(0, 4).map(function (t) { return { label: t.v.label, type: t.v.type, count: t.v.c }; });
    r.intents = s.intents.map(function (i) { return i.label; });
    return r;
  }

  function popular(n) {
    return vocab().filter(function (v) { return v.type === "cat"; }).sort(function (a, b) { return b.c - a.c; }).slice(0, n || 6)
      .map(function (v) { return { label: v.label, type: v.type, count: v.c }; });
  }

  return { popular: popular, build: build, search: search, suggest: suggest, norm: norm, toFa: toFa, ready: function () { return LIST.length > 0; }, _tokens: tokens };
  }
  var g = make(); g.create = make; window.PPSearch = g;
})();
