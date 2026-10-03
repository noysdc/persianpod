(function () {
  var logo = document.querySelector('.pp-logo');
  if (!logo) return;
  var rects = logo.querySelectorAll('rect');
  var last = parseInt(sessionStorage.getItem('pp-logo') || '-1', 10);
  var i;
  do { i = Math.floor(Math.random() * rects.length); } while (i === last && rects.length > 1);
  try { sessionStorage.setItem('pp-logo', String(i)); } catch (e) {}
  for (var k = 0; k < rects.length; k++) rects[k].classList.toggle('on', k === i);
})();
