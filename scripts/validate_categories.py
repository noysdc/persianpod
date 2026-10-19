#!/usr/bin/env python3
"""اعتبارسنجی دسته و زیردسته‌ی همه‌ی پادکست‌ها با _data/categories.yml

  python3 scripts/validate_categories.py              # فقط خطاها؛ اگر خطا بود با کد 1 خارج می‌شود
  python3 scripts/validate_categories.py --stats      # شمارش هر دسته/زیردسته + هشدار زیردسته‌های کم‌جمعیت
  python3 scripts/validate_categories.py --folder _podcasts
"""
import argparse, os, sys
from collections import Counter
from catlib import *

MAX_SUBS = 3
MIN_SUB_VISIBLE = 3   # فقط برای گزارش --stats

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--folder", default="_podcasts")
    ap.add_argument("--stats", action="store_true")
    a = ap.parse_args()

    cats = load_categories()
    cat_norm = {norm(c): c for c in cats}
    formats = []
    try:
        formats = load_yaml("_data/formats.yml") or []
    except FileNotFoundError:
        pass
    fmt_set = set(formats)

    errors, cc, sc, total, drafts = [], Counter(), Counter(), 0, 0
    for path in podcast_files(a.folder):
        total += 1
        name = os.path.relpath(path, ROOT)
        _, m, fm = read_front(path)
        if fm is None:
            errors.append(f"{name}: فرانت‌متر ندارد"); continue
        if fm.get("published") is False:      # پیش‌نویس‌های خودکار (pi-build-pages) هنوز بررسی نمی‌شوند
            drafts += 1
            continue
        cat = fm.get("category")
        subs = fm.get("subcategories") or []
        if isinstance(subs, str):
            subs = [subs]

        if cat not in cats:
            hint = f" (منظورت «{cat_norm[norm(cat)]}» بود؟ فرق فقط در نگارش/نیم‌فاصله است)" if norm(cat) in cat_norm else ""
            errors.append(f"{name}: دسته‌ی «{cat}» در categories.yml نیست{hint}")
            continue
        cc[cat] += 1
        if len(subs) > MAX_SUBS:
            errors.append(f"{name}: بیش از {MAX_SUBS} زیردسته ({len(subs)})")
        if len(set(subs)) != len(subs):
            errors.append(f"{name}: زیردسته‌ی تکراری")
        allowed = cats[cat]; allowed_norm = {norm(s): s for s in allowed}
        for s in subs:
            if s in allowed:
                sc[(cat, s)] += 1
            else:
                hint = f" (منظورت «{allowed_norm[norm(s)]}» بود؟)" if norm(s) in allowed_norm else ""
                other = [c for c, l in cats.items() if s in l]
                if other and not hint:
                    hint = f" (این زیردسته زیر «{other[0]}» تعریف شده، نه «{cat}»)"
                errors.append(f"{name}: زیردسته‌ی «{s}» زیر «{cat}» نیست{hint}")
        fmt = fm.get("format")
        if fmt and fmt_set and fmt not in fmt_set:
            errors.append(f"{name}: قالب «{fmt}» در formats.yml نیست")

    for e in errors:
        print("خطا:", e)
    print(f"\n{total} پادکست بررسی شد ({drafts} پیش‌نویس رد شد)، {len(errors)} خطا.")

    if a.stats:
        print("\n— شمارش دسته‌ها —")
        for c in cats:
            print(f"{cc[c]:4d}  {c}")
            for s in cats[c]:
                n = sc[(c, s)]
                flag = "  ← خالی" if n == 0 else ("  ← کم‌جمعیت" if n < MIN_SUB_VISIBLE else "")
                print(f"        {n:3d}  {s}{flag}")
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()
