/* PersianPod: تأیید صفحه‌های ساخته‌شده‌ی خودکار
   SLUGS = "all" (همه‌ی صفحه‌های تأییدنشده) یا فهرست نام‌ها با ویرگول:  noys-example,another-slug
   فقط فایل‌هایی را عوض می‌کند که source: "podcastindex" و published: false دارند؛ published را true و reviewed را true می‌کند. */
import fs from "node:fs/promises";
import path from "node:path";
const DIR = process.env.PI_PODCASTS || "_podcasts";
const raw = (process.env.SLUGS || "").trim();
if (!raw) { console.error("SLUGS خالی است. «all» یا نام صفحه‌ها را بنویس."); process.exit(1); }
const all = raw.toLowerCase() === "all", want = new Set(raw.split(/[,\s،]+/).filter(Boolean));
const changed = [];
for (const n of await fs.readdir(DIR)) {
  if (!n.endsWith(".md")) continue;
  const p = path.join(DIR, n), t = await fs.readFile(p, "utf8");
  const m = t.match(/^---\s*\n([\s\S]*?)\n---/); if (!m) continue;
  const fm = m[1], slug = n.replace(/\.md$/, "");
  if (!/^source:\s*"?podcastindex"?/m.test(fm) || !/^published:\s*false\s*$/m.test(fm)) continue;
  if (!all && !want.has(slug)) continue;
  const fm2 = fm.replace(/^published:\s*false\s*$/m, "published: true").replace(/^reviewed:\s*false\s*$/m, "reviewed: true");
  await fs.writeFile(p, t.replace(fm, fm2)); changed.push(slug);
}
const missing = all ? [] : [...want].filter((s) => !changed.includes(s));
const out = `## تأیید صفحه‌ها\n\n- تأییدشده: **${changed.length}**\n${changed.map((s) => `  - ${s}`).join("\n")}\n${missing.length ? `\n- پیدا نشد یا قبلاً تأیید شده: ${missing.join("، ")}\n` : ""}`;
console.log(out);
await fs.mkdir("_data/pi", { recursive: true }); await fs.writeFile("_data/pi/approve-report.md", out);
