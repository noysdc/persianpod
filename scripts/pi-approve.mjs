/* PersianPod: تأیید — انتقال همه‌ی فایل‌های _drafts/ به _podcasts/ و انتشار */
import fs from "node:fs/promises";
import path from "node:path";

const PODCASTS_DIR = process.env.PI_PODCASTS || "_podcasts";
const DRAFTS_DIR = process.env.PI_DRAFTS || "_drafts";
const DATA = process.env.PI_OUT || "_data/pi";
const FORCE = process.env.FORCE === "1";   // اگر 1 باشد، بدون نگاه به previous، همه را منتقل می‌کند

async function listDrafts() {
  return (await fs.readdir(DRAFTS_DIR).catch(() => [])).filter((n) => n.endsWith(".md"));
}

const drafts = await listDrafts();
if (!drafts.length) {
  const emptyRep = `## گزارش تأیید\n\n- پوشه‌ی \`_drafts/\` خالی است. چیزی برای انتقال نیست.\n`;
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, "approve-report.md"), emptyRep);
  console.log(emptyRep);
  process.exit(0);
}

await fs.mkdir(PODCASTS_DIR, { recursive: true });
const moved = [], skipped = [];

for (const name of drafts) {
  const src = path.join(DRAFTS_DIR, name);
  let dst = path.join(PODCASTS_DIR, name);

  // اگر فایل هم‌نام در _podcasts هست
  if (await fs.stat(dst).catch(() => null)) {
    if (!FORCE) {
      skipped.push(`${name} — در _podcasts از قبل هست (FORCE=1 برای جایگزینی)`);
      continue;
    }
    // با پسوند -v2 ذخیره کن
    const base = name.replace(/\.md$/, "");
    let v = 2;
    while (await fs.stat(path.join(PODCASTS_DIR, `${base}-v${v}.md`)).catch(() => null)) v++;
    dst = path.join(PODCASTS_DIR, `${base}-v${v}.md`);
  }

  // خواندن و تغییر published: false → true
  let content = await fs.readFile(src, "utf8");
  content = content.replace(/^published:\s*false\s*$/m, "published: true");
  content = content.replace(/^reviewed:\s*false\s*$/m, "reviewed: true");
  await fs.writeFile(dst, content);
  await fs.unlink(src);
  moved.push(path.basename(dst));
}

const rep = `## گزارش تأیید و انتقال

- منتقل‌شده از \`_drafts/\` به \`_podcasts/\`: **${moved.length}**
- ردشده (از قبل موجود بود): ${skipped.length}

${moved.length ? "### منتقل‌شده\n" + moved.map((n) => `- \`${n}\``).join("\n") : ""}
${skipped.length ? "\n### ردشده\n" + skipped.map((n) => `- ${n}`).join("\n") : ""}
`;
await fs.mkdir(DATA, { recursive: true });
await fs.writeFile(path.join(DATA, "approve-report.md"), rep);
console.log(rep);