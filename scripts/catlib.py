"""توابع مشترک اسکریپت‌های دسته‌بندی پرشین‌پاد."""
import re, sys, glob, os
try:
    import yaml
except ImportError:
    sys.exit("PyYAML نصب نیست:  pip install pyyaml")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FM = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n", re.S)

def norm(s):
    """یکسان‌سازی برای مقایسه: نیم‌فاصله، ی/ک عربی، فاصله‌های اضافه."""
    s = str(s or "").replace("\u200c", "").replace("ي", "ی").replace("ك", "ک")
    return re.sub(r"\s+", " ", s).strip()

def load_yaml(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return yaml.safe_load(f)

def load_categories():
    cats = load_yaml("_data/categories.yml")
    return {c["name"]: list(c.get("subcategories") or []) for c in cats}

def podcast_files(folder):
    return sorted(glob.glob(os.path.join(ROOT, folder, "**", "*.md"), recursive=True))

def read_front(path):
    text = open(path, encoding="utf-8").read()
    m = FM.match(text)
    if not m:
        return text, None, None
    return text, m, (yaml.safe_load(m.group(1)) or {})
