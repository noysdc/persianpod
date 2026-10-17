// پاک‌سازی surrogateهای ناقص (نیمه‌ی ایموجی) از همه‌ی JSONهای _data؛ جکیل روی آن‌ها می‌شکند.
import fs from 'node:fs';
import path from 'node:path';

const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.json')) out.push(p);
  }
  return out;
}

for (const file of walk('_data')) {
  const raw = fs.readFileSync(file, 'utf8');
  let n = 0;
  const fix = (o) =>
    typeof o === 'string' ? o.replace(LONE, () => (n++, '')) :
    Array.isArray(o) ? o.map(fix) :
    o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fix(v)])) : o;
  const data = fix(JSON.parse(raw));
  if (n > 0) {
    fs.writeFileSync(file, JSON.stringify(data));
    console.log(`اصلاح شد: ${file} (${n} کاراکتر ناقص)`);
  }
}
console.log('پاک‌سازی تمام شد.');
