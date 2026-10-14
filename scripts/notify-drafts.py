#!/usr/bin/env python3
"""اعلان پادکست‌های تازه‌ای که به _drafts/ اضافه شده‌اند.

ورودی: فایلی که در هر خط مسیر یک فایل تازه‌ی _drafts را دارد (argv[1]).
خروجی:
  - $RUNNER_TEMP/notify-subject.txt و notify-body.md  (برای ساخت Issue؛ گیت‌هاب از آن ایمیل می‌فرستد)
  - اگر SMTP_USER و SMTP_PASS تنظیم شده باشد، همین متن مستقیم از ایمیل خودت هم فرستاده می‌شود.
هیچ‌وقت workflow را قرمز نمی‌کند.
فقط با کتابخانه‌ی استاندارد پایتون."""
import os, re, smtplib, sys
from email.message import EmailMessage
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP = Path(os.environ.get("RUNNER_TEMP") or "/tmp")
STATUS_FA = {"active": "فعال", "paused": "متوقف", "ended": "پایان‌یافته", "inactive": "متوقف"}


def front(path):
    t = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---", t, re.S)
    d = {}
    for line in (m.group(1) if m else "").split("\n"):
        k = re.match(r"^([A-Za-z_]+):\s*(.*)$", line)
        if k:
            d[k.group(1)] = k.group(2).strip().strip('"').strip("'")
    return d


def build_summary():
    """بخش «این اجرا» از گزارش ساخت، شامل هشدار سقف Groq و ..."""
    p = ROOT / "_data" / "pi" / "build-report.md"
    if not p.exists():
        return ""
    t = p.read_text(encoding="utf-8")
    m = re.search(r"### 🎯 این اجرا\n(.*?)(?=\n###|\n> ℹ️|\Z)", t, re.S)
    return m.group(1).strip() if m else ""


def main():
    lst = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    files = [l.strip() for l in lst.read_text(encoding="utf-8").splitlines() if l.strip()] if lst and lst.exists() else []
    files = [f for f in files if f.startswith("_drafts/") and f.endswith(".md")]
    if not files:
        print("پادکست تازه‌ای در drafts نیست؛ اعلانی فرستاده نشد.")
        return 0

    repo = os.environ.get("GITHUB_REPOSITORY", "")
    branch = os.environ.get("GITHUB_REF_NAME", "master")
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    owner = os.environ.get("GITHUB_REPOSITORY_OWNER", "")

    items = []
    for f in sorted(files):
        p = ROOT / f
        d = front(p) if p.exists() else {}
        items.append((Path(f).name, d))

    n = len(items)
    subject = f"پرشین‌پاد: {n} پادکست تازه به drafts اضافه شد"
    lines = [f"{n} پادکست تازه در پوشه‌ی drafts ساخته شد و منتظر بازبینی توست.", ""]
    for name, d in items:
        title = d.get("title") or name
        meta = [x for x in (d.get("category"), STATUS_FA.get(d.get("status", ""), d.get("status")),
                            (d.get("episode_count") + " قسمت") if d.get("episode_count") else "") if x]
        lines.append(f"• {title}" + (f" — {'، '.join(meta)}" if meta else ""))
        if repo:
            lines.append(f"  {server}/{repo}/blob/{branch}/_drafts/{name}")
    summ = build_summary()
    if summ:
        lines += ["", "خلاصه‌ی این اجرا:", summ]
    lines += ["", "برای تأیید: Actions ← «Podcast Index — ساخت و تأیید صفحه‌ها» ← Run workflow ← حالت approve؛ "
                  "یا «تأیید صفحه‌های خودکار» با نام صفحه‌ها یا all."]
    if repo and run_id:
        lines += ["", f"گزارش اجرا: {server}/{repo}/actions/runs/{run_id}"]
    body = "\n".join(lines) + "\n"

    TMP.mkdir(parents=True, exist_ok=True)
    (TMP / "notify-subject.txt").write_text(subject, encoding="utf-8")
    # برای Issue، نام کاربری مالک ذکر می‌شود تا گیت‌هاب حتماً ایمیل بفرستد
    issue_body = (f"@{owner}\n\n" if owner else "") + body
    (TMP / "notify-body.md").write_text(issue_body, encoding="utf-8")
    print(subject)

    user, pwd, to = os.environ.get("SMTP_USER", ""), os.environ.get("SMTP_PASS", ""), os.environ.get("MAIL_TO", "") or os.environ.get("SMTP_USER", "")
    if user and pwd and to:
        try:
            msg = EmailMessage()
            msg["Subject"], msg["From"], msg["To"] = subject, user, to
            msg.set_content(body, charset="utf-8")
            host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
            with smtplib.SMTP_SSL(host, int(os.environ.get("SMTP_PORT", "465")), timeout=30) as s:
                s.login(user, pwd)
                s.send_message(msg)
            print("ایمیل ارسال شد.")
            (TMP / "notify-mailed").write_text("1", encoding="utf-8")
        except Exception as e:
            print(f"ارسال ایمیل ناموفق بود: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:      # اعلان هیچ‌وقت نباید کار اصلی را خراب کند
        print(f"notify-drafts: {e}", file=sys.stderr)
        sys.exit(0)
