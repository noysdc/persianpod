#!/usr/bin/env python3
"""پست خودکار پادکست‌های تازه‌منتشرشده در کانال تلگرام (فایل کارت HTML + کپشن).

  python3 scripts/telegram_post.py --init            # یک بار: همه‌ی پادکست‌های فعلی «قبلاً پست‌شده» ثبت می‌شوند (چیزی ارسال نمی‌شود)
  python3 scripts/telegram_post.py --dry-run         # فقط نشان می‌دهد چه چیزی پست می‌شد (و کارت HTML را در tmp می‌نویسد)
  python3 scripts/telegram_post.py                   # پست پادکست‌های جدید (حداکثر --max در هر اجرا)
  python3 scripts/telegram_post.py --slug noys       # فقط همین پادکست (اگر قبلاً پست شده، اول از _data/tg_posts.json حذفش کن)
  python3 scripts/telegram_post.py --max 1 --min-gap 4   # برنامه‌ی روزانه: یک پست؛ اگر کمتر از ۴ ساعت از پست قبلی گذشته، ردش می‌کند
  python3 scripts/telegram_post.py --order oldest    # ترتیب صف: newest (پیش‌فرض)، oldest یا random
  python3 scripts/telegram_post.py --check           # عیب‌یابی: توکن، کانال و ادمین‌بودن ربات را بررسی می‌کند (چیزی ارسال نمی‌شود)

متغیرهای محیطی:
  TELEGRAM_BOT_TOKEN   توکن ربات (در GitHub Secrets)
  TELEGRAM_CHAT_ID     پیش‌فرض @persian_pod_ir

قاعده: پادکستی پست می‌شود که published: false نباشد، tg_skip: true نداشته باشد و slugش در _data/tg_posts.json نباشد.
اگر آن فایل وجود نداشته باشد، هیچ چیزی پست نمی‌شود (اول --init).
فیلدهای اختیاری فایل پادکست: tg_caption (توضیح کپشن به‌جای description)، tg_quote (نقل‌قول)، tg_tagline (زیرعنوان کارت).
فقط با کتابخانه‌ی استاندارد پایتون + PyYAML.
"""
import argparse, base64, html, json, mimetypes, os, re, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request, uuid
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parent.parent
PODCASTS = ROOT / "_podcasts"
STATE = ROOT / "_data" / "tg_posts.json"
LAST = ROOT / "_data" / "tg_last.json"          # زمان آخرین پست موفق (برای نگه‌داشتن فاصله‌ی بین دو پست روزانه)
TEMPLATE = Path(__file__).resolve().parent / "tg_card_template.html"
SITE = "https://persianpod.ir"
API = os.environ.get("TELEGRAM_API_BASE", "https://api.telegram.org")
CAPTION_MAX = 1024
FIXED_TAGS = ["پرشین_پاد", "پادکست_فارسی", "معرفی_پادکست"]
MAX_TAGS = 10
FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
FM = re.compile(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|$)", re.S)


def esc(s):
    return html.escape(str(s or ""), quote=True)


def read_podcast(path):
    text = path.read_text(encoding="utf-8")
    m = FM.match(text)
    if not m:
        return None, ""
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return None, ""
    return fm, text[m.end():]


def short_name(fm):
    t = str(fm.get("title") or "").strip()
    return t.split("؛")[0].strip() if "؛" in t else t


def tagline(fm):
    if fm.get("tg_tagline"):
        return str(fm["tg_tagline"]).strip()
    t = str(fm.get("title") or "")
    return t.split("؛", 1)[1].strip() if "؛" in t else ""


def where_to_start(body):
    """اولین مورد بخش «از کجا شروع کنیم» → (عنوان, لینک) یا None."""
    m = re.search(r"(?m)^##\s*از کجا شروع.*$", body)
    if not m:
        return None
    for line in body[m.end():].splitlines():
        if line.startswith("## "):
            break
        if line.lstrip().startswith(("- ", "* ")):
            t = re.search(r"\*\*(.+?)\*\*", line)
            u = re.search(r"\]\((https?://[^)\s]+)\)", line)
            if t and u:
                return re.sub(r"\s*[—–-]\s*قسمت.*$", "", t.group(1)).strip(), u.group(1)
            return None
    return None


def hashtags(fm):
    out = []
    def add(x):
        x = re.sub(r"[^\w\u200c]+", "_", str(x).strip(), flags=re.U).strip("_").replace("\u200c", "_")
        if x and x.lower() not in [o.lower() for o in out]:
            out.append(x)
    for t in FIXED_TAGS:
        add(t)
    for t in (fm.get("tags") or []):
        add(t)
    if fm.get("title_en"):
        add(re.sub(r"\s+", "", str(fm["title_en"])))
    return out[:MAX_TAGS]


def build_caption(fm, body, slug):
    name = short_name(fm)
    head = f"پادکست {name}"
    if fm.get("title_en"):
        head += f" | {str(fm['title_en']).upper()}"
    desc = str(fm.get("tg_caption") or fm.get("description") or "").strip()
    quote = str(fm.get("tg_quote") or "").strip()
    place = "، ".join(x for x in [str(fm.get("city") or "").strip(), str(fm.get("country") or "").strip()] if x)
    year = str(fm.get("start_year") or "").translate(FA)
    meta = []
    if fm.get("creator"):
        meta.append(f"🎧 میزبان: {esc(fm['creator'])}")
    line2 = " · ".join(x for x in [f"📍 {esc(place)}" if place else "", f"📅 شروع: {esc(year)}" if year else ""] if x)
    if line2:
        meta.append(line2)
    start = where_to_start(body)
    start_line = f'🎧 از کجا شروع کنیم: اپیزود «<a href="{esc(start[1])}">{esc(start[0])}</a>»' if start else ""
    tags = " ".join("#" + t for t in hashtags(fm))
    tail = [
        f'🔗 <a href="{SITE}/podcasts/{esc(slug)}/">صفحه‌ی کامل در پرشین‌پاد</a>',
        f'📌 <a href="{SITE}">پادکستت را به پرشین‌پاد اضافه کن</a>',
        "@persian_pod_ir | خانه‌ی پادکست‌های فارسی",
    ]
    def assemble(d):
        parts = [f"<b>{esc(head)}</b>"]
        if d: parts.append(esc(d))
        if quote: parts.append(f"<blockquote>{esc(quote)}</blockquote>")
        if meta: parts.append("\n".join(meta))
        if start_line: parts.append(start_line)
        if tags: parts.append(f"<tg-spoiler>{esc(tags)}</tg-spoiler>")
        parts.append(tail[0]); parts.append(tail[1]); parts.append(tail[2])
        return "\n\n".join(parts)
    def visible_len(s):
        return len(html.unescape(re.sub(r"<[^>]+>", "", s)))
    cap = assemble(desc)
    while visible_len(cap) > CAPTION_MAX and len(desc) > 40:       # توضیح بلند را در مرز کلمه کوتاه می‌کند
        desc = desc[: max(40, len(desc) - max(20, visible_len(cap) - CAPTION_MAX + 5))].rsplit(" ", 1)[0].rstrip("،,.؛ ") + "…"
        cap = assemble(desc)
    return cap


def link_btn(label, href):
    return f'<a href="{esc(href)}">{label}</a>'


def build_card(fm, slug):
    tpl = TEMPLATE.read_text(encoding="utf-8")
    name = short_name(fm)
    cover = f'<div class="cover ph">🎙</div>'
    logo = str(fm.get("logo") or "")
    lp = ROOT / logo.lstrip("/") if logo and "://" not in logo else None
    if lp and lp.exists() and lp.stat().st_size < 400_000:
        mime = mimetypes.guess_type(lp.name)[0] or "image/webp"
        cover = f'<img class="cover" src="data:{mime};base64,{base64.b64encode(lp.read_bytes()).decode()}" alt="لوگوی {esc(name)}">'
    links = [link_btn("PersianPod 🏠", f"{SITE}/podcasts/{slug}/")]
    cb = fm.get("castbox_channel") or (f"https://castbox.fm/ch/{fm['castbox_id']}" if fm.get("castbox_id") else "")
    for label, val in [("Castbox 🎧", cb), ("Spotify 🎧", fm.get("spotify")), ("Apple Podcasts 🎧", fm.get("apple_podcasts")),
                       ("YouTube ▶️", fm.get("youtube")), ("Telegram ✈️", fm.get("telegram")), ("RSS 📡", fm.get("rss")),
                       ("Email ✉️", f"mailto:{fm['email']}" if fm.get("email") else ""), ("Website 🌐", fm.get("website")),
                       ("Instagram 📷", fm.get("instagram")), ("Threads 🧵", fm.get("threads"))]:
        if val:
            links.append(link_btn(label, val))
    quote = str(fm.get("tg_quote") or "").strip()
    out = (tpl.replace("{{TITLE}}", esc(name)).replace("{{NAME}}", esc(name)).replace("{{COVER}}", cover)
              .replace("{{TAGLINE}}", esc(tagline(fm))).replace("{{LINKS}}", "\n".join(links))
              .replace("{{QUOTE}}", f'<div class="q">«{esc(quote)}»</div>' if quote else ""))
    return out


def multipart(fields, files):
    b = uuid.uuid4().hex
    body = bytearray()
    for k, v in fields.items():
        body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, (fn, data, ctype) in files.items():
        body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + data + b"\r\n"
    body += f"--{b}--\r\n".encode()
    return bytes(body), f"multipart/form-data; boundary={b}"


def send_document(token, chat, filename, data, caption):
    body, ctype = multipart({"chat_id": chat, "caption": caption, "parse_mode": "HTML"}, {"document": (filename, data, "text/html")})
    req = urllib.request.Request(f"{API}/bot{token}/sendDocument", data=body, headers={"Content-Type": ctype})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.loads(r.read().decode("utf-8"))
            if not j.get("ok"):
                raise RuntimeError(j)
            return j["result"]["message_id"]
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")
            if e.code == 429 and attempt < 2:
                wait = 5
                try: wait = int(json.loads(err)["parameters"]["retry_after"]) + 1
                except Exception: pass
                time.sleep(min(wait, 60)); continue
            raise RuntimeError(f"HTTP {e.code}: {err[:300]}")
    raise RuntimeError("failed")


def tg(token, method, **params):
    """فراخوانی ساده‌ی API تلگرام (GET)؛ همیشه یک dict برمی‌گرداند."""
    url = f"{API}/bot{token}/{method}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "description": f"HTTP {e.code}"}
    except Exception as e:
        return {"ok": False, "description": str(e)}


def hint(desc):
    """خطای تلگرام را به راهنمای فارسی تبدیل می‌کند."""
    d = (desc or "").lower()
    if "unauthorized" in d or "http 401" in d or "not found" in d and "bot" in d:
        return "توکن ربات اشتباه یا باطل است؛ از @BotFather توکن بگیر و Secret با نام TELEGRAM_BOT_TOKEN را به‌روز کن."
    if "chat_id is empty" in d or "chat not found" in d:
        return "شناسه‌ی کانال اشتباه است یا ربات به کانال دسترسی ندارد (کانال عمومی: @نام_کانال، کانال خصوصی: شناسه‌ی عددی که با -100 شروع می‌شود)."
    if "not a member" in d or "forbidden" in d or "not enough rights" in d or "need administrator" in d:
        return "ربات باید «ادمین» کانال باشد و دسترسی «ارسال پیام» (Post Messages) داشته باشد."
    if "can't parse entities" in d:
        return "کپشن HTML نامعتبر است (تگ باز یا بسته‌نشده)."
    if "too long" in d:
        return "کپشن بیش از ۱۰۲۴ نویسه است."
    return ""


def check(token, chat):
    """عیب‌یابی: توکن، کانال و دسترسی ربات. کد خروج 0 یعنی همه‌چیز درست است."""
    print(f"کانال مقصد: {chat!r}")
    me = tg(token, "getMe")
    if not me.get("ok"):
        print(f"✗ توکن: {me.get('description')}\n  → {hint(me.get('description')) or 'توکن را از @BotFather دوباره بگیر.'}")
        return 1
    bot = me["result"]
    print(f"✓ ربات: @{bot.get('username')}")
    c = tg(token, "getChat", chat_id=chat)
    if not c.get("ok"):
        print(f"✗ کانال: {c.get('description')}\n  → {hint(c.get('description')) or 'شناسه‌ی کانال را بررسی کن.'}")
        return 1
    print(f"✓ کانال: {c['result'].get('title')} ({c['result'].get('type')})")
    m = tg(token, "getChatMember", chat_id=chat, user_id=bot["id"])
    r = m.get("result") or {}
    status = r.get("status")
    if not m.get("ok") or status not in ("administrator", "creator"):
        print(f"✗ ربات ادمین کانال نیست (وضعیت: {status or m.get('description')})\n  → ربات را در کانال به‌عنوان «ادمین» با دسترسی «ارسال پیام» اضافه کن.")
        return 1
    if r.get("can_post_messages") is False:
        print("✗ ربات ادمین است ولی دسترسی «ارسال پیام» (Post Messages) را ندارد.")
        return 1
    print("✓ ربات ادمین است و می‌تواند پست کند.")
    state = load_state()
    if state is None:
        print("! هنوز --init اجرا نشده (_data/tg_posts.json نیست).")
    else:
        pend = [slug for slug, fm, _ in all_podcasts() if eligible(fm) and slug not in state]
        print(f"ℹ پادکست‌های در انتظار پست: {len(pend)} (با روزی ۲ پست حدود {(len(pend) + 1) // 2} روز طول می‌کشد)")
        q = order_queue([(s, fm, b) for s, fm, b in all_podcasts() if eligible(fm) and s not in state], os.environ.get("TG_ORDER") or "newest")
        if q:
            print("  نوبت‌های بعدی: " + "، ".join(s for s, _, _ in q[:4]))
    return 0


def added_ts(path):
    """زمان اولین کامیتِ این فایل (= زمان اضافه‌شدن پادکست). به تاریخچه‌ی گیت نیاز دارد (fetch-depth: 0)."""
    try:
        out = subprocess.run(["git", "log", "--diff-filter=A", "--format=%ct", "--", str(path)], cwd=ROOT, capture_output=True, text=True, timeout=30).stdout.split()
        return int(out[-1]) if out else 0
    except Exception:
        return 0


def order_queue(todo, how):
    """todo = [(slug, fm, body)]. newest: تازه‌ترین پادکست اضافه‌شده اول (پادکست تازه‌ثبت‌شده زود معرفی می‌شود)؛ oldest: قدیمی‌ترین اول."""
    if how == "random":
        import random
        random.shuffle(todo)
        return todo
    ts = {s: added_ts(PODCASTS / f"{s}.md") for s, _, _ in todo}
    # اگر نام فایل با slug فرق داشته باشد، ts صفر می‌شود و ترتیب الفبایی می‌ماند
    return sorted(todo, key=lambda t: (-ts[t[0]] if how == "newest" else ts[t[0]], t[0]))


def hours_since_last():
    try:
        return (time.time() - float(json.loads(LAST.read_text(encoding="utf-8"))["at"])) / 3600
    except Exception:
        return None


def load_state():
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else None


def save_state(d):
    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(d, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def all_podcasts():
    for path in sorted(PODCASTS.glob("*.md")):
        fm, body = read_podcast(path)
        if fm is None:
            continue
        slug = str(fm.get("slug") or path.stem)
        yield slug, fm, body


def eligible(fm):
    return fm.get("published") is not False and not fm.get("tg_skip")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--init", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--slug")
    ap.add_argument("--check", action="store_true", help="عیب‌یابی توکن و دسترسی ربات")
    ap.add_argument("--order", choices=["newest", "oldest", "random"], default=os.environ.get("TG_ORDER") or "newest", help="ترتیب صف پادکست‌های در انتظار")
    ap.add_argument("--min-gap", type=float, default=0, help="حداقل فاصله‌ی ساعتی از پست قبلی؛ اجرای پشتیبان زمان‌بندی را بی‌اثر می‌کند")
    ap.add_argument("--max", type=int, default=5, help="حداکثر تعداد پست در یک اجرا")
    a = ap.parse_args()

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat = (os.environ.get("TELEGRAM_CHAT_ID") or "").strip() or "@persian_pod_ir"
    if a.check:
        if not token:
            print("✗ Secret با نام TELEGRAM_BOT_TOKEN تنظیم نشده (Settings → Secrets and variables → Actions → Repository secrets).")
            return 1
        return check(token, chat)

    state = load_state()
    if a.init:
        state = state or {}
        n = 0
        for slug, fm, _ in all_podcasts():
            if eligible(fm) and slug not in state:
                state[slug] = 0; n += 1          # 0 = «قبلاً دستی پست شده / پست نمی‌شود»
        save_state(state)
        print(f"init: {n} پادکست موجود ثبت شد؛ از این به بعد فقط پادکست‌های تازه پست می‌شوند.")
        return 0
    if state is None and a.dry_run:
        state = {}                                  # پیش‌نمایش بدون --init مجاز است (چیزی ارسال یا ذخیره نمی‌شود)
    if state is None:
        print("هنوز --init اجرا نشده (_data/tg_posts.json نیست)؛ برای جلوگیری از پست انبوه، چیزی ارسال نشد.", file=sys.stderr)
        return 0

    if not token and not a.dry_run:
        print("TELEGRAM_BOT_TOKEN تنظیم نشده (باید «Repository secret» باشد، نه Variable یا Environment secret).", file=sys.stderr)
        return 1

    if a.min_gap and not a.dry_run and not a.slug:
        h = hours_since_last()
        if h is not None and h < a.min_gap:
            print(f"آخرین پست {h:.1f} ساعت پیش بوده (کمتر از {a.min_gap:g}؛ نوبت امروز قبلاً انجام شده)؛ چیزی ارسال نشد.")
            return 0
    todo = [(s, fm, b) for s, fm, b in all_podcasts() if eligible(fm) and s not in state and (not a.slug or s == a.slug)]
    todo = order_queue(todo, a.order)
    if a.slug and not todo:
        print(f"{a.slug}: پیدا نشد، منتشر نشده، tg_skip دارد، یا قبلاً در tg_posts.json ثبت شده.")
        return 0
    if not todo:
        print("پادکست تازه‌ای برای پست نیست.")
        return 0
    sent = 0
    fails = []
    for slug, fm, body in todo[: a.max]:
        caption = build_caption(fm, body, slug)
        card = build_card(fm, slug).encode("utf-8")
        if a.dry_run:
            out = Path(tempfile.gettempdir()) / f"{slug}.html"
            out.write_bytes(card)
            print(f"--- {slug} (کارت: {out}, {len(card)} بایت) ---\n{caption}\n")
            continue
        try:
            mid = send_document(token, chat, f"{slug}.html", card, caption)
        except Exception as e:
            print(f"FAIL {slug}: {e}", file=sys.stderr)
            h = hint(str(e))
            if h:
                print(f"  → {h}", file=sys.stderr)
            fails.append(slug)
            if len(fails) >= 2 and not sent:                  # خطای تنظیمات است نه یک پادکست؛ بقیه را بی‌خودی امتحان نکن
                print("ارسال متوقف شد. برای عیب‌یابی گزینه‌ی check را اجرا کن.", file=sys.stderr)
                break
            continue
        state[slug] = mid
        save_state(state)
        LAST.write_text(json.dumps({"at": time.time(), "slug": slug}) + "\n", encoding="utf-8")                         # بعد از هر پست ذخیره می‌شود تا با خطای بعدی دوباره‌پست نشود
        sent += 1
        print(f"ok {slug}: message_id={mid}")
        time.sleep(3)
    if len(todo) > a.max:
        print(f"{len(todo) - a.max} مورد برای اجرای بعدی ماند (سقف {a.max}).")
    if fails:
        print(f"{len(fails)} ارسال ناموفق بود: {', '.join(fails)}", file=sys.stderr)
        return 1                                           # اجرا قرمز می‌شود تا خطا دیده شود (قبلاً با «موفق» تمام می‌شد)
    return 0


if __name__ == "__main__":
    sys.exit(main())
