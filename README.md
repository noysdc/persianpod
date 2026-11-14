<div align="center">

# پرشین‌پاد · PersianPod

**مرجع کشف پادکست‌های فارسی**
**The discovery hub for Persian-language podcasts**

[persianpod.ir](https://persianpod.ir) · [Telegram](https://t.me/persian_pod_ir) · [contact@persianpod.ir](mailto:contact@persianpod.ir)

[![License: GPL-3.0](https://img.shields.io/badge/code-GPL--3.0-blue.svg)](LICENSE)

[🇮🇷 فارسی](#fa) · [🇬🇧 English](#en)

</div>

---

<a id="fa"></a>

<div dir="rtl" align="right">

# 🇮🇷 فارسی

## پرشین‌پاد چیست؟

پرشین‌پاد جایی است برای پیدا کردن پادکست‌های فارسی. هر پادکست یک صفحه‌ی مستقل دارد؛ با معرفی، دسته‌بندی، لینک‌ها، فهرست قسمت‌ها و پخش‌کننده‌ی داخل خود سایت. هدف این است که شنونده بتواند پادکست خوب را راحت پیدا کند و پادکست‌ساز هم دیده شود، بدون اینکه یک پلتفرم یا واسطه‌ای میان آن‌ها باشد.

این ریپو **کد و محتوای سایت [persianpod.ir](https://persianpod.ir)** است. سایت با Jekyll ساخته شده و روی GitHub Pages با دامنه‌ی اختصاصی منتشر می‌شود.

## امکانات

**کشف و جست‌وجو**

- جست‌وجوی پیشرفته با فیلتر نام، دسته و زیردسته، کشور و شهر، سال شروع، تعداد و مدت قسمت‌ها، فعال یا غیرفعال بودن و «قسمت تازه‌ی اخیر»
- دسته‌بندی شاخه‌ای: هر دسته زیردسته‌های خودش را دارد و برچسب‌ها قابل کلیک‌اند
- پیشنهاد پادکست‌های مشابه در پایین هر صفحه
- صفحه‌ی **مقایسه**: مقایسه‌ی دو پادکست بر پایه‌ی داده‌های قابل اندازه‌گیری، بدون امتیاز، بدون برنده و بدون قضاوت درباره‌ی کیفیت
- نقشه‌ی جهان که با کلیک روی ایران به نقشه‌ی شهرها باز می‌شود

**گوش‌دادن**

- صفحه‌ی **گوش بده** با پخش‌کننده‌ها به‌تفکیک دسته
- صفحه‌ی **تازه‌ها** برای دیدن تازه‌ترین قسمت‌ها
- پخش‌کننده‌ی شناور که هنگام گشت‌وگذار در سایت هم به پخش ادامه می‌دهد، با کنترل سرعت و تایمر خواب
- فهرست قسمت‌ها با اسکرول داخل خود صفحه‌ی هر پادکست

**صفحه‌ی هر پادکست**

- معرفی، کاور، دسته، شهر، سال شروع، آمار قسمت‌ها و لینک‌های شبکه‌های اجتماعی و پلتفرم‌ها
- داده‌ی ساختاریافته‌ی `PodcastSeries` (JSON-LD) برای فهمیدن بهتر صفحه توسط موتورهای جست‌وجو
- نمایش درست پیش‌نمایش لینک در تلگرام و شبکه‌های اجتماعی (OpenGraph)

**آموزش**

- بخش **آموزش** با مقاله‌هایی درباره‌ی ساخت پادکست؛ مثلاً [راهنمای کامل ادیت و میکس پادکست با Adobe Audition](_learn/audition-podcast-guide.md)

**تجربه‌ی کاربری**

- حالت شب و روز، تغییر اندازه‌ی فونت و حالت مطالعه
- طراحی راست‌به‌چپ با فونت وزیرمتن (Vazirmatn)
- واکنش‌گرا برای موبایل، تبلت و دسکتاپ
- نصب‌پذیر به‌صورت **PWA** روی گوشی (فایل‌های `manifest.webmanifest`، `sw.js` و `offline.html`)

## اصول پروژه

- **برابری.** همه‌ی پادکست‌ها یکسان دیده می‌شوند. ترتیب دسته‌ها و جایگاه پادکست‌ها به‌صورت چرخشی عوض می‌شود و هیچ پادکستی جایگاه ثابت، نشان ویژه یا اولویت ندارد. حالت ترتیب الفبایی هم در دسترس است.
- **بی‌طرفی.** مقایسه‌ها فقط بر پایه‌ی واقعیت‌های قابل اندازه‌گیری‌اند.
- **احترام به سازندگان.** متن معرفی، کاور و لوگوی هر پادکست متعلق به صاحب آن است. هر پادکست‌ساز هر زمان بخواهد می‌تواند درخواست ویرایش یا حذف صفحه‌اش را بدهد.
- **سادگی.** ثبت پادکست فقط یک چیز لازم دارد: لینک فید RSS.

## پادکست من را چطور اضافه یا ویرایش کنم؟

1. به صفحه‌ی ثبت پادکست بروید: [persianpod.ir/form](https://persianpod.ir/form/)
2. فقط **لینک فید RSS** الزامی است. بقیه‌ی بخش‌ها (توضیح، دسته‌ها، لینک‌ها، شهر و ...) اختیاری‌اند، ولی هرچه کامل‌تر باشند صفحه‌ی بهتری ساخته می‌شود.
3. برای ویرایش یا حذف، دوباره همان فرم را پر کنید یا به [contact@persianpod.ir](mailto:contact@persianpod.ir) پیام بدهید.

قسمت‌ها و آمار هر پادکست به‌صورت خودکار از فید RSS آن به‌روز می‌شود. پادکستی که بیش از سه سال قسمت تازه نداشته باشد «غیرفعال» نشان داده می‌شود.

## ساختار ریپو

| مسیر | کاربرد |
|---|---|
| `_podcasts/` | صفحه‌ی هر پادکست (یک فایل Markdown برای هر پادکست) |
| `_learn/` | مقاله‌های آموزشی |
| `_drafts/` | پیش‌نویس صفحه‌ها پیش از انتشار |
| `_blocked/` | صفحه‌های کنارگذاشته‌شده که منتشر نمی‌شوند |
| `_data/` | داده‌ها: دسته‌بندی‌ها (`categories.yml`)، شهرها، فیلدهای فرم، آمار RSS و ... |
| `_layouts/` و `_includes/` | قالب‌ها و اجزای تکرارشونده‌ی سایت |
| `_worker/` | Cloudflare Worker که فرم ثبت پادکست را دریافت و ارسال می‌کند |
| `assets/` | CSS، جاوااسکریپت، فونت و تصویرها |
| `scripts/` و `tools/` | اسکریپت‌های Python و Node برای به‌روزرسانی، اعتبارسنجی و ساخت داده |
| `.github/workflows/` | خودکارسازی‌ها با GitHub Actions |
| `podcasts.json`، `search.json`، `compare.json`، `new.json` | داده‌ی صفحه‌های جست‌وجو، مقایسه و تازه‌ها |
| `manifest.webmanifest`، `sw.js`، `offline.html` | بخش‌های PWA |
| `CNAME` | دامنه‌ی اختصاصی سایت |

## فناوری‌ها

- **Jekyll** (kramdown و `jekyll-sitemap`) روی **GitHub Pages**
- HTML، CSS و جاوااسکریپت ساده، بدون فریم‌ورک سنگین
- **GitHub Actions** با اسکریپت‌های **Python** و **Node.js**
- **Cloudflare Worker** برای فرم ثبت پادکست
- ربات **تلگرام** برای ارسال خبر پادکست‌های تازه به کانال

## اجرای سایت روی کامپیوتر خودتان

برای اجرا به [Ruby](https://www.ruby-lang.org) و Jekyll نیاز دارید:

```bash
git clone https://github.com/noysdc/persianpod.git
cd persianpod
gem install jekyll jekyll-sitemap
jekyll serve
```

بعد از آن سایت در `http://localhost:4000` باز می‌شود.

**نکته‌ها**

- هر وقت فایل CSS یا JS را تغییر دادید، مقدار `asset_v` را در `_config.yml` بالا ببرید تا مرورگرها نسخه‌ی کش‌شده را کنار بگذارند.
- پیش از ثبت تغییرها می‌توانید اعتبارسنجی داده‌ها را اجرا کنید:

```bash
python tools/validate_podcasts.py
python scripts/validate_categories.py
```

- در ویندوز، فایل‌های `scripts/1-preview-migrate.bat` تا `scripts/4-stats.bat` ابزارهای دسته‌بندی را قدم‌به‌قدم اجرا می‌کنند: پیش‌نمایش، اعمال، اعتبارسنجی و آمار.

## خودکارسازی (GitHub Actions)

| ورک‌فلو | کاربرد |
|---|---|
| `update-rss.yml` | به‌روزرسانی قسمت‌ها و آمار پادکست‌ها از فید RSS (هر ۳۰ دقیقه) |
| `pi-discover.yml`، `pi-build-pages.yml`، `pi-approve.yml`، `pi-dump.yml` | واردکردن پادکست‌های تازه، ساخت پیش‌نویس صفحه و تأیید آن |
| `validate-categories.yml` | اعتبارسنجی دسته‌بندی‌ها |
| `audit-duplicates.yml` | پیدا کردن پادکست‌های تکراری |
| `audit-audio.yml` | بررسی سلامت فایل‌های صوتی |
| `podcast-locations.yml` | ساخت داده‌ی شهر و کشور برای نقشه |
| `telegram-post.yml` | ارسال پست پادکست‌های تازه به کانال تلگرام |
| `sanitize-data.yml`، `cleanup-old-runs.yml`، `fetch-learn-covers.yml`، `move-blocked-logos.yml`، `fix-old-note.yml` | نگه‌داری و پاکسازی |

## مشارکت

- ایراد یا پیشنهادی دارید؟ یک [Issue](https://github.com/noysdc/persianpod/issues) باز کنید یا از طریق تلگرام و ایمیل پیام بدهید.
- برای تغییر در کد، ریپو را Fork کنید و Pull Request بفرستید. لطفاً پیش از آن اعتبارسنجی‌های بالا را اجرا کنید.
- ویرایش یا حذف صفحه‌ی یک پادکست را فقط صاحب آن (یا نماینده‌اش) درخواست می‌کند.

## ارتباط

- وب‌سایت: [persianpod.ir](https://persianpod.ir)
- ایمیل: [contact@persianpod.ir](mailto:contact@persianpod.ir)
- کانال تلگرام: [@persian_pod_ir](https://t.me/persian_pod_ir)
- خبرنامه: [persianpod.substack.com](https://persianpod.substack.com)
- حمایت از پروژه: [daramet.com/NOYS](https://daramet.com/NOYS)

## سازنده

پرشین‌پاد ایده و ساخته‌ی **یونس شجاعی** است.

## مجوز

### کد

کد این سایت تحت مجوز **GPL-3.0** منتشر شده است (فایل [`LICENSE`](LICENSE)). هر کس می‌تواند آن را ببیند، کپی و تغییر دهد و برای پروژه‌ی خودش استفاده کند، به شرط اینکه نسخه‌ی تغییریافته هم با همین مجوز و به‌صورت متن‌باز منتشر شود. اگر از این کد الهام گرفته‌اید، ذکر منبع قدردانی می‌شود.

### نام و لوگو

نام «پرشین‌پاد / PersianPod» و لوگوی آن متعلق به یونس شجاعی است و **جزو این مجوز نیست**. در نسخه‌های دیگر باید با نام و لوگوی خودتان منتشر شود و استفاده از نام و لوگوی پرشین‌پاد بدون اجازه مجاز نیست.

### محتوای پادکست‌ها

متن معرفی، کاور و لوگوی هر پادکست (پوشه‌ی `_podcasts` و `assets/img/podcasts`) متعلق به صاحبان آن‌هاست و مجوز GPL شامل آن‌ها نمی‌شود.

</div>

---

<a id="en"></a>

# 🇬🇧 English

## What is PersianPod?

PersianPod is a place to discover Persian-language podcasts. Every podcast has its own page with an introduction, categories, links, an episode list and a built-in player. The goal is simple: listeners should find good podcasts easily, and podcast makers should be seen, with no platform or middleman in between.

This repository holds the **code and content of [persianpod.ir](https://persianpod.ir)**. The site is built with Jekyll and published on GitHub Pages under a custom domain.

## Features

**Discovery and search**

- Advanced search with filters for name, category and subcategory, country and city, start year, episode count and length, active or inactive status, and "recent new episode"
- A branched category tree: every category has its own subcategories, and tags are clickable
- Similar-podcast suggestions at the bottom of every page
- A **Compare** page: side-by-side comparison of two podcasts using measurable facts only, with no scores, no winners and no quality judgments
- A world map that opens into a map of Iran's cities when you click Iran

**Listening**

- A **Listen** page with players grouped by category
- A **New** page for the latest episodes
- A floating player that keeps playing while you browse the site, with playback speed and a sleep timer
- A scrollable episode list on each podcast page

**Podcast pages**

- Introduction, cover, category, city, start year, episode stats, and links to social networks and platforms
- `PodcastSeries` structured data (JSON-LD) so search engines understand each page better
- Correct link previews in Telegram and social networks (OpenGraph)

**Learn**

- A **Learn** section with articles on making podcasts, for example the [complete guide to podcast editing and mixing with Adobe Audition](_learn/audition-podcast-guide.md)

**User experience**

- Day and night mode, adjustable font size and a reading mode
- Right-to-left design with the Vazirmatn font
- Responsive on mobile, tablet and desktop
- Installable as a **PWA** on phones (`manifest.webmanifest`, `sw.js` and `offline.html`)

## Principles

- **Equality.** Every podcast is shown the same way. The order of categories and the position of podcasts rotate, and no podcast gets a fixed spot, a special badge or priority. An alphabetical mode is also available.
- **Neutrality.** Comparisons rely only on measurable facts.
- **Respect for creators.** The description, cover and logo of each podcast belong to its owner. Any podcaster can ask to edit or remove their page at any time.
- **Simplicity.** Adding a podcast needs just one thing: its RSS feed link.

## How do I add or edit my podcast?

1. Open the submission page: [persianpod.ir/form](https://persianpod.ir/form/)
2. Only the **RSS feed link** is required. Everything else (description, categories, links, city and so on) is optional, but the more you share, the better your page will be.
3. To edit or remove your page, fill in the same form again or write to [contact@persianpod.ir](mailto:contact@persianpod.ir).

Episodes and stats for every podcast update automatically from its RSS feed. A podcast with no new episode for more than three years is shown as "inactive".

## Repository structure

| Path | Purpose |
|---|---|
| `_podcasts/` | One Markdown page per podcast |
| `_learn/` | Learning articles |
| `_drafts/` | Draft pages before publication |
| `_blocked/` | Set-aside pages that are not published |
| `_data/` | Data files: categories (`categories.yml`), cities, form fields, RSS stats and more |
| `_layouts/` and `_includes/` | Page templates and reusable site components |
| `_worker/` | Cloudflare Worker that receives and forwards the submission form |
| `assets/` | CSS, JavaScript, fonts and images |
| `scripts/` and `tools/` | Python and Node scripts for updating, validating and building data |
| `.github/workflows/` | Automation with GitHub Actions |
| `podcasts.json`, `search.json`, `compare.json`, `new.json` | Data behind the search, compare and new pages |
| `manifest.webmanifest`, `sw.js`, `offline.html` | PWA files |
| `CNAME` | The site's custom domain |

## Tech stack

- **Jekyll** (kramdown and `jekyll-sitemap`) on **GitHub Pages**
- Plain HTML, CSS and JavaScript, with no heavy framework
- **GitHub Actions** running **Python** and **Node.js** scripts
- A **Cloudflare Worker** for the submission form
- A **Telegram** bot that posts new podcasts to the channel

## Run the site locally

You need [Ruby](https://www.ruby-lang.org) and Jekyll:

```bash
git clone https://github.com/noysdc/persianpod.git
cd persianpod
gem install jekyll jekyll-sitemap
jekyll serve
```

The site will then be available at `http://localhost:4000`.

**Notes**

- Whenever you change a CSS or JS file, increase the `asset_v` value in `_config.yml` so browsers drop their cached copy.
- Before committing, you can run the data checks:

```bash
python tools/validate_podcasts.py
python scripts/validate_categories.py
```

- On Windows, the files `scripts/1-preview-migrate.bat` to `scripts/4-stats.bat` run the category tools step by step: preview, apply, validate and stats.

## Automation (GitHub Actions)

| Workflow | Purpose |
|---|---|
| `update-rss.yml` | Refreshes episodes and stats for every podcast from its RSS feed (every 30 minutes) |
| `pi-discover.yml`, `pi-build-pages.yml`, `pi-approve.yml`, `pi-dump.yml` | Importing new podcasts, building draft pages and approving them |
| `validate-categories.yml` | Validates the categories |
| `audit-duplicates.yml` | Finds duplicate podcasts |
| `audit-audio.yml` | Checks the health of audio files |
| `podcast-locations.yml` | Builds city and country data for the map |
| `telegram-post.yml` | Posts new podcasts to the Telegram channel |
| `sanitize-data.yml`, `cleanup-old-runs.yml`, `fetch-learn-covers.yml`, `move-blocked-logos.yml`, `fix-old-note.yml` | Maintenance and cleanup |

## Contributing

- Found a bug or have a suggestion? Open an [Issue](https://github.com/noysdc/persianpod/issues) or write to us on Telegram or by email.
- To change the code, fork the repository and send a Pull Request. Please run the checks above first.
- Only a podcast's owner (or their representative) can request edits or removal of its page.

## Contact

- Website: [persianpod.ir](https://persianpod.ir)
- Email: [contact@persianpod.ir](mailto:contact@persianpod.ir)
- Telegram channel: [@persian_pod_ir](https://t.me/persian_pod_ir)
- Newsletter: [persianpod.substack.com](https://persianpod.substack.com)
- Support the project: [daramet.com/NOYS](https://daramet.com/NOYS)

## Creator

PersianPod is the idea and creation of **Younes Shojaei**.

## License

### Code

The code of this site is released under the **GPL-3.0** license (see [`LICENSE`](LICENSE)). Anyone may view, copy, modify and use it for their own project, as long as the modified version is also released as open source under the same license. If you drew inspiration from this code, credit is appreciated.

### Name and logo

The name "PersianPod / پرشین‌پاد" and its logo belong to Younes Shojaei and are **not covered by this license**. In other versions you must publish under your own name and logo, and using the PersianPod name and logo without permission is not allowed.

### Podcast content

The description, cover and logo of each podcast (the `_podcasts` folder and `assets/img/podcasts`) belong to their owners and are not covered by the GPL license.
