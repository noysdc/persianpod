/* اصلاح یک‌باره‌ی متن پایین صفحه‌ها در _podcasts/، _drafts/ و _blocked/ */
import fs from "node:fs/promises";
import path from "node:path";

const DIRS = ["_podcasts", "_drafts", "_blocked"];

const OLD = "این صفحه خودکار و از اطلاعات عمومی منتشرشده‌ی پادکست (فید RSS و Podcast Index) ساخته شده و هنوز کامل نیست.";
const NEW = "این صفحه بر اساس اطلاعات عمومی منتشرشده‌ی پادکست شما (فید RSS) تهیه شده است. اگر صاحب یا نماینده‌ی این پادکست هستید، خوشحال می‌شویم با تکمیل [فرم معرفی پادکست](https://persianpod.ir/form/) به کامل‌تر و دقیق‌تر شدن این صفحه کمک کنید. برای هرگونه اصلاح، تکمیل یا حذف صفحه هم می‌توانید به contact@persianpod.ir پیام بدهید.";

let changed = 0, unchanged = 0, errors = [];

for (const dir of DIRS) {
  const files = (await fs.readdir(dir).catch(() => [])).filter((n) => n.endsWith(".md"));
  for (const name of files) {
    const p = path.join(dir, name);
    try {
      const txt = await fs.readFile(p, "utf8");
      if (!txt.includes(OLD)) { unchanged++; continue; }
      const updated = txt.replaceAll(OLD, NEW);
      await fs.writeFile(p, updated);
      changed++;
      console.log(`✓ ${dir}/${name}`);
    } catch (e) {
      errors.push(`${dir}/${name}: ${e.message}`);
    }
  }
}

console.log(`\n=== نتیجه ===`);
console.log(`تغییر یافته: ${changed}`);
console.log(`بدون تغییر: ${unchanged}`);
console.log(`خطا: ${errors.length}`);
if (errors.length) console.log("\nخطاها:\n" + errors.join("\n"));