#!/usr/bin/env python3
"""
Extract location suggestions for each podcast from its public RSS feed.

- Reads every _podcasts/*.md, finds the RSS URL (front matter field "rss").
- Skips podcasts whose city AND country are already filled (use --all to re-check them
  and flag differences).
- Source 1 (reliable): <podcast:location> tag (Podcasting 2.0).
- Source 2 (low confidence): city names mentioned in the feed description/author.
- Writes ONLY a report: .github/location_suggestions.json
  (dot-folders are ignored by Jekyll, so the site/template is untouched).
  Review it, then copy approved entries into _data/cities.yml yourself.

Adjust FEED_KEYS / PODCASTS_DIR below to match your front matter.
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
import yaml

PODCASTS_DIR = Path("_podcasts")
OUT_FILE = Path(".github/location_suggestions.json")
FEED_KEYS = ["rss", "rss_url", "feed", "feed_url", "rssFeed"]  # <-- adjust to your field name
TIMEOUT = 25
CHECK_ALL = "--all" in sys.argv  # also re-check podcasts whose city/country are already filled
HEADERS = {"User-Agent": "PersianPodBot/1.0 (+https://persianpod.ir)"}

NS_PODCAST = ["https://podcastindex.org/namespace/1.0", "http://podcastindex.org/namespace/1.0"]

# Small starter list: Persian/English name -> (city, country). Extend freely.
CITIES = {
    "تهران": ("تهران", "ایران"), "مشهد": ("مشهد", "ایران"), "اصفهان": ("اصفهان", "ایران"),
    "شیراز": ("شیراز", "ایران"), "تبریز": ("تبریز", "ایران"), "کرج": ("کرج", "ایران"),
    "اهواز": ("اهواز", "ایران"), "قم": ("قم", "ایران"), "رشت": ("رشت", "ایران"),
    "کیش": ("کیش", "ایران"), "کرمان": ("کرمان", "ایران"), "یزد": ("یزد", "ایران"),
    "تورنتو": ("تورنتو", "کانادا"), "ونکوور": ("ونکوور", "کانادا"),
    "لس‌آنجلس": ("لس‌آنجلس", "آمریکا"), "لس آنجلس": ("لس‌آنجلس", "آمریکا"),
    "نیویورک": ("نیویورک", "آمریکا"), "لندن": ("لندن", "بریتانیا"),
    "برلین": ("برلین", "آلمان"), "پاریس": ("پاریس", "فرانسه"),
    "استکهلم": ("استکهلم", "سوئد"), "ملبورن": ("ملبورن", "استرالیا"),
    # English aliases (podcast:location is often written in English)
    "Tehran": ("تهران", "ایران"), "Mashhad": ("مشهد", "ایران"), "Isfahan": ("اصفهان", "ایران"),
    "Shiraz": ("شیراز", "ایران"), "Tabriz": ("تبریز", "ایران"), "Kish": ("کیش", "ایران"),
    "Toronto": ("تورنتو", "کانادا"), "Vancouver": ("ونکوور", "کانادا"),
    "Los Angeles": ("لس‌آنجلس", "آمریکا"), "New York": ("نیویورک", "آمریکا"),
    "London": ("لندن", "بریتانیا"), "Berlin": ("برلین", "آلمان"), "Paris": ("پاریس", "فرانسه"),
    "Stockholm": ("استکهلم", "سوئد"), "Melbourne": ("ملبورن", "استرالیا"),
}


def read_front_matter(path: Path):
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    if not m:
        return {}
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return {}


def get_feed_url(meta: dict):
    for k in FEED_KEYS:
        v = meta.get(k)
        if isinstance(v, str) and v.startswith("http"):
            return v
    return None


def parse_location_tag(channel):
    for ns in NS_PODCAST:
        el = channel.find(f"{{{ns}}}location")
        if el is not None:
            return {
                "text": (el.text or "").strip(),
                "geo": el.get("geo"),
                "osm": el.get("osm"),
            }
    return None


def normalise(text: str):
    for name, (city, country) in CITIES.items():
        if name.lower() in text.lower():
            return {"city": city, "country": country}
    return None


def guess_from_text(channel):
    parts = []
    for tag in ("description", "author"):
        el = channel.find(tag)
        if el is not None and el.text:
            parts.append(el.text)
    for el in channel.iter():
        if el.tag.endswith("}summary") or el.tag.endswith("}author"):
            if el.text:
                parts.append(el.text)
    blob = " ".join(parts)
    hits = {}
    for name, (city, country) in CITIES.items():
        if name in blob:
            hits[city] = country
    return [{"city": c, "country": k} for c, k in hits.items()]


def process(path: Path):
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
        root = ET.fromstring(r.content)
        channel = root.find("channel")
        if channel is None:
            entry["status"] = "bad_feed"
            return entry
    except Exception as e:  # network/parse errors shouldn't stop the run
        entry["status"] = f"error: {type(e).__name__}"
        return entry

    tag = parse_location_tag(channel)
    if tag and tag["text"]:
        entry.update(status="ok", source="podcast:location", confidence="high", location=tag)
        norm = normalise(tag["text"])
        if norm:
            entry["normalised"] = norm
            if existing["city"] and existing["city"] != norm["city"]:
                entry["differs_from_existing"] = True
        return entry
    guesses = guess_from_text(channel)
    if guesses:
        entry.update(status="ok", source="description", confidence="low", candidates=guesses)
    else:
        entry["status"] = "not_found"
    return entry


def main():
    files = sorted(PODCASTS_DIR.glob("*.md"))
    if not files:
        print(f"No files in {PODCASTS_DIR}", file=sys.stderr)
        sys.exit(1)
    results = [process(p) for p in files]
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    found_hi = sum(1 for r in results if r.get("confidence") == "high")
    found_lo = sum(1 for r in results if r.get("confidence") == "low")
    print(f"{len(results)} podcasts | high: {found_hi} | low: {found_lo} -> {OUT_FILE}")


if __name__ == "__main__":
    main()
