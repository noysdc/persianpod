#!/usr/bin/env python3
"""
Suggest podcast locations from public RSS feeds, matched against _data/cities.yml.

- Reads every _podcasts/*.md (front matter field "rss").
- Skips podcasts whose city AND country are already filled (use --all to re-check
  them and flag differences).
- Source 1 (high confidence): <podcast:location> tag.
- Source 2 (low confidence): known city names inside the feed description/author.
- The map matches by NAME, so a suggestion is only "map_ready" if the city (or country)
  already exists in _data/cities.yml. Otherwise the report gives a ready-to-paste
  cities.yml line (if the feed has coordinates) or says coordinates are needed.
- Output: .github/location_suggestions.json  (dot-folder: ignored by Jekyll, so the
  site and template are never touched). Review, then edit podcast files / cities.yml.
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
import yaml

PODCASTS_DIR = Path("_podcasts")
CITIES_FILE = Path("_data/cities.yml")
OUT_FILE = Path(".github/location_suggestions.json")
FEED_KEYS = ["rss", "rss_url", "feed", "feed_url"]
TIMEOUT = 25
HEADERS = {"User-Agent": "PersianPodBot/1.0 (+https://persianpod.ir)"}
CHECK_ALL = "--all" in sys.argv

NS_PODCAST = ["https://podcastindex.org/namespace/1.0", "http://podcastindex.org/namespace/1.0"]

# Persian city -> country, using the SAME names as _data/cities.yml
CITY_COUNTRY = {
    **{c: "ایران" for c in [
        "تهران", "مشهد", "اصفهان", "شیراز", "تبریز", "اهواز", "کرج", "قم", "کرمانشاه",
        "ارومیه", "رشت", "زاهدان", "همدان", "کرمان", "یزد", "اردبیل", "بندرعباس", "اراک",
        "ساری", "قزوین", "زنجان", "گرگان", "سنندج", "خرم‌آباد", "بوشهر", "بیرجند", "ایلام",
        "یاسوج", "شهرکرد", "بجنورد", "سمنان", "کیش", "قشم", "بابل", "آمل"]},
    "دبی": "امارات", "دوحه": "قطر", "استانبول": "ترکیه", "لندن": "انگلستان",
    "برلین": "آلمان", "کلن": "آلمان", "فرانکفورت": "آلمان", "هامبورگ": "آلمان",
    "پاریس": "فرانسه", "آمستردام": "هلند", "استکهلم": "سوئد", "وین": "اتریش",
    "رم": "ایتالیا", "مادرید": "اسپانیا", "مسکو": "روسیه", "تورنتو": "کانادا",
    "مونترال": "کانادا", "ونکوور": "کانادا", "نیویورک": "آمریکا", "واشنگتن": "آمریکا",
    "لس‌آنجلس": "آمریکا", "سن‌خوزه": "آمریکا", "سیدنی": "استرالیا", "ملبورن": "استرالیا",
    "توکیو": "ژاپن", "کوالالامپور": "مالزی",
}
EN_ALIASES = {
    "Tehran": "تهران", "Mashhad": "مشهد", "Isfahan": "اصفهان", "Esfahan": "اصفهان",
    "Shiraz": "شیراز", "Tabriz": "تبریز", "Ahvaz": "اهواز", "Karaj": "کرج", "Qom": "قم",
    "Rasht": "رشت", "Kerman": "کرمان", "Yazd": "یزد", "Kish": "کیش", "Dubai": "دبی",
    "Doha": "دوحه", "Istanbul": "استانبول", "London": "لندن", "Berlin": "برلین",
    "Cologne": "کلن", "Frankfurt": "فرانکفورت", "Hamburg": "هامبورگ", "Paris": "پاریس",
    "Amsterdam": "آمستردام", "Stockholm": "استکهلم", "Vienna": "وین", "Rome": "رم",
    "Madrid": "مادرید", "Moscow": "مسکو", "Toronto": "تورنتو", "Montreal": "مونترال",
    "Vancouver": "ونکوور", "New York": "نیویورک", "Washington": "واشنگتن",
    "Los Angeles": "لس‌آنجلس", "San Jose": "سن‌خوزه", "Sydney": "سیدنی",
    "Melbourne": "ملبورن", "Tokyo": "توکیو", "Kuala Lumpur": "کوالالامپور",
}
EN_COUNTRIES = {
    "Iran": "ایران", "Canada": "کانادا", "United States": "آمریکا", "USA": "آمریکا",
    "Germany": "آلمان", "United Kingdom": "انگلستان", "UK": "انگلستان", "England": "انگلستان",
    "France": "فرانسه", "Sweden": "سوئد", "Turkey": "ترکیه", "Türkiye": "ترکیه",
    "UAE": "امارات", "United Arab Emirates": "امارات", "Australia": "استرالیا",
}


def load_map_names():
    if not CITIES_FILE.exists():
        return set()
    data = yaml.safe_load(CITIES_FILE.read_text(encoding="utf-8")) or []
    return {str(row.get("name")) for row in data if isinstance(row, dict)}


def read_front_matter(path: Path):
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    if not m:
        return {}
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return {}


def get_feed_url(meta):
    for k in FEED_KEYS:
        v = meta.get(k)
        if isinstance(v, str) and v.startswith("http"):
            return v
    return None


def parse_geo(geo):
    m = re.match(r"geo:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)", geo or "")
    return (round(float(m.group(1)), 2), round(float(m.group(2)), 2)) if m else None


def parse_location_tag(channel):
    for ns in NS_PODCAST:
        el = channel.find(f"{{{ns}}}location")
        if el is not None:
            return {"text": (el.text or "").strip(), "geo": el.get("geo"), "osm": el.get("osm")}
    return None


def normalise(text):
    """Return {'city','country'} (or just country) in the same Persian names used by the site."""
    for fa in CITY_COUNTRY:
        if fa in text:
            return {"city": fa, "country": CITY_COUNTRY[fa]}
    for en, fa in EN_ALIASES.items():
        if re.search(rf"\b{re.escape(en)}\b", text, re.I):
            return {"city": fa, "country": CITY_COUNTRY[fa]}
    for en, fa in EN_COUNTRIES.items():
        if re.search(rf"\b{re.escape(en)}\b", text):
            return {"country": fa}
    return None


def text_candidates(channel):
    parts = []
    for el in channel.iter():
        tag = el.tag.split("}")[-1]
        if tag in ("description", "author", "summary") and el.text:
            parts.append(el.text)
    blob = " ".join(parts)
    found = {}
    for fa in CITY_COUNTRY:
        if fa in blob:
            found[fa] = CITY_COUNTRY[fa]
    return [{"city": c, "country": k} for c, k in found.items()]


def add_map_info(entry, norm, geo, map_names):
    """Say whether the suggestion can already be drawn on the map."""
    name = norm.get("city") or norm.get("country")
    if not name:
        return
    if name in map_names:
        entry["map_ready"] = True
    else:
        entry["map_ready"] = False
        if geo:
            entry["cities_yml_line"] = f"- {{name: {name}, lat: {geo[0]}, lon: {geo[1]}}}"
        else:
            entry["note"] = f"«{name}» در cities.yml نیست و مختصات هم در فید نبود"


def process(path, map_names):
    meta = read_front_matter(path)
    feed = get_feed_url(meta)
    existing = {"city": meta.get("city") or "", "country": meta.get("country") or ""}
    entry = {"slug": path.stem, "feed": feed, "existing": existing}
    if existing["city"] and existing["country"] and not CHECK_ALL:
        entry["status"] = "already_set"
        return entry
    if not feed:
        entry["status"] = "no_feed_url"
        return entry
    try:
        r = requests.get(feed, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        channel = ET.fromstring(r.content).find("channel")
        if channel is None:
            entry["status"] = "bad_feed"
            return entry
    except Exception as e:
        entry["status"] = f"error: {type(e).__name__}"
        return entry

    tag = parse_location_tag(channel)
    if tag and tag["text"]:
        entry.update(status="ok", source="podcast:location", confidence="high", location=tag)
        norm = normalise(tag["text"])
        if norm:
            entry["suggested"] = norm
            add_map_info(entry, norm, parse_geo(tag["geo"]), map_names)
            if existing["city"] and norm.get("city") and existing["city"] != norm["city"]:
                entry["differs_from_existing"] = True
        else:
            entry["note"] = "مکان در فید هست ولی نامش در فهرست شناخته‌شده نبود؛ دستی بررسی شود"
        return entry

    guesses = text_candidates(channel)
    if guesses:
        entry.update(status="ok", source="description", confidence="low", candidates=guesses)
        for g in guesses:
            g["map_ready"] = g["city"] in map_names
    else:
        entry["status"] = "not_found"
    return entry


def main():
    files = sorted(PODCASTS_DIR.glob("*.md"))
    if not files:
        print(f"No files in {PODCASTS_DIR}", file=sys.stderr)
        sys.exit(1)
    map_names = load_map_names()
    results = [process(p, map_names) for p in files]
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    hi = sum(1 for r in results if r.get("confidence") == "high")
    lo = sum(1 for r in results if r.get("confidence") == "low")
    skipped = sum(1 for r in results if r.get("status") == "already_set")
    print(f"{len(results)} podcasts | already set: {skipped} | high: {hi} | low: {lo} -> {OUT_FILE}")


if __name__ == "__main__":
    main()
