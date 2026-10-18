/* PersianPod: تشخیص پادکستِ تکراری (مشترک بین pi-build-pages، pi-approve و audit-duplicates)

   یک پادکست وقتی «تکراری» حساب می‌شود که با یک صفحه‌ی موجود در هر کدام از _podcasts، _drafts یا _blocked
   در یکی از این‌ها یکی باشد:
     ۱) pi_id (شناسه‌ی Podcast Index)
     ۲) آدرس RSS (بدون http/www/پارامتر/اسلش آخر؛ هم url و هم originalUrl فید)
     ۳) شناسه‌ی اپل‌پادکست
     ۴) عنوان (کامل یا هر بخشِ «A | B»، با حذف واژه‌ی عمومی «پادکست») به شرط اینکه سازنده با هم نخواند: سازنده یا خالی باشد یا یکی باشد
   اگر عنوان یکی ولی سازنده‌ها فرق داشته باشند «هم‌نام» حساب می‌شود (تکراری نیست ولی در گزارش می‌آید). */
import fs from "node:fs/promises";
import path from "node:path";

/* آدرس RSS را یکدست می‌کند (http/https، www، #، اسلش آخر، پارامترهای ردیابی) ولی بخش ?query را نگه می‌دارد:
   چند پادکست فقط با پارامتر از هم جدا می‌شوند (مثل radioiranshahr.org/feed/podcast?name=… یا فیدهای RFI) و حذف query آن‌ها را «یکی» می‌کرد. */
export const normUrl = (u) => {
  const s = String(u || "").toLowerCase().trim().replace(/^https?:\/\/(www\.)?/, "").replace(/#.*$/, "");
  const [base, q = ""] = s.split("?");
  const params = q.split("&").filter((x) => x && !/^(utm_|fbclid|gclid|ref=|source=)/.test(x)).sort();
  return base.replace(/\/+$/, "") + (params.length ? "?" + params.join("&") : "");
};
export const normKey = (x) => String(x || "").replace(/[\u06F0-\u06F9]/g, (d) => d.charCodeAt(0) - 1776).replace(/ي/g, "ی").replace(/ك/g, "ک")
  .toLowerCase().replace(/[\s\u200c\u200f_\-|:·.,،؛!؟?()«»"'’/\\[\]]+/g, "");
const SPLIT = /\s*(?:[|｜–—:؛/]|\s-\s)\s*/;
const GENERIC = new Set(["پادکست", "podcast", "رادیو", "radio", "پادکستفارسی", "فارسی", "کتابصوتی", "audiobook"]);
const stripGeneric = (k) => k.replace(/پادکست|podcast/g, "");

/** همه‌ی کلیدهای عنوانیِ یک نام (کامل + بخش‌ها، با و بدون «پادکست») */
export function titleKeys(...titles) {
  const out = new Set();
  for (const t of titles.filter(Boolean)) {
    for (const part of [String(t), ...String(t).split(SPLIT)]) {
      const k = normKey(part);
      for (const v of [k, stripGeneric(k)]) if (v.length >= 2 && !GENERIC.has(v)) out.add(v);
    }
  }
  return [...out];
}
const appleId = (s) => (String(s || "").match(/id(\d{6,})/) || [])[1] || "";

/** هویت یک صفحه از روی front matter */
export function identityFromFm(fm, file = "", dir = "") {
  const get = (k) => (fm.match(new RegExp("^" + k + ":\\s*[\"']?([^\"'\\n]+)", "m")) || [, ""])[1].trim();
  const id = (fm.match(/^pi_id:\s*"?(\d+)/m) || [])[1];
  return {
    file, dir, pi: id ? +id : 0,
    rss: [...new Set([get("rss")].filter(Boolean).map(normUrl))],
    apple: appleId(get("apple_podcasts")),
    titles: titleKeys(get("title"), get("title_en"), get("name_fa"), get("name_en")),
    creator: normKey(get("creator")),
    shown: get("title") || get("title_en") || file,
  };
}
/** هویت یک فید Podcast Index (از feeds.json) */
export function identityFromFeed(F) {
  return {
    pi: +F.id || 0,
    rss: [...new Set([F.url, F.originalUrl].filter(Boolean).map(normUrl))],
    apple: F.itunesId ? String(F.itunesId) : "",
    titles: titleKeys(F.title),
    creator: normKey(F.author || F.ownerName),
    shown: F.title,
  };
}
const creatorsAgree = (a, b) => !a || !b || a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a)));

/** خواندن همه‌ی صفحه‌های موجود از چند پوشه و ساخت نمایه */
export async function loadIndex(dirs) {
  const items = [];
  for (const dir of dirs) for (const n of await fs.readdir(dir).catch(() => [])) {
    if (!n.endsWith(".md")) continue;
    const txt = await fs.readFile(path.join(dir, n), "utf8").catch(() => "");
    const fm = (txt.match(/^---\s*\n([\s\S]*?)\n---/) || [, ""])[1];
    items.push(identityFromFm(fm, n, dir));
  }
  const idx = { items, pi: new Map(), rss: new Map(), apple: new Map(), title: new Map() };
  const add = (m, k, it) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(it); };
  for (const it of items) { add(idx.pi, it.pi, it); it.rss.forEach((u) => add(idx.rss, u, it)); add(idx.apple, it.apple, it); it.titles.forEach((t) => add(idx.title, t, it)); }
  return idx;
}

/** آیا این هویت با چیزی در نمایه یکی است؟  {kind, with, soft?} یا null.  selfFile: خودِ همان فایل را نادیده بگیر */
/** یک هویت تازه (مثلاً پادکستی که همین الان ساخته شد) را به نمایه اضافه می‌کند تا موارد بعدیِ همان اجرا هم با آن سنجیده شوند */
export function addIdentity(idx, it) {
  idx.items.push(it);
  const add = (m, k) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(it); };
  add(idx.pi, it.pi); it.rss.forEach((u) => add(idx.rss, u)); add(idx.apple, it.apple); it.titles.forEach((t) => add(idx.title, t));
}

export function findDuplicate(ident, idx, selfFile = "") {
  const other = (list) => (list || []).find((x) => !(selfFile && `${x.dir}/${x.file}` === selfFile));
  let hit;
  if (ident.pi && (hit = other(idx.pi.get(ident.pi)))) return { kind: "pi_id", with: hit };
  for (const u of ident.rss) if ((hit = other(idx.rss.get(u)))) return { kind: "RSS یکسان", with: hit };
  if (ident.apple && (hit = other(idx.apple.get(ident.apple)))) return { kind: "شناسه‌ی اپل یکسان", with: hit };
  let soft = null;
  for (const t of ident.titles) for (const c of idx.title.get(t) || []) {
    if (selfFile && `${c.dir}/${c.file}` === selfFile) continue;
    // عنوان‌های دوحرفی («رخ»، «من») فقط وقتی تکراری‌اند که سازنده‌ی هر دو مشخص و یکی باشد
    if (t.length < 3 && !(ident.creator && c.creator && creatorsAgree(ident.creator, c.creator))) continue;
    if (creatorsAgree(ident.creator, c.creator)) return { kind: "عنوان و سازنده یکسان", with: c };
    soft = soft || { kind: "هم‌نام با سازنده‌ی متفاوت", with: c, soft: true };
  }
  return soft;
}

/** حذف تکراری‌ها بین خودِ نامزدها (مثلاً همان پادکست با دو شناسه یا دو آدرس فید). از هر گروه بهترین می‌ماند. */
export function dedupeFeeds(feeds) {
  const parent = new Map(); const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  feeds.forEach((f) => parent.set(f.id, f.id));
  const owner = new Map();
  const link = (key, id) => { if (!key) return; if (owner.has(key)) parent.set(find(id), find(owner.get(key))); else owner.set(key, id); };
  for (const f of feeds) {
    const I = identityFromFeed(f);
    I.rss.forEach((u) => link("u:" + u, f.id));
    if (I.apple) link("a:" + I.apple, f.id);
    if (f.podcastGuid) link("g:" + f.podcastGuid, f.id);
    const full = normKey(f.title); if (full.length >= 3 && !GENERIC.has(full)) link("t:" + full + "|" + I.creator, f.id);
  }
  const groups = new Map(); for (const f of feeds) { const r = find(f.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(f); }
  const score = (f) => (f.active === true ? 1e9 : 0) + (f.episodeCount || 0) * 1e3 + (f.newestItemPubdate || 0) / 1e6;
  const keep = [], dropped = [];
  for (const g of groups.values()) { g.sort((a, b) => score(b) - score(a)); keep.push(g[0]); g.slice(1).forEach((x) => dropped.push({ id: x.id, title: x.title, dupOf: g[0].id })); }
  const order = new Map(feeds.map((f, i) => [f.id, i]));
  keep.sort((a, b) => order.get(a.id) - order.get(b.id));
  return { keep, dropped };
}
