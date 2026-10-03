(function () {
  var grid = document.getElementById('grid');
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.children);
  var q = document.getElementById('q');
  var cat = document.getElementById('cat');
  var status = document.getElementById('status');
  var empty = document.getElementById('empty');
  var bAlpha = document.getElementById('sort-alpha');
  var bRandom = document.getElementById('sort-random');

  var cats = {};
  cards.forEach(function (c) { if (c.dataset.category) cats[c.dataset.category] = 1; });
  Object.keys(cats).sort(function (a, b) { return a.localeCompare(b, 'fa'); }).forEach(function (n) {
    var o = document.createElement('option'); o.value = n; o.textContent = n; cat.appendChild(o);
  });

  function apply() {
    var term = q.value.trim().toLowerCase(), shown = 0;
    cards.forEach(function (c) {
      var ok = (!term || c.dataset.title.toLowerCase().indexOf(term) > -1) &&
               (!cat.value || c.dataset.category === cat.value) &&
               (!status.value || c.dataset.status === status.value);
      c.hidden = !ok; if (ok) shown++;
    });
    empty.hidden = shown > 0 || cards.length === 0;
  }
  function render(list) { list.forEach(function (c) { grid.appendChild(c); }); }
  function press(a, r) { bAlpha.setAttribute('aria-pressed', a); bRandom.setAttribute('aria-pressed', r); }
  function alpha() {
    render(cards.slice().sort(function (a, b) { return a.dataset.title.localeCompare(b.dataset.title, 'fa'); }));
    press(true, false);
  }
  function random() {
    var l = cards.slice();
    for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = l[i]; l[i] = l[j]; l[j] = t; }
    render(l); press(false, true);
  }
  q.addEventListener('input', apply);
  [cat, status].forEach(function (el) { el.addEventListener('input', apply); });
  bAlpha.addEventListener('click', alpha);
  bRandom.addEventListener('click', random);

  var m = location.search.match(/[?&]q=([^&]*)/);
  if (m) { try { q.value = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) {} }
  random(); apply();
})();
