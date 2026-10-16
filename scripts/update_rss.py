#!/usr/bin/env python3
"""خواندن RSS پادکست‌ها و ساخت _data/rss_stats.json
برای هر فایل _podcasts/<slug>.md که فیلد rss: دارد:
  episodes (تعداد)، avg_length (دقیقه)، first_year (شمسی)، last (تاریخ آخرین قسمت، شمسی)، status
فقط با کتابخانه‌ی استاندارد پایتون + PyYAML."""
import concurrent.futures, gzip, html, json, os, re, socket, statistics, sys, threading, time, urllib.error, urllib.parse, urllib.request, zlib
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
PLAY_COUNT = 8                # قسمت‌های آماده‌ی لحظه‌ی اول (داخل rss_stats و podcasts.json)
ALL_EPS_MAX = 3000            # سقف همه‌ی قسمت‌ها در فایل جدای هر پادکست
EPS_DIR = ROOT / "assets" / "eps"   # assets/eps/<slug>.json؛ پلیر در صورت نیاز می‌خواندش
DESC_MAX = 300                # سقف طول توضیح تمیزشده‌ی هر قسمت (برای ایندکس جست‌وجو)
ERRORS = ROOT / "_data" / "rss_errors.json"
WORKERS = 12                  # فیدها هم‌زمان گرفته می‌شوند (قبلاً پشت‌سرهم؛ اجرا ۸ تا ۱۱ دقیقه طول می‌کشید)
PER_HOST = 3                  # حداکثر درخواست هم‌زمان به یک میزبان (acast، castbox و anchor دهها فید دارند)
RETRY_EVERY_H = 6             # فید خراب فقط هر چند ساعت یک‌بار دوباره امتحان می‌شود (اجرای دستی همه را امتحان می‌کند)
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


_TAG = re.compile(r"<[^>]+>")
_URL = re.compile(r"(?:https?://|www\.)\S+", re.I)
_WS = re.compile(r"\s+")


def clean_desc(raw, limit=DESC_MAX):
    """توضیح قسمت را برای جست‌وجو تمیز می‌کند: بدون تگ HTML، لینک و فاصله‌ی اضافه؛ حداکثر limit حرف (برش در مرز کلمه)."""
    if not raw:
        return ""
    t = re.sub(r"<(?:br|/p|/div|/li)\s*/?>", " ", raw, flags=re.I)
    t = _TAG.sub(" ", t)
    t = html.unescape(t)
    t = _URL.sub(" ", t)
    t = t.replace("\u200f", "").replace("\u200e", "").replace("\xa0", " ")
    t = _WS.sub(" ", t).strip()
    if len(t) <= limit:
        return t
    cut = t[:limit]
    sp = cut.rfind(" ")
    if sp >= limit * 0.6:
        cut = cut[:sp]
    return cut.rstrip(" ،,.:;-–—") + "…"


def item_desc(it):
    """اولین توضیح غیرخالی قسمت: description، بعد itunes:summary، بعد content:encoded، بعد itunes:subtitle."""
    order = ("description", "summary", "encoded", "subtitle")
    found = {}
    for child in it:
        name = child.tag.rsplit("}", 1)[-1]
        if name in order and name not in found and (child.text or "").strip():
            found[name] = child.text
    for name in order:
        if name in found:
            d = clean_desc(found[name])
            if d:
                return d
    return ""


def fetch(feed_url):
    """دریافت فید با چند User-Agent؛ خطای آخر با جزئیات برمی‌گردد.
    خطای دائمی (دامنه‌ی ناموجود، اتصال ردشده) فوراً قطع می‌شود؛ ۴۰۳/۴۰۴/۴۲۹/۵۰۳ فقط با User-Agent بعدی امتحان می‌شود،
    و تلاش دوباره با همان User-Agent فقط برای خطای موقت (تایم‌اوت، قطع اتصال، ۵۰۰) است."""
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
                if e.code in (403, 404, 410, 429, 503):
                    break                    # با همین UA فایده ندارد؛ سراغ UA بعدی
            except urllib.error.URLError as e:
                last_err = f"{type(e).__name__}: {e}"
                if isinstance(e.reason, (socket.gaierror, ConnectionRefusedError)):
                    raise RuntimeError(last_err)      # دامنه وجود ندارد یا پورت بسته است؛ UA فرقی نمی‌کند
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"
            if attempt == 0:
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
    audio_eps = []  # (تاریخ، عنوان، آدرس فایل صوتی) برای پلیر داخلی
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
        enc = it.find("enclosure")                    # فایل صوتی قسمت (برای پلیر داخلی)
        au = ((enc.get("url") if enc is not None else "") or "").strip()
        ty = ((enc.get("type") if enc is not None else "") or "").lower()
        if au.lower().startswith(("http://", "https://")) and (ty.startswith("audio") or ty in ("", "application/octet-stream") or re.search(r"\.(mp3|m4a|aac|ogg|oga|wav)(\?|$)", au, re.I)):
            audio_eps.append((d, (it.findtext("title") or "").strip()[:160], au, item_desc(it)))
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
        result["first_at"] = first.strftime("%Y-%m-%d")      # تاریخ اولین قسمت (میلادی)؛ برای برچسب «جدید»
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
    # --- پلیر داخلی: ۸ قسمت آخر که فایل صوتی دارند ---
    play = sorted(((utc2(d), t, u) for d, t, u, _ in audio_eps if d), key=lambda x: x[0], reverse=True)[:PLAY_COUNT]
    if play:
        result["play"] = [{"at": d.strftime("%Y-%m-%dT%H:%M:%SZ"), "t": t, "a": u} for d, t, u in play]
    # همه‌ی قسمت‌ها (جدیدترین اول؛ بدون تاریخ‌ها آخر). خروجی ثابت است تا بدون قسمت جدید، فایل تغییر نکند.
    def ep_row(t, u, desc):
        row = {"t": t, "a": u}
        if desc:
            row["d"] = desc          # توضیح تمیزشده؛ فقط وقتی هست که فید داشته باشد
        return row
    dated_all = sorted(((utc2(d), t, u, x) for d, t, u, x in audio_eps if d), key=lambda x: x[0], reverse=True)
    all_list = [ep_row(t, u, x) for _, t, u, x in dated_all] + [ep_row(t, u, x) for d, t, u, x in audio_eps if not d]
    if all_list:
        result["_all"] = all_list[:ALL_EPS_MAX]
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


def retry_due(slug, now=None):
    """فید خراب فقط در یک بازه‌ی یک‌ساعته از هر RETRY_EVERY_H ساعت دوباره امتحان می‌شود (بر اساس slug پخش می‌شود)."""
    now = now or dt.datetime.now(dt.timezone.utc)
    return now.hour % RETRY_EVERY_H == zlib.crc32(slug.encode("utf-8")) % RETRY_EVERY_H


def main():
    previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    prev_errors = json.loads(ERRORS.read_text(encoding="utf-8")) if ERRORS.exists() else {}
    retry_all = bool(os.environ.get("RSS_RETRY_ALL"))
    stats = dict(previous)
    errors = {}
    jobs = []
    for path in sorted(PODCASTS.glob("*.md")):
        fm = front_matter(path)
        feed = fm.get("rss")
        # کلید همان slug داخل فایل است (که سایت و صفحه‌ی «تازه‌ها» با آن می‌خوانند)؛ اگر نبود، نام فایل
        slug = str(fm.get("slug") or path.stem)
        if not feed:
            continue
        if slug in prev_errors and prev_errors[slug].get("rss") == feed and not retry_all and not retry_due(slug):
            errors[slug] = prev_errors[slug]         # فید خراب: این بار دوباره امتحان نمی‌شود، خطای قبلی می‌ماند
            print(f"skip {slug}: failing, retry later", file=sys.stderr)
            continue
        jobs.append((slug, feed))

    host_gate = {}
    gate_lock = threading.Lock()

    def gate(feed):
        host = urllib.parse.urlsplit(feed).netloc.lower()
        with gate_lock:
            return host_gate.setdefault(host, threading.Semaphore(PER_HOST))

    def work(job):
        slug, feed = job
        try:
            with gate(feed):
                return slug, feed, analyse(feed), None
        except Exception as e:           # اگر خطا شد، آمار قبلی حفظ می‌شود
            return slug, feed, None, f"{type(e).__name__}: {e}"[:300]

    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(work, jobs))          # ترتیب نتیجه‌ها همان ترتیب jobs است (خروجی ثابت)
    for slug, feed, res, err in results:
        if err:
            errors[slug] = {"rss": feed, "error": err}
            print(f"FAIL {slug}: {err}", file=sys.stderr)
            continue
        stats[slug] = res
        all_eps = stats[slug].pop("_all", None)
        if all_eps:
            EPS_DIR.mkdir(parents=True, exist_ok=True)
            fp = EPS_DIR / (slug.replace("/", "_") + ".json")
            txt = json.dumps(all_eps, ensure_ascii=False, separators=(",", ":")) + "\n"
            if not fp.exists() or fp.read_text(encoding="utf-8") != txt:
                fp.write_text(txt, encoding="utf-8")
        print(f"ok   {slug}: {stats[slug]}")
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
