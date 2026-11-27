(() => {
  const form = document.getElementById('pp-compass-form');
  const results = document.getElementById('pp-compass-results');
  if (!form || !results) return;

  const $ = id => document.getElementById(id);
  const selected = name => Array.from(form.querySelectorAll('[name="' + name + '"]:checked')).map(el => el.value);
  const answer = name => (form.elements[name]?.value || '').trim();
  const has = (arr, value) => arr.includes(value);

  const topics = {
    people: {label:'زندگی آدم‌ها', angles:['تصمیمی که مسیر زندگی یک نفر را عوض کرد','شغلی که کمتر کسی از واقعیت روزمره‌اش خبر دارد','زندگی در موقعیتی که از بیرون ساده به نظر می‌رسد']},
    society: {label:'جامعه و مسائل اجتماعی', angles:['قانون نانوشته‌ای که رفتار روزمره‌ی ما را شکل می‌دهد','گروهی که در یک تغییر اجتماعی کمتر دیده می‌شوند','مسئله‌ای عمومی از زاویه‌ی زندگی یک فرد واقعی']},
    history: {label:'تاریخ و ماجراهای واقعی', angles:['یک تصمیم کوچک با پیامدهای بزرگ تاریخی','روایت یک شاهد یا شخصیت فراموش‌شده','چیزی که روایت مشهور تاریخ از قلم انداخته است']},
    science: {label:'علم و فناوری', angles:['وعده‌ی یک فناوری و فاصله‌اش با واقعیت','پرسشی علمی که در زندگی روزمره پنهان شده','آزمایشی که یک باور رایج را به چالش می‌کشد']},
    culture: {label:'فرهنگ و هنر', angles:['چرا یک اثر یا چهره در حافظه‌ی جمعی ماندگار شد؟','پشت‌صحنه‌ی شکل‌گیری یک جریان فرهنگی','یک اثر شناخته‌شده از زاویه‌ای کمتر دیده‌شده']},
    business: {label:'کسب‌وکار و اقتصاد', angles:['مدل درآمدی یک کسب‌وکار که کمتر کسی می‌شناسد','پشت‌پرده‌ی زنجیره‌ای که یک محصول را به دست ما می‌رساند','شرکتی که با یک تصمیم رشد کرد یا سقوط کرد']},
    nature: {label:'طبیعت و مکان‌ها', angles:['زندگی آدم‌هایی که با یک محیط خاص گره خورده است','مکانی که ظاهرش داستان واقعی‌اش را پنهان می‌کند','تغییر یک زیست‌بوم از نگاه کسانی که آنجا زندگی می‌کنند']},
    daily: {label:'زندگی روزمره و تجربه‌های شخصی', angles:['قاعده‌ای نانوشته که همه رعایت می‌کنند اما درباره‌اش حرف نمی‌زنند','تجربه‌ای عادی که وقتی دقیق نگاهش کنی عجیب می‌شود','چیزی که در یک محیط خاص فقط از نزدیک می‌توان فهمید']}
  };

  const strengths = {
    explain:'توضیح روشن و ساده‌سازی', listen:'گوش‌دادن و سؤال‌پرسیدن', research:'تحقیق و راستی‌آزمایی',
    story:'قصه‌گویی و روایت', connect:'ارتباط با آدم‌ها', make:'ساختن و تجربه‌کردن',
    notice:'مشاهده‌ی جزئیات', organize:'ساختاردهی و پیدا کردن الگو'
  };
  const formats = {
    narrative:'روایت مستند و داستانی', conversation:'گفت‌وگو و مصاحبه',
    analysis:'تحلیل و پرونده‌کاوی', diary:'روایت شخصی', magazine:'مجله‌ی صوتی'
  };

  const paths = [
    {id:'case',title:'مستند پرونده‌محور',desc:'هر قسمت با یک پرسش واقعی شروع می‌شود و از راه اسناد، روایت‌ها و شواهد به پاسخ نزدیک می‌شود.',fit:(i,s,f,w)=>2*has(i,'history')+2*has(i,'business')+2*has(i,'society')+has(i,'science')+3*has(s,'research')+2*has(s,'notice')+2*has(s,'organize')+2*has(f,'analysis')+has(f,'narrative')+has(w,'solo')},
    {id:'human',title:'مستند شخصیت‌محور',desc:'به‌جای توضیح یک موضوع از بالا، آن را از مسیر زندگی و انتخاب‌های یک یا چند آدم دنبال می‌کنی.',fit:(i,s,f,w)=>3*has(i,'people')+has(i,'daily')+3*has(s,'listen')+2*has(s,'connect')+2*has(f,'conversation')+2*has(f,'narrative')+2*has(w,'interview')},
    {id:'explainer',title:'روایت توضیحی و تحلیلی',desc:'یک پدیده‌ی پیچیده را با مثال، شواهد و روایت روشن می‌کنی؛ بدون اینکه به کلاس درس یا سخنرانی تبدیل شود.',fit:(i,s,f)=>2*has(i,'science')+2*has(i,'society')+2*has(i,'business')+3*has(s,'explain')+2*has(s,'organize')+2*has(f,'analysis')},
    {id:'field',title:'مستند میدانی و مکان‌محور',desc:'برای فهمیدن یک موضوع از پشت میز فاصله می‌گیری؛ به مکان‌ها می‌روی، مشاهده می‌کنی و با آدم‌های درگیر ماجرا حرف می‌زنی.',fit:(i,s,f,w)=>3*has(i,'nature')+2*has(i,'people')+has(i,'history')+2*has(s,'connect')+2*has(s,'notice')+3*has(w,'field')+2*has(w,'interview')},
    {id:'firstperson',title:'روایت تجربه و مشاهده‌ی شخصی',desc:'تجربه‌ی زیسته نقطه‌ی ورود است؛ اما هر قسمت از تجربه‌ی شخصی فراتر می‌رود و چیزی قابل‌استفاده برای شنونده کشف می‌کند.',fit:(i,s,f)=>3*has(i,'daily')+2*has(s,'story')+2*has(s,'make')+3*has(f,'diary')+has(f,'narrative')},
    {id:'culture',title:'مستند فرهنگی و روایی',desc:'آدم‌ها، آثار، عادت‌ها و جریان‌های فرهنگی را به هم وصل می‌کنی تا معنای پنهان یک پدیده روشن شود.',fit:(i,s,f)=>3*has(i,'culture')+2*has(i,'history')+2*has(s,'notice')+2*has(s,'story')+2*has(f,'magazine')+2*has(f,'narrative')}
  ];

  function escapeText(value) {
    return String(value).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  }
  function add(parent, tag, className, text) {
    const node=document.createElement(tag);
    if(className) node.className=className;
    if(text!==undefined) node.textContent=text;
    parent.append(node);
    return node;
  }

  function analyze() {
    const i=selected('interest'), s=selected('strength'), f=selected('format'), w=selected('working');
    const exp=answer('experience'), curiosity=answer('curiosity');
    const visibility=form.elements.visibility.value, time=form.elements.time.value;
    const resources=selected('resources');
    const ranked=paths.map(path=>({ ...path, score:path.fit(i,s,f,w) }));
    // Experience and the user's own question are meaningful evidence, not decorative additions.
    if(exp) {
      if(/کار|بازار|فروش|شرکت|پول|درآمد|کسب/.test(exp)) ranked.find(x=>x.id==='case').score+=3;
      if(/آدم|مردم|خانواده|مصاحبه|ارتباط/.test(exp)) ranked.find(x=>x.id==='human').score+=3;
      if(/سفر|شهر|روستا|مکان|طبیعت|محیط/.test(exp)) ranked.find(x=>x.id==='field').score+=3;
      if(/ساخت|تعمیر|تجربه|شخصی|زندگی|شکست/.test(exp)) ranked.find(x=>x.id==='firstperson').score+=3;
      if(/هنر|کتاب|فیلم|موسیقی|فرهنگ/.test(exp)) ranked.find(x=>x.id==='culture').score+=3;
    }
    if(curiosity) {
      if(/چرا|چطور|سازوکار|علت|پشت.?پرده|واقعیت/.test(curiosity)) {
        ranked.find(x=>x.id==='case').score+=2;
        ranked.find(x=>x.id==='explainer').score+=2;
      }
      if(/زندگی|آدم|سرگذشت|تجربه/.test(curiosity)) ranked.find(x=>x.id==='human').score+=2;
      if(/مکان|شهر|سفر|محیط/.test(curiosity)) ranked.find(x=>x.id==='field').score+=2;
    }
    if(!i.length && !s.length && !f.length) ranked.find(x=>x.id==='firstperson').score+=1;
    return ranked.sort((a,b)=>b.score-a.score).slice(0,3).map((p,index)=>({...p,rank:index+1}));
  }

  function buildConcept(path, topic, curiosity, exp) {
    const t=topic ? topics[topic].label : 'موضوعی که واقعاً برایت سؤال‌برانگیز است';
    const q=curiosity ? 'پرسش محوری تو، «'+curiosity+'»، نخ اصلی مجموعه می‌شود.' : 'هر قسمت باید یک پرسش روشن و قابل‌پیگیری داشته باشد.';
    const e=exp ? ' تجربه‌ی «'+exp+'» می‌تواند نقطه‌ی ورود یا مزیت دسترسی تو باشد.' : '';
    const concepts={
      case:'یک پرونده در هر قسمت: ادعا یا اتفاق اولیه، سرنخ‌ها، شواهد مخالف، آدم‌های درگیر و آنچه در پایان هنوز نامعلوم می‌ماند.',
      human:'یک آدم، یک انتخاب و یک پیامد: شنونده از مسیر زندگی شخصیت، مسئله‌ای بزرگ‌تر را کشف می‌کند.',
      explainer:'از یک سؤال آشنا شروع کن، سوءبرداشت رایج را نشان بده و با مثال و شواهد، سازوکار واقعی را باز کن.',
      field:'هر قسمت به یک مکان یا محیط مشخص می‌رود؛ صداها، جزئیات و روایت افراد، خودِ مکان را به شخصیت داستان تبدیل می‌کنند.',
      firstperson:'راوی از یک تجربه یا مشاهده‌ی واقعی شروع می‌کند، اما در پایان فقط درباره‌ی خودش حرف نمی‌زند؛ یک الگوی عمومی را کشف می‌کند.',
      culture:'یک اثر، عادت یا پدیده‌ی فرهنگی را به آدم‌ها، زمانه و مناسبات اجتماعی‌اش وصل کن.'
    };
    return 'محور پیشنهادی: '+t+'. '+concepts[path.id]+' '+q+e;
  }

  function episodeIdeas(path, topic, curiosity, exp) {
    const angles=topic ? topics[topic].angles : ['یک تصور رایج درباره‌ی موضوع را با شواهد امتحان کن','داستان یک فرد یا نمونه‌ی مشخص را دنبال کن','پشت‌صحنه یا پیامد پنهان موضوع را کشف کن'];
    const first=curiosity ? 'پرونده‌ی اول: '+curiosity : angles[0];
    const second=exp ? 'از تجربه‌ی «'+exp+'» شروع کن و ببین چه چیزی فراتر از تجربه‌ی شخصی در آن وجود دارد.' : angles[1];
    const third=angles[2];
    const byPath={
      case:['چه چیزی در این ماجرا با روایت مشهور فرق دارد؟','کدام سند یا شاهد می‌تواند برداشت ما را عوض کند؟','چه کسی از ادامه‌ی این وضعیت سود می‌برد؟'],
      human:['لحظه‌ای که شخصیت اصلی مجبور شد انتخاب کند','چه چیزی را اطرافیان او نمی‌دیدند؟','این زندگی چه چیزی درباره‌ی جامعه‌ی اطرافش نشان می‌دهد؟'],
      explainer:['این پدیده دقیقاً چطور کار می‌کند؟','سه باور رایج درباره‌ی آن؛ کدام درست است؟','چه کسانی از آن سود می‌برند و چه کسانی هزینه‌اش را می‌پردازند؟'],
      field:['اگر یک روز در این مکان بمانی چه چیزهایی می‌بینی؟','آدم‌های اینجا چه چیزی می‌دانند که غریبه‌ها نمی‌دانند؟','چه تغییری این مکان را به وضعیت امروز رسانده است؟'],
      firstperson:['چه چیزی در این تجربه برخلاف انتظار تو بود؟','کدام جزئیات کوچک معنای بزرگ‌تری داشت؟','اگر فرد دیگری همین تجربه را داشته باشد چه چیزی مشترک است؟'],
      culture:['این پدیده از کجا شروع شد و چطور تغییر کرد؟','چرا بعضی‌ها با آن ارتباط می‌گیرند و بعضی نه؟','چه چیزی درباره‌ی زمانه‌ی ما در آن دیده می‌شود؟']
    };
    return [first,second,...byPath[path.id],third].slice(0,5);
  }

  function formatSuggestion(path, f, w, visibility) {
    const chosen=f.map(x=>formats[x]).filter(Boolean);
    let base=chosen[0] || (path.id==='human'?'گفت‌وگوی هدایت‌شده':path.id==='case'?'روایت مستند': 'روایت تک‌نفره');
    if(path.id==='case'||path.id==='explainer') base='روایت تک‌نفره با تحقیق و اسناد';
    if(path.id==='human' && !has(w,'interview')) base='روایت شخصیت‌محور با نقل‌قول و روایت راوی';
    if(has(w,'field')) base+=' همراه با ضبط صدای محیط';
    if(visibility==='voice') base+='؛ با هویت غیرشخصی راوی';
    if(visibility==='altered') base+='؛ بدون نیاز به حضور مستقیم تو';
    return base;
  }

  function render() {
    const ranked=analyze();
    const interest=selected('interest');
    const strengthsPicked=selected('strength');
    const formatsPicked=selected('format');
    const working=selected('working');
    const exp=answer('experience'), curiosity=answer('curiosity');
    const visibility=form.elements.visibility.value, time=form.elements.time.value;
    const topic=interest[0] || '';
    const directionBox=$('pp-compass-directions');
    directionBox.replaceChildren();

    ranked.forEach((path,index)=>{
      const card=add(directionBox,'article','pp-compass-direction');
      add(card,'div','pp-compass-rank',index===0?'پیشنهاد اصلی':index===1?'مسیر جایگزین اول':'مسیر جایگزین دوم');
      add(card,'h3','',path.title);
      add(card,'p','pp-compass-pathdesc',path.desc);
      add(card,'div','pp-compass-subhead','طرح مشخص برنامه');
      add(card,'p','pp-compass-concept',buildConcept(path,topic,curiosity,exp));
      add(card,'div','pp-compass-subhead','چرا این مسیر به پاسخ‌هایت نزدیک است؟');
      const reasons=[];
      if(topic) reasons.push('علاقه به '+topics[topic].label);
      strengthsPicked.slice(0,3).forEach(x=>reasons.push('توانایی '+strengths[x]));
      formatsPicked.slice(0,2).forEach(x=>reasons.push('قالب '+formats[x]));
      if(exp) reasons.push('تجربه‌ی شخصی‌ای که توضیح داده‌ای');
      if(curiosity) reasons.push('پرسش مشخصی که می‌خواهی دنبال کنی');
      add(card,'p','pp-compass-reasons',reasons.length?reasons.join('، '):'با پاسخ‌های فعلی، این مسیر فقط یک فرضیه‌ی اولیه است؛ برای دقیق‌ترشدن، تجربه و پرسش شخصی‌ات را کامل‌تر کن.');
      add(card,'div','pp-compass-subhead','قالب اجرایی مناسب');
      add(card,'p','pp-compass-format',formatSuggestion(path,formatsPicked,working,visibility));
      add(card,'div','pp-compass-subhead','سه ایده برای قسمت‌های آغازین');
      const list=add(card,'ol','pp-compass-episode-list');
      episodeIdeas(path,topic,curiosity,exp).slice(0,3).forEach(x=>add(list,'li','',x));
    });

    const best=ranked[0];
    const scoreText=best.score===0
      ? 'پاسخ‌ها هنوز برای تفکیک مسیرها کافی نیستند؛ این نتیجه را با احتیاط بخوان.'
      : 'مسیر اول بیشترین هم‌پوشانی را میان علاقه‌ها، توانایی‌ها، قالب دلخواه و تجربه‌های تو داشته است.';
    $('pp-compass-result-summary').textContent=scoreText;
    const audience={
      case:'شنونده‌ای که از کشف واقعیت پشت اتفاقات و دنبال‌کردن سرنخ‌ها لذت می‌برد.',
      human:'شنونده‌ای که با زندگی واقعی آدم‌ها و انتخاب‌های دشوارشان ارتباط می‌گیرد.',
      explainer:'شنونده‌ای کنجکاو که می‌خواهد موضوعات پیچیده را بدون زبان تخصصی بفهمد.',
      field:'شنونده‌ای که دوست دارد مکان‌ها و جهان‌های کمتر دیده‌شده را از نزدیک تجربه کند.',
      firstperson:'شنونده‌ای که از تجربه‌ی صادقانه و کشف معنا در اتفاقات روزمره استقبال می‌کند.',
      culture:'شنونده‌ای که دنبال لایه‌های پنهان آثار، عادت‌ها و پدیده‌های فرهنگی است.'
    };
    $('pp-compass-audience').textContent=audience[best.id];
    const weekly=time==='little'?'یک اپیزود کوتاه هر دو هفته؛ تحقیق محدود و یک پرسش مرکزی.':time==='much'?'یک اپیزود کامل در هر یک تا دو هفته؛ با زمان مشخص برای تحقیق، ضبط و تدوین.':'یک اپیزود ۱۵ تا ۲۵ دقیقه‌ای هر دو هفته؛ با یک روز تحقیق و یک نوبت ضبط.';
    let first='برای آزمایش مسیر اول، یک قسمت نمونه بساز و قبل از انتشار از دو شنونده‌ی هدف بازخورد بگیر. معیار موفقیت فقط کیفیت صدا نیست: آیا سؤال اصلی روشن بود؟ آیا شنونده تا پایان همراه ماند؟ آیا برای قسمت بعد کنجکاو شد؟ '+weekly;
    if(!selected('resources').length || has(selected('resources'),'none')) first+=' فعلاً با گوشی و محیط آرام یک نمونه‌ی آزمایشی بساز؛ خرید تجهیزات را به بعد از آزمون ایده موکول کن.';
    if(visibility==='voice'||visibility==='altered') first+=' می‌توانی بدون معرفی هویت واقعی خودت تولید کنی؛ فقط در استفاده از صدای دیگران رضایت روشن داشته باش.';
    $('pp-compass-first-step').textContent=first;
    $('pp-compass-results').hidden=false;
    form.hidden=true;
    results.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }

  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(!form.reportValidity()) return;
    render();
  });
  $('pp-compass-edit').addEventListener('click',()=>{
    results.hidden=true; form.hidden=false; form.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('pp-compass-print').addEventListener('click',()=>window.print());
})();