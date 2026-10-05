(()=>{
if(window.__ppPlayer)return;window.__ppPlayer=1;
const D=document,K='ppDock';
/* ---------- embed url from a podcast record ---------- */
const emb=o=>{
 if(!o)return null;if(o.embed)return o.embed;
 const m=(o.spotify||'').match(/open\.spotify\.com\/(show|episode)\/(\w+)/);
 if(m)return'https://open.spotify.com/embed/'+m[1]+'/'+m[2];
 if((o.apple||'').includes('podcasts.apple.com'))return o.apple.replace('://podcasts.apple.com','://embed.podcasts.apple.com');
 return null};
/* ---------- floating player ---------- */
const css=`#pp-dock{--b:#fff;--f:#16201a;--l:#d9e0da;position:fixed;z-index:99999;display:flex;flex-direction:column;background:var(--b);color:var(--f);border:2px solid var(--f);border-radius:4px;box-shadow:0 14px 34px -10px #00ff9c;font:14px/1.6 Vazirmatn,Tahoma,sans-serif;direction:rtl}
@media(prefers-color-scheme:dark){#pp-dock{--b:#131916;--f:#e9f0ea;--l:#243028}}
#pp-dock[hidden]{display:none}
.pp-bar{display:flex;align-items:center;gap:6px;padding:0 8px;height:36px;flex:none;border-bottom:1px solid var(--l);cursor:grab;touch-action:none;user-select:none}
.pp-bar:before{content:"";width:10px;height:10px;background:#08cb00;flex:none}
.pp-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;text-decoration:none;font-weight:700}
.pp-bar button{all:unset;cursor:pointer;width:26px;height:26px;display:grid;place-items:center;border-radius:3px;font-size:18px;line-height:1}
.pp-bar button:hover,.pp-bar button:focus-visible{background:#08cb00;color:#0b0e0c}
.pp-body{flex:1;min-height:0}.pp-body iframe{width:100%;height:100%;border:0;display:block}
.pp-rs{position:absolute;right:0;bottom:0;width:20px;height:20px;cursor:nwse-resize;touch-action:none;background:linear-gradient(135deg,transparent 55%,var(--f) 55%,var(--f) 62%,transparent 62%,transparent 75%,var(--f) 75%,var(--f) 82%,transparent 82%)}
#pp-dock.pp-min{height:auto!important}#pp-dock.pp-min .pp-body{flex:none;height:0;overflow:hidden}#pp-dock.pp-min .pp-rs{display:none}
#pp-dock.pp-drag iframe{pointer-events:none}`;
let dock,cur,g={x:16,y:0,w:380,h:240};
const save=()=>{try{localStorage.setItem(K,JSON.stringify(g))}catch(e){}};
const place=(x,y,w,h)=>{
 w=Math.max(260,Math.min(w,innerWidth-8));h=Math.max(130,Math.min(h,innerHeight-8));
 x=Math.max(0,Math.min(x,innerWidth-w));y=Math.max(0,Math.min(y,innerHeight-(dock.classList.contains('pp-min')?44:h)));
 g={x,y,w,h};Object.assign(dock.style,{width:w+'px',height:h+'px',left:x+'px',top:y+'px'})};
const grab=(el,start)=>{
 let moved=0;
 el.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopPropagation();moved=0}},true);
 el.addEventListener('pointerdown',e=>{
 if(e.target.closest('button'))return;
 const sx=e.clientX,sy=e.clientY,o={...g};moved=0;el.setPointerCapture(e.pointerId);dock.classList.add('pp-drag');
 el.onpointermove=m=>{if(Math.abs(m.clientX-sx)+Math.abs(m.clientY-sy)>4)moved=1;start(o,m.clientX-sx,m.clientY-sy)};
 el.onpointerup=el.onpointercancel=()=>{el.onpointermove=el.onpointerup=el.onpointercancel=null;dock.classList.remove('pp-drag');save()}})};
const make=()=>{
 if(dock)return;
 const s=D.createElement('style');s.textContent=css;D.head.appendChild(s);
 dock=D.createElement('div');dock.id='pp-dock';dock.setAttribute('role','region');dock.setAttribute('aria-label','پخش‌کننده');
 dock.innerHTML='<div class="pp-bar"><a class="pp-t" draggable="false"></a><button class="pp-m" aria-label="کوچک کردن" title="کوچک کردن">–</button><button class="pp-x" aria-label="بستن" title="بستن">×</button></div><div class="pp-body"></div><i class="pp-rs" aria-hidden="true"></i>';
 D.body.appendChild(dock);
 let sv={};try{sv=JSON.parse(localStorage.getItem(K))||{}}catch(e){}
 const w=sv.w||380,h=sv.h||240;
 place(sv.x==null?16:sv.x,sv.y==null?innerHeight-h-16:sv.y,w,h);
 grab(dock.querySelector('.pp-bar'),(o,dx,dy)=>place(o.x+dx,o.y+dy,o.w,o.h));
 grab(dock.querySelector('.pp-rs'),(o,dx,dy)=>place(o.x,o.y,o.w+dx,o.h+dy));
 dock.querySelector('.pp-m').onclick=e=>{const b=e.currentTarget,m=dock.classList.toggle('pp-min');b.textContent=m?'+':'–';b.title=b.ariaLabel=m?'بزرگ کردن':'کوچک کردن';place(g.x,g.y,g.w,g.h)};
 dock.querySelector('.pp-x').onclick=()=>{dock.hidden=true;dock.querySelector('.pp-body').innerHTML='';cur=null};
 addEventListener('resize',()=>place(g.x,g.y,g.w,g.h))};
const play=o=>{
 const u=emb(o);if(!u)return false;make();
 dock.hidden=false;
 if(dock.classList.contains('pp-min'))dock.querySelector('.pp-m').click();
 if(cur!==u){const f=D.createElement('iframe');f.src=u;f.allow='autoplay; encrypted-media; clipboard-write';f.title='پخش‌کننده';
  const b=dock.querySelector('.pp-body');b.innerHTML='';b.appendChild(f);cur=u}
 const t=dock.querySelector('.pp-t');t.textContent=o.title||'پخش‌کننده';
 if(o.url)t.href=o.url;else t.removeAttribute('href');
 return true};
window.ppPlay=play;window.ppEmb=emb;
D.addEventListener('click',e=>{
 const b=e.target.closest&&e.target.closest('[data-play]');if(!b)return;
 e.preventDefault();const d=b.dataset;
 play({title:d.title,url:d.url,spotify:d.spotify,apple:d.apple,embed:d.embed})});
/* ---------- page-to-page navigation without reloading (keeps the player alive) ---------- */
const loaded=new Set([...D.scripts].map(s=>s.src).filter(Boolean));
let here=location.href.split('#')[0];
const fresh=s=>{const n=D.createElement('script');[...s.attributes].forEach(a=>n.setAttribute(a.name,a.value));n.textContent=s.textContent;n.async=false;return n};
const go=async(url,push)=>{
 try{
  D.documentElement.style.cursor='progress';
  const r=await fetch(url,{credentials:'same-origin'});
  if(!r.ok||!/text\/html/.test(r.headers.get('content-type')||''))throw 0;
  const doc=new DOMParser().parseFromString(await r.text(),'text/html');
  if(!doc.body)throw 0;
  if(push)history.pushState(null,'',url);
  here=url.split('#')[0];
  D.title=doc.title;
  ['meta[name=description]','link[rel=canonical]','meta[property="og:title"]','meta[property="og:description"]'].forEach(q=>{
   const a=D.querySelector(q),b=doc.querySelector(q);if(a&&b)a.setAttribute(a.tagName==='LINK'?'href':'content',b.getAttribute(a.tagName==='LINK'?'href':'content'))});
  const keep=D.getElementById('pp-dock');
  [...D.body.children].forEach(c=>{if(c!==keep)c.remove()});
  const added=[...doc.body.children].filter(c=>c.id!=='pp-dock');
  added.forEach(c=>D.body.appendChild(D.adoptNode(c)));
  added.forEach(c=>(c.tagName==='SCRIPT'?[c]:[...c.querySelectorAll('script')]).forEach(s=>{
   if(s.src&&loaded.has(s.src)){s.remove();return}
   if(s.src)loaded.add(s.src);
   s.replaceWith(fresh(s))}));
  const h=location.hash&&D.getElementById(decodeURIComponent(location.hash.slice(1)));
  h?h.scrollIntoView():scrollTo(0,0);
  D.dispatchEvent(new Event('pp:nav'));
 }catch(err){location.href=url}
 finally{D.documentElement.style.cursor=''}};
D.addEventListener('click',e=>{
 if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
 const a=e.target.closest&&e.target.closest('a[href]');
 if(!a||a.target||a.hasAttribute('download')||a.getAttribute('href').startsWith('#'))return;
 const u=new URL(a.href,location.href);
 if(u.origin!==location.origin||/\.(xml|json|txt|png|jpe?g|gif|svg|webp|pdf|zip|woff2?|mp3)$/i.test(u.pathname)||u.pathname.startsWith('/cdn-cgi/'))return;
 if(u.pathname===location.pathname&&u.search===location.search&&u.hash)return;
 e.preventDefault();go(u.href,true)});
addEventListener('popstate',()=>{if(location.href.split('#')[0]!==here)go(location.href,false)});
})();
