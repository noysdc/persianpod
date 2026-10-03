(()=>{
const S={active:'فعال',paused:'متوقف',ended:'پایان‌یافته'};
const n=s=>String(s||'').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u064b-\u065f]/g,' ').replace(/\s+/g,' ').trim();
const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=x=>String(x).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const yr=p=>{const l=parseInt(p.last);return l?(p.status==='active'?new Date().getFullYear():l):0};
const card=p=>`<a class="card" href="${e(p.url)}">${p.logo?`<img src="${e(p.logo)}" alt="" loading="lazy">`:`<i class="ph">${e((p.title||'').trim().charAt(0))}</i>`}<div><h3>${e(p.title)}</h3><p>${e(p.description)}</p><div class="tags"><span>${e(p.category)}</span>${p.subcategory?`<span>${e(p.subcategory)}</span>`:''}<span class="st ${e(p.status)}">${S[p.status]||''}</span></div></div></a>`;
const uniq=(a,k)=>[...new Set(a.map(x=>x[k]).filter(Boolean))].sort((x,y)=>x.localeCompare(y,'fa'));
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
if(!document.getElementById('list')&&!document.getElementById('similar'))return;
fetch(document.body.dataset.search).then(r=>r.json()).then(all=>{
 document.querySelectorAll('[data-fa]').forEach(x=>x.textContent=fa(x.textContent));
 const sim=document.getElementById('similar');
 if(sim){
  const me=all.find(p=>p.url===sim.dataset.url);if(!me)return;
  const sc=p=>(p.category===me.category?2:0)+(me.subcategory&&p.subcategory===me.subcategory?2:0)+(p.tags||[]).filter(t=>(me.tags||[]).includes(t)).length*3;
  const r=all.filter(p=>p.url!==me.url).map(p=>[sc(p),p]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]).slice(0,4).map(x=>x[1]);
  if(r.length){sim.querySelector('.grid').innerHTML=r.map(card).join('');sim.hidden=false}
  return;
 }
 const $=id=>document.getElementById(id),ids=['q','category','status','language','city','eps','year','sort'];
 const fill=(id,vals)=>vals.forEach(v=>$(id).add(new Option(v,v)));
 fill('category',uniq(all,'category'));fill('language',uniq(all,'language'));fill('city',uniq(all,'city'));
 const ys=all.map(p=>+p.start).filter(Boolean),now=new Date().getFullYear();
 if(ys.length)for(let y=now;y>=Math.min(...ys);y--)$('year').add(new Option(fa(y),y));
 const P=new URLSearchParams(location.search);ids.forEach(k=>{if(P.get(k))$(k).value=P.get(k)});
 let shown=48,rows=[];
 const run=()=>{
  const q=n($('q').value),[lo,hi]=($('eps').value||'0-99999').split('-').map(Number),y=+$('year').value;
  rows=all.filter(p=>{
   if($('category').value&&p.category!==$('category').value)return false;
   if($('status').value&&p.status!==$('status').value)return false;
   if($('language').value&&p.language!==$('language').value)return false;
   if($('city').value&&p.city!==$('city').value)return false;
   if($('eps').value&&!(p.episodes>=lo&&p.episodes<=hi))return false;
   if(y&&!(p.start&&p.start<=y&&y<=(yr(p)||p.start)))return false;
   if(q){const h=n([p.title,p.description,p.creator,p.category,p.subcategory,p.city,(p.tags||[]).join(' ')].join(' '));return q.split(' ').every(w=>h.includes(w))}
   return true});
  const s=$('sort').value;
  if(s==='random')shuffle(rows);else if(s==='recent')rows.sort((a,b)=>String(b.last).localeCompare(String(a.last)));else rows.sort((a,b)=>a.title.localeCompare(b.title,'fa'));
  const u=new URLSearchParams();ids.forEach(k=>{if($(k).value&&!(k==='sort'&&$(k).value==='alpha'))u.set(k,$(k).value)});
  history.replaceState(null,'',u.toString()?'?'+u:location.pathname);
  draw()};
 const draw=()=>{
  $('count').textContent=rows.length?fa(rows.length)+' پادکست پیدا شد':'پادکستی پیدا نشد. فیلترها را کم کن یا عبارت دیگری را جست‌وجو کن.';
  $('list').innerHTML=rows.slice(0,shown).map(card).join('');$('more').hidden=rows.length<=shown};
 ids.forEach(k=>$(k).addEventListener(k==='q'?'input':'change',()=>{shown=48;run()}));
 $('more').onclick=()=>{shown+=48;draw()};
 run();
});
})();
