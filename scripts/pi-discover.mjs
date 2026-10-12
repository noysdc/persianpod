/* PersianPod: مرحله‌ی ۱ — شناسایی پادکست‌های فارسی در Podcast Index (فقط می‌خواند و گزارش می‌دهد؛ هیچ صفحه‌ای نمی‌سازد)
   خروجی‌ها:  _data/pi/feeds.json   همه‌ی پادکست‌های فارسی پیداشده (فیلدهای کوتاه‌شده)
              _data/pi/matches.json پادکست‌های دستی فعلی که در Index پیدا شدند
              _data/pi/report.md    گزارش خلاصه
   کلیدها فقط از متغیرهای محیطی PI_KEY و PI_SECRET خوانده می‌شوند (GitHub Secrets). */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const KEY = process.env.PI_KEY, SECRET = process.env.PI_SECRET;
const BASE = process.env.PI_BASE || "https://api.podcastindex.org/api/1.0";
const OUT = process.env.PI_OUT || "_data/pi";
const PODCASTS_DIR = process.env.PI_PODCASTS || "_podcasts";
const INACTIVE_DAYS = 365 * 3;               // همان قاعده‌ی «بیش از ۳ سال بدون قسمت جدید = غیرفعال»
if (!KEY || !SECRET) { console.error("PI_KEY / PI_SECRET تنظیم نشده‌اند."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(p, params = {}) {
  const url = new URL(BASE + p);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let i = 0; i < 4; i++) {
    const t = Math.floor(Date.now() / 1000);                       // زمان تازه در هر تلاش (پنجره‌ی ۵ دقیقه‌ای)
    const auth = crypto.createHash("sha1").update(KEY + SECRET + t).digest("hex");
    const r = await fetch(url, { headers: { "User-Agent": "PersianPod/1.0 (+https://persianpod.ir)", "X-Auth-Key": KEY, "X-Auth-Date": String(t), Authorization: auth } });
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await sleep(2500 * (i + 1)); continue; }
    throw new Error(`HTTP ${r.status} برای ${p}`);
  }
  throw new Error(`چند بار تلاش شد و جواب نیامد: ${p}`);
}

/* ---------- تشخیص فارسی ----------
   language=fa → مطمئن. وگرنه از روی حروف: پ چ ژ گ فقط در فارسی (و اردو/کردی…) هستند؛ حروف خاص اردو را کنار می‌گذاریم. */
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
  "روایت", "سفر", "آشپزی", "بازی", "استارتاپ", "مدیریت", "انگیزشی", "زنان", "خانواده", "persian podcast", "farsi podcast", "iranian"];
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

/* ---------- ذخیره‌ی فیلدهای لازم ---------- */
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

/* ---------- تطبیق با صفحه‌های دستی فعلی ---------- */
const normUrl = (u) => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[/?#].*$/, (m) => m).replace(/\/+$/, "");
const normTitle = (t) => String(t || "").toLowerCase().replace(/[\s\u200c\-_|:؛،.,!؟?()«»"']+/g, "");
const byUrl = new Map(), byTitle = new Map();
for (const f of list) { [f.url, f.originalUrl].filter(Boolean).forEach((u) => byUrl.set(normUrl(u), f)); if (f.title) byTitle.set(normTitle(f.title), f); }
const matches = [], unmatched = [];
let files = [];
try { files = (await fs.readdir(PODCASTS_DIR)).filter((n) => n.endsWith(".md")); } catch { console.warn(`پوشه‌ی ${PODCASTS_DIR} پیدا نشد؛ تطبیق انجام نمی‌شود.`); }
for (const n of files) {
  const txt = await fs.readFile(path.join(PODCASTS_DIR, n), "utf8");
  const fm = (txt.match(/^---\s*\n([\s\S]*?)\n---/) || [, ""])[1];
  const urls = (fm.match(/https?:\/\/[^\s"',)\]]+/g) || []).map(normUrl);
  const title = (fm.match(/^name_fa:\s*"?([^"\n]+)"?/m) || fm.match(/^title:\s*"?([^"\n]+)"?/m) || [, ""])[1];
  let f = null, how = "";
  for (const u of urls) if (byUrl.has(u)) { f = byUrl.get(u); how = "url"; break; }
  if (!f && title && byTitle.has(normTitle(title))) { f = byTitle.get(normTitle(title)); how = "title"; }
  if (f) matches.push({ file: n, pi_id: f.id, how, index_title: f.title }); else unmatched.push({ file: n, title });
}

/* ---------- تطبیق دقیق‌تر برای مواردی که پیدا نشدند: پرسیدن مستقیم از Index (با لینک RSS، بعد با عنوان) ---------- */
const stillUnmatched = [];
for (const u of unmatched) {
  const txt = await fs.readFile(path.join(PODCASTS_DIR, u.file), "utf8");
  const fm = (txt.match(/^---\s*\n([\s\S]*?)\n---/) || [, ""])[1];
  const rss = (fm.match(/^rss:\s*["']?([^"'\s]+)/m) || [, ""])[1];
  let f = null, how = "";
  try {
    if (rss) { const r = await api("/podcasts/byfeedurl", { url: rss }); if (r && r.feed && r.feed.id) { f = r.feed; how = "rss-lookup"; } }
    if (!f && u.title) {
      const r = await api("/search/bytitle", { q: u.title, max: 10 });
      const nt = normTitle(u.title);
      const hit = (r.feeds || []).find((x) => { const xt = normTitle(x.title); return xt === nt || (nt.length >= 4 && (xt.includes(nt) || nt.includes(xt)) && xt.length >= 4); });
      if (hit) { f = hit; how = "title-lookup"; }
    }
  } catch (e) { console.warn(`جست‌وجوی مستقیم برای ${u.file} ناموفق: ${e.message}`); }
  if (f) {
    matches.push({ file: u.file, pi_id: f.id, how, index_title: f.title });
    if (!list.some((x) => x.id === f.id)) list.push(trim({ ...f, _conf: "manual" }));
  } else stillUnmatched.push(u);
  await sleep(300);
}
unmatched.length = 0; unmatched.push(...stillUnmatched);

/* ---------- گزارش ---------- */
const high = list.filter((f) => f.confidence === "high").length, med = list.filter((f) => f.confidence === "medium").length, man = list.length - high - med;
const act = list.filter((f) => f.active === true).length, ina = list.filter((f) => f.active === false).length, unk = list.length - act - ina;
const rep = `## گزارش شناسایی پادکست‌های فارسی در Podcast Index

- پادکست فارسی پیداشده: **${list.length}** (زبان \`fa\` ثبت‌شده: ${high}؛ فقط از روی حروف فارسی تشخیص داده شده: ${med}؛ اضافه‌شده از روی صفحه‌های دستی: ${man})
- فعال (قسمت در ۳ سال اخیر): **${act}** · غیرفعال: **${ina}** · نامشخص: ${unk}
- صفحه‌های دستی فعلی: ${files.length} — در Index پیدا شد: **${matches.length}**، پیدا نشد: **${unmatched.length}**
- مرحله‌ی بعد نیاز به بازبینی دارد: مواردی با confidence=medium ممکن است فارسی نباشند.

${unmatched.length ? "### پیدا نشده (احتمالاً باید به Index اضافه شوند)\n" + unmatched.map((u) => `- ${u.file} ${u.title ? "— " + u.title : ""}`).join("\n") : ""}
`;
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, "feeds.json"), JSON.stringify(list));
await fs.writeFile(path.join(OUT, "matches.json"), JSON.stringify({ matches, unmatched }, null, 1));
await fs.writeFile(path.join(OUT, "report.md"), rep);
if (rawSample) await fs.writeFile(path.join(OUT, "raw-sample.json"), JSON.stringify(rawSample, null, 1));  // یک نمونه‌ی خام از پاسخ API برای کنترل نام فیلدها
console.log("\n" + rep);
