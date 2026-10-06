#!/usr/bin/env python3
"""خواندن RSS پادکست‌ها و ساخت _data/rss_stats.json
برای هر فایل _podcasts/<slug>.md که فیلد rss: دارد:
  episodes (تعداد)، avg_length (دقیقه)، first_year (شمسی)، last (تاریخ آخرین قسمت، شمسی)، status
فقط با کتابخانه‌ی استاندارد پایتون + PyYAML."""
import json, statistics, sys, urllib.request
import datetime as dt
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parent.parent
PODCASTS = ROOT / "_podcasts"
OUT = ROOT / "_data" / "rss_stats.json"
INACTIVE_AFTER_DAYS = 1095    # بدون قسمت جدید بیش از ۳ سال = غیرفعال
RECENT_FOR_AVG = 30           # میانگین طول از چند قسمت آخر
UA = "PersianPodBot/1.0 (+https://persianpod.ir)"


def g2j(gy, gm, gd):
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    gy2 = gy + 1 if gm > 2 else gy
    days = 355666 + 365 * gy + (gy2 + 3) // 4 - (gy2 + 99) // 100 + (gy2 + 399) // 400 + gd + g_d_m[gm - 1]
    jy = -1595 + 33 * (days // 12053); days %= 12053
    jy += 4 * (days // 1461); days %= 1461
    if days > 365:
        jy += (days - 1) // 365; days = (days - 1) % 365
    if days < 186:
        jm = 1 + days // 31; jd = 1 + days % 31
    else:
        jm = 7 + (days - 186) // 30; jd = 1 + (days - 186) % 30
    return jy, jm, jd


def front_matter(path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    parts = text.split("---", 2)
    return (yaml.safe_load(parts[1]) or {}) if len(parts) >= 3 else {}


def parse_duration(s):
    s = (s or "").strip()
    if not s:
        return 0
    try:
        if ":" in s:
            sec = 0
            for p in s.split(":"):
                sec = sec * 60 + float(p)
            return sec
        return float(s)
    except ValueError:
        return 0


def analyse(feed_url):
    req = urllib.request.Request(feed_url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read(20_000_000)
    root = ET.fromstring(data)
    items = []
    for it in root.iter("item"):
        pub = it.findtext("pubDate")
        try:
            d = parsedate_to_datetime(pub) if pub else None
        except (TypeError, ValueError):
            d = None
        dur = 0
        for child in it:
            if child.tag.endswith("}duration"):
                dur = parse_duration(child.text)
        items.append((d, dur))
    if not items:
        raise ValueError("no items in feed")
    result = {"episodes": len(items)}
    dated = [(d, x) for d, x in items if d]
    if dated:
        def utc(d):
            return d.replace(tzinfo=None) if d.tzinfo is None else d.astimezone(dt.timezone.utc).replace(tzinfo=None)
        norm = [utc(d) for d, _ in dated]
        first, last = min(norm), max(norm)
        result["first_year"] = g2j(first.year, first.month, first.day)[0]
        jy, jm, jd = g2j(last.year, last.month, last.day)
        result["last"] = f"{jy:04d}/{jm:02d}/{jd:02d}"
        age = (dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) - last).days
        result["status"] = "active" if age <= INACTIVE_AFTER_DAYS else "inactive"
        recent = sorted([(utc(d), x) for d, x in dated if x > 0], key=lambda t: t[0], reverse=True)[:RECENT_FOR_AVG]
        if recent:
            result["avg_length"] = max(1, round(statistics.mean(x for _, x in recent) / 60))
    # --- آمار تکمیلی برای صفحه‌ی «مقایسه»؛ همه از خود RSS و قابل بازتولید ---
    durs = sorted(x for _, x in items if x > 0)
    if durs:
        mins = lambda sec: max(1, round(sec / 60))
        result["median_length"] = mins(statistics.median(durs))
        result["min_length"] = mins(durs[0])
        result["max_length"] = mins(durs[-1])
    if dated:
        now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
        dates = sorted(n for n in norm if n <= now)
        result["eps_90"] = sum(1 for d in dates if (now - d).days < 90)
        year = [d for d in dates if (now - d).days < 365]
        result["eps_365"] = len(year)
        buckets = [0] * 12                      # ۱۲ بازه‌ی ۳۰ روزه؛ آخرین عنصر = ۳۰ روز اخیر
        for d in dates:
            age = (now - d).days
            if 0 <= age < 360:
                buckets[11 - age // 30] += 1
        result["recent_30d"] = buckets
        if len(year) >= 2:
            result["avg_gap_days"] = round((year[-1] - year[0]).days / (len(year) - 1), 1)
    return result


def main():
    previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    stats = dict(previous)
    for path in sorted(PODCASTS.glob("*.md")):
        feed = front_matter(path).get("rss")
        slug = path.stem
        if not feed:
            continue
        try:
            stats[slug] = analyse(feed)
            print(f"ok   {slug}: {stats[slug]}")
        except Exception as e:           # اگر خطا شد، آمار قبلی حفظ می‌شود
            print(f"FAIL {slug}: {e}", file=sys.stderr)
    OUT.parent.mkdir(exist_ok=True)
    new_text = json.dumps(stats, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if not OUT.exists() or OUT.read_text(encoding="utf-8") != new_text:
        OUT.write_text(new_text, encoding="utf-8")
        print("rss_stats.json updated")
    else:
        print("no changes")
    return 0   # خطای یک فید نباید کل اجرا را قرمز کند


if __name__ == "__main__":
    sys.exit(main())
