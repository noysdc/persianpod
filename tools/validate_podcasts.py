#!/usr/bin/env python3
"""
اعتبارسنجی فایل‌های _podcasts پرشین‌پاد

اجرا (از ریشه‌ی مخزن):
    pip install pyyaml
    python3 tools/validate_podcasts.py

خطا (ERROR) یعنی باید درست شود؛ هشدار (WARN) یعنی بهتر است درست شود.
اگر خطایی باشد خروجی با کد 1 تمام می‌شود (برای GitHub Actions مناسب است).
"""
import re
import sys
import pathlib
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
PODCASTS = ROOT / "_podcasts"
CATEGORIES = ROOT / "_data" / "categories.yml"

STATUSES = {"active", "paused", "ended"}
FREQUENCIES = {"روزانه", "هفتگی", "دو هفته یک‌بار", "ماهانه", "فصلی", "نامنظم"}
MAX_SUBS = 3
MAX_COVER_BYTES = 2 * 1024 * 1024
REQUIRED = ["title", "description", "category", "creator"]
URL_KEYS = ["castbox_channel", "spotify", "apple_podcasts", "youtube",
            "instagram", "telegram", "threads", "website"]
NON_LATIN_DIGITS = re.compile(r"[۰-۹٠-٩]")

errors, warns = [], []


def err(f, msg):
    errors.append(f"ERROR  {f}: {msg}")


def warn(f, msg):
    warns.append(f"WARN   {f}: {msg}")


def load_categories():
    data = yaml.safe_load(CATEGORIES.read_text(encoding="utf-8"))
    return {c["name"]: set(c.get("subcategories") or []) for c in data}


def split(text):
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not m:
        return None, text
    return yaml.safe_load(m.group(1)) or {}, m.group(2)


def check(path, cats, slugs):
    name = path.name
    fm, body = split(path.read_text(encoding="utf-8"))
    if fm is None:
        err(name, "front matter پیدا نشد (فایل باید با --- شروع شود)")
        return

    for k in REQUIRED:
        if not fm.get(k):
            err(name, f"فیلد الزامی «{k}» خالی یا ناموجود است")

    # دسته و زیردسته
    cat = fm.get("category")
    if cat and cat not in cats:
        err(name, f"دسته‌ی «{cat}» در categories.yml نیست")
    subs = fm.get("subcategories", [])
    if "subcategory" in fm:
        err(name, "کلید قدیمی subcategory؛ باید subcategories (فهرست) باشد")
    if subs and not isinstance(subs, list):
        err(name, "subcategories باید فهرست باشد: [الف, ب]")
        subs = []
    if len(subs) > MAX_SUBS:
        err(name, f"حداکثر {MAX_SUBS} زیردسته مجاز است")
    if cat in cats:
        for s in subs:
            if s not in cats[cat]:
                err(name, f"زیردسته‌ی «{s}» جزو دسته‌ی «{cat}» نیست")

    # عددها
    sy = fm.get("start_year")
    if sy is not None:
        if not isinstance(sy, int):
            err(name, f"start_year باید عدد لاتین باشد، نه «{sy}»")
        elif not 1379 <= sy <= 1450:
            err(name, f"start_year={sy} شمسی نیست (بازه‌ی ۱۳۷۹ تا ۱۴۵۰)")
    ec = fm.get("episode_count")
    if ec is not None and (not isinstance(ec, int) or ec < 0):
        err(name, f"episode_count باید عدد صحیح لاتین باشد، نه «{ec}»")
    du = fm.get("duration")
    if du is not None and not re.fullmatch(r"\d+ دقیقه", str(du)):
        err(name, f"duration باید مثل «40 دقیقه» باشد (عدد لاتین)، نه «{du}»")
    le = fm.get("last_episode")
    if le is not None and not re.fullmatch(r"\d{4}-\d{2}(-\d{2})?", str(le)):
        err(name, f"last_episode باید میلادی و مثل «2026-09» باشد، نه «{le}»")

    # فهرست‌های بسته
    st = fm.get("status")
    if st is not None and st not in STATUSES:
        err(name, f"status باید یکی از {sorted(STATUSES)} باشد، نه «{st}»")
    fr = fm.get("frequency")
    if fr is not None and fr not in FREQUENCIES:
        err(name, f"frequency باید یکی از {sorted(FREQUENCIES)} باشد، نه «{fr}»")
    if "collab" in fm and not isinstance(fm["collab"], bool):
        err(name, "collab باید true یا false باشد؛ توضیح در collab_types")

    # رقم فارسی در فیلدهای ماشینی
    for k in ["start_year", "episode_count", "duration", "last_episode", "castbox_id"]:
        if k in fm and NON_LATIN_DIGITS.search(str(fm[k])):
            err(name, f"{k} رقم فارسی دارد؛ در داده فقط لاتین بنویس")

    # مقدار خالی (در Liquid رشته‌ی خالی true حساب می‌شود)
    for k, v in fm.items():
        if v == "":
            warn(name, f"«{k}» رشته‌ی خالی است؛ کل خط را حذف کن")

    for k in URL_KEYS:
        v = fm.get(k)
        if v and not str(v).startswith("https://"):
            warn(name, f"{k} باید با https:// شروع شود")
    em = fm.get("email")
    if em and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", em):
        err(name, f"ایمیل نامعتبر: {em}")
    if fm.get("castbox_channel") or fm.get("castbox_id"):
        if not fm.get("castbox_id"):
            warn(name, "castbox_id ندارد؛ پلیر ساخته نمی‌شود")

    # نام فایل و slug
    slug = fm.get("slug") or path.stem
    if slug in slugs:
        err(name, f"slug تکراری: {slug} (در {slugs[slug]})")
    slugs[slug] = name
    if path.stem != slug and not path.stem.startswith("sample-"):
        warn(name, f"نام فایل ({path.stem}) با slug ({slug}) یکی نیست؛ آدرس صفحه از نام فایل ساخته می‌شود")
    if path.stem.endswith("-final"):
        warn(name, "پسوند -final در نام فایل وارد آدرس صفحه می‌شود؛ حذفش کن")

    # کاور
    logo = fm.get("logo")
    if logo:
        lp = ROOT / str(logo).lstrip("/")
        if lp.exists():
            size = lp.stat().st_size
            if size > MAX_COVER_BYTES:
                err(name, f"کاور {size/1024/1024:.1f} مگابایت است؛ حداکثر ۲ مگابایت")
        else:
            warn(name, f"فایل کاور پیدا نشد: {logo}")

    # متن
    if re.search(r"\[citation:\d+\]", body):
        err(name, "ته‌مانده‌ی [citation:N] در متن؛ حذفش کن")
    if "<iframe" in body:
        warn(name, "iframe دستی در متن است؛ پلیر باید از castbox_id ساخته شود")


def main():
    cats = load_categories()
    slugs = {}
    files = sorted(p for p in PODCASTS.glob("*.md") if not p.name.startswith("_"))
    for p in files:
        check(p, cats, slugs)
    for line in warns + errors:
        print(line)
    print(f"\n{len(files)} فایل بررسی شد: {len(errors)} خطا، {len(warns)} هشدار")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
