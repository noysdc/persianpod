#!/usr/bin/env python3
"""خواندن RSS پادکست‌ها و ساخت _data/rss_stats.json
برای هر فایل _podcasts/<slug>.md که فیلد rss: دارد:
  episodes (تعداد)، avg_length (دقیقه)، first_year (شمسی)، last (تاریخ آخرین قسمت، شمسی)، status
فقط با کتابخانه‌ی استاندارد پایتون + PyYAML."""
import gzip, json, re, statistics, sys, time, urllib.error, urllib.request
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
ERRORS = ROOT / "_data" / "rss_errors.json"
# بعضی میزبان‌ها (Anchor، Audiya و…) به User-Agent ربات یا IP سرورهای ابری جواب ۴۰۳ می‌دهند؛
# پس چند هویت را به‌ترتیب امتحان می‌کنیم.
UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Mozilla/5.0 (compatible; PodcastFeedReader/1.0; +https://persianpod.ir)",
    "PersianPodBot/1.0 (+https://persianpod.ir)",
]
ACCEPT = "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5"


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
    # جداکننده فقط یک خطِ تنهای --- است؛ split ساده روی "---" لینک‌هایی مثل کست‌باکس را که --- دارند نصف می‌کرد
    m = re.match(r"^---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|$)", text, re.S)
    if not m:
        return {}
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:      # فایل خراب نباید کل اجرا را از کار بیندازد
        print(f"WARN {path.name}: front matter invalid: {e}", file=sys.stderr)
        return {}


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


def fetch(feed_url):
    """دریافت فید با چند User-Agent و دو بار تلاش؛ خطای آخر با جزئیات برمی‌گردد."""
    last_err = None
    for ua in UAS:
        for attempt in range(2):
            req = urllib.request.Request(feed_url, headers={
                "User-Agent": ua, "Accept": ACCEPT, "Accept-Encoding": "gzip",
                "Accept-Language": "fa,en;q=0.8"})
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = r.read(20_000_000)
                    if (r.headers.get("Content-Encoding") or "").lower() == "gzip" or data[:2] == b"\x1f\x8b":
                        data = gzip.decompress(data)
                    return data
            except urllib.error.HTTPError as e:
                last_err = f"HTTP {e.code} ({e.reason}) با UA «{ua[:20]}…»"
                if e.code in (403, 429, 503):
                    break                    # با همین UA فایده ندارد؛ سراغ UA بعدی
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"
            time.sleep(2)
    raise RuntimeError(last_err or "unknown fetch error")


def parse_xml(data):
    """XML فیدهای ناقص را هم تحمل می‌کند (BOM، فاصله‌ی ابتدای فایل، & بدون escape، کاراکتر کنترلی)."""
    head = data[:600].lstrip().lower()
    if head.startswith((b"<!doctype html", b"<html")):
        raise ValueError("به‌جای فید، صفحه‌ی HTML برگشت (احتمالاً مسدود یا چالش ضدربات)")
    text = data.decode("utf-8-sig", errors="replace").lstrip()
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    try:
        return ET.fromstring(text.encode("utf-8"))
    except ET.ParseError:
        fixed = re.sub(r"&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)", "&amp;", text)
        # اعلان encoding بالای فایل با bytes سازگار نیست؛ حذفش می‌کنیم
        fixed = re.sub(r"^<\?xml[^>]*\?>", "", fixed)
        return ET.fromstring(fixed.encode("utf-8"))


def parse_date(text):
    text = (text or "").strip()
    if not text:
        return None
    try:
        return parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError):
        pass
    try:                                       # ISO 8601 مثل 2026-09-18T14:30:00Z
        return dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def analyse(feed_url):
    root = parse_xml(fetch(feed_url))
    items = []
    eps = []      # (تاریخ، عنوان، لینک) برای صفحه‌ی «تازه‌ها»
    for it in root.iter("item"):
        pub = it.findtext("pubDate")
        if not pub:                                  # بعضی فیدها به‌جای pubDate از dc:date استفاده می‌کنند
            for child in it:
                if child.tag.endswith("}date") or child.tag.endswith("}published"):
                    pub = child.text
                    break
        d = parse_date(pub)
        dur = 0
        for child in it:
            if child.tag.endswith("}duration"):
                dur = parse_duration(child.text)
        items.append((d, dur))
        link = (it.findtext("link") or "").strip()
        if not link.lower().startswith(("http://", "https://")):
            enc = it.find("enclosure")
            link = (enc.get("url") if enc is not None else "") or ""
            link = link if link.lower().startswith(("http://", "https://")) else ""
        eps.append((d, (it.findtext("title") or "").strip()[:160], link))
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
    # --- صفحه‌ی «تازه‌ها»: آخرین قسمت‌ها با زمان دقیق (UTC) ---
    def utc2(d):
        return d.replace(tzinfo=None) if d.tzinfo is None else d.astimezone(dt.timezone.utc).replace(tzinfo=None)
    newest = sorted(((utc2(d), t, l) for d, t, l in eps if d), key=lambda x: x[0], reverse=True)[:3]
    if newest:
        result["last_at"] = newest[0][0].strftime("%Y-%m-%dT%H:%M:%SZ")
        result["last_title"] = newest[0][1]
        result["last_link"] = newest[0][2]
        result["recent"] = [{"at": d.strftime("%Y-%m-%dT%H:%M:%SZ"), "title": t, "link": l} for d, t, l in newest]
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
    errors = {}
    for path in sorted(PODCASTS.glob("*.md")):
        fm = front_matter(path)
        feed = fm.get("rss")
        # کلید همان slug داخل فایل است (که سایت و صفحه‌ی «تازه‌ها» با آن می‌خوانند)؛ اگر نبود، نام فایل
        slug = str(fm.get("slug") or path.stem)
        if not feed:
            continue
        try:
            stats[slug] = analyse(feed)
            print(f"ok   {slug}: {stats[slug]}")
        except Exception as e:           # اگر خطا شد، آمار قبلی حفظ می‌شود
            errors[slug] = {"rss": feed, "error": f"{type(e).__name__}: {e}"[:300]}
            print(f"FAIL {slug}: {e}", file=sys.stderr)
    # دلیل خطای هر فید در فایل جدا ثبت می‌شود تا بدون لاگ Actions هم دیده شود
    err_text = json.dumps(errors, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if not ERRORS.exists() or ERRORS.read_text(encoding="utf-8") != err_text:
        ERRORS.write_text(err_text, encoding="utf-8")
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
