#!/usr/bin/env python3
"""
ساخت assets/data/pp-map-data.json برای نقشه‌ی پرشین‌پاد.

داده‌ها از Natural Earth (دامنه‌ی عمومی) گرفته می‌شود:
  - کشورها (۵۰ متر)           ne_50m_admin_0_countries
  - استان‌های ایران (۱۰ متر)   ne_10m_admin_1_states_provinces

اجرا (فقط وقتی می‌خواهی داده را دوباره بسازی):
    python3 scripts/build_map_data.py
"""
import json, math, os, sys, urllib.request

BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
SRC = {"countries": "ne_50m_admin_0_countries.geojson",
       "admin1": "ne_10m_admin_1_states_provinces.geojson"}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "data", "pp-map-data.json")
WIDTH = 1000.0                       # عرض بوم نقشه
FINE_BOX = (30, 10, 75, 46)          # lon0, lat0, lon1, lat1: اطراف ایران با دقت بیشتر


def load(name):
    cache = os.path.join("/tmp", name)
    if not os.path.exists(cache):
        print("download", name)
        urllib.request.urlretrieve(BASE + name, cache)
    return json.load(open(cache, encoding="utf-8"))


def ne1(lon, lat):
    """Natural Earth 1 (همان فرمول d3.geoNaturalEarth1)؛ جاوااسکریپت نقشه هم همین را دارد."""
    l, p = math.radians(lon), math.radians(lat)
    p2 = p * p; p4 = p2 * p2
    x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return x, y


def rings_of(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]            # فقط حلقه‌ی بیرونی
    return [poly[0] for poly in geom["coordinates"]]


def area(r):
    return abs(sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))) / 2


def dp(pts, tol):
    """Douglas-Peucker. حلقه‌ی بسته (نقطه‌ی اول = آخر) را از دورترین نقطه به دو نیم می‌کند."""
    if len(pts) < 4:
        return pts
    if pts[0] == pts[-1]:
        far = max(range(1, len(pts) - 1), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
        return dp(pts[:far + 1], tol)[:-1] + dp(pts[far:], tol)
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        n = math.hypot(dx, dy) or 1e-12
        dmax, idx = 0, -1
        for i in range(a + 1, b):
            d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / n
            if d > dmax:
                dmax, idx = d, i
        if dmax > tol:
            keep[idx] = True; stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def path(ring, dec):
    q = 10 ** dec
    pts = [(round(x * q), round(y * q)) for x, y in ring]
    out = [pts[0]]
    for p in pts[1:]:
        if p != out[-1]:
            out.append(p)
    if len(out) < 3:
        return ""
    fmt = lambda v: ("%d" % v) if dec == 0 else ("%g" % round(v / q, dec))
    s = "M%s,%s" % (fmt(out[0][0]), fmt(out[0][1]))
    s += "l" + " ".join("%s,%s" % (fmt(b[0] - a[0]), fmt(b[1] - a[1])) for a, b in zip(out, out[1:]))
    return s + "z"


def in_poly(x, y, r):
    c = False; j = len(r) - 1
    for i in range(len(r)):
        if (r[i][1] > y) != (r[j][1] > y) and x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]:
            c = not c
        j = i
    return c


def edge_dist(x, y, r):
    best = 1e9
    for i in range(len(r)):
        (x1, y1), (x2, y2) = r[i], r[(i + 1) % len(r)]
        dx, dy = x2 - x1, y2 - y1
        t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy or 1e-12)))
        best = min(best, math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)))
    return best


def label_point(r):
    xs = [p[0] for p in r]; ys = [p[1] for p in r]
    best = (None, None, -1)
    n = 36
    for i in range(n + 1):
        for j in range(n + 1):
            x = min(xs) + (max(xs) - min(xs)) * i / n; y = min(ys) + (max(ys) - min(ys)) * j / n
            if in_poly(x, y, r):
                d = edge_dist(x, y, r)
                if d > best[2]:
                    best = (x, y, d)
    return best[0], best[1]


def main():
    countries = [f for f in load(SRC["countries"])["features"] if f["properties"]["ADMIN"] != "Antarctica"]
    prov = [f for f in load(SRC["admin1"])["features"] if f["properties"].get("adm0_a3") == "IRN"]

    # گستره‌ی نقشه برای نرمال‌سازی
    xs, ys = [], []
    for f in countries:
        for r in rings_of(f["geometry"]):
            for lon, lat in r:
                x, y = ne1(lon, lat); xs.append(x); ys.append(y)
    k = WIDTH / (max(xs) - min(xs))
    ox, oy = -min(xs) * k, max(ys) * k
    H = round((max(ys) - min(ys)) * k, 1)

    def proj(r):
        out = []
        for lon, lat in r:
            x, y = ne1(lon, lat); out.append((ox + k * x, oy - k * y))
        return out

    def in_fine(r):
        lons = [p[0] for p in r]; lats = [p[1] for p in r]
        return not (max(lons) < FINE_BOX[0] or min(lons) > FINE_BOX[2] or max(lats) < FINE_BOX[1] or min(lats) > FINE_BOX[3])

    out_c = []
    for f in countries:
        p = f["properties"]
        iso = p.get("ISO_A2_EH") or p.get("ISO_A2")
        d = ""
        for r in rings_of(f["geometry"]):
            fine = in_fine(r)
            pr = proj(r)
            if area(pr) < (0.03 if fine else 0.35):
                continue
            d += path(dp(pr, 0.02 if fine else 0.12), 2 if fine else 1)
        if d:
            out_c.append({"i": iso if iso and iso != "-99" else "", "n": p["NAME_FA"] if p.get("NAME_FA") else p["ADMIN"], "d": d})

    out_p = []
    bx0 = by0 = 1e9; bx1 = by1 = -1e9
    for f in prov:
        p = f["properties"]
        rs = [proj(r) for r in rings_of(f["geometry"])]
        d = ""
        for r in rs:
            if area(r) < 0.004:
                continue
            d += path(dp(r, 0.012), 2)
            for x, y in r:
                bx0 = min(bx0, x); by0 = min(by0, y); bx1 = max(bx1, x); by1 = max(by1, y)
        big = max(rs, key=area)
        lx, ly = label_point(big)
        name = (p.get("name_fa") or p["name"]).replace("استان ", "").strip()
        out_p.append({"c": p["iso_3166_2"] if p["name"] != "Alborz" else "IR-32", "n": name, "en": p["name_en"] or p["name"],
                      "d": d, "lx": round(lx, 2), "ly": round(ly, 2)})

    data = {"w": WIDTH, "h": H, "proj": {"k": round(k, 6), "ox": round(ox, 4), "oy": round(oy, 4)},
            "iranBox": [round(bx0, 2), round(by0, 2), round(bx1, 2), round(by1, 2)],
            "countries": out_c, "provinces": out_p}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("ok", os.path.getsize(OUT) // 1024, "KB |", len(out_c), "countries,", len(out_p), "provinces | box", data["iranBox"], "| size", WIDTH, H)


if __name__ == "__main__":
    main()
