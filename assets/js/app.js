(()=>{
const S={active:'فعال',paused:'متوقف',ended:'پایان‌یافته'};
const n=s=>String(s||'').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u064b-\u065f]/g,' ').replace(/\s+/g,' ').trim();
const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=x=>String(x).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const yr=p=>{const l=parseInt(p.last);return l?(p.status==='active'?new Date().getFullYear():l):0};
const card=p=>`<a class="tile" href="${e(p.url)}" title="${e(p.description)}"><span class="sq">${p.logo?`<img src="${e(p.logo)}" alt="" loading="lazy">`:`<i class="ph">${e((p.title||'').trim().charAt(0))}</i>`}</span><h3>${e(p.title)}</h3><small><i class="dot ${e(p.status)}"></i>${e(p.category)}${p.subcategory?'، '+e(p.subcategory):''}</small></a>`;
const uniq=(a,k)=>[...new Set(a.map(x=>x[k]).filter(Boolean))].sort((x,y)=>x.localeCompare(y,'fa'));
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
if(!document.getElementById('list')&&!document.getElementById('similar'))return;
fetch(document.body.dataset.search).then(r=>r.json()).then(all=>{
 document.querySelectorAll('[data-fa]').forEach(x=>x.textContent=fa(x.textContent));
 const sim=document.getElementById('similar');
 if(sim){
  const me=all.find(p=>p.url===sim.dataset.url);if(!me)return;
  // نزدیک‌ترین‌ها: زیردسته‌ی مشترک (۴)، موضوع/برچسب مشترک (۲)، دسته‌ی مشترک (۲)،
  // سازنده‌ی مشترک (۳)، شهر مشترک (۰٫۳) و کلمه‌های مشترک توضیح (تا ۲). بدون ربط واقعی، چیزی نشان داده نمی‌شود.
  const lst=v=>Array.isArray(v)?v:(v?[v]:[]);
  const sharedOf=(a,b)=>lst(a).map(n).filter(x=>x&&lst(b).map(n).includes(x));
  const words=p=>new Set(n(p.description).split(' ').filter(w=>w.length>3));
  const mw=words(me);
  const rate=p=>{
   const subs=sharedOf(p.subcategories,me.subcategories),tags=sharedOf(p.tags,me.tags);
   const cat=!!p.category&&p.category===me.category,same=!!p.creator&&n(p.creator)===n(me.creator);
   let ov=0;words(p).forEach(w=>{if(mw.has(w))ov++});
   const rel=cat||subs.length||tags.length||same;
   const s=(cat?2:0)+subs.length*4+tags.length*2+(same?3:0)+(p.city&&p.city===me.city?.3:0)+Math.min(2,ov*.4);
   const why=subs.length?'موضوع مشترک: '+lst(p.subcategories).find(x=>n(x)===subs[0]):tags.length?'موضوع مشترک: '+lst(p.tags).find(x=>n(x)===tags[0]):same?'همان سازنده':cat?'هم‌دسته':'';
   return {p,s,rel,why};
  };
  const sCard=x=>{const p=x.p,subs=lst(p.subcategories).slice(0,1);
   return `<a class="pd-card" href="${e(p.url)}" title="${e(p.description)}"><span class="pd-logo">${p.logo?`<img src="${e(p.logo)}" alt="" loading="lazy" width="160" height="160">`:`<i>${e((p.title||'').trim().charAt(0))}</i>`}</span><span class="pd-body"><h3>${e(p.title)}</h3><span class="pd-meta"><span class="pd-b">${e(p.category)}</span>${subs.map(t=>`<span class="pd-b">${e(t)}</span>`).join('')}</span>${x.why?`<small class="pd-why">${e(x.why)}</small>`:''}</span></a>`};
  const r=all.filter(p=>p.url!==me.url&&p.category).map(rate).filter(x=>x.rel&&x.s>=2).sort((a,b)=>b.s-a.s).slice(0,4);
  if(r.length){
   const h=sim.querySelector('h2');if(h)h.textContent='پادکست‌های نزدیک به این پادکست';
   const g=sim.querySelector('.grid');g.className='pd-grid';g.innerHTML=r.map(sCard).join('');sim.hidden=false;
  }
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
