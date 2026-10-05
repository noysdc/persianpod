# مرحله‌ی ۱ پرشین‌پاد؛ پایه‌ی داده

## چیدمان فایل‌ها (مسیرها عیناً مثل مخزن)
- `_data/categories.yml`          15 دسته و زیردسته‌ها (منبع واحد)
- `_podcasts/*.md`                فایل‌های یکسان‌شده‌ی ۸ پادکست (۵ واقعی + ۳ نمونه)
- `about-us.md`                   متن اصلاح‌شده
- `assets/js/pp-digits.js`        تبدیل ارقام (نمایش فارسی، داده لاتین)
- `_includes/fa-digits.html`      همان کار هنگام ساخت سایت (Liquid)
- `tools/validate_podcasts.py`    اعتبارسنج فایل‌ها

## ساختار نهایی front matter
layout, title, title_en, slug, description, category, subcategories, tags,
status (active|paused|ended), language, creator, country, city,
start_year (شمسی، عدد لاتین), last_episode ("2026-09" میلادی), episode_count,
frequency (روزانه|هفتگی|دو هفته یک‌بار|ماهانه|فصلی|نامنظم), duration ("40 دقیقه"),
audience, logo, castbox_id, castbox_channel, spotify, apple_podcasts, youtube,
instagram, telegram, threads, website, email, collab (true/false), collab_types

## بعد از جایگزینی
1. فایل‌های قدیمی `_podcasts/*-final.md` را حذف کن (نام فایل‌های جدید بدون -final است).
2. `python3 tools/validate_podcasts.py`
