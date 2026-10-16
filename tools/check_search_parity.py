#!/usr/bin/env python3
"""بررسی می‌کند توکنایزر پایتون (scripts/build_search_index.py) با assets/js/pp-search-core.js یکی است.
اگر فرق کند، ایندکس با کلمه‌هایی ساخته می‌شود که مرورگر هرگز جست‌وجو نمی‌کند. نیاز به node دارد."""
import json, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_search_index as bi

SAMPLES = [
    "پادکست‌های جنایی ایرانی", "كتابهای صوتي ۱۲۳ قسمت", "داستانی بودن؛ روایت‌ها و قصه‌گویی",
    "تاریخ ایران باستان — هخامنشیان", "Python & AI: یادگیری ماشین", "آموزش زبان انگلیسی با متد مرتضی نصرت",
    "روانشناسی‌شناختی، خودشناسی و رشد", "اقتصاد‌ ایران ۱۴۰۴", "مصاحبه با کارشناسان", "سلامتی خانواده‌ها",
    "ة ؤ أ إ آ ى ي ك", "قسمت ۵: جنایتهای واقعی", "", "   ", "ها های ان ات", "کتابها", "دانشمندان", "ایرانی",
]
JS = r'''
global.window = {}; global.document = {};
require(process.argv[2]);
const P = window.PPSearch.create();
const samples = JSON.parse(require("fs").readFileSync(process.argv[3], "utf8"));
console.log(JSON.stringify(samples.map(s => [P.norm(s), P._tokens(s)])));
'''
def main():
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / "s.json").write_text(json.dumps(SAMPLES), encoding="utf-8")
        (Path(d) / "run.js").write_text(JS, encoding="utf-8")
        r = subprocess.run(["node", str(Path(d) / "run.js"), str(ROOT / "assets/js/pp-search-core.js"), str(Path(d) / "s.json")],
                           capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        print(r.stderr); return 2
    js = json.loads(r.stdout)
    bad = 0
    for s, (jn, jt) in zip(SAMPLES, js):
        pn, pt = bi.norm(s), bi.tokens(s)
        if pn != jn or pt != jt:
            bad += 1
            print("MISMATCH", repr(s), "\n  py:", pn, pt, "\n  js:", jn, jt)
    print("parity ok" if not bad else f"{bad} mismatches")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
