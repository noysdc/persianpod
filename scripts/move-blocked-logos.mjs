/* انتقال لوگوهای پادکست‌های بلاک‌شده از assets/img/podcasts/ به _blocked/ */
import fs from "node:fs/promises";
import path from "node:path";

const BLOCKED_DIR = "_blocked";
const IMG_DIR = "assets/img/podcasts";

let moved = 0, notFound = 0, errors = [];

const files = (await fs.readdir(BLOCKED_DIR).catch(() => [])).filter((n) => n.endsWith(".md"));

console.log(`پادکست‌های بلاکی: ${files.length}\n`);

for (const name of files) {
  const slug = name.replace(/\.md$/, "");
  const possibleImages = [
    `${slug}.webp`,
    `${slug}.jpg`,
    `${slug}.jpeg`,
    `${slug}.png`,
  ];

  let found = null;
  for (const img of possibleImages) {
    const src = path.join(IMG_DIR, img);
    try {
      await fs.access(src);
      found = img;
      break;
    } catch { /* پیدا نشد، بعدی */ }
  }

  if (!found) {
    notFound++;
    console.log(`✗ ${slug} — لوگو پیدا نشد`);
    continue;
  }

  try {
    const src = path.join(IMG_DIR, found);
    const dst = path.join(BLOCKED_DIR, found);
    await fs.rename(src, dst);
    moved++;
    console.log(`✓ ${found} → _blocked/`);
  } catch (e) {
    errors.push(`${slug}: ${e.message}`);
  }
}

console.log(`\n=== نتیجه ===`);
console.log(`منتقل‌شده: ${moved}`);
console.log(`لوگو پیدا نشد: ${notFound}`);
console.log(`خطا: ${errors.length}`);
if (errors.length) console.log("\nخطاها:\n" + errors.join("\n"));