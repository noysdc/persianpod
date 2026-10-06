# پرشین‌پاد (persianpod.ir)

دایرکتوری رایگان و بدون تبلیغ پادکست‌های فارسی؛ ساخته‌شده با Jekyll روی GitHub Pages.

## افزودن پادکست
یک فایل `_podcasts/نام-انگلیسی.md` بسازید. آدرس صفحه می‌شود `/podcasts/نام-انگلیسی/`.

```yaml
---
title: نام پادکست
title_en: Podcast Name
slug: podcast-name          # مثل نام فایل
description: یک یا دو جمله درباره‌ی پادکست (در کارت و نتیجه‌ی جست‌وجو دیده می‌شود)
category: تاریخ             # یکی از دسته‌های _data/categories.yml (الزامی)
subcategories: [تاریخ ایران, تاریخ باستان]   # اختیاری؛ تا ۳ مورد از همان دسته
tags: [تاریخ, سیاست, جامعه]
status: active              # active | paused | ended  (با RSS خودکار به‌روز می‌شود)
language: فارسی
creator: نام سازنده
country: ایران
city: تهران
start_year: 1402            # شمسی، همیشه عدد لاتین (نمایش فارسی خودکار است)
episode_count: 40           # عدد لاتین
frequency: هفتگی            # روزانه | هفتگی | دو هفته یک‌بار | ماهانه | فصلی | نامنظم
duration: 40 دقیقه
logo: /assets/img/podcasts/name.jpg   # مربع، حداکثر ۲ مگابایت
castbox_id: "1234567"
castbox_channel:
spotify:
apple_podcasts:
youtube:
instagram:
telegram:
website:
email:
collab: true
collab_types:
---
متن بلند معرفی (Markdown) اینجا.
```

بعد از هر تغییر در فایل‌ها: `python3 tools/validate_podcasts.py`

## پخش‌کننده‌ی صفحه‌ی «گوش بده»
هر پادکست که یکی از این‌ها را داشته باشد در `/listen/` پخش‌کننده پیدا می‌کند:
- `spotify:` لینک عادی نمایش در اسپاتیفای (مثل `https://open.spotify.com/show/...`)
- `apple:` لینک عادی اپل پادکست
- `embed:` آدرس کامل iframe هر سرویس دیگر
