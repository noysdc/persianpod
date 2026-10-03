(function () {
  var dataEl = document.getElementById('pp-data');
  if (!dataEl) return;
  var P = JSON.parse(dataEl.textContent), C = JSON.parse(document.getElementById('pp-cities').textContent);
  var idx = {}; C.forEach(function (c) { idx[c.name] = c; });
  var NS = 'http://www.w3.org/2000/svg';

  var world = function (la, lo) { return [(lo + 180) / 360 * 1000, (90 - la) / 180 * 500]; };
  var iran = function (la, lo) { return [(lo - 43) * 40 * 0.845, (40.5 - la) * 40]; };
  var inIran = function (c) { return c.lat >= 24 && c.lat <= 40.5 && c.lon >= 43 && c.lon <= 64; };

  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }

  function draw(gid, proj, r, only, labels) {
    var g = document.getElementById(gid); if (!g) return;
    var groups = {};
    P.forEach(function (p) {
      var c = idx[p.c] || idx[p.k]; if (!c || (only && !only(c))) return;
      var key = c.lat + ',' + c.lon; (groups[key] = groups[key] || { c: c, name: idx[p.c] ? p.c : p.k, items: [] }).items.push(p);
    });
    Object.keys(groups).forEach(function (key) {
      var G = groups[key], pt = proj(G.c.lat, G.c.lon), n = G.items.length;
      G.items.forEach(function (p, i) {
        var a = (i / n) * Math.PI * 2, off = n > 1 ? r * 1.8 : 0;
        var link = el('a', { href: p.u, 'class': 'dot' });
        link.appendChild(el('circle', { cx: pt[0] + Math.cos(a) * off, cy: pt[1] + Math.sin(a) * off, r: r }));
        var t = el('title', {}); t.textContent = p.t + (G.name ? ' | ' + G.name : ''); link.appendChild(t);
        g.appendChild(link);
      });
      if (labels) {
        var tx = el('text', { x: pt[0], y: pt[1] - r * 2.6, 'text-anchor': 'middle', 'class': 'lbl' });
        tx.textContent = G.name + (n > 1 ? ' (' + n + ')' : ''); g.appendChild(tx);
      }
    });
  }
  draw('dots-world', world, 5, null, false);
  draw('dots-iran', iran, 7, inIran, true);
})();
