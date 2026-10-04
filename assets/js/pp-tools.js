(function () {
  var d = document, r = d.documentElement, b = d.body;
  function $(i) { return d.getElementById(i); }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* day / night */
  var th = $('t-theme');
  if (th) th.addEventListener('click', function () {
    var t = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', t); save('pp-theme', t);
  });

  /* font size */
  function size(delta) {
    var f = parseFloat(getComputedStyle(r).getPropertyValue('--fs')) || 1;
    f = Math.min(1.5, Math.max(0.85, Math.round((f + delta) * 100) / 100));
    r.style.setProperty('--fs', f); save('pp-fs', f);
  }
  var plus = $('t-fs-plus'), minus = $('t-fs-minus');
  if (plus) plus.addEventListener('click', function () { size(0.1); });
  if (minus) minus.addEventListener('click', function () { size(-0.1); });

  /* reading mode */
  var read = $('t-read');
  function setRead(on) {
    b.classList.toggle('reading', on);
    if (read) read.setAttribute('aria-pressed', on ? 'true' : 'false');
    try { sessionStorage.setItem('pp-read', on ? '1' : ''); } catch (e) {}
  }
  if (read) read.addEventListener('click', function () { setRead(!b.classList.contains('reading')); });
  try { if (sessionStorage.getItem('pp-read')) setRead(true); } catch (e) {}

  /* header search: on the home page it filters live, elsewhere it opens /?q=... */
  var form = d.querySelector('.pp-search');
  if (form && $('list')) form.addEventListener('submit', function (e) { e.preventDefault(); });

  /* glow under the glass bar after scrolling */
  function sc() { b.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', sc, { passive: true }); sc();
})();
