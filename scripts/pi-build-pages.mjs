/* PersianPod: مرحله‌ی ۳ — ساخت صفحه‌ی سبک برای پادکست‌های تازه‌ی Podcast Index
   ورودی:  _data/pi/feeds.json و matches.json (خروجی مرحله‌ی ۱)، _data/categories.yml
   خروجی:  _podcasts/<slug>.md  با published:false  +  assets/img/podcasts/<slug>.webp  +  _data/pi/build-report.md
   قاعده: همه‌ی حقیقت‌ها از Podcast Index/RSS می‌آید. با CLASSIFY=1 (پیش‌فرض workflow) هر پادکست قبل از ساخت صفحه با GitHub Models (رایگان، با GITHUB_TOKEN)
   دسته‌بندی می‌شود (یک درخواست برای هر پادکست: دسته + زیردسته + نوع + اطمینان). پادکستی که دسته‌اش قطعی نشود، یا کتاب صوتی/رسانه‌ی خبری باشد، صفحه نمی‌گیرد
   و در _data/pi/needs-review.md می‌ماند. به سقف روزانه که رسیدیم اجرا می‌ایستد و بقیه نوبت فردا می‌ماند. با CLASSIFY=0 فقط جدول نگاشت دسته‌ها استفاده می‌شود. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const E = process.env;
const LIMIT = Math.max(1, parseInt(E.LIMIT || "10", 10)), SORT = E.SORT || "episodes";
const IDS = (E.IDS || "").split(/[,\s،]+/).filter(Boolean).map(Number).filter(Boolean);   // اختیاری: فقط همین pi_idها ساخته شوند (برای تست دقیق)
const MAX_FAILS_IN_ROW = 5;                                                                  // اگر پشت‌سرهم این‌قدر شکست خورد، توقف
const PODCASTS_DIR = E.PI_PODCASTS || "_podcasts", IMG_DIR = E.PI_IMG || "assets/img/podcasts", DATA = E.PI_OUT || "_data/pi";
const CATS_FILE = E.PI_CATS || "_data/categories.yml";
const PI_BASE = E.PI_BASE || "https://api.podcastindex.org/api/1.0";
const CLASSIFY = E.CLASSIFY === "1", PUBLISH = E.PUBLISH === "1";           // PUBLISH=1: صفحه‌ها مستقیم منتشر شوند (published: true)
const AI_BUDGET = parseInt(E.AI_BUDGET || "130", 10);                        // سقف درخواست به GitHub Models در هر اجرا (سقف روزانه‌ی پلن رایگان ۱۵۰ است)
const GH_BASE = E.GH_MODELS_BASE || "https://models.github.ai/inference", GH_MODEL = E.GH_MODEL || "openai/gpt-4.1-mini";
const GH_TOKEN = E.GH_MODELS_TOKEN || E.GITHUB_TOKEN || "";
const GAP = parseInt(E.GAP_MS || (CLASSIFY ? "4500" : "800"), 10);        // سقف دقیقه‌ای مدل‌های کوچک: ۱۵ درخواست در دقیقه
if (!E.PI_KEY || !E.PI_SECRET) { console.error("PI_KEY / PI_SECRET تنظیم نشده‌اند."); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Podcast Index ---------- */
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

/* ---------- دسته‌ها (خواندن ساده‌ی categories.yml) ---------- */
const catsTxt = await fs.readFile(CATS_FILE, "utf8"), CATS = [];
for (const line of catsTxt.split("\n")) {
  let m;
  if ((m = line.match(/^- name:\s*(.+?)\s*$/))) CATS.push({ name: m[1], subs: [] });
  else if ((m = line.match(/^\s+- (.+?)\s*$/)) && CATS.length) CATS[CATS.length - 1].subs.push(m[1]);
}
if (!CATS.length) { console.error("categories.yml خوانده نشد."); process.exit(1); }

/* ---------- ابزارها ---------- */
const toEn = (s) => String(s).replace(/[\u06F0-\u06F9]/g, (d) => d.charCodeAt(0) - 1776).replace(/[\u0660-\u0669]/g, (d) => d.charCodeAt(0) - 1632);
const q = JSON.stringify;
const hasFa = (s) => /[\u0600-\u06FF]/.test(s), hasLat = (s) => /[A-Za-z]/.test(s);
const SPLIT = /\s*(?:[|｜–—:؛]|\s-\s)\s*/;
function splitTitle(t) {
  const parts = String(t || "").split(SPLIT).map((x) => x.trim()).filter(Boolean);
  const fa = (parts.find((x) => hasFa(x)) || String(t || "").trim()).replace(/^[\u200c\u200f\s]+|[\u200c\u200f\s]+$/g, "");
  let en = parts.find((x) => hasLat(x) && !hasFa(x)) || "";
  if (!en) {                                   // عنوان بدون جداکننده: بلندترین دنباله‌ی لاتین داخل عنوان (مثلاً BPLUS)
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

/* ---------- موجودها: pi_id و slug صفحه‌های فعلی ---------- */
const havePi = new Set(), haveSlug = new Set();
for (const n of await fs.readdir(PODCASTS_DIR).catch(() => [])) {
  if (!n.endsWith(".md")) continue;
  haveSlug.add(n.replace(/\.md$/, ""));
  const fm = ((await fs.readFile(path.join(PODCASTS_DIR, n), "utf8")).match(/^---\s*\n([\s\S]*?)\n---/) || [, ""])[1];
  const id = (fm.match(/^pi_id:\s*"?(\d+)/m) || [])[1]; if (id) havePi.add(+id);
  const sl = (fm.match(/^slug:\s*"?([^"\n]+)/m) || [])[1]; if (sl) haveSlug.add(sl.trim());
}
const haveRss = new Set(), haveKey = new Set();
const normKey = (x) => String(x || "").replace(/[\u06F0-\u06F9]/g, (d) => d.charCodeAt(0) - 1776).toLowerCase().replace(/[\s\u200c\u200f_\-|:·.,،؛]+/g, "");
for (const n of await fs.readdir(PODCASTS_DIR).catch(() => [])) {
  if (!n.endsWith(".md")) continue;
  const fm = ((await fs.readFile(path.join(PODCASTS_DIR, n), "utf8")).match(/^---\s*\n([\s\S]*?)\n---/) || [, ""])[1];
  const rss = (fm.match(/^rss:\s*"?([^"\n]+)/m) || [])[1]; if (rss) haveRss.add(rss.trim());
  const te = (fm.match(/^title_en:\s*"?([^"\n]+)/m) || [])[1]; if (te && normKey(te).length >= 3) haveKey.add(normKey(te));
}
try { for (const m of JSON.parse(await fs.readFile(path.join(DATA, "matches.json"), "utf8")).matches || []) havePi.add(+m.pi_id); } catch { /* اختیاری */ }

/* ---------- وضعیت وارد کردن (تلاش‌ها و فهرست بازبینی) ---------- */
const STATE_FILE = path.join(DATA, "import-state.json");
let STATE = { tries: {}, review: {} };
try { STATE = { tries: {}, review: {}, ...JSON.parse(await fs.readFile(STATE_FILE, "utf8")) }; } catch { /* اولین اجرا */ }

/* ---------- انتخاب نامزدها ---------- */
const feeds = JSON.parse(await fs.readFile(path.join(DATA, "feeds.json"), "utf8"));
let cand;
if (IDS.length) {                                   // حالت دستی: فقط شناسه‌های داده‌شده، به همان ترتیب
  const byId = new Map(feeds.map((f) => [+f.id, f]));
  cand = IDS.map((id) => byId.get(id)).filter((f) => f && !havePi.has(+f.id));
  const bad = IDS.filter((id) => !byId.has(id) || havePi.has(id));
  if (bad.length) console.warn("نادیده گرفته شد (در feeds.json نیست یا قبلاً ساخته شده): " + bad.join(", "));
} else {
  cand = feeds.filter((f) => f.confidence === "high" && f.active === true && !f.dead && !havePi.has(+f.id) && !STATE.review[f.id] && (f.episodeCount || 0) >= 3 && hasFa(f.title || ""));
  cand.sort(SORT === "recent" ? (a, b) => (b.newestItemPubdate || 0) - (a.newestItemPubdate || 0) : (a, b) => (b.episodeCount || 0) - (a.episodeCount || 0));
}
console.log(`نامزد: ${cand.length}، ساخته می‌شود: ${Math.min(LIMIT, cand.length)}`);

/* ---------- حالت پایه (بدون هوش مصنوعی) ---------- */
const CAT_MAP = [   // به ترتیب اولویت؛ اولین ردیفی که یکی از دسته‌های Podcast Index در آن باشد انتخاب می‌شود
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
  return { category, weak: !hit, suggested: "", subcategories: [], tags: hit ? [category] : [], hashtags: [], description, intro: "", about: "", text: text.slice(0, 1200) };
}

/* ---------- GitHub Models: اتصال، تشخیص، دسته‌بندی ---------- */
let aiStop = "", aiCalls = 0, AI = null; const aiDiag = [];
const KINDS = { audiobook: "کتاب صوتی/رمان‌خوانی", news_outlet: "برنامه‌ی یک رسانه‌ی خبری سازمانی", other: "غیرپادکستی یا نامشخص" };
async function chat(cfg, system, user, maxTokens) {
  const payload = { model: cfg.model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: maxTokens };
  if (cfg.rf) payload.response_format = { type: "json_object" };
  aiCalls++;
  const r = await fetch(`${cfg.base}/chat/completions`, { method: "POST", signal: AbortSignal.timeout(60000),
    headers: { "Content-Type": "application/json", Accept: "application/vnd.github+json", Authorization: "Bearer " + GH_TOKEN, "X-GitHub-Api-Version": "2022-11-28" }, body: JSON.stringify(payload) });
  const text = await r.text();
  let out = ""; try { const j = JSON.parse(text); out = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ""; } catch { /* پاسخ JSON نیست */ }
  return { status: r.status, ctype: (r.headers.get("content-type") || "").split(";")[0], text, out };
}
// قبل از لمس هر پادکست، چند حالت اتصال را امتحان می‌کند و اولین حالتِ سالم را برمی‌دارد؛ نتیجه‌ی هر تلاش در گزارش می‌آید
async function preflight() {
  const legacy = E.GH_LEGACY_BASE || "https://models.inference.ai.azure.com", bare = GH_MODEL.replace(/^[^/]+\//, "");
  const variants = [
    { base: GH_BASE, model: GH_MODEL, rf: true }, { base: GH_BASE, model: GH_MODEL, rf: false },
    { base: GH_BASE, model: "openai/gpt-4o-mini", rf: false }, { base: legacy, model: bare, rf: false },
  ].filter((v, i, a) => a.findIndex((x) => x.base === v.base && x.model === v.model && x.rf === v.rf) === i);
  for (const v of variants) {
    const tag = `${v.base} · ${v.model}${v.rf ? " · json_mode" : ""}`;
    try {
      const res = await chat(v, "فقط یک JSON معتبر بده.", 'خروجی: {"ok": true}', 30);
      aiDiag.push(`${tag} → HTTP ${res.status} · ${res.ctype || "?"} · ${res.text.replace(/\s+/g, " ").slice(0, 140)}`);
      if (res.status === 200 && res.out) return v;
      if (res.status === 429) { aiStop = "سقف درخواست GitHub Models پر است؛ بعداً دوباره اجرا کن"; return null; }
    } catch (e) { aiDiag.push(`${tag} → خطا: ${e.message}`); }
    await sleep(GAP);
  }
  aiStop = "اتصال به GitHub Models برقرار نشد؛ جزئیات هر تلاش در «تشخیص اتصال» آمده. هیچ پادکستی تغییر نکرد و تلاشی از آن‌ها کم نشد";
  return null;
}
async function classify(data) {
  const sys = `تو ویراستار فهرست پادکست‌های فارسی (پرشین‌پاد) هستی. فقط بر اساس «داده‌ی پادکست» تصمیم بگیر و حدس نزن.
خروجی فقط یک JSON معتبر با این کلیدها:
- category: دقیقاً یکی از نام‌های categories
- subcategories: حداکثر ۲ مورد از زیردسته‌های همان دسته (یا آرایه‌ی خالی)
- kind: «podcast» برای برنامه‌ی صوتی معمولی؛ «audiobook» برای کتاب صوتی و رمان‌خوانی؛ «news_outlet» برای برنامه‌ی یک رسانه‌ی خبری سازمانی؛ «other» برای چیز غیرپادکستی
- confidence: «high» اگر عنوان و توضیح دسته را روشن می‌کنند، وگرنه «low»`;
  const cats = CATS.map((c) => ({ name: c.name, subcategories: c.subs }));
  const user = JSON.stringify({ categories: cats, podcast: { title: data.title_fa, description: data.description.slice(0, 700), episode_titles: data.episode_titles, index_categories: data.index_categories } });
  for (let i = 0; i < 2; i++) {
    if (aiCalls >= AI_BUDGET) { aiStop = `به سقف ${AI_BUDGET} درخواست این اجرا رسید؛ بقیه فردا`; return null; }
    const res = await chat(AI, sys, user, 250);
    if (res.status === 429 && i === 0) { await sleep(parseInt(E.RATE_WAIT_MS || "65000", 10)); continue; }   // احتمالاً سقف دقیقه‌ای
    if (res.status === 429) { aiStop = "سقف درخواست GitHub Models پر شد (احتمالاً سقف روزانه)؛ بقیه فردا"; return null; }
    if ([400, 401, 403, 404].includes(res.status)) { aiStop = `GitHub Models HTTP ${res.status}: ${res.text.replace(/\s+/g, " ").slice(0, 160)}`; return null; }
    if (res.status !== 200 || !res.out) return undefined;                                                   // خطای موقت یا پاسخ نامعتبر
    try {
      const o = JSON.parse(res.out.replace(/^```(?:json)?\s*|\s*```$/g, "")), cat = CATS.find((c) => c.name === String(o.category || "").trim());
      if (!cat) return undefined;
      const subs = (Array.isArray(o.subcategories) ? o.subcategories : []).map((x) => String(x).trim()).filter((x) => cat.subs.includes(x)).slice(0, 2);
      return { category: cat.name, subcategories: subs, kind: ["podcast", "audiobook", "news_outlet", "other"].includes(o.kind) ? o.kind : "other", confidence: String(o.confidence).toLowerCase() === "high" ? "high" : "low" };
    } catch { return undefined; }
  }
  return undefined;
}
if (CLASSIFY && cand.length) { AI = await preflight(); if (AI) console.log(`GitHub Models: ${AI.base} · ${AI.model}`); }

/* ---------- لوگو → webp ---------- */
let sharp = null; try { sharp = (await import("sharp")).default; } catch { console.warn("sharp نصب نیست؛ لوگوها ساخته نمی‌شوند."); }
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

/* ---------- ساخت فایل md ---------- */
function build(F, T, slug, logo, L, eps, ai, full) {
  const fm = [`title: ${q(T.fa)}`, `title_en: ${q(T.en)}`, `slug: ${q(slug)}`, `description: ${q(ai.description)}`, `category: ${q(ai.category)}`,
    `subcategories: ${q(ai.subcategories)}`, `tags: ${q(ai.tags)}`, `status: "active"`, `language: "فارسی"`];
  if (full.author || full.ownerName) fm.push(`creator: ${q(full.author || full.ownerName)}`);
  fm.push(`episode_count: ${full.episodeCount || F.episodeCount || 0}`, `logo: ${q(logo)}`, `rss: ${q(full.url || F.url)}`);
  for (const k of ["website", "instagram", "telegram", "threads", "youtube", "apple", "spotify"]) if (L[k]) fm.push(`${k === "apple" ? "apple_podcasts" : k}: ${q(L[k])}`);
  fm.push(`pi_id: ${F.id}`, `source: "podcastindex"`, ...(ai.aiCat ? [`ai_category: true`] : []), `auto_imported: true`, `reviewed: false`, `published: ${PUBLISH}`);
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
  const note = "این صفحه خودکار و از اطلاعات عمومی منتشرشده‌ی پادکست (فید RSS و Podcast Index) ساخته شده و هنوز کامل نیست.";
  body.push("---", "", "## لینک‌های مرتبط و ارتباطات", "", rel.join("\n"), "",
    `> ${note} اگر صاحب یا نماینده‌ی این پادکست هستید، برای تکمیل و اصلاح آن [فرم معرفی پادکست](https://persianpod.ir/form/) را پر کنید؛ برای حذف صفحه هم به contact@persianpod.ir پیام بدهید.`, "");
  return `---\n${fm.join("\n")}\n---\n\n${body.join("\n")}`;
}

/* ---------- اجرا ---------- */
let aiOk = 0; const done = [], skipped = []; let fatal = "", failsInRow = 0; const seenKey = new Set();
await fs.mkdir(PODCASTS_DIR, { recursive: true });
for (const F of cand) {
  if (done.length >= (IDS.length ? IDS.length : LIMIT)) break;
  if (fatal || aiStop || failsInRow >= MAX_FAILS_IN_ROW) break;
  const T = splitTitle(F.title);
  const dupKey = normKey(F.title) + "|" + normKey(F.author || F.ownerName);
  if (!IDS.length) {                                // تکراری‌ها: همان عنوان+سازنده (چند فید برای یک پادکست)، یا RSS و نام انگلیسیِ موجود
    if (seenKey.has(dupKey)) { skipped.push(`${F.id} «${T.fa}» — تکراری (فید دیگری از همین پادکست)`); continue; }
    if (haveRss.has(F.url) || haveRss.has(F.originalUrl) || (T.en && normKey(T.en).length >= 3 && haveKey.has(normKey(T.en)))) { skipped.push(`${F.id} «${T.fa}» — احتمالاً همان صفحه‌ی دستیِ موجود است`); continue; }
  }
  seenKey.add(dupKey);
  try {
    const fullR = await pi("/podcasts/byfeedid", { id: F.id }); const full = (fullR && fullR.feed && fullR.feed.id) ? fullR.feed : F;
    const epR = await pi("/episodes/byfeedid", { id: F.id, max: 3 });
    const eps = ((epR && epR.items) || []).filter((e) => e.title).slice(0, 3).map((e) => ({ title: String(e.title).replace(/\s+/g, " ").trim().slice(0, 140), link: e.link || "" }));
    const desc = cleanDesc(full.description || F.description);
    const L = links(`${full.description || ""} ${eps.map((e) => e.link).join(" ")}`, full, full);
    let slug = (T.en || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `podcast-${F.id}`;
    if (haveSlug.has(slug)) slug = `${slug}-${F.id}`;
    const data = { title_fa: T.fa, title_en: T.en, author: full.author || "", description: desc, episode_titles: eps.map((e) => e.title), episode_count: full.episodeCount || F.episodeCount,
      index_categories: Object.values(full.categories || F.categories || {}) };
    const ai = basic(desc, data.index_categories);
    if (CLASSIFY) {
      const c = await classify(data);
      if (aiStop) break;                                                            // سقف یا خطای دسترسی: همین‌جا می‌ایستیم، پادکست فردا دوباره امتحان می‌شود
      const reason = c === undefined || c === null ? "" : c.kind !== "podcast" ? `نوع: ${KINDS[c.kind]}` : c.confidence !== "high" ? `دسته نامطمئن (پیشنهاد: ${c.category})` : "";
      if (c === undefined) { STATE.tries[F.id] = (STATE.tries[F.id] || 0) + 1; if (STATE.tries[F.id] >= 2) STATE.review[F.id] = { title: T.fa, reason: "دسته‌بندی دو بار ناموفق بود", cat: "" }; skipped.push(`${F.id} «${T.fa}» — دسته‌بندی ناموفق (فردا دوباره)`); failsInRow++; await sleep(GAP); continue; }
      if (reason && !IDS.length) { STATE.review[F.id] = { title: T.fa, reason, cat: c.category }; skipped.push(`${F.id} «${T.fa}» — برای بازبینی کنار گذاشته شد: ${reason}`); await sleep(GAP); continue; }
      ai.category = c.category; ai.subcategories = c.subcategories; ai.tags = [c.category, ...c.subcategories]; ai.weak = false; ai.aiCat = true; aiOk++;
    }
    failsInRow = 0;
    const logo = await makeLogo(full.artwork || full.image || F.image, slug);
    await fs.writeFile(path.join(PODCASTS_DIR, slug + ".md"), build(F, T, slug, logo, L, eps, ai, full));
    haveSlug.add(slug); haveSlug.add(slug.toLowerCase()); done.push({ slug, title: T.fa, cat: ai.category, logo: !!logo, weak: ai.weak, suggested: ai.suggested });
    console.log(`✓ ${slug} — ${T.fa} (${ai.category})`);
  } catch (e) { skipped.push(`${F.id} «${T.fa}» — ${e.message}`); if (e.fatal) fatal = e.message; else failsInRow++; }
  await sleep(GAP);
}
const stopMsg = fatal ? `⛔ **اجرا متوقف شد:** ${fatal}\n\n` : failsInRow >= MAX_FAILS_IN_ROW ? `⛔ **اجرا متوقف شد:** ${MAX_FAILS_IN_ROW} شکست پشت‌سرهم (علت را در فهرست «ردشده» ببین)\n\n` : "";
const rep = `## گزارش ساخت صفحه‌های جدید

${stopMsg}- ساخته‌شده: **${done.length}** (${PUBLISH ? "منتشر شده‌اند" : "همه با \`published: false\`؛ تا تأیید نکنی روی سایت نمی‌آیند"})
- ردشده/کنار گذاشته‌شده: ${skipped.length}${CLASSIFY ? `\n- دسته‌بندی با GitHub Models: ${aiOk} پادکست؛ ${aiCalls} درخواست مصرف شد (سقف روزانه‌ی پلن رایگان ۱۵۰)${aiStop ? `\n- ⚠️ ${aiStop}` : ""}` : ""}
- در انتظار بازبینی دستی: ${Object.keys(STATE.review).length} (فایل needs-review.md)${CLASSIFY && aiDiag.length ? `\n\n### تشخیص اتصال به GitHub Models\n` + aiDiag.map((d) => "- " + d).join("\n") : ""}

${done.map((d) => `- \`${d.slug}\` — ${d.title} · ${d.cat}${d.logo ? "" : " · بدون لوگو"}${d.weak ? ` · ⚠️ دسته‌ی ضعیف${d.suggested ? ` (پیشنهاد دسته‌ی تازه: ${d.suggested})` : ""}` : ""}`).join("\n")}
${skipped.length ? "\n### ردشده\n" + skipped.map((s) => "- " + s).join("\n") : ""}
`;
await fs.mkdir(DATA, { recursive: true });
await fs.writeFile(STATE_FILE, JSON.stringify(STATE, null, 1));
const revIds = Object.keys(STATE.review);
await fs.writeFile(path.join(DATA, "needs-review.md"), `# پادکست‌های در انتظار تصمیم دستی\n\nبرای ساختن صفحه‌ی هر کدام، شناسه‌اش را در ورودی \`ids\` بنویس (در این حالت هرچه مدل پیشنهاد داده بدون بازبینی پذیرفته می‌شود).\n\n` + (revIds.length ? revIds.map((id) => `- \`${id}\` «${STATE.review[id].title}» — ${STATE.review[id].reason}`).join("\n") : "فعلاً خالی است.") + "\n");
await fs.writeFile(path.join(DATA, "build-report.md"), rep);
console.log("\n" + rep);
