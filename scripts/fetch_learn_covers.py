#!/usr/bin/env python3
"""
PersianPod — گرفتن خودکار کاور برای آموزش‌ها

برای هر آموزشی که «image» ندارد:
  1) صفحه‌ی منبع (url یا source_url) را باز می‌کند
  2) عکس شاخص آن (og:image) را پیدا می‌کند
  3) عکس را کوچک می‌کند و در assets/img/learn/ ذخیره می‌کند
  4) خط «image: ...» را به همان آموزش اضافه می‌کند

کجا را نگاه می‌کند:
  - _data/learn_links.yml   (لینک‌های بیرونی)
  - _learn/*.md             (مطلب‌های خودت، فقط اگر source_url داشته باشند و image نداشته باشند)

هیچ آموزشی را که از قبل image دارد دست نمی‌زند. اگر عکسی پیدا نشد، چیزی عوض نمی‌شود
و صفحه به‌جایش یک کاور ساده با حرف اول نشان می‌دهد.
"""
import argparse
import hashlib
import io
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (compatible; PersianPodBot/1.0; +https://persianpod.ir)"
MAX_BYTES = 10 * 1024 * 1024
OUT_W = 960                      # عرض نهایی کاور (پیکسل)

try:
    from PIL import Image        # اختیاری؛ بدون آن عکس همان‌طور که هست ذخیره می‌شود
except Exception:                # pragma: no cover
    Image = None


def fetch(url, binary=False, referer=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*",
                                               **({"Referer": referer} if referer else {})})
    with urllib.request.urlopen(req, timeout=25) as r:
        data = r.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("too large")
        ctype = r.headers.get("Content-Type", "")
        if binary:
            return data, ctype
        charset = re.search(r"charset=([\w-]+)", ctype)
        enc = charset.group(1) if charset else "utf-8"
        return data.decode(enc, errors="replace")


def find_og_image(html, base):
    """og:image یا twitter:image را (با هر ترتیب صفت‌ها) پیدا می‌کند."""
    for tag in re.findall(r"<meta\b[^>]*>", html, flags=re.I):
        name = re.search(r'(?:property|name)\s*=\s*["\']([^"\']+)["\']', tag, flags=re.I)
        content = re.search(r'content\s*=\s*["\']([^"\']+)["\']', tag, flags=re.I)
        if name and content and name.group(1).lower() in ("og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"):
            return urllib.parse.urljoin(base, content.group(1).replace("&amp;", "&"))
    return None


def save_image(data, ctype, slug, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    if Image is not None:
        try:
            im = Image.open(io.BytesIO(data))
            im = im.convert("RGB")
            if im.width > OUT_W:
                im = im.resize((OUT_W, round(im.height * OUT_W / im.width)))
            name = slug + ".webp"
            im.save(out_dir / name, "WEBP", quality=82, method=6)
            return name
        except Exception:
            pass
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}.get(ctype.split(";")[0].strip().lower(), ".jpg")
    name = slug + ext
    (out_dir / name).write_bytes(data)
    return name


def cover_for(page_url, out_dir):
    html = fetch(page_url)
    img_url = find_og_image(html, page_url)
    if not img_url:
        return None
    data, ctype = fetch(img_url, binary=True, referer=page_url)
    if "svg" in ctype.lower() or len(data) < 1500:
        return None
    slug = "l-" + hashlib.sha1(page_url.encode("utf-8")).hexdigest()[:10]
    return save_image(data, ctype, slug, out_dir)


def unquote(v):
    v = v.strip()
    return v[1:-1] if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'" else v


def process_links(path, out_dir, web_dir):
    lines = path.read_text(encoding="utf-8").split("\n")
    # هر بلوک از «- title:» شروع می‌شود
    starts = [i for i, l in enumerate(lines) if l.startswith("- title:")]
    added = 0
    for n in range(len(starts) - 1, -1, -1):          # از آخر به اول، تا شماره‌ی خط‌ها به‌هم نریزد
        a = starts[n]
        b = starts[n + 1] if n + 1 < len(starts) else len(lines)
        block = lines[a:b]
        if any(re.match(r"\s+image\s*:", l) for l in block):
            continue
        url_i = next((i for i, l in enumerate(block) if re.match(r"\s+url\s*:", l)), None)
        if url_i is None:
            continue
        url = unquote(block[url_i].split(":", 1)[1])
        try:
            name = cover_for(url, out_dir)
        except Exception as e:
            print(f"  ✗ {url}  ({type(e).__name__}: {e})")
            continue
        if not name:
            print(f"  ✗ {url}  (عکس شاخص پیدا نشد)")
            continue
        lines.insert(a + url_i + 1, f'  image: "{web_dir}/{name}"')
        print(f"  ✓ {url}  ->  {name}")
        added += 1
    if added:
        path.write_text("\n".join(lines), encoding="utf-8")
    return added


def process_posts(folder, out_dir, web_dir):
    added = 0
    for md in sorted(folder.glob("*.md")):
        text = md.read_text(encoding="utf-8")
        m = re.match(r"^---\n(.*?)\n---\n", text, flags=re.S)
        if not m:
            continue
        fm = m.group(1).split("\n")
        live = [l for l in fm if not l.lstrip().startswith("#")]
        if any(re.match(r"image\s*:", l) for l in live):
            continue
        src = next((unquote(l.split(":", 1)[1]) for l in live if re.match(r"source_url\s*:", l)), None)
        if not src:
            continue
        try:
            name = cover_for(src, out_dir)
        except Exception as e:
            print(f"  ✗ {md.name}  ({type(e).__name__}: {e})")
            continue
        if not name:
            print(f"  ✗ {md.name}  (عکس شاخص پیدا نشد)")
            continue
        fm.append(f'image: "{web_dir}/{name}"')
        md.write_text("---\n" + "\n".join(fm) + "\n---\n" + text[m.end():], encoding="utf-8")
        print(f"  ✓ {md.name}  ->  {name}")
        added += 1
    return added


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="ریشه‌ی ریپو")
    args = ap.parse_args()
    root = Path(args.root)
    out_dir = root / "assets" / "img" / "learn"
    web_dir = "/assets/img/learn"
    total = 0
    links = root / "_data" / "learn_links.yml"
    if links.exists():
        print("learn_links.yml")
        total += process_links(links, out_dir, web_dir)
    posts = root / "_learn"
    if posts.is_dir():
        print("_learn/")
        total += process_posts(posts, out_dir, web_dir)
    print(f"تمام شد؛ {total} کاور اضافه شد.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
