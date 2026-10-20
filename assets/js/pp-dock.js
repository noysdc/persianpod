/* پرشین‌پاد: منوی «بیشتر»، پنهان‌شدن داک با کیبورد، و کلاس pp-playing وقتی چیزی پخش می‌شود */
(function(){
  var b=document.body, dock=document.querySelector('.pp-dock');
  if(!dock) return;
  var more=document.getElementById('pp-more'),
      sheet=document.getElementById('pp-sheet'),
      scrim=document.getElementById('pp-scrim');

  if(sheet){
    dock.querySelectorAll('.opt').forEach(function(a){ sheet.appendChild(a.cloneNode(true)); });
  }
  function setSheet(open){
    b.classList.toggle('pp-sheet-open',open);
    if(more) more.setAttribute('aria-expanded',open);
    if(sheet) sheet.setAttribute('aria-hidden',!open);
  }
  if(more) more.addEventListener('click',function(){ setSheet(true); });
  if(scrim) scrim.addEventListener('click',function(){ setSheet(false); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') setSheet(false); });

  // کیبورد موبایل
  var field='input,textarea,select';
  document.addEventListener('focusin',function(e){ if(e.target.matches&&e.target.matches(field)) b.classList.add('pp-kb'); });
  document.addEventListener('focusout',function(e){ if(e.target.matches&&e.target.matches(field)) b.classList.remove('pp-kb'); });

  // وضعیت پخش: رویدادهای audio/video bubble نمی‌کنند، پس با capture گوش می‌دهیم
  document.addEventListener('play',function(){ b.classList.add('pp-playing'); },true);
  document.addEventListener('ended',function(){ b.classList.remove('pp-playing'); },true);
  document.addEventListener('emptied',function(){ b.classList.remove('pp-playing'); },true);
})();
