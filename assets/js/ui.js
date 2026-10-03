(function () {
  var d = document, r = d.documentElement, b = d.body;
  function $(i) { return d.getElementById(i); }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  $('t-theme').addEventListener('click', function () {
    var t = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', t); save('pp-theme', t);
  });

  function size(delta) {
    var f = parseFloat(getComputedStyle(r).getPropertyValue('--fs')) || 1;
    f = Math.min(1.4, Math.max(0.85, Math.round((f + delta) * 100) / 100));
    r.style.setProperty('--fs', f); save('pp-fs', f);
  }
  $('t-fs-plus').addEventListener('click', function () { size(0.1); });
  $('t-fs-minus').addEventListener('click', function () { size(-0.1); });

  var read = $('t-read');
  function setRead(on) {
    b.classList.toggle('reading', on); read.setAttribute('aria-pressed', on);
    try { sessionStorage.setItem('pp-read', on ? '1' : ''); } catch (e) {}
  }
  read.addEventListener('click', function () { setRead(!b.classList.contains('reading')); });
  try { if (sessionStorage.getItem('pp-read')) setRead(true); } catch (e) {}

  var form = d.querySelector('.search');
  if (form && $('grid')) form.addEventListener('submit', function (e) { e.preventDefault(); });

  function sc() { b.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', sc, { passive: true }); sc();
})();
