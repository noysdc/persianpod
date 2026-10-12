/* PersianPod: مرحله‌ی ۳ — ساخت صفحه‌ی سبک برای پادکست‌های تازه‌ی Podcast Index
   ورودی:  _data/pi/feeds.json و matches.json (خروجی مرحله‌ی ۱)، _data/categories.yml
   خروجی:  _podcasts/<slug>.md  با published:false  +  assets/img/podcasts/<slug>.webp  +  _data/pi/build-report.md
   قاعده: حقیقت‌ها (عنوان، لینک، عددها، لوگو) را کد می‌نویسد؛ DeepSeek فقط متن و دسته را پیشنهاد می‌دهد (JSON). */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const E = process.env;
const LIMIT = Math.max(1, parseInt(E.LIMIT || "10", 10)), SORT = E.SORT || "episodes";
const PODCASTS_DIR = E.PI_PODCASTS || "_podcasts", IMG_DIR = E.PI_IMG || "assets/img/podcasts", DATA = E.PI_OUT || "_data/pi";
const CATS_FILE = E.PI_CATS || "_data/categories.yml";
const PI_BASE = E.PI_BASE || "https://api.podcastindex.org/api/1.0";
const DS_BASE = E.DEEPSEEK_BASE || "https://api.deepseek.com", DS_MODEL = E.DEEPSEEK_MODEL || "deepseek-chat";
if (!E.PI_KEY || !E.PI_SECRET || !E.DEEPSEEK_API_KEY) { console.error("PI_KEY / PI_SECRET / DEEPSEEK_API_KEY تنظیم نشده‌اند."); process.exit(1); }
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
try { for (const m of JSON.parse(await fs.readFile(path.join(DATA, "matches.json"), "utf8")).matches || []) havePi.add(+m.pi_id); } catch { /* اختیاری */ }

/* ---------- انتخاب نامزدها ---------- */
const feeds = JSON.parse(await fs.readFile(path.join(DATA, "feeds.json"), "utf8"));
const cand = feeds.filter((f) => f.confidence === "high" && f.active === true && !f.dead && !havePi.has(+f.id) && (f.episodeCount || 0) >= 3 && hasFa(f.title || ""));
cand.sort(SORT === "recent" ? (a, b) => (b.newestItemPubdate || 0) - (a.newestItemPubdate || 0) : (a, b) => (b.episodeCount || 0) - (a.episodeCount || 0));
console.log(`نامزد: ${cand.length}، ساخته می‌شود: ${Math.min(LIMIT, cand.length)}`);

/* ---------- DeepSeek ---------- */
const SYSTEM = `تو ویراستار فارسی‌زبان پرشین‌پاد (راهنمای پادکست‌های فارسی) هستی.
فقط بر اساس «داده‌ی پادکست» که به تو می‌دهم بنویس. هرچه در داده نیست اضافه نکن (نام میزبان، سال شروع، جایزه، آمار و ...). اگر چیزی معلوم نبود، ننویس.
خروجی فقط یک JSON معتبر (json) باشد با این کلیدها:
- description: معرفی یک‌جمله‌ای، حداکثر ۲۰۰ نویسه
- intro: یک پاراگراف روایی و سوم‌شخص (۴۰ تا ۷۰ کلمه)
- about: دو پاراگراف کوتاه درباره‌ی موضوع و فضای پادکست (با خط خالی بینشان)
- category: دقیقاً یکی از نام‌های «categories»
- subcategories: حداکثر ۲ مورد از زیردسته‌های همان دسته (یا آرایه‌ی خالی)
- tags: حداکثر ۵ برچسب فارسی
- hashtags: ۸ تا ۱۲ هشتگ با زیرخط (مثلاً #پادکست_فارسی)
- fit: «good» اگر یکی از دسته‌ها واقعاً مناسب است؛ «weak» اگر هیچ‌کدام مناسب نیست و فقط نزدیک‌ترین را انتخاب کرده‌ای
- suggested_category: فقط وقتی fit برابر weak است، نام کوتاه یک دسته‌ی تازه‌ی پیشنهادی؛ وگرنه رشته‌ی خالی
لحن: روایی و گرم، بدون تبلیغ و اغراق. اعداد را با ارقام انگلیسی بنویس. جمله‌های تبلیغاتی میزبان (Hosted on ...) را نادیده بگیر.`;
async function ask(data, feedback) {
  const user = { podcast: data, categories: CATS.map((c) => ({ name: c.name, subcategories: c.subs })) };
  const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: "داده‌ی پادکست (json):\n" + JSON.stringify(user) + (feedback ? "\n\nخطای قبلی: " + feedback : "") }];
  const r = await fetch(DS_BASE + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + E.DEEPSEEK_API_KEY },
    body: JSON.stringify({ model: DS_MODEL, messages, response_format: { type: "json_object" }, temperature: 0.4, max_tokens: 1800 }) });
  if (!r.ok) throw new Error("DeepSeek HTTP " + r.status);
  const j = await r.json();
  return JSON.parse(j.choices[0].message.content);
}
function validate(a) {
  const cat = CATS.find((c) => c.name === a.category);
  if (!cat) return "category باید دقیقاً یکی از نام‌های categories باشد";
  for (const k of ["description", "intro", "about"]) if (typeof a[k] !== "string" || a[k].trim().length < 10) return `${k} خالی یا نامعتبر است`;
  const subs = (Array.isArray(a.subcategories) ? a.subcategories : []).filter((s) => cat.subs.includes(s)).slice(0, 2);
  const tags = (Array.isArray(a.tags) ? a.tags : []).map((t) => toEn(String(t)).trim()).filter(Boolean).slice(0, 5);
  const hashtags = (Array.isArray(a.hashtags) ? a.hashtags : []).map((h) => "#" + String(h).replace(/^#+/, "").trim().replace(/\s+/g, "_")).filter((h) => h.length > 2).slice(0, 12);
  let description = toEn(a.description).trim(); if (description.length > 200) description = description.slice(0, 197).replace(/\s+\S*$/, "") + "…";
  const weak = String(a.fit || "").toLowerCase() === "weak", suggested = weak ? String(a.suggested_category || "").trim().slice(0, 60) : "";
  return { category: cat.name, weak, suggested, subcategories: subs, tags, hashtags, description, intro: toEn(a.intro).trim(), about: toEn(a.about).trim() };
}

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
  fm.push(`pi_id: ${F.id}`, `source: "podcastindex"`, `ai_generated: true`, `reviewed: false`, `published: false`);
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
  const body = [`# ${T.fa}`, "", ai.intro, "", "## درباره‌ی پادکست", "", ai.about, ""];
  if (epLines.length) body.push("## تازه‌ترین قسمت‌ها", "", epLines.join("\n"), "");
  body.push("---", "", ai.hashtags.join(" "), "", "---", "", "## لینک‌های مرتبط و ارتباطات", "", rel.join("\n"), "",
    "> این صفحه با کمک هوش مصنوعی و بر پایه‌ی اطلاعات منتشرشده‌ی پادکست ساخته شده و هنوز کامل نیست. اگر صاحب یا نماینده‌ی این پادکست هستید، برای تکمیل و اصلاح آن [فرم معرفی پادکست](https://persianpod.ir/form/) را پر کنید.", "");
  return `---\n${fm.join("\n")}\n---\n\n${body.join("\n")}`;
}

/* ---------- اجرا ---------- */
const done = [], skipped = [];
await fs.mkdir(PODCASTS_DIR, { recursive: true });
for (const F of cand) {
  if (done.length >= LIMIT) break;
  const T = splitTitle(F.title);
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
    let ai = null, err = "";
    for (let i = 0; i < 3 && !ai; i++) {
      try { const raw = await ask(data, err); const v = validate(raw); if (typeof v === "string") err = v; else ai = v; } catch (e) { err = e.message; await sleep(1500); }
    }
    if (!ai) { skipped.push(`${F.id} «${T.fa}» — ${err}`); continue; }
    const logo = await makeLogo(full.artwork || full.image || F.image, slug);
    await fs.writeFile(path.join(PODCASTS_DIR, slug + ".md"), build(F, T, slug, logo, L, eps, ai, full));
    haveSlug.add(slug); haveSlug.add(slug.toLowerCase()); done.push({ slug, title: T.fa, cat: ai.category, logo: !!logo, weak: ai.weak, suggested: ai.suggested });
    console.log(`✓ ${slug} — ${T.fa} (${ai.category})`);
  } catch (e) { skipped.push(`${F.id} «${T.fa}» — ${e.message}`); }
  await sleep(800);
}
const rep = `## گزارش ساخت صفحه‌های جدید

- ساخته‌شده: **${done.length}** (همه با \`published: false\`؛ تا تأیید نکنی روی سایت نمی‌آیند)
- ردشده: ${skipped.length}

${done.map((d) => `- \`${d.slug}\` — ${d.title} · ${d.cat}${d.logo ? "" : " · بدون لوگو"}${d.weak ? ` · ⚠️ دسته‌ی ضعیف${d.suggested ? ` (پیشنهاد دسته‌ی تازه: ${d.suggested})` : ""}` : ""}`).join("\n")}
${skipped.length ? "\n### ردشده\n" + skipped.map((s) => "- " + s).join("\n") : ""}
`;
await fs.mkdir(DATA, { recursive: true });
await fs.writeFile(path.join(DATA, "build-report.md"), rep);
console.log("\n" + rep);
