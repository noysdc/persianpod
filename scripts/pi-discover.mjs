/* PersianPod: مرحله‌ی ۱ — شناسایی پادکست‌های فارسی در Podcast Index (فقط می‌خواند و گزارش می‌دهد؛ هیچ صفحه‌ای نمی‌سازد)
   خروجی‌ها:  _data/pi/feeds.json   همه‌ی پادکست‌های فارسی پیداشده (فیلدهای کوتاه‌شده)
              _data/pi/matches.json پادکست‌های دستی فعلی که در Index پیدا شدند
              _data/pi/report.md    گزارش خلاصه
   کلیدها فقط از متغیرهای محیطی PI_KEY و PI_SECRET خوانده می‌شوند (GitHub Secrets). */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { normUrl } from "./lib/dedupe.mjs";

const KEY = process.env.PI_KEY, SECRET = process.env.PI_SECRET;
const BASE = process.env.PI_BASE || "https://api.podcastindex.org/api/1.0";
const OUT = process.env.PI_OUT || "_data/pi";
const PODCASTS_DIR = process.env.PI_PODCASTS || "_podcasts";
const DRAFTS_DIR = process.env.PI_DRAFTS || "_drafts";
const BLOCKED_DIR = process.env.PI_BLOCKED || "_blocked";
const INACTIVE_DAYS = 365 * 3;
if (!KEY || !SECRET) { console.error("PI_KEY / PI_SECRET تنظیم نشده‌اند."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(p, params = {}) {
  const url = new URL(BASE + p);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let i = 0; i < 4; i++) {
    const t = Math.floor(Date.now() / 1000);
    const auth = crypto.createHash("sha1").update(KEY + SECRET + t).digest("hex");
    const r = await fetch(url, { headers: { "User-Agent": "PersianPod/1.0 (+https://persianpod.ir)", "X-Auth-Key": KEY, "X-Auth-Date": String(t), Authorization: auth } });
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await sleep(2500 * (i + 1)); continue; }
    throw new Error(`HTTP ${r.status} برای ${p}`);
  }
  throw new Error(`چند بار تلاش شد و جواب نیامد: ${p}`);
}

/* ---------- تشخیص فارسی ---------- */
const ARABIC_SCRIPT = /[\u0600-\u06FF]/g, FA_ONLY = /[پچژگ]/, NOT_FA = /[ٹڈڑںۓےہھ]/;
function persianConfidence(f) {
  const lang = String(f.language || "").toLowerCase();
  if (lang === "fa" || lang.startsWith("fa-") || lang === "per" || lang === "fas") return "high";
  const s = `${f.title || ""} ${f.description || ""}`;
  const letters = (s.match(/\p{L}/gu) || []).length || 1, arab = (s.match(ARABIC_SCRIPT) || []).length;
  if (arab / letters > 0.3 && FA_ONLY.test(s) && !NOT_FA.test(s)) return "medium";
  return null;
}

/* ---------- جست‌وجو با کلیدواژه‌های فارسی ---------- */
const TERMS = ["پادکست", "پادکست فارسی", "فارسی", "ایران", "ایرانی", "داستان", "تاریخ", "گفتگو", "گفت‌وگو", "مصاحبه", "روانشناسی", "کتاب", "رمان",
  "فیلم", "سینما", "موسیقی", "اقتصاد", "کسب‌وکار", "بازار", "تکنولوژی", "فناوری", "برنامه‌نویسی", "علم", "فلسفه", "دین", "سیاست", "جامعه", "طنز",
  "کودک", "نوجوان", "ورزش", "فوتبال", "سلامت", "سبک زندگی", "آموزش", "زبان انگلیسی", "هنر", "نقاشی", "شعر", "ادبیات", "جنایی", "ماجرا", "مستند",
  "روایت", "سفر", "آشپزی", "بازی", "استارتاپ", "مدیریت", "انگیزشی", "زنان", "خانواده", "persian podcast", "farsi podcast", "iranian",
  /* واژه‌های پرتکرار در نام پادکست‌های فارسی که ۵۷ کلیدواژه‌ی بالا نمی‌گرفتند (عنوان‌هایی مثل «رخ»، «ناشتا»، «کافه کرنر» هیچ‌کدام از آن‌ها را ندارند) */
  "رادیو", "کافه", "کتاب صوتی", "رمان صوتی", "مدیتیشن", "مراقبه", "شاهنامه", "فردوسی", "مولانا", "حافظ", "هری پاتر", "قصه", "افسانه", "جنایت", "راز",
  "ذهن", "نشاط", "ناشتا", "صبح", "شب", "شبانه", "روز", "زندگی", "عشق", "رابطه", "ازدواج", "کودکان", "مادر", "پدر", "نوجوانان", "بزرگسال",
  "پول", "ثروت", "سرمایه", "بورس", "ارز دیجیتال", "کریپتو", "بیت‌کوین", "فارکس", "املاک", "شغل", "کارآفرینی", "برند", "بازاریابی", "فروش", "مذاکره",
  "رهبری", "موفقیت", "عادت", "تمرکز", "خودشناسی", "خودسازی", "اعتماد به نفس", "استرس", "اضطراب", "افسردگی", "درمان", "سلامتی", "تغذیه", "خواب",
  "پزشکی", "روان", "جامعه‌شناسی", "انسان‌شناسی", "اسطوره", "باستان", "ایران باستان", "هخامنشی", "ساسانی", "قاجار", "پهلوی", "انقلاب", "جنگ",
  "مهاجرت", "اروپا", "آمریکا", "کانادا", "آلمان", "ترکیه", "افغانستان", "تاجیکستان", "کردی", "ترکی", "عربی", "انگلیسی", "زبان", "آموزش زبان",
  "گوینده", "صدا", "صوتی", "میکروفن", "گفتگو با", "مهمان", "برنامه", "ماجراجویی", "پرونده", "معما", "ترسناک", "وحشت", "فانتزی", "علمی تخیلی",
  "فوتبال ایران", "سینمای ایران", "سریال", "نقد", "تحلیل", "خبر", "اخبار", "سیاسی", "حقوق بشر", "فمینیسم", "فلسفه", "عرفان", "اسلام", "مسیحیت", "زرتشت",
  "نجوم", "فضا", "فیزیک", "ریاضی", "شیمی", "زیست", "هوش مصنوعی", "برنامه نویسی", "طراحی", "معماری", "عکاسی", "تئاتر", "گیتار", "پیانو", "سنتور", "ترانه",
  "رپ", "پاپ", "راک", "جاز", "کلاسیک", "بی‌کلام", "آرامش", "خوابکست", "لالایی", "شب بخیر", "بچه", "تربیت", "والدین", "دانش‌آموز", "کنکور", "دانشگاه"];
const feeds = new Map();
let rawSample = null;
for (const q of TERMS) {
  try {
    const r = await api("/search/byterm", { q, max: 1000 });
    const list = r.feeds || [];
    if (!rawSample && list[0]) rawSample = list[0];
    let added = 0;
    for (const f of list) { const c = persianConfidence(f); if (c && !feeds.has(f.id)) { feeds.set(f.id, { ...f, _conf: c }); added++; } }
    console.log(`«${q}»: ${list.length} نتیجه، ${added} پادکست فارسی تازه`);
  } catch (e) { console.warn(`«${q}» ناموفق: ${e.message}`); }
  await sleep(400);
}

/* ---------- روش‌های دیگر شناسایی (قبلاً فقط جست‌وجوی کلیدواژه بود) ----------
   جست‌وجوی byterm فقط پادکستی را می‌دهد که یکی از کلیدواژه‌ها در عنوان/توضیحش باشد. عنوانی مثل «جافکری»، «رخ» یا «آدمیزاد» هیچ‌وقت پیدا نمی‌شود.
   پس این‌ها هم اضافه شدند:  ۱) آخرین پادکست‌های به‌روزشده با فیلتر زبان fa  ۲) آخرین قسمت‌های فارسی (از روی آن‌ها پادکستشان)
   ۳) پادکست‌های پرطرفدار fa  ۴) فهرست دستی نام‌ها (scripts/pi-wanted.txt)  ۵) پیدا کردن پادکست‌های هم‌سازنده (نام سازنده را می‌گردد) */
const absorb = (arr, label) => {
  let added = 0;
  for (const f of arr || []) { if (!f || !f.id) continue; const c = persianConfidence(f) || (f._force || null); if (c && !feeds.has(f.id)) { feeds.set(f.id, { ...f, _conf: c }); added++; } }
  console.log(`${label}: ${(arr || []).length} نتیجه، ${added} پادکست فارسی تازه`);
  return added;
};
const tryApi = async (label, p, params) => { try { return await api(p, params); } catch (e) { console.warn(`${label} ناموفق: ${e.message}`); return null; } };
const nowEpoch = Math.floor(Date.now() / 1000);
for (const days of [1, 3, 7, 14, 30, 60, 120, 240, 365]) {
  const r = await tryApi(`recent/feeds ${days}d`, "/recent/feeds", { lang: "fa", max: 1000, since: nowEpoch - days * 86400 });
  if (r) absorb(r.feeds, `recent/feeds fa (${days} روز)`);
  await sleep(400);
}
{
  const r = await tryApi("recent/episodes", "/recent/episodes", { lang: "fa", max: 1000 });
  const ids = [...new Set(((r && r.items) || []).map((i) => i.feedId).filter((id) => id && !feeds.has(id)))].slice(0, 300);
  console.log(`recent/episodes fa: ${(r && r.items || []).length} قسمت، ${ids.length} پادکست ناشناخته`);
  for (const id of ids) { const x = await tryApi(`byfeedid ${id}`, "/podcasts/byfeedid", { id }); if (x && x.feed) absorb([{ ...x.feed, _force: "high" }], `byfeedid ${id}`); await sleep(250); }
}
{
  const r = await tryApi("trending", "/podcasts/trending", { lang: "fa", max: 1000, since: nowEpoch - 30 * 86400 });
  if (r) absorb(r.feeds, "trending fa (۳۰ روز)");
}
const NT = (t) => String(t || "").toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\s\u200c\-_|:؛،.,!؟?()«»"'’/]+/g, "");
{ // فهرست دستی نام‌ها: هر خط یک نام (مثلاً از چارت کست‌باکس)
  let wanted = [];
  try { wanted = (await fs.readFile(process.env.PI_WANTED || "scripts/pi-wanted.txt", "utf8")).split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith("#")); } catch { /* اختیاری */ }
  let found = 0, miss = [];
  for (const w of wanted) {
    const r = await tryApi(`bytitle «${w}»`, "/search/bytitle", { q: w, max: 10 });
    const want = NT(w);
    const hits = ((r && r.feeds) || []).filter((f) => { const t = NT(f.title); return want.length >= 2 && (t === want || (want.length >= 4 && t.includes(want)) || (t.length >= 4 && want.includes(t))); });
    if (hits.length) { for (const f of hits) if (!feeds.has(f.id)) { feeds.set(f.id, { ...f, _conf: persianConfidence(f) || "manual" }); found++; } } else miss.push(w);
    await sleep(300);
  }
  console.log(`فهرست دستی: ${wanted.length} نام، ${found} پادکست تازه، ${miss.length} نام در Podcast Index پیدا نشد`);
  if (wanted.length) await fs.mkdir(OUT, { recursive: true }).then(() => fs.writeFile(path.join(OUT, "wanted-missing.md"), `## نام‌هایی از scripts/pi-wanted.txt که در Podcast Index پیدا نشدند\n\nاین‌ها احتمالاً RSS عمومی ندارند (مثلاً کانال‌های ساخته‌شده فقط داخل کست‌باکس) یا هنوز در Podcast Index ثبت نشده‌اند؛ برای ثبتشان RSS را در podcastindex.org اضافه کن.\n\n${miss.map((m) => `- ${m}`).join("\n")}\n`));
}
{ // پادکست‌های هم‌سازنده: هر روز تا ۱۵۰ نامِ سازنده‌ی جدید جست‌وجو می‌شود و فهرست نام‌های انجام‌شده ذخیره می‌ماند
  const doneFile = path.join(OUT, "snowball-done.json");
  let done = []; try { done = JSON.parse(await fs.readFile(doneFile, "utf8")); } catch { /* اولین بار */ }
  const doneSet = new Set(done);
  const names = [...new Set([...feeds.values()].flatMap((f) => [f.author, f.ownerName]).map((x) => String(x || "").trim()).filter((x) => x.length >= 3))].filter((x) => !doneSet.has(NT(x))).slice(0, Number(process.env.PI_SNOWBALL_PER_RUN || 150));
  let added = 0;
  for (const nm of names) { const r = await tryApi(`byterm «${nm}»`, "/search/byterm", { q: nm, max: 100 }); if (r) added += absorb(r.feeds, `سازنده «${nm}»`) ; doneSet.add(NT(nm)); await sleep(300); }
  console.log(`هم‌سازنده‌ها: ${names.length} نام جست‌وجو شد، ${added} پادکست فارسی تازه`);
  await fs.mkdir(OUT, { recursive: true }); await fs.writeFile(doneFile, JSON.stringify([...doneSet]));
}
/* ---------- فهرست تجمعی ----------
   قبلاً هر اجرا feeds.json را از صفر می‌ساخت و پادکستی که آن روز در نتیجه‌ی جست‌وجو نمی‌آمد از فهرست می‌افتاد.
   حالا فهرست قبلی هم نگه داشته می‌شود (داده‌ی تازه‌ی همین اجرا روی قبلی‌ها برتری دارد). */
let carried = 0;
try { const prev = JSON.parse(await fs.readFile(path.join(OUT, "feeds.json"), "utf8")); for (const f of prev) if (f && f.id && !feeds.has(f.id)) { feeds.set(f.id, { ...f, _conf: f.confidence || "high" }); carried++; } } catch { /* اولین اجرا */ }
console.log(`از اجراهای قبلی نگه داشته شد: ${carried}`);

/* ---------- ذخیره‌ی فیلدهای لازم ---------- */
// حذف نیمه‌ی ناقصِ ایموجی (surrogate تنها)؛ جکیل/YAML روی \ud83c تنها خطا می‌دهد و کل بیلد سایت می‌شکند
const wellFormed = (s) => String(s).replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
const jsonSafe = (o, space) => JSON.stringify(o, (k, v) => (typeof v === "string" ? wellFormed(v) : v), space);
const nowS = Date.now() / 1000;
const trim = (f) => ({
  id: f.id, title: f.title, url: f.url, originalUrl: f.originalUrl, link: f.link,
  description: String(f.description || "").slice(0, 600), author: f.author, ownerName: f.ownerName,
  image: f.image, artwork: f.artwork, language: f.language, itunesId: f.itunesId || null,
  episodeCount: f.episodeCount ?? null, newestItemPubdate: f.newestItemPubdate ?? null, lastUpdateTime: f.lastUpdateTime ?? null,
  categories: f.categories || null, dead: f.dead ?? null, podcastGuid: f.podcastGuid || null, confidence: f._conf,
  active: f.newestItemPubdate ? (nowS - f.newestItemPubdate) / 86400 <= INACTIVE_DAYS : null,
});
const list = [...feeds.values()].map(trim).sort((a, b) => (b.newestItemPubdate || 0) - (a.newestItemPubdate || 0));

/* ---------- تطبیق با صفحه‌های موجود (هر سه پوشه) ----------
   مقایسه با لینک RSS (بدون http، www، پارامترهای بعد از ؟ و اسلش آخر) و با عنوان.
   عنوان‌های دوزبانه («نویز | NOYS») به بخش‌هایشان شکسته می‌شوند تا «نویز» یا «NOYS» هر کدام به‌تنهایی جور شود. */
/* normUrl از lib/dedupe.mjs می‌آید (پارامترهای ?query را حذف نمی‌کند؛ قبلاً فیدهای RFI و radioiranshahr با هم یکی حساب می‌شدند) */
const normTitle = (t) => String(t || "").toLowerCase().replace(/[\s\u200c\-_|:؛،.,!؟?()«»"'’]+/g, "");
const SPLIT = /\s*(?:[|｜–—:؛]|\s-\s)\s*/;
const rawParts = (t) => { const full = String(t || "").trim(); return [full, ...full.split(SPLIT)].map((x) => x.trim()).filter((x) => normTitle(x).length >= 3); };
const titleParts = (t) => [...new Set(rawParts(t).map(normTitle))];
const byUrl = new Map(), byTitle = new Map();
const addIndex = (f) => { [f.url, f.originalUrl].filter(Boolean).forEach((u) => byUrl.set(normUrl(u), f)); titleParts(f.title).forEach((t) => { if (!byTitle.has(t)) byTitle.set(t, f); }); };
list.forEach(addIndex);

/* ---------- overrides ---------- */
let overrides = {};
try { overrides = JSON.parse(await fs.readFile(process.env.PI_OVERRIDES || "scripts/pi-overrides.json", "utf8")); } catch { /* فایل اختیاری است */ }

/* ---------- جمع‌آوری همه‌ی فایل‌های موجود از هر سه پوشه ---------- */
const allExistingFiles = [];
for (const dir of [PODCASTS_DIR, DRAFTS_DIR, BLOCKED_DIR]) {
  const names = (await fs.readdir(dir).catch(() => [])).filter((n) => n.endsWith(".md"));
  for (const n of names) allExistingFiles.push({ dir, name: n });
}
console.log(`فایل‌های موجود برای تطبیق: ${allExistingFiles.length} (podcasts + drafts + blocked)`);

const matches = [], unmatched = [];
const info = {};
for (const { dir, name: n } of allExistingFiles) {
  const txt = await fs.readFile(path.join(dir, n), "utf8").catch(() => "");
  if (!txt) continue;
  const fm = (txt.match(/^---\s*\n([\s\S]*?)\n---/) || [, ""])[1];
  const get = (k) => (fm.match(new RegExp("^" + k + ":\\s*[\"']?([^\"'\\n]+)", "m")) || [, ""])[1].trim();
  const ov = overrides[n];
  const urls = [...(typeof ov === "string" ? [ov] : []), ...(fm.match(/https?:\/\/[^\s"',)\]]+/g) || [])];
  const slug = n.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/[-_]+/g, " ");
  const names = [get("name_fa"), get("name_en"), get("title"), get("title_en")].filter(Boolean);
  info[n] = { dir, urls, names, slug, ov, shown: names[0] || slug, rss: [...new Set([typeof ov === "string" ? ov : "", get("rss")].filter(Boolean))] };
  let f = null, how = "";
  for (const u of urls.map(normUrl)) if (byUrl.has(u)) { f = byUrl.get(u); how = "url"; break; }
  if (!f) outer: for (const nm of names) for (const t of titleParts(nm)) if (byTitle.has(t)) { f = byTitle.get(t); how = "title"; break outer; }
  if (!f) for (const t of titleParts(slug)) if (byTitle.has(t)) { f = byTitle.get(t); how = "slug"; break; }
  if (f) matches.push({ file: n, dir, pi_id: f.id, how, index_title: f.title }); else unmatched.push({ file: n, dir, title: info[n].shown });
}

/* ---------- برای مواردی که هنوز پیدا نشدند: پرسیدن مستقیم از Index ---------- */
const safe = async (label, fn) => { try { return await fn(); } catch (e) { console.warn(`${label}: ${e.message}`); return null; } };
const stillUnmatched = [];
for (const u of unmatched) {
  const I = info[u.file];
  const rssNorm = new Set(I.rss.map(normUrl));
  let f = null, how = "";
  if (typeof I.ov === "number") { const r = await safe(`${u.file} byfeedid`, () => api("/podcasts/byfeedid", { id: I.ov })); if (r && r.feed && r.feed.id) { f = r.feed; how = "override-id"; } }
  for (const rss of I.rss) {
    if (f) break;
    const r = await safe(`${u.file} byfeedurl`, () => api("/podcasts/byfeedurl", { url: rss }));
    if (r && r.feed && r.feed.id) { f = r.feed; how = "rss-lookup"; }
    await sleep(200);
  }
  if (!f) {
    const qs = [...new Set([...I.names.flatMap(rawParts), ...rawParts(I.slug)])].slice(0, 5);
    const want = new Set(qs.flatMap(titleParts));
    for (const q of qs) {
      if (f) break;
      const r = await safe(`${u.file} bytitle «${q}»`, () => api("/search/bytitle", { q, max: 10 }));
      const hit = r && (r.feeds || []).find((x) => rssNorm.has(normUrl(x.url)) || rssNorm.has(normUrl(x.originalUrl)) || titleParts(x.title).some((t) => want.has(t)));
      if (hit) { f = hit; how = "title-lookup"; }
      await sleep(200);
    }
  }
  if (f) { matches.push({ file: u.file, dir: u.dir, pi_id: f.id, how, index_title: f.title }); if (!list.some((x) => x.id === f.id)) list.push(trim({ ...f, _conf: "manual" })); }
  else stillUnmatched.push(u);
}
unmatched.length = 0; unmatched.push(...stillUnmatched);

/* ---------- گزارش ---------- */
const high = list.filter((f) => f.confidence === "high").length, med = list.filter((f) => f.confidence === "medium").length, man = list.length - high - med;
const act = list.filter((f) => f.active === true).length, ina = list.filter((f) => f.active === false).length, unk = list.length - act - ina;

// شمارش فایل‌های هر پوشه
const countByDir = {};
for (const { dir } of allExistingFiles) countByDir[dir] = (countByDir[dir] || 0) + 1;

const rep = `## گزارش شناسایی پادکست‌های فارسی در Podcast Index

- پادکست فارسی پیداشده: **${list.length}** (زبان \`fa\` ثبت‌شده: ${high}؛ فقط از روی حروف فارسی تشخیص داده شده: ${med}؛ اضافه‌شده از روی صفحه‌های دستی: ${man})
- فعال (قسمت در ۳ سال اخیر): **${act}** · غیرفعال: **${ina}** · نامشخص: ${unk}

### 📁 فایل‌های موجود (در هر سه پوشه)

${Object.entries(countByDir).map(([d, c]) => `- \`${d}/\`: **${c}** فایل`).join("\n")}
- مجموع: **${allExistingFiles.length}** فایل

### 🔗 تطبیق با Podcast Index

- در Index پیدا شد: **${matches.length}** (از این تعداد، فایل‌های تکراری که نباید دوباره ساخته شوند)
- پیدا نشد: **${unmatched.length}**

${unmatched.length ? "### پیدا نشده (احتمالاً باید به Index اضافه شوند یا slug/عنوانشان با Index نمی‌خواند)\n" + unmatched.map((u) => `- \`${u.dir}/${u.file}\` ${u.title ? "— " + u.title : ""}`).join("\n") : ""}
`;
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, "feeds.json"), jsonSafe(list));
await fs.writeFile(path.join(OUT, "matches.json"), jsonSafe({ matches, unmatched }, 1));
await fs.writeFile(path.join(OUT, "report.md"), rep);
if (rawSample) await fs.writeFile(path.join(OUT, "raw-sample.json"), jsonSafe(rawSample, 1));
console.log("\n" + rep);