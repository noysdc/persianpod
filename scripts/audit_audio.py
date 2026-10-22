#!/usr/bin/env python3
"""
بررسی سلامت فایل‌های صوتی پادکست‌ها (برای پیدا کردن «پلی نمی‌شود»ها).

برای هر پادکست دو قسمت را آزمایش می‌کند: جدیدترین و یکی از میانه‌ی فهرست. هر آزمایش یک درخواست کوچک
(Range: bytes=0-1023) است؛ فایل دانلود نمی‌شود. آدرس هم دقیقاً مثل پلیر سایت (http → https) و با هدر Referer
خود سایت درخواست می‌شود، چون مرورگر کاربر همین‌طور می‌فرستد.

نتیجه هر قسمت:
  ok               پاسخ ۲۰۰/۲۰۶ و نوع محتوا صوتی
  not-audio        پاسخ ۲۰۰ ولی HTML/JSON/متن است (صفحه یا خطا به‌جای فایل صوتی)
  referer-blocked  با Referer سایت ۴۰۱/۴۰۳ می‌دهد ولی بدون Referer باز می‌شود («هات‌لینک» ممنوع)
  forbidden        ۴۰۱/۴۰۳ در هر دو حالت (مسدود برای سرور، IP، منطقه یا نیازمند توکن)
  gone             ۴۰۴/۴۱۰ (فایل یا قسمت حذف شده؛ فید باید دوباره خوانده شود)
  server-error     ۵xx
  rate-limited     ۴۲۹
  network          DNS/SSL/تایم‌اوت
  empty            پاسخ بدون محتوا

خروجی: _data/audio_health.json (فقط پادکست‌های مشکل‌دار) + جدول خلاصه (و GITHUB_STEP_SUMMARY در Actions).

اجرا:
  python3 scripts/audit_audio.py                # همه
  python3 scripts/audit_audio.py --slug noys    # فقط یک پادکست
  python3 scripts/audit_audio.py --limit 30     # ۳۰ پادکست اول (آزمایش سریع)
توجه: ران‌های GitHub در آمریکا هستند؛ مسدودی مخصوص ایران یا فیلترینگ را نمی‌بینند.
"""
import argparse, concurrent.futures as cf, datetime, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EPS = ROOT / "assets" / "eps"
OUT = ROOT / "_data" / "audio_health.json"
SITE = "https://persianpod.ir/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"


def player_url(u):
    """همان کاری که پلیر سایت می‌کند: http → https (صفحه https است و مرورگر http را بلاک می‌کند)."""
    x = urllib.parse.urlparse(u.strip())
    if x.scheme == "http" and not os.environ.get("AUDIT_NO_UPGRADE"):      # AUDIT_NO_UPGRADE فقط برای آزمایش محلی
        x = x._replace(scheme="https")
    return urllib.parse.urlunparse(x)


def probe(url, referer, timeout):
    h = {"User-Agent": UA, "Range": "bytes=0-1023", "Accept": "*/*"}
    if referer:
        h["Referer"] = SITE
    t = time.time()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout) as r:
            data = r.read(2048)
            return {"code": r.status, "ct": (r.headers.get("Content-Type") or "").split(";")[0].strip().lower(),
                    "ms": int((time.time() - t) * 1000), "len": len(data)}
    except urllib.error.HTTPError as e:
        ct = (e.headers.get("Content-Type") or "").split(";")[0].strip().lower() if e.headers else ""
        return {"code": e.code, "ct": ct, "ms": int((time.time() - t) * 1000), "len": 0}
    except Exception as e:
        return {"code": 0, "ct": "", "ms": int((time.time() - t) * 1000), "len": 0, "err": (type(e).__name__ + ": " + str(e))[:90]}


def classify(r):
    c = r["code"]
    if c in (200, 206):
        ct = r.get("ct", "")
        if ct.startswith("text/") or ct in ("application/json", "application/xml"):
            return "not-audio"
        return "ok" if r.get("len", 0) > 0 else "empty"
    if c in (401, 403):
        return "forbidden"
    if c in (404, 410):
        return "gone"
    if c == 429:
        return "rate-limited"
    if 500 <= c < 600:
        return "server-error"
    if c == 0:
        return "network"
    return f"http-{c}"


def check(url, timeout):
    u = player_url(url)
    r = probe(u, True, timeout)
    kind = classify(r)
    if kind == "forbidden":                      # آیا «بدون Referer» باز می‌شود؟ (یعنی هات‌لینک ممنوع است)
        r2 = probe(u, False, timeout)
        if classify(r2) == "ok":
            kind, r = "referer-blocked", r2
    return {"kind": kind, "code": r["code"], "ct": r.get("ct", ""), "ms": r.get("ms", 0), "err": r.get("err", ""),
            "host": urllib.parse.urlparse(u).netloc}


def pick(eps):
    """جدیدترین قسمت + یکی از میانه (اگر آدرسش فرق داشته باشد)."""
    out, seen = [], set()
    for i in (0, len(eps) // 2):
        if 0 <= i < len(eps) and eps[i].get("a") and eps[i]["a"] not in seen:
            seen.add(eps[i]["a"]); out.append(eps[i])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug"); ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=16); ap.add_argument("--timeout", type=float, default=20)
    a = ap.parse_args()

    files = sorted(EPS.glob("*.json"))
    if a.slug:
        files = [f for f in files if f.stem == a.slug]
    if a.limit:
        files = files[: a.limit]
    jobs = []                                                       # (slug, ep)
    for f in files:
        try:
            eps = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        for e in pick(eps):
            jobs.append((f.stem, e))

    results = defaultdict(list)
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(check, e["a"], a.timeout): (slug, e) for slug, e in jobs}
        for fu in cf.as_completed(futs):
            slug, e = futs[fu]
            res = fu.result(); res["ep"] = (e.get("t") or "")[:60]
            results[slug].append(res)

    kinds, hosts_all, hosts_bad = Counter(), Counter(), Counter()
    problems = {}
    for slug, rs in results.items():
        for r in rs:
            kinds[r["kind"]] += 1; hosts_all[r["host"]] += 1
            if r["kind"] != "ok":
                hosts_bad[r["host"]] += 1
        bad = [r for r in rs if r["kind"] != "ok"]
        if bad:
            problems[slug] = {"status": "all-bad" if len(bad) == len(rs) else "partial",
                              "samples": [{k: r[k] for k in ("kind", "code", "ct", "host", "ep", "err") if r.get(k)} for r in bad]}

    health = {"checked_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
              "podcasts": len(results), "probes": sum(kinds.values()), "ok": kinds["ok"],
              "kinds": dict(kinds), "problems": dict(sorted(problems.items()))}
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(health, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    lines = [f"## سلامت فایل‌های صوتی ({health['checked_at']})",
             f"{len(results)} پادکست، {health['probes']} آزمایش، {kinds['ok']} سالم، **{len(problems)} پادکست مشکل‌دار** (در {time.time() - t0:.0f} ثانیه)", "",
             "| وضعیت | تعداد | معنی |", "|---|---|---|"]
    meaning = {"ok": "سالم", "not-audio": "به‌جای صدا صفحه‌ی HTML/JSON برمی‌گردد", "referer-blocked": "هات‌لینک ممنوع (بدون Referer باز می‌شود)",
               "forbidden": "۴۰۱/۴۰۳ (مسدود یا نیازمند توکن)", "gone": "۴۰۴/۴۱۰ (فایل حذف‌شده)", "server-error": "خطای ۵xx سرور",
               "rate-limited": "۴۲۹", "network": "DNS/SSL/تایم‌اوت", "empty": "پاسخ خالی"}
    for k, n in kinds.most_common():
        lines.append(f"| {k} | {n} | {meaning.get(k, '')} |")
    if hosts_bad:
        lines += ["", "### میزبان‌هایی که بیشترین مشکل را دارند (مشکل / کل آزمایش‌ها)", "| میزبان | مشکل | کل |", "|---|---|---|"]
        for h, n in hosts_bad.most_common(12):
            lines.append(f"| {h} | {n} | {hosts_all[h]} |")
    if problems:
        lines += ["", "### پادکست‌های مشکل‌دار", "| پادکست | وضعیت | نوع | میزبان | قسمت |", "|---|---|---|---|---|"]
        for slug, p in list(problems.items())[:60]:
            for s in p["samples"][:2]:
                lines.append(f"| {slug} | {p['status']} | {s['kind']} ({s.get('code') or s.get('err', '')}) | {s['host']} | {s.get('ep', '')[:40]} |")
        if len(problems) > 60:
            lines.append(f"… و {len(problems) - 60} پادکست دیگر (در _data/audio_health.json)")
    text = "\n".join(lines)
    print(text)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(text + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
