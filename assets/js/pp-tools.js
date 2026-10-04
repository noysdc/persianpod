(function () {
  var d = document, r = d.documentElement, b = d.body;
  function $(i) { return d.getElementById(i); }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var rects = d.querySelectorAll('.pp-logo rect');
  function hop(i) { for (var k = 0; k < rects.length; k++) rects[k].classList.toggle('on', k === i); }
  if (rects.length) {
    var last = -1;
    try { last = parseInt(sessionStorage.getItem('pp-logo') || '-1', 10); } catch (e) {}
    var i;
    do { i = Math.floor(Math.random() * rects.length); } while (i === last && rects.length > 1);
    try { sessionStorage.setItem('pp-logo', String(i)); } catch (e) {}
    hop(i);
    var brand = d.querySelector('.brand'), cur = i;
    if (brand) brand.addEventListener('mouseenter', function () { cur = (cur + 1) % rects.length; hop(cur); });
  }

  var th = $('t-theme');
  if (th) th.addEventListener('click', function () {
    var t = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', t); save('pp-theme', t);
  });

  function size(delta) {
    var f = parseFloat(getComputedStyle(r).getPropertyValue('--fs')) || 1;
    f = Math.min(1.5, Math.max(0.85, Math.round((f + delta) * 100) / 100));
    r.style.setProperty('--fs', f); save('pp-fs', f);
  }
  var plus = $('t-fs-plus'), minus = $('t-fs-minus');
  if (plus) plus.addEventListener('click', function () { size(0.1); });
  if (minus) minus.addEventListener('click', function () { size(-0.1); });

  var read = $('t-read');
  function setRead(on) {
    b.classList.toggle('reading', on);
    if (read) read.setAttribute('aria-pressed', on ? 'true' : 'false');
    try { sessionStorage.setItem('pp-read', on ? '1' : ''); } catch (e) {}
  }
  if (read) read.addEventListener('click', function () { setRead(!b.classList.contains('reading')); });
  try { if (sessionStorage.getItem('pp-read')) setRead(true); } catch (e) {}

  function sc() { b.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', sc, { passive: true }); sc();
})();
