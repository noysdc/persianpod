/* PersianPod: تأیید — انتقال _drafts/ به _podcasts/ (فقط _drafts، نه _blocked) */
import fs from "node:fs/promises";
import path from "node:path";
import { loadIndex, findDuplicate, identityFromFm, addIdentity } from "./lib/dedupe.mjs";

const PODCASTS_DIR = process.env.PI_PODCASTS || "_podcasts";
const DRAFTS_DIR = process.env.PI_DRAFTS || "_drafts";
const BLOCKED_DIR = process.env.PI_BLOCKED || "_blocked";   // فقط برای نمایش
const DATA = process.env.PI_OUT || "_data/pi";
const FORCE = process.env.FORCE === "1";

const allDrafts = (await fs.readdir(DRAFTS_DIR).catch(() => [])).filter((n) => n.endsWith(".md"));
/* SLUGS: «all» (یا خالی) = همه‌ی پیش‌نویس‌ها؛ وگرنه نام فایل‌ها با ویرگول (مثلاً: zangetarikh,noys). قبلاً این ورودی خوانده نمی‌شد و هر بار همه‌ی پیش‌نویس‌ها تأیید می‌شدند. */
const WANT = (process.env.SLUGS || "all").split(/[,\s،]+/).map((x) => x.trim().replace(/\.md$/, "")).filter(Boolean);
const approveAll = !WANT.length || WANT.some((x) => x.toLowerCase() === "all");
const drafts = approveAll ? allDrafts : allDrafts.filter((n) => WANT.includes(n.replace(/\.md$/, "")));
const unknown = approveAll ? [] : WANT.filter((x) => !allDrafts.includes(x + ".md"));
if (unknown.length) console.warn("در _drafts پیدا نشد: " + unknown.join(", "));
const blocked = (await fs.readdir(BLOCKED_DIR).catch(() => [])).filter((n) => n.endsWith(".md"));

if (!drafts.length) {
  const emptyRep = `## گزارش تأیید\n\n- پوشه‌ی \`_drafts/\` خالی است. چیزی برای انتقال نیست.\n- فایل‌های در \`_blocked/\`: ${blocked.length}\n`;
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, "approve-report.md"), emptyRep);
  console.log(emptyRep);
  process.exit(0);
}

await fs.mkdir(PODCASTS_DIR, { recursive: true });
const moved = [], skipped = [];
const PUBIDX = await loadIndex([PODCASTS_DIR]);   // پادکست‌های منتشرشده؛ هر پیش‌نویس با آن‌ها و با پیش‌نویس‌های همین اجرا سنجیده می‌شود

for (const name of drafts) {
  const src = path.join(DRAFTS_DIR, name);
  let dst = path.join(PODCASTS_DIR, name);
  if (await fs.stat(dst).catch(() => null)) {
    if (!FORCE) { skipped.push(`${name} — در _podcasts از قبل هست`); continue; }
    const base = name.replace(/\.md$/, "");
    let v = 2;
    while (await fs.stat(path.join(PODCASTS_DIR, `${base}-v${v}.md`)).catch(() => null)) v++;
    dst = path.join(PODCASTS_DIR, `${base}-v${v}.md`);
  }
  let content = await fs.readFile(src, "utf8");
  const ident = identityFromFm((content.match(/^---\s*\n([\s\S]*?)\n---/) || [, ""])[1], name, PODCASTS_DIR);
  const dup = findDuplicate(ident, PUBIDX);
  if (dup && !FORCE) { skipped.push(`${name} — تکراری (${dup.kind}) با \`${dup.with.file}\`؛ در _drafts ماند. اگر مطمئنی تکراری نیست FORCE=1`); continue; }
  content = content.replace(/^published:\s*false\s*$/m, "published: true");
  content = content.replace(/^reviewed:\s*false\s*$/m, "reviewed: true");
  await fs.writeFile(dst, content);
  await fs.unlink(src);
  addIdentity(PUBIDX, { ...ident, file: path.basename(dst), dir: PODCASTS_DIR });
  moved.push(path.basename(dst));
}

const rep = `## گزارش تأیید و انتقال

- منتقل‌شده از \`_drafts/\` به \`_podcasts/\`: **${moved.length}**
- ردشده (تکراری یا از قبل موجود): ${skipped.length}${typeof unknown !== "undefined" && unknown.length ? `\n- نام‌هایی که در _drafts نبودند: ${unknown.join("، ")}` : ""}
- در \`_blocked/\` (دست‌نخورده، منتشر نمی‌شود): **${blocked.length}**

${moved.length ? "### منتقل‌شده\n" + moved.map((n) => `- \`${n}\``).join("\n") : ""}
${skipped.length ? "\n### ردشده\n" + skipped.map((n) => `- ${n}`).join("\n") : ""}
`;
await fs.mkdir(DATA, { recursive: true });
await fs.writeFile(path.join(DATA, "approve-report.md"), rep);
console.log(rep);