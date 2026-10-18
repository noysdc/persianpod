/* PersianPod: ممیزی تکراری‌ها در _podcasts + _drafts + _blocked
   خروجی: _data/pi/duplicates.md (و چاپ در کنسول). هیچ فایلی را عوض یا حذف نمی‌کند؛ فقط گزارش می‌دهد. */
import fs from "node:fs/promises";
import path from "node:path";
import { loadIndex, identityFromFm } from "./lib/dedupe.mjs";

const DIRS = [process.env.PI_PODCASTS || "_podcasts", process.env.PI_DRAFTS || "_drafts", process.env.PI_BLOCKED || "_blocked"];
const OUT = process.env.PI_OUT || "_data/pi";
const idx = await loadIndex(DIRS);
const key = (it) => `${it.dir}/${it.file}`;
const pairs = new Map();    // "a||b" → {kinds:Set, a, b}
const addPair = (a, b, kind, soft) => { if (key(a) === key(b)) return; const [x, y] = key(a) < key(b) ? [a, b] : [b, a]; const k = key(x) + "||" + key(y); if (!pairs.has(k)) pairs.set(k, { a: x, b: y, kinds: new Set(), soft: true }); const p = pairs.get(k); p.kinds.add(kind); if (!soft) p.soft = false; };
const groupBy = (map, kind) => { for (const list of map.values()) if (list.length > 1) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) addPair(list[i], list[j], kind, false); };
groupBy(idx.pi, "pi_id یکسان"); groupBy(idx.rss, "RSS یکسان"); groupBy(idx.apple, "شناسه‌ی اپل یکسان");
const agree = (a, b) => !a || !b || a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a)));
for (const list of idx.title.values()) if (list.length > 1) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
  const a = list[i], b = list[j]; if (agree(a.creator, b.creator)) addPair(a, b, "عنوان و سازنده یکسان", false); else addPair(a, b, "هم‌نام با سازنده‌ی متفاوت", true);
}
const real = [...pairs.values()].filter((p) => !p.soft), soft = [...pairs.values()].filter((p) => p.soft);
const line = (p) => `- \`${key(p.a)}\` «${p.a.shown}» ⟷ \`${key(p.b)}\` «${p.b.shown}» — ${[...p.kinds].join("، ")}`;
const counts = DIRS.map((d) => `\`${d}/\`: ${idx.items.filter((i) => i.dir === d).length}`).join(" · ");
const rep = `## ممیزی تکراری‌ها\n\n- فایل‌های بررسی‌شده: **${idx.items.length}** (${counts})\n- جفت‌های تکراریِ قطعی: **${real.length}**\n- جفت‌های هم‌نام با سازنده‌ی متفاوت (احتمالاً دو پادکستِ جدا؛ فقط برای اطلاع): **${soft.length}**\n\n${real.length ? "### تکراری (باید یکی‌شان حذف یا بلاک شود)\n" + real.map(line).join("\n") + "\n" : "### تکراری قطعی نداریم ✅\n"}\n${soft.length ? "\n### هم‌نام، سازنده‌ی متفاوت\n" + soft.map(line).join("\n") + "\n" : ""}`;
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, "duplicates.md"), rep);
console.log(rep);
