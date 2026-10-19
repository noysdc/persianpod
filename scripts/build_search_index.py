#!/usr/bin/env python3
"""ساخت ایندکس جست‌وجوی قسمت‌ها از روی assets/eps/*.json (بدون اینترنت، فقط کتابخانه‌ی استاندارد).

خروجی در assets/sidx/ است و مرورگر فقط تکه‌ی لازم را می‌خواند:
  meta.json            فهرست slugها، تنظیمات و کلمه‌های خیلی رایج
  t/<prefix>.json      پست‌های همه‌ی کلمه‌هایی که با همان دو حرف شروع می‌شوند
  d/<slugIdx>-<n>.json عنوان و خلاصه‌ی ۶۴ قسمت پشت‌سرهم از یک پادکست (برای نمایش نتیجه)

شناسه‌ی قسمت پایدار است تا با آمدن قسمت جدید، فایل‌های بی‌ربط عوض نشوند:
  doc = slugIdx * BLOCK + oldIdx      (oldIdx: ترتیب از قدیمی‌ترین؛ قسمت جدید ته فهرست می‌نشیند)
  slugIdx از meta.json قبلی حفظ می‌شود (فقط اضافه می‌شود، هیچ‌وقت جابه‌جا نمی‌شود).

نرمال‌سازی و ریشه‌یابی باید دقیقاً با assets/js/pp-search-core.js یکی باشد؛ با tools/check_search_parity.py بررسی کن.
"""
import argparse
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

VERSION = 1
BLOCK = 4096          # سقف تعداد قسمت‌های یک پادکست (ALL_EPS_MAX در update_rss.py سه‌هزار است)
DOC_CHUNK = 16        # تعداد قسمت در هر فایل d/ (کوچک نگه داشته شده تا هر نتیجه فقط چند کیلوبایت بکشد)
PREFIX_LEN = 2        # تعداد حرف اول کلمه برای تکه‌کردن پست‌ها
SNIPPET_MAX = 120     # طول خلاصه‌ی نمایشی
MIN_TOKEN = 2
COMMON_DF = 2500      # کلمه‌ای که در بیش از این تعداد قسمت بیاید «رایج» است و ایندکس نمی‌شود

# ---------- نرمال‌سازی (هم‌ارز pp-search-core.js) ----------
_FA = "۰۱۲۳۴۵۶۷۸۹"
_AR = "٠١٢٣٤٥٦٧٨٩"
_DIGITS = {ord(c): str(i) for i, c in enumerate(_FA)}
_DIGITS.update({ord(c): str(i) for i, c in enumerate(_AR)})
_MARKS = re.compile("[\u064B-\u065F\u0670\u0640]")
_ZW = re.compile("[\u200c\u200f\u200e]")
_WS = re.compile(r"\s+")


def norm(s):
    s = "" if s is None else str(s)
    s = s.translate(_DIGITS)
    s = re.sub("[يى]", "ی", s)
    s = s.replace("ك", "ک")
    s = re.sub("[أإآ]", "ا", s)
    s = s.replace("ة", "ه").replace("ؤ", "و")
    s = _MARKS.sub("", s)
    s = _ZW.sub(" ", s)
    s = "".join(ch if (unicodedata.category(ch)[0] in "LN" or ch.isspace()) else " " for ch in s)
    s = _WS.sub(" ", s).lower().strip()
    return s


_STOP_RAW = (
    "پادکست پادکستی پادکستها پادکستهای با و یا یا از در به برای که این آن اون یک را تا هم می رو من میخوام میخواهم بده بدی بهم دنبال "
    "چیزی چیز مثل مثلا مثلاً درباره راجع در مورد اپیزود اپیزودها اپیزودهای قسمت قسمتها قسمتهای فارسی بهترین خوب خوبی معرفی پیشنهاد خیلی کمی "
    "های ها هایی هاش هست هستن باشه باشد دارای داره دارد کدوم کدام ببینم پیدا کن کنید کنم"
)
STOP = {norm(w) for w in _STOP_RAW.split(" ") if w}

_PL = re.compile("(های|ها)$")
_PL2 = re.compile("(ان|ات)$")


def stem(w):
    if len(w) > 5 and _PL.search(w):
        w = _PL.sub("", w)
    elif len(w) > 4 and _PL2.search(w):
        w = _PL2.sub("", w)
    if len(w) >= 4 and w.endswith("ی"):
        w = w[:-1]
    return w


def indexable(tk):
    """کلمه‌ی کوتاه‌تر از حد یا با حرف خارج از BMP (نام فایل شارد در مرورگر با UTF-16 ساخته می‌شود) ایندکس نمی‌شود."""
    return len(tk) >= MIN_TOKEN and all(ord(c) <= 0xFFFF for c in tk)


def tokens(s, keep_stop=False):
    out = []
    for w in norm(s).split(" "):
        if not w or (not keep_stop and w in STOP):
            continue
        out.append(stem(w))
    return out


# ---------- کمک‌ها ----------
def b36(n):
    if n == 0:
        return "0"
    digs = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = []
    while n:
        n, r = divmod(n, 36)
        out.append(digs[r])
    return "".join(reversed(out))


def enc_postings(vals):
    """vals: فهرست مرتب‌شده‌ی مقدارهای doc*2+inTitle؛ خروجی: اختلاف‌های پیاپی به مبنای ۳۶ با «,»."""
    prev = 0
    parts = []
    for v in vals:
        parts.append(b36(v - prev))
        prev = v
    return ",".join(parts)


def snippet(desc):
    desc = (desc or "").strip()
    if len(desc) <= SNIPPET_MAX:
        return desc
    cut = desc[:SNIPPET_MAX]
    sp = cut.rfind(" ")
    if sp >= SNIPPET_MAX * 0.6:
        cut = cut[:sp]
    return cut.rstrip(" ،,.:;-–—…") + "…"


def dumps(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"


def prefix_name(prefix):
    return "".join(f"{ord(c):04x}" for c in prefix)


def write_if_changed(path, text, written):
    written.add(path)
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


# ---------- ساخت ----------
def active_slugs():
    """slug پادکست‌هایی که الان در _podcasts هستند و منتشر می‌شوند (published: false نباشد).
    قسمت‌های پادکستِ حذف‌شده یا پیش‌نویس نباید در جست‌وجو بیایند، وگرنه نتیجه به صفحه‌ای می‌رود که وجود ندارد."""
    out = set()
    for fp in (ROOT / "_podcasts").glob("*.md"):
        try:
            txt = fp.read_text(encoding="utf-8")
        except OSError:
            continue
        m = re.match(r"^---[ \t]*\r?\n(.*?)\r?\n---", txt, re.S)
        fm = m.group(1) if m else ""
        if re.search(r"(?m)^published:\s*false\s*$", fm):
            continue
        sm = re.search(r"(?m)^slug:\s*[\"']?([^\"'\n]+?)[\"']?\s*$", fm)
        out.add((sm.group(1).strip() if sm else fp.stem).replace("/", "_"))
    return out


def build(eps_dir, out_dir, verbose=True, active=None):
    eps_dir, out_dir = Path(eps_dir), Path(out_dir)
    meta_path = out_dir / "meta.json"
    slugs = []
    if meta_path.exists():
        try:
            slugs = list(json.loads(meta_path.read_text(encoding="utf-8")).get("slugs", []))
        except (ValueError, OSError):
            slugs = []

    files = {}
    for fp in sorted(eps_dir.glob("*.json")):
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            print(f"skip {fp.name}: unreadable", file=sys.stderr)
            continue
        if isinstance(data, list) and (active is None or fp.stem in active):
            files[fp.stem] = data
    known = set(slugs)
    slugs += [s for s in sorted(files) if s not in known]          # slug جدید ته فهرست می‌نشیند

    postings = defaultdict(dict)        # token -> {doc: inTitle}
    chunks = {}                         # (slugIdx, n) -> [[title, snippet], ...]
    n_docs = 0
    for slug in slugs:
        data = files.get(slug)
        if not data:
            continue
        si = slugs.index(slug)
        total = min(len(data), BLOCK)
        for i, ep in enumerate(data[:BLOCK]):
            if not isinstance(ep, dict):
                continue
            old = total - 1 - i                                       # قدیمی‌ترین = ۰
            doc = si * BLOCK + old
            title = str(ep.get("t") or "").strip()
            desc = str(ep.get("d") or "").strip()
            n_docs += 1
            row = chunks.setdefault((si, old // DOC_CHUNK), {})
            row[old] = [title, snippet(desc)]
            for tk in set(tokens(title)):
                if indexable(tk):
                    postings[tk][doc] = 1
            for tk in set(tokens(desc)):
                if indexable(tk):
                    postings[tk].setdefault(doc, 0)       # اگر کلمه در عنوان هم بود، همان ۱ می‌ماند

    common = sorted(t for t, d in postings.items() if len(d) > COMMON_DF)
    for t in common:
        del postings[t]

    shards = defaultdict(dict)
    for tk, docs in postings.items():
        vals = sorted(d * 2 + int(tt) for d, tt in docs.items())
        shards[tk[:PREFIX_LEN]][tk] = enc_postings(vals)

    written = set()
    changed = 0
    for pre, body in shards.items():
        changed += write_if_changed(out_dir / "t" / f"{prefix_name(pre)}.json", dumps(body), written)
    for (si, n), rows in chunks.items():
        lo = n * DOC_CHUNK
        hi = max(rows) + 1
        arr = [rows.get(k, ["", ""]) for k in range(lo, hi)]
        changed += write_if_changed(out_dir / "d" / f"{si}-{n}.json", dumps(arr), written)
    meta = {
        "version": VERSION, "block": BLOCK, "dchunk": DOC_CHUNK, "prefix": PREFIX_LEN,
        "docs": n_docs, "slugs": slugs, "common": common,
    }
    changed += write_if_changed(meta_path, dumps(meta), written)

    removed = 0
    for sub in ("t", "d"):
        for fp in (out_dir / sub).glob("*.json") if (out_dir / sub).exists() else []:
            if fp not in written:
                fp.unlink()
                removed += 1
    if verbose:
        size = sum(f.stat().st_size for f in written if f.exists())
        print(f"sidx: {n_docs} episodes, {len(postings)} tokens ({len(common)} common), "
              f"{len(written)} files, {size/1e6:.2f} MB, {changed} written, {removed} removed")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--eps", default=str(ROOT / "assets" / "eps"))
    ap.add_argument("--out", default=str(ROOT / "assets" / "sidx"))
    a = ap.parse_args()
    return build(a.eps, a.out, active=active_slugs() if a.eps == str(ROOT / "assets" / "eps") else None)


if __name__ == "__main__":
    sys.exit(main())
