#!/usr/bin/env python3
"""انتقال دسته/زیردسته‌ی فایل‌های پادکست طبق _data/category_migrations.yml

  python3 tools/migrate_categories.py            # پیش‌نمایش (چیزی نوشته نمی‌شود)
  python3 tools/migrate_categories.py --apply    # اعمال تغییرات

فقط دو خط category: و subcategories: در فرانت‌متر بازنویسی می‌شوند؛ باقی فایل دست نمی‌خورد.
"""
import argparse, json, os, re
from catlib import *

MAX_SUBS = 3

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--folder", default="_podcasts")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()

    cats = load_categories()
    cat_norm = {norm(c): c for c in cats}
    mig = load_yaml("_data/category_migrations.yml") or {}
    cat_alias = {norm(k): v for k, v in (mig.get("categories") or {}).items()}
    sub_map = {(norm(r["from"][0]), norm(r["from"][1])): r["to"] for r in (mig.get("subcategories") or [])}
    overrides = mig.get("slug_overrides") or {}

    changed = manual = 0
    for path in podcast_files(a.folder):
        name = os.path.relpath(path, ROOT)
        text, m, fm = read_front(path)
        if fm is None:
            continue
        old_cat = fm.get("category") or ""
        old_subs = fm.get("subcategories") or []
        if isinstance(old_subs, str):
            old_subs = [old_subs]
        slug = fm.get("slug") or os.path.splitext(os.path.basename(path))[0]
        notes = []

        def target(t):
            """to -> (cat یا None برای همان دسته، sub) یا None برای حذف"""
            if t is None: return None
            if isinstance(t, list): return (t[0], t[1])
            return (None, t)

        if slug in overrides:
            new_cat = overrides[slug]["category"]
            new_subs = list(overrides[slug].get("subcategories") or [])
        else:
            res_cat = cat_norm.get(norm(old_cat)) or cat_alias.get(norm(old_cat)) or old_cat
            new_cat = res_cat
            # اگر اولین زیردسته به دسته‌ی دیگری منتقل می‌شود، دسته‌ی اصلی هم همراهش می‌رود
            if old_subs:
                k0 = (norm(old_cat), norm(old_subs[0]))
                if k0 in sub_map:
                    t0 = target(sub_map[k0])
                    if t0 and t0[0] and t0[0] != res_cat:
                        new_cat = t0[0]
                        notes.append(f"دسته‌ی اصلی از «{res_cat}» به «{new_cat}» رفت")
            new_subs = []
            allowed = {norm(s): s for s in cats.get(new_cat, [])}
            for s in old_subs:
                key = (norm(old_cat), norm(s))
                if key in sub_map:
                    t = target(sub_map[key])
                    if t is None:
                        notes.append(f"زیردسته‌ی «{s}» حذف شد؛ دستی زیردسته‌ی مناسب بگذار")
                    elif t[0] and t[0] != new_cat:
                        notes.append(f"زیردسته‌ی «{s}» به «{t[0]} / {t[1]}» می‌رفت ولی دسته‌ی اصلی پادکست «{new_cat}» ماند؛ دستی بررسی شود")
                    else:
                        new_subs.append(t[1])
                elif norm(s) in allowed:
                    new_subs.append(allowed[norm(s)])
                else:
                    notes.append(f"زیردسته‌ی «{s}» نه قاعده دارد نه در «{new_cat}» هست؛ دستی بررسی شود")
        # حذف تکراری با حفظ ترتیب
        seen = set(); new_subs = [s for s in new_subs if not (s in seen or seen.add(s))]
        if len(new_subs) > MAX_SUBS:
            notes.append(f"{len(new_subs)} زیردسته شد؛ فقط {MAX_SUBS} اولی نگه داشته شد: {new_subs[MAX_SUBS:]} حذف")
            new_subs = new_subs[:MAX_SUBS]
        if new_cat not in cats:
            notes.append(f"دسته‌ی «{new_cat}» در categories.yml نیست")
        bad = [s for s in new_subs if new_cat in cats and s not in cats[new_cat]]
        if bad:
            notes.append(f"زیردسته‌ی نامعتبر: {bad}")

        if (new_cat, new_subs) != (old_cat, list(old_subs)):
            changed += 1
            print(f"{name}\n   {old_cat} {json.dumps(list(old_subs), ensure_ascii=False)}\n → {new_cat} {json.dumps(new_subs, ensure_ascii=False)}")
            if a.apply:
                fm_text = m.group(1)
                fm_text = re.sub(r"(?m)^category:.*$", "category: " + json.dumps(new_cat, ensure_ascii=False), fm_text, count=1)
                line = "subcategories: " + json.dumps(new_subs, ensure_ascii=False)
                if re.search(r"(?m)^subcategories:", fm_text):
                    fm_text = re.sub(r"(?m)^subcategories:.*$", lambda _: line, fm_text, count=1)
                else:
                    fm_text = re.sub(r"(?m)^(category:.*)$", lambda mm: mm.group(1) + "\n" + line, fm_text, count=1)
                text = "---\n" + fm_text + "\n---\n" + text[m.end():]
                open(path, "w", encoding="utf-8", newline="\n").write(text)
        for n in notes:
            manual += 1
            print("   ⚠", n)

    print(f"\n{changed} فایل {'تغییر کرد' if a.apply else 'تغییر خواهد کرد'}، {manual} مورد نیاز به بررسی دستی.")
    if not a.apply:
        print("برای اعمال: python3 tools/migrate_categories.py --apply")

if __name__ == "__main__":
    main()
