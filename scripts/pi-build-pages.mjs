/* PersianPod: مرحله‌ی ۳ — ساخت صفحه‌ی سبک برای پادکست‌های تازه‌ی Podcast Index
   خروجی: _drafts/<slug>.md با published:false
   نام فایل همیشه از «اسم فارسی» ساخته می‌شود.
   _blocked/ هم چک می‌شود تا پادکست‌های بلاک‌شده دوباره ساخته نشوند.
   وضعیت: "فعال" برای پادکست‌های ۳ سال اخیر، "متوقف شده" برای بقیه. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const E = process.env;
const LIMIT = Math.max(1, parseInt(E.LIMIT || "10", 10)), SORT = E.SORT || "episodes";
const IDS = (E.IDS || "").split(/[,\s،]+/).filter(Boolean).map(Number).filter(Boolean);
const MAX_FAILS_IN_ROW = 20;
const PODCASTS_DIR = E.PI_PODCASTS || "_podcasts";
const DRAFTS_DIR = E.PI_DRAFTS || "_drafts";
const BLOCKED_DIR = E.PI_BLOCKED || "_blocked";
const IMG_DIR = E.PI_IMG || "assets/img/podcasts";
const DATA = E.PI_OUT || "_data/pi";
const CATS_FILE = E.PI_CATS || "_data/categories.yml";
const PI_BASE = E.PI_BASE || "https://api.podcastindex.org/api/1.0";
const CLASSIFY = E.CLASSIFY === "1";
const AI_BUDGET = parseInt(E.AI_BUDGET || "130", 10);

const GROQ_BASE = E.GROQ_BASE || "https://api.groq.com/openai/v1";
const GROQ_MODEL = E.GH_MODEL || "openai/gpt-oss-120b";
const GROQ_TOKEN = E.GROQ_API_KEY || "";

const GAP = parseInt(E.GAP_MS || (CLASSIFY ? "2500" : "800"), 10);
if (!E.PI_KEY || !E.PI_SECRET) { console.error("PI_KEY / PI_SECRET تنظیم نشده‌اند."); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pi(p, params = {}) {
  const url = new URL(PI_BASE + p); for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let i = 0; i < 3; i++) {
    const t = Math.floor(Date.now() / 1000), auth = crypto.createHash("sha1").update(E.PI_KEY + E.PI_SECRET + t).digest("hex");
    const r = await fetch(url, { headers: { "User-Agent": "PersianPod/1.0 (+https://persianpod.ir)", "X-Auth-Key": E.PI_KEY, "X-Auth-Date": String(t), Authorization: auth } });
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await sleep(2500 * (i + 1)); continue; }
    throw new Error(`HTTP ${r.status} ${p}`);
  }
  throw new Error(`بدون پاسخ: ${p}`);
}

const catsTxt = await fs.readFile(CATS_FILE, "utf8"), CATS = [];
for (const line of catsTxt.split("\n")) {
  let m;
  if ((m = line.match(/^- name:\s*(.+?)\s*$/))) CATS.push({ name: m[1], subs: [] });
  else if ((m = line.match(/^\s+- (.+?)\s*$/)) && CATS.length) CATS[CATS.length - 1].subs.push(m[1]);
}
if (!CATS.length) { console.error("categories.yml خوانده نشد."); process.exit(1); }
const CAT_NAMES = CATS.map((c) => c.name);

function translitFa(s) {
  if (!s) return "";
  s = s.normalize("NFC").replace(/[\u200c]/g, " ").replace(/[\u200f\u200e]/g, "").trim();
  s = s.replace(/[\u064B-\u0652\u0670]/g, "");
  const map = {
    "آ":"aa","ا":"a","ب":"b","پ":"p","ت":"t","ث":"s","ج":"j","چ":"ch","ح":"h","خ":"kh",
    "د":"d","ذ":"z","ر":"r","ز":"z","ژ":"zh","س":"s","ش":"sh","ص":"s","ض":"z","ط":"t","ظ":"z",
    "ع":"a","غ":"gh","ف":"f","ق":"gh","ک":"k","ك":"k","گ":"g","ل":"l","م":"m","ن":"n",
    "و":"o","ه":"h","ی":"i","ي":"i","ئ":"y","ء":"","ٔ":"",
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
    "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
  };
  let out = "";
  for (const ch of s) {
    if (map[ch] !== undefined) out += map[ch];
    else if (/[A-Za-z0-9]/.test(ch)) out += ch;
    else out += " ";
  }
  out = out.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (out.length > 60) out = out.slice(0, 60).replace(/-+[^-]*$/, "");
  return out;
}

const toEn = (s) => String(s).replace(/[\u06F0-\u06F9]/g, (d) => d.charCodeAt(0) - 1776).replace(/[\u0660-\u0669]/g, (d) => d.charCodeAt(0) - 1632);
// حذف نیمه‌ی ناقصِ ایموجی (surrogate تنها)؛ جکیل/YAML روی \ud83c تنها خطا می‌دهد و کل بیلد سایت می‌شکند
const wellFormed = (s) => String(s).replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
const jsonSafe = (o, space) => JSON.stringify(o, (k, v) => (typeof v === "string" ? wellFormed(v) : v), space);
const q = (v) => jsonSafe(v);
const hasFa = (s) => /[\u0600-\u06FF]/.test(s), hasLat = (s) => /[A-Za-z]/.test(s);
const SPLIT = /\s*(?:[|｜–—:؛]|\s-\s)\s*/;
function splitTitle(t) {
  const parts = String(t || "").split(SPLIT).map((x) => x.trim()).filter(Boolean);
  const fa = (parts.find((x) => hasFa(x)) || String(t || "").trim()).replace(/^[\u200c\u200f\s]+|[\u200c\u200f\s]+$/g, "");
  let en = parts.find((x) => hasLat(x) && !hasFa(x)) || "";
  if (!en) {
    const runs = String(t || "").match(/[A-Za-z][A-Za-z0-9&'._-]*(?:\s+[A-Za-z0-9&'._-]+)*/g) || [];
    en = (runs.sort((a, b) => b.length - a.length)[0] || "").trim();
    if (en.length < 3) en = "";
  }
  return { fa, en };
}
function cleanDesc(d) {
  let s = String(d || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  s = s.replace(/Hosted on [^.\n]+\.\s*See [^\s]+ for more information\.?/gi, " ").replace(/See [^\s]*privacy[^\s]* for more information\.?/gi, " ")
       .replace(/Hosted (?:on|by) [A-Za-z0-9 .]+/gi, " ").replace(/[-_=*~]{4,}/g, " ").replace(/\s+/g, " ").trim();
  return s.slice(0, 1500);
}
const HOSTS = /(castbox|apple\.com|spotify|acast|libsyn|anchor\.fm|podbean|buzzsprout|soundcloud|rabt\.host|audiya|simplecast|megaphone|transistor|captivate|podcasts\.google|youtube|youtu\.be|instagram|t\.me|telegram|threads|twitter|x\.com|facebook|rss)/i;
function links(raw, feed, full) {
  const text = `${raw || ""} ${feed.link || ""}`, f = (re) => (text.match(re) || [])[0] || "";
  const L = {
    telegram: f(/https?:\/\/(?:www\.)?t(?:elegram)?\.me\/[A-Za-z0-9_+]{3,}/i),
    instagram: f(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/i),
    youtube: f(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:@|channel\/|c\/|user\/)[A-Za-z0-9_.-]+|youtu\.be\/[A-Za-z0-9_-]+)/i),
    threads: f(/https?:\/\/(?:www\.)?threads\.(?:com|net)\/@[A-Za-z0-9_.]+/i),
    website: feed.link && /^https?:\/\//.test(feed.link) && !HOSTS.test(feed.link) ? feed.link : "",
    apple: full.itunesId ? `https://podcasts.apple.com/podcast/id${full.itunesId}` : "",
    spotify: f(/https?:\/\/open\.spotify\.com\/show\/[A-Za-z0-9]+/i),
  };
  return L;
}

/* ============ موجودها: _podcasts + _drafts + _blocked ============ */
const havePi = new Set(), haveSlug = new Set(), haveRss = new Set(), haveKey = new Set();
const normKey = (x) => String(x || "").replace(/[\u06F0-\u06F9]/g, (d) => d.charCodeAt(0) - 1776).toLowerCase().replace(/[\s\u200c\u200f_\-|:·.,،؛]+/g, "");
for (const dir of [PODCASTS_DIR, DRAFTS_DIR, BLOCKED_DIR]) {
  for (const n of await fs.readdir(dir).catch(() => [])) {
    if (!n.endsWith(".md")) continue;
    haveSlug.add(n.replace(/\.md$/, ""));
    const fm = ((await fs.readFile(path.join(dir, n), "utf8")).match(/^---\s*\n([\s\S]*?)\n---/) || [, ""])[1];
    const id = (fm.match(/^pi_id:\s*"?(\d+)/m) || [])[1]; if (id) havePi.add(+id);
    const sl = (fm.match(/^slug:\s*"?([^"\n]+)/m) || [])[1]; if (sl) haveSlug.add(sl.trim());
    const rss = (fm.match(/^rss:\s*"?([^"\n]+)/m) || [])[1]; if (rss) haveRss.add(rss.trim());
    const te = (fm.match(/^title_en:\s*"?([^"\n]+)/m) || [])[1]; if (te && normKey(te).length >= 3) haveKey.add(normKey(te));
  }
}
try { for (const m of JSON.parse(await fs.readFile(path.join(DATA, "matches.json"), "utf8")).matches || []) havePi.add(+m.pi_id); } catch { /* اختیاری */ }

const STATE_FILE = path.join(DATA, "import-state.json");
let STATE = { tries: {}, review: {} };
try { STATE = { tries: {}, review: {}, ...JSON.parse(await fs.readFile(STATE_FILE, "utf8")) }; } catch { /* اولین اجرا */ }

/* ============ انتخاب نامزدها (فعال و غیرفعال، هر دو) ============ */
const feeds = JSON.parse(await fs.readFile(path.join(DATA, "feeds.json"), "utf8"));

const totalInFeeds = feeds.length;
const highActive = feeds.filter((f) => f.confidence === "high" && f.active === true && !f.dead).length;
const highInactive = feeds.filter((f) => f.confidence === "high" && f.active === false && !f.dead).length;
const faOk = feeds.filter((f) => f.confidence === "high" && !f.dead && (f.episodeCount || 0) >= 3 && hasFa(f.title || "")).length;
const alreadyBuilt = feeds.filter((f) => havePi.has(+f.id)).length;
const inReview = feeds.filter((f) => STATE.review[f.id]).length;
const allCandidates = feeds.filter((f) => f.confidence === "high" && !f.dead && !havePi.has(+f.id) && !STATE.review[f.id] && (f.episodeCount || 0) >= 3 && hasFa(f.title || "")).length;

let cand;
if (IDS.length) {
  const byId = new Map(feeds.map((f) => [+f.id, f]));
  cand = IDS.map((id) => byId.get(id)).filter((f) => f && !havePi.has(+f.id));
  const bad = IDS.filter((id) => !byId.has(id) || havePi.has(id));
  if (bad.length) console.warn("نادیده گرفته شد: " + bad.join(", "));
} else {
  cand = feeds.filter((f) => f.confidence === "high" && !f.dead && !havePi.has(+f.id) && !STATE.review[f.id] && (f.episodeCount || 0) >= 3 && hasFa(f.title || ""));
  cand.sort(SORT === "recent" ? (a, b) => (b.newestItemPubdate || 0) - (a.newestItemPubdate || 0) : (a, b) => (b.episodeCount || 0) - (a.episodeCount || 0));
}

const stats = {
  totalInFeeds, highActive, highInactive, faOk, alreadyBuilt, inReview, allCandidates,
  thisRunLimit: Math.min(LIMIT, cand.length), aiBudget: AI_BUDGET,
};

console.log(`کل در feeds.json: ${totalInFeeds}`);
console.log(`فعال: ${highActive} · غیرفعال: ${highInactive}`);
console.log(`فارسی + حداقل ۳ قسمت: ${faOk}`);
console.log(`قبلاً ساخته‌شده: ${alreadyBuilt}`);
console.log(`کاندیدهای واجد شرایط (فعال + غیرفعال): ${allCandidates}`);
console.log(`این اجرا حداکثر می‌سازد: ${stats.thisRunLimit} (سقف AI: ${AI_BUDGET})`);

const CAT_MAP = [
  ["جنایی", ["True Crime"]], ["مستند و روایت", ["Documentary"]], ["تاریخ", ["History"]], ["موسیقی", ["Music"]],
  ["ورزش", ["Sports", "Soccer", "Football", "Baseball", "Basketball", "Cricket", "Tennis", "Wrestling"]], ["کودک و نوجوان", ["Kids"]],
  ["طنز و سرگرمی", ["Comedy", "Games", "Improv", "Stand-Up"]], ["کسب‌وکار و اقتصاد", ["Business", "Management", "Investing", "Entrepreneurship", "Marketing", "Careers", "Non-Profit"]],
  ["علم و فناوری", ["Science", "Technology", "Natural", "Astronomy", "Physics", "Chemistry", "Mathematics"]], ["روانشناسی", ["Mental", "Self Improvement", "Relationships"]],
  ["فلسفه و دین", ["Religion", "Spirituality", "Philosophy", "Islam", "Christianity", "Buddhism"]], ["ادبیات و کتاب", ["Books", "Fiction", "Stories", "Poetry", "Literature", "Journals"]],
  ["گفت‌وگو و مصاحبه", ["Interviews"]], ["جامعه و سیاست", ["Politics", "News", "Government", "Commentary", "Daily"]],
  ["سبک زندگی و سلامت", ["Health", "Fitness", "Medicine", "Life", "Parenting", "Leisure", "Travel", "Places", "Food", "Home", "Garden"]],
  ["آموزش و مهارت", ["Education", "Language", "Learning", "Courses", "How To"]], ["هنر", ["Arts", "Design", "Visual", "Performing", "Film", "Tv", "Fashion", "Beauty"]],
];
function basic(desc, piCats) {
  const set = new Set(piCats.map((c) => String(c)));
  const hit = CAT_MAP.find(([, names]) => names.some((n) => set.has(n)));
  const category = hit ? hit[0] : "سایر";
  const text = toEn(desc).trim();
  let description = text;
  if (description.length > 200) { const cut = description.slice(0, 200), k = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("؟"), cut.lastIndexOf("!"), cut.lastIndexOf("؛")); description = k > 80 ? cut.slice(0, k + 1) : cut.replace(/\s+\S*$/, "") + "…"; }
  return { category, weak: !hit, subcategories: [], tags: hit ? [category] : [], hashtags: [], description, intro: "", about: "", text: text.slice(0, 1200) };
}

let aiStop = "", aiCalls = 0, AI = null; const aiDiag = [];
const NEW_CATS_FILE = path.join(DATA, "new-categories.md");
const newCats = [];

async function chat(cfg, system, user, maxTokens) {
  const payload = { model: cfg.model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: maxTokens };
  if (cfg.rf) payload.response_format = { type: "json_object" };
  aiCalls++;
  const r = await fetch(`${cfg.base}/chat/completions`, { method: "POST", signal: AbortSignal.timeout(60000),
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + GROQ_TOKEN }, body: JSON.stringify(payload) });
  const text = await r.text();
  let out = ""; try { const j = JSON.parse(text); out = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ""; } catch { /* پاسخ JSON نیست */ }
  return { status: r.status, ctype: (r.headers.get("content-type") || "").split(";")[0], text, out };
}

async function preflight() {
  const variants = [
    { base: GROQ_BASE, model: GROQ_MODEL, rf: false },
    { base: GROQ_BASE, model: GROQ_MODEL, rf: true },
    { base: GROQ_BASE, model: "openai/gpt-oss-20b", rf: false },
  ].filter((v, i, a) => a.findIndex((x) => x.base === v.base && x.model === v.model && x.rf === v.rf) === i);
  for (const v of variants) {
    const tag = `${v.base} · ${v.model}${v.rf ? " · json_mode" : ""}`;
    try {
      const res = await chat(v, "فقط یک JSON معتبر بده.", 'خروجی: {"ok": true}', 30);
      aiDiag.push(`${tag} → HTTP ${res.status} · ${res.ctype || "?"} · ${res.text.replace(/\s+/g, " ").slice(0, 140)}`);
      if (res.status === 200) {
        if (!res.out) aiDiag.push(`  ↑ توجه: پاسخ JSON خالی بود ولی مدل پذیرفته شد.`);
        return v;
      }
      if (res.status === 429) { aiStop = "سقف درخواست Groq پر است؛ بعداً دوباره اجرا کن"; return null; }
      if ([400, 401, 403].includes(res.status)) aiDiag.push(`  ⚠️ احتمالاً کلید GROQ_API_KEY مشکل دارد.`);
    } catch (e) { aiDiag.push(`${tag} → خطا: ${e.message}`); }
    await sleep(GAP);
  }
  aiStop = "اتصال به Groq برقرار نشد.";
  return null;
}

async function classify(data) {
  const sys = `تو ویراستار فهرست پادکست‌های فارسی (پرشین‌پاد) هستی. فقط بر اساس «داده‌ی پادکست» تصمیم بگیر و حدس نزن.
خروجی فقط یک JSON معتبر با این کلیدها:
- category: نام دسته. اگر پادکست در دسته‌های موجود (categories) جا می‌گیرد، دقیقاً یکی از آن نام‌ها را بده. اگر هیچ‌کدام مناسب نیست، یک نام دسته‌ی جدید فارسی پیشنهاد بده (کوتاه، ۲ تا ۴ کلمه).
- is_new_category: true اگر دسته‌ی جدیدی پیشنهاد دادی، وگرنه false
- subcategories: حداکثر ۲ زیردسته یا آرایه‌ی خالی
- is_podcast: true اگر این یک برنامه‌ی صوتی/پادکست واقعی است؛ false فقط اگر واقعاً پادکست نیست (موسیقی خالی، تبلیغ)
- confidence: «high» یا «low»

نکته: کتاب صوتی، برنامه‌ی خبری، پادکست گفت‌وگویی، مستند، آموزشی — همه پادکست محسوب می‌شوند و is_podcast باید true باشد.`;
  const cats = CATS.map((c) => ({ name: c.name, subcategories: c.subs }));
  const user = JSON.stringify({ categories: cats, podcast: { title: data.title_fa, description: data.description.slice(0, 700), episode_titles: data.episode_titles, index_categories: data.index_categories } });
  for (let i = 0; i < 2; i++) {
    if (aiCalls >= AI_BUDGET) { aiStop = `به سقف ${AI_BUDGET} درخواست این اجرا رسید؛ بقیه فردا`; return null; }
    const res = await chat(AI, sys, user, 350);
    if (res.status === 429 && i === 0) { await sleep(parseInt(E.RATE_WAIT_MS || "65000", 10)); continue; }
    if (res.status === 429) { aiStop = "سقف درخواست Groq پر شد؛ بقیه فردا"; return null; }
    if ([400, 401, 403, 404].includes(res.status)) { aiStop = `Groq HTTP ${res.status}`; return null; }
    if (res.status !== 200 || !res.out) return undefined;
    try {
      const o = JSON.parse(res.out.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      const catName = String(o.category || "").trim();
      if (!catName) return undefined;
      const isNew = o.is_new_category === true || !CAT_NAMES.includes(catName);
      const subs = (Array.isArray(o.subcategories) ? o.subcategories : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 2);
      return { category: catName, isNewCategory: isNew, subcategories: subs, isPodcast: o.is_podcast !== false, confidence: String(o.confidence).toLowerCase() === "high" ? "high" : "low" };
    } catch { return undefined; }
  }
  return undefined;
}
if (CLASSIFY && cand.length) { AI = await preflight(); if (AI) console.log(`Groq: ${AI.base} · ${AI.model}`); }

let sharp = null; try { sharp = (await import("sharp")).default; } catch { console.warn("sharp نصب نیست."); }
async function makeLogo(url, slug) {
  if (!sharp || !url) return "";
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (!r.ok) return "";
    const buf = Buffer.from(await r.arrayBuffer());
    await fs.mkdir(IMG_DIR, { recursive: true });
    await sharp(buf).resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toFile(path.join(IMG_DIR, slug + ".webp"));
    return `/assets/img/podcasts/${slug}.webp`;
  } catch (e) { console.warn(`لوگو ناموفق (${slug}): ${e.message}`); return ""; }
}

function makeSlugFromFa(faTitle, fallbackId) {
  let base = String(faTitle || "").trim();
  base = base.replace(/^پادکست\s+/i, "podcast ").replace(/^رادیو\s+/i, "radio ");
  let slug = translitFa(base);
  if (!slug || slug.length < 2) slug = `podcast-${fallbackId}`;
  return slug;
}

function build(F, T, slug, logo, L, eps, ai, full, status) {
  const fm = [`title: ${q(T.fa)}`, `title_en: ${q(T.en)}`, `slug: ${q(slug)}`, `description: ${q(ai.description)}`, `category: ${q(ai.category)}`,
    `subcategories: ${q(ai.subcategories)}`, `tags: ${q(ai.tags)}`, `status: ${q(status)}`, `language: "فارسی"`];
  if (full.author || full.ownerName) fm.push(`creator: ${q(full.author || full.ownerName)}`);
  fm.push(`episode_count: ${full.episodeCount || F.episodeCount || 0}`, `logo: ${q(logo)}`, `rss: ${q(full.url || F.url)}`);
  for (const k of ["website", "instagram", "telegram", "threads", "youtube", "apple", "spotify"]) if (L[k]) fm.push(`${k === "apple" ? "apple_podcasts" : k}: ${q(L[k])}`);
  fm.push(`pi_id: ${F.id}`, `source: "podcastindex"`, ...(ai.aiCat ? [`ai_category: true`] : []), ...(ai.isNewCategory ? [`new_category: true`] : []), `auto_imported: true`, `reviewed: false`, `published: false`);
  const a = `{:target="_blank" rel="noopener"}`;
  const epLines = eps.map((e) => (e.link && /^https?:/.test(e.link) ? `- [${e.title.replace(/[\[\]]/g, "")}](${e.link})${a}` : `- ${e.title}`));
  const rel = [];
  if (L.website) rel.push(`- [وب‌سایت ${T.fa}](${L.website})${a}`);
  if (L.apple) rel.push(`- [شنیدن در اپل پادکست](${L.apple})${a}`);
  if (L.spotify) rel.push(`- [شنیدن در اسپاتیفای](${L.spotify})${a}`);
  if (L.youtube) rel.push(`- [یوتیوب ${T.fa}](${L.youtube})${a}`);
  if (L.instagram) rel.push(`- [اینستاگرام ${T.fa}](${L.instagram})${a}`);
  if (L.telegram) rel.push(`- [تلگرام ${T.fa}](${L.telegram})${a}`);
  if (L.threads) rel.push(`- [Threads ${T.fa}](${L.threads})${a}`);
  rel.push(`- [فید RSS](${full.url || F.url})${a}`);
  const body = [`# ${T.fa}`, ""];
  if (ai.intro) body.push(ai.intro, "");
  if (ai.about) body.push("## درباره‌ی پادکست", "", ai.about, ""); else if (ai.text) body.push(ai.text, "");
  if (epLines.length) body.push("## تازه‌ترین قسمت‌ها", "", epLines.join("\n"), "");
  if (ai.hashtags.length) body.push("---", "", ai.hashtags.join(" "), "");
  const note = "این صفحه بر اساس اطلاعات عمومی منتشرشده‌ی پادکست شما (فید RSS) تهیه شده است. اگر صاحب یا نماینده‌ی این پادکست هستید، خوشحال می‌شویم با تکمیل [فرم معرفی پادکست](https://persianpod.ir/form/) به کامل‌تر و دقیق‌تر شدن این صفحه کمک کنید. برای هرگونه اصلاح، تکمیل یا حذف صفحه هم می‌توانید به contact@persianpod.ir پیام بدهید.";
  body.push("---", "", "## لینک‌های مرتبط و ارتباطات", "", rel.join("\n"), "",
    `> ${note}`, "");
  return `---\n${fm.join("\n")}\n---\n\n${body.join("\n")}`;
}

let aiOk = 0; const done = [], skipped = []; let fatal = "", failsInRow = 0; const seenKey = new Set();
let activeCount = 0, inactiveCount = 0;
await fs.mkdir(DRAFTS_DIR, { recursive: true });
for (const F of cand) {
  if (done.length >= (IDS.length ? IDS.length : LIMIT)) break;
  if (fatal || aiStop || failsInRow >= MAX_FAILS_IN_ROW) break;
  const T = splitTitle(F.title);
  const dupKey = normKey(F.title) + "|" + normKey(F.author || F.ownerName);
  if (!IDS.length) {
    if (seenKey.has(dupKey)) { skipped.push(`${F.id} «${T.fa}» — تکراری`); continue; }
    if (haveRss.has(F.url) || haveRss.has(F.originalUrl) || (T.en && normKey(T.en).length >= 3 && haveKey.has(normKey(T.en)))) { skipped.push(`${F.id} «${T.fa}» — احتمالاً همان صفحه‌ی موجود است`); continue; }
  }
  seenKey.add(dupKey);
  try {
    const fullR = await pi("/podcasts/byfeedid", { id: F.id }); const full = (fullR && fullR.feed && fullR.feed.id) ? fullR.feed : F;
    const epR = await pi("/episodes/byfeedid", { id: F.id, max: 3 });
    const eps = ((epR && epR.items) || []).filter((e) => e.title).slice(0, 3).map((e) => ({ title: String(e.title).replace(/\s+/g, " ").trim().slice(0, 140), link: e.link || "" }));
    const desc = cleanDesc(full.description || F.description);
    const L = links(`${full.description || ""} ${eps.map((e) => e.link).join(" ")}`, full, full);
    let slug = makeSlugFromFa(T.fa, F.id);
    if (haveSlug.has(slug)) slug = `${slug}-${F.id}`;
    const data = { title_fa: T.fa, title_en: T.en, author: full.author || "", description: desc, episode_titles: eps.map((e) => e.title), episode_count: full.episodeCount || F.episodeCount,
      index_categories: Object.values(full.categories || F.categories || {}) };
    const ai = basic(desc, data.index_categories);
    if (CLASSIFY) {
      const c = await classify(data);
      if (aiStop) break;
      if (c === undefined) {
        STATE.tries[F.id] = (STATE.tries[F.id] || 0) + 1;
        if (STATE.tries[F.id] >= 2) STATE.review[F.id] = { title: T.fa, reason: "دسته‌بندی دو بار ناموفق بود", cat: "" };
        skipped.push(`${F.id} «${T.fa}» — دسته‌بندی ناموفق (فردا دوباره)`);
        failsInRow++;
        await sleep(GAP); continue;
      }
      if (!c.isPodcast) {
        STATE.review[F.id] = { title: T.fa, reason: "پادکست نیست", cat: c.category };
        skipped.push(`${F.id} «${T.fa}» — پادکست نیست`);
        await sleep(GAP); continue;
      }
      if (c.isNewCategory) newCats.push({ id: F.id, title: T.fa, suggested: c.category, subs: c.subcategories });
      ai.category = c.category;
      ai.subcategories = c.subcategories;
      ai.tags = [c.category, ...c.subcategories].filter(Boolean);
      ai.weak = !c.isNewCategory && c.confidence !== "high";
      ai.aiCat = true;
      ai.isNewCategory = c.isNewCategory;
      aiOk++;
    }
    failsInRow = 0;
    const isActive = F.active === true;
    const status = isActive ? "فعال" : "متوقف شده";
    if (isActive) activeCount++; else inactiveCount++;
    const logo = await makeLogo(full.artwork || full.image || F.image, slug);
    await fs.writeFile(path.join(DRAFTS_DIR, slug + ".md"), build(F, T, slug, logo, L, eps, ai, full, status));
    haveSlug.add(slug); haveSlug.add(slug.toLowerCase()); done.push({ slug, title: T.fa, cat: ai.category, logo: !!logo, weak: ai.weak, isNewCategory: ai.isNewCategory, status });
    console.log(`✓ [draft] ${slug} — ${T.fa} (${ai.category}) [${status}]${ai.isNewCategory ? " [دسته‌ی جدید]" : ""}`);
  } catch (e) { skipped.push(`${F.id} «${T.fa}» — ${e.message}`); if (e.fatal) fatal = e.message; else failsInRow++; }
  await sleep(GAP);
}
const stopMsg = fatal ? `⛔ **اجرا متوقف شد:** ${fatal}\n\n` : failsInRow >= MAX_FAILS_IN_ROW ? `⛔ **اجرا متوقف شد:** ${MAX_FAILS_IN_ROW} شکست پشت‌سرهم\n\n` : "";

const rep = `## گزارش ساخت صفحه‌های جدید (drafts)

${stopMsg}### 📊 آمار کلی (منبع: feeds.json)

| مورد | تعداد |
|---|---|
| کل پادکست‌ها در \`feeds.json\` | **${stats.totalInFeeds}** |
| فعال (۳ سال اخیر) | ${stats.highActive} |
| **متوقف شده (بیش از ۳ سال)** | **${stats.highInactive}** |
| فارسی + حداقل ۳ قسمت | ${stats.faOk} |
| قبلاً ساخته‌شده | ${stats.alreadyBuilt} |
| در انتظار بازبینی دستی | ${stats.inReview} |
| **کاندیدهای واجد شرایط (فعال + متوقف)** | **${stats.allCandidates}** |

### 🎯 این اجرا

- این اجرا حداکثر: **${stats.thisRunLimit}** (سقف \`limit\` = ${LIMIT})
- سقف درخواست AI: **${stats.aiBudget}**
- **ساخته‌شده در \`_drafts/\`: ${done.length}** (فعال: ${activeCount} · متوقف: ${inactiveCount})
- ردشده/کنار گذاشته‌شده: ${skipped.length}${CLASSIFY ? `\n- دسته‌بندی با Groq: ${aiOk} پادکست؛ ${aiCalls} درخواست${aiStop ? `\n- ⚠️ ${aiStop}` : ""}` : ""}
- در انتظار بازبینی دستی: ${Object.keys(STATE.review).length}${newCats.length ? `\n- 🆕 **دسته‌های جدید پیشنهادی: ${newCats.length}**` : ""}${CLASSIFY && aiDiag.length ? `\n\n### تشخیص اتصال به Groq\n` + aiDiag.map((d) => "- " + d).join("\n") : ""}

${stats.allCandidates - done.length > 0 ? `> ℹ️ **${stats.allCandidates - done.length}** پادکست واجد شرایط دیگر باقی مانده. برای ساخت بقیه، workflow را دوباره اجرا کن.\n` : ""}
${done.map((d) => `- \`${d.slug}\` — ${d.title} · ${d.cat} · **${d.status}**${d.isNewCategory ? " 🆕" : ""}${d.logo ? "" : " · بدون لوگو"}${d.weak ? ` · ⚠️ دسته‌ی ضعیف` : ""}`).join("\n")}
${newCats.length ? "\n### 🆕 دسته‌های جدید پیشنهادی\n" + newCats.map((n) => `- \`${n.suggested}\` — برای «${n.title}»${n.subs.length ? ` (زیردسته‌ها: ${n.subs.join("، ")})` : ""}`).join("\n") : ""}
${skipped.length ? "\n### ردشده\n" + skipped.map((s) => "- " + s).join("\n") : ""}
`;
await fs.mkdir(DATA, { recursive: true });
await fs.writeFile(STATE_FILE, jsonSafe(STATE, 1));
const revIds = Object.keys(STATE.review);
await fs.writeFile(path.join(DATA, "needs-review.md"), `# پادکست‌های در انتظار تصمیم دستی\n\n` + (revIds.length ? revIds.map((id) => `- \`${id}\` «${STATE.review[id].title}» — ${STATE.review[id].reason}`).join("\n") : "فعلاً خالی است.") + "\n");
if (newCats.length) {
  await fs.writeFile(NEW_CATS_FILE, `# دسته‌های جدید پیشنهادی\n\n` + newCats.map((n) => `- **${n.suggested}** — برای «${n.title}» (pi_id: ${n.id})${n.subs.length ? `\n  - زیردسته‌های پیشنهادی: ${n.subs.join("، ")}` : ""}`).join("\n") + "\n");
}
await fs.writeFile(path.join(DATA, "build-report.md"), rep);
console.log("\n" + rep);