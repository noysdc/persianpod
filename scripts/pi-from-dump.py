#!/usr/bin/env python3
"""PersianPod: افزودن «همه‌ی» پادکست‌های فارسیِ Podcast Index از روی فایل دامپ کامل آن.

چرا: API فقط با جست‌وجوی کلیدواژه کار می‌کند و پادکستی که کلیدواژه‌ای در عنوانش نباشد («رخ»، «جافکری»، «آدمیزاد»…) هیچ‌وقت پیدا نمی‌شود.
دامپ همه‌ی فیدهای Podcast Index را دارد (فایل SQLite)؛ اینجا همه‌ی ردیف‌هایی که زبانشان فارسی است (یا زبان ثبت نشده ولی متنشان فارسی است)
بیرون کشیده و به _data/pi/feeds.json اضافه می‌شوند. ردیف‌های موجود دست‌نخورده می‌مانند (فقط شناسه‌های تازه اضافه می‌شوند).

استفاده:  python3 scripts/pi-from-dump.py podcastindex_feeds.db [خروجی=_data/pi/feeds.json]
"""
import json, re, sqlite3, sys, time
from pathlib import Path

DB = sys.argv[1] if len(sys.argv) > 1 else "podcastindex_feeds.db"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "_data/pi/feeds.json")
INACTIVE_DAYS = 365 * 3
ARABIC = re.compile(r"[\u0600-\u06FF]"); FA_ONLY = re.compile(r"[پچژگ]"); NOT_FA = re.compile(r"[ٹڈڑںۓےہھ]")


def well_formed(s):
    return re.sub(r"[\ud800-\udfff]", "", str(s)) if s is not None else s


def script_conf(title, desc):
    s = f"{title or ''} {desc or ''}"
    letters = sum(1 for c in s if c.isalpha()) or 1
    arab = len(ARABIC.findall(s))
    return "medium" if arab / letters > 0.3 and FA_ONLY.search(s) and not NOT_FA.search(s) else None


con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
con.row_factory = sqlite3.Row
cols = [r[1] for r in con.execute("PRAGMA table_info(podcasts)")]
need = ["id", "title", "url", "language"]
if [c for c in need if c not in cols]:
    sys.exit(f"ستون‌های لازم در جدول podcasts نیست. ستون‌های موجود: {cols}")
has = set(cols)
col = lambda *names: next((n for n in names if n in has), None)
c_author, c_owner = col("itunesAuthor", "author"), col("itunesOwnerName", "ownerName")
c_img, c_last = col("imageUrl", "image"), col("lastUpdate", "lastUpdateTime")
cat_cols = [f"category{i}" for i in range(1, 11) if f"category{i}" in has]
dead_sql = "COALESCE(dead,0)=0" if "dead" in has else "1=1"

t0 = time.time()
sql = f"""SELECT * FROM podcasts WHERE {dead_sql} AND (
    lower(COALESCE(language,'')) LIKE 'fa%' OR lower(COALESCE(language,'')) IN ('per','fas')
    OR (COALESCE(language,'')='' AND title GLOB '*[پچژگ]*'))"""
now = time.time()
found = {}
for r in con.execute(sql):
    d = dict(r)
    lang = str(d.get("language") or "").lower()
    conf = "high" if (lang.startswith("fa") or lang in ("per", "fas")) else script_conf(d.get("title"), d.get("description"))
    if not conf:
        continue
    newest = d.get("newestItemPubdate") or None
    cats = {str(i + 1): d[c] for i, c in enumerate(cat_cols) if d.get(c)}
    found[int(d["id"])] = {
        "id": int(d["id"]), "title": well_formed(d.get("title")), "url": d.get("url"), "originalUrl": d.get("originalUrl") if "originalUrl" in has else None,
        "link": d.get("link") if "link" in has else None, "description": well_formed(str(d.get("description") or "")[:600]),
        "author": well_formed(d.get(c_author)) if c_author else None, "ownerName": well_formed(d.get(c_owner)) if c_owner else None,
        "image": d.get(c_img) if c_img else None, "artwork": None, "language": d.get("language"),
        "itunesId": d.get("itunesId") or None, "episodeCount": d.get("episodeCount"), "newestItemPubdate": newest,
        "lastUpdateTime": d.get(c_last) if c_last else None, "categories": cats or None, "dead": d.get("dead") if "dead" in has else None,
        "podcastGuid": d.get("podcastGuid") if "podcastGuid" in has else None, "confidence": conf,
        "active": ((now - newest) / 86400 <= INACTIVE_DAYS) if newest else None,
    }
print(f"در دامپ پیدا شد: {len(found)} پادکست فارسی (غیرمرده) در {time.time() - t0:.0f} ثانیه")

existing = []
if OUT.exists():
    existing = json.loads(OUT.read_text(encoding="utf-8"))
have = {f["id"] for f in existing}
fresh = [f for i, f in found.items() if i not in have]
merged = sorted(existing + fresh, key=lambda f: -(f.get("newestItemPubdate") or 0))
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(merged, ensure_ascii=False), encoding="utf-8")
act = sum(1 for f in fresh if f.get("active"))
print(f"قبلاً در feeds.json: {len(existing)} | تازه از دامپ: {len(fresh)} (فعال: {act}) | مجموع: {len(merged)}")
