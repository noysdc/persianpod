(() => {
  const form = document.getElementById('pp-compass-form');
  const results = document.getElementById('pp-compass-results');
  if (!form || !results) return;

  const directions = [
    {id:'people', title:'روایت زندگی آدم‌ها', tags:['people','story','listen','connect','conversation','interview','diary'], desc:'داستان آدم‌ها، انتخاب‌های دشوار، شغل‌های کمتر دیده‌شده و مسیرهایی که زندگی افراد را شکل داده‌اند.', fit:'وقتی به آدم‌ها و تجربه‌هایشان علاقه داری و از شنیدن، سؤال‌پرسیدن یا روایت‌کردن لذت می‌بری.'},
    {id:'case', title:'پرونده‌کاوی و کشف پشت‌پرده', tags:['research','analysis','notice','organize','history','business','society','science'], desc:'هر قسمت مثل یک پرونده پیش می‌رود: یک پرسش، چند سرنخ، شواهد و در نهایت تصویری روشن‌تر از ماجرا.', fit:'وقتی کنجکاوی، تحقیق و کنار هم گذاشتن جزئیات برایت جذاب است.'},
    {id:'experience', title:'روایت تجربه‌های واقعی', tags:['daily','story','make','diary','practical','field','nature'], desc:'از تجربه‌های شخصی، کار، زندگی در یک محیط خاص یا آموخته‌هایی که فقط با زندگی‌کردن به دست می‌آیند، قصه بساز.', fit:'وقتی تجربه یا مسیر زندگی‌ات می‌تواند دریچه‌ای به موضوعی باشد که دیگران کمتر از آن خبر دارند.'},
    {id:'explain', title:'بازکردن موضوعات پیچیده', tags:['explain','science','society','business','analysis','organize'], desc:'موضوعات دشوار را به زبان روشن و شنیدنی تبدیل کن؛ از فناوری و اقتصاد تا رفتارهای اجتماعی.', fit:'وقتی از فهمیدن سازوکار چیزها و توضیح ساده‌ی آن‌ها لذت می‌بری.'},
    {id:'culture', title:'فرهنگ، هنر و سلیقه‌ها', tags:['culture','creative','notice','research','magazine','narrative'], desc:'آثار، جریان‌ها، آدم‌ها و پدیده‌های فرهنگی را از زاویه‌ای شخصی و کنجکاوانه دنبال کن.', fit:'وقتی با هنر و فرهنگ ارتباط داری و دوست داری میان آثار و زندگی واقعی پیوند پیدا کنی.'},
    {id:'discovery', title:'سفر و کشف جهان اطراف', tags:['nature','field','interview','people','history','explore'], desc:'مکان‌ها، محله‌ها، مشاغل و جهان‌های کوچکی را کشف کن که معمولاً از کنارشان بی‌تفاوت می‌گذریم.', fit:'وقتی مشاهده‌ی میدانی، رفتن به مکان‌ها و روبه‌روشدن با آدم‌ها به تو انرژی می‌دهد.'}
  ];

  const ideasByDirection = {
    people:['یک روز عادی از زندگی کسی که شغلش را کمتر می‌شناسیم','تصمیمی که مسیر زندگی یک نفر را عوض کرد','چرا بعضی آدم‌ها حاضرند سال‌ها برای یک هدف نامعمول وقت بگذارند؟'],
    case:['داستان شکل‌گیری و سقوط یک کسب‌وکار غیرمعمول','یک وسیله یا فناوری که وعده‌ای بزرگ داد؛ واقعیت چه بود؟','پشت‌پرده‌ی پدیده‌ای روزمره که کمتر درباره‌اش سؤال می‌کنیم'],
    experience:['چیزی که سال‌ها در محیط کار یا زندگی‌ات دیدی و کمتر کسی از آن خبر دارد','یک شکست یا اشتباه که نگاهت را به موضوعی عوض کرد','قواعد نانوشته‌ی زندگی در یک شهر، شغل یا جامعه‌ی خاص'],
    explain:['یک مفهوم پیچیده که هر روز درباره‌اش حرف می‌زنیم اما درست نمی‌شناسیم','چه کسانی از یک تغییر اجتماعی یا فناوری سود می‌برند؟','چطور یک عادت یا باور معمولی در جامعه شکل می‌گیرد؟'],
    culture:['چرا یک اثر هنری یا داستانی در ذهن مردم ماندگار می‌شود؟','زندگی و جهان‌بینی یک هنرمند کمتر شناخته‌شده','ردپای یک پدیده‌ی فرهنگی در زندگی روزمره‌ی ما'],
    discovery:['یک محله یا مکان که داستانی پنهان در دل خود دارد','مشاغلی که با تغییر زمانه در حال ناپدیدشدن‌اند','یک سفر کوتاه برای فهمیدن زندگی مردمان یک منطقه']
  };

  const selected = name => Array.from(form.querySelectorAll('[name="' + name + '"]:checked')).map(el => el.value);
  const hasText = name => (form.elements[name]?.value || '').trim();

  function scoreDirections() {
    const interests = selected('interest');
    const strengths = selected('strength');
    const formats = selected('format');
    const working = selected('working');
    const score = {
      people: interests.includes('people')*3 + interests.includes('daily')*1 + strengths.includes('listen')*3 + strengths.includes('connect')*2 + formats.includes('conversation')*2 + working.includes('interview')*2,
      case: interests.includes('history')*2 + interests.includes('business')*2 + interests.includes('society')*2 + interests.includes('science')*1 + strengths.includes('research')*3 + strengths.includes('notice')*2 + strengths.includes('organize')*2 + formats.includes('analysis')*2,
      experience: interests.includes('daily')*3 + strengths.includes('story')*2 + strengths.includes('make')*2 + formats.includes('diary')*3 + working.includes('field')*1,
      explain: interests.includes('science')*2 + interests.includes('society')*1 + interests.includes('business')*1 + strengths.includes('explain')*3 + strengths.includes('organize')*1 + formats.includes('analysis')*2,
      culture: interests.includes('culture')*3 + interests.includes('history')*1 + strengths.includes('notice')*1 + strengths.includes('story')*1 + formats.includes('magazine')*2 + formats.includes('narrative')*1,
      discovery: interests.includes('nature')*3 + interests.includes('people')*1 + strengths.includes('connect')*1 + working.includes('field')*3 + working.includes('interview')*1
    };
    if (!interests.length && !strengths.length && !formats.length) score.experience += 1;
    return Object.entries(score).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id,value])=>({...directions.find(d=>d.id===id),value}));
  }

  function render() {
    const ranked = scoreDirections();
    const exp = hasText('experience');
    const curious = hasText('curiosity');
    const visibility = form.elements.visibility.value;
    const time = form.elements.time.value;
    const work = selected('working');
    const resource = selected('resources');
    const directionBox = document.getElementById('pp-compass-directions');
    directionBox.replaceChildren();
    ranked.forEach((d,i)=>{
      const card=document.createElement('article');
      card.className='pp-compass-direction';
      const label=document.createElement('small'); label.textContent=['مسیر پیشنهادی اول','مسیر پیشنهادی دوم','مسیر پیشنهادی سوم'][i];
      const h=document.createElement('h3'); h.textContent=d.title;
      const p=document.createElement('p'); p.textContent=d.desc;
      const fit=document.createElement('div'); fit.className='pp-compass-fit'; fit.textContent='چرا ممکن است مناسب باشد: '+d.fit;
      card.append(label,h,p,fit); directionBox.append(card);
    });

    const ideaList=document.getElementById('pp-compass-ideas-list');
    ideaList.replaceChildren();
    const ideaPool=[];
    ranked.forEach(d=>(ideasByDirection[d.id]||[]).forEach(x=>ideaPool.push(x)));
    const chosen=[];
    ideaPool.forEach(x=>{if(!chosen.includes(x)&&chosen.length<8)chosen.push(x)});
    if(curious) chosen.unshift('یک قسمت درباره‌ی این پرسش بساز: «'+curious+'»');
    if(exp) chosen.splice(1,0,'روایت یک تجربه‌ی واقعی از این بخش زندگی: «'+exp+'»');
    chosen.slice(0,10).forEach(x=>{const li=document.createElement('li');li.textContent=x;ideaList.append(li)});

    let step='از میان سه مسیر بالا، یکی را انتخاب کن و یک طرح صوتی آزمایشی ۳ تا ۵ دقیقه‌ای ضبط کن. لازم نیست آن را منتشر کنی؛ فقط ببین هنگام ساختنش چقدر مشتاق می‌مانی.';
    if(time==='little') step='با یک قالب کوتاه شروع کن: هر دو هفته یک اپیزود ۵ تا ۱۰ دقیقه‌ای. برای شروع، یک پرسش مشخص انتخاب کن و فقط سه نکته‌ی اصلی‌اش را یادداشت کن.';
    else if(time==='much') step='برای مسیر اول یک پرونده‌ی کوچک انتخاب کن، سه منبع معتبر پیدا کن و پیش از تولید، طرح یک قسمت آزمایشی را بنویس.';
    if(work.includes('interview') && visibility==='altered') step='اگر گفت‌وگو دوست داری اما نمی‌خواهی شناخته شوی، با یک مهمان موافق و آگاه شروع کن؛ رضایت و حریم خصوصی او را روشن نگه دار و خودت می‌توانی پشت صحنه بمانی.';
    else if(visibility==='voice') step+=' می‌توانی با نام برنامه و بدون انتشار اطلاعات هویتی خودت فعالیت کنی.';
    else if(visibility==='altered') step+=' می‌توانی از راوی همکار استفاده کنی؛ صدای افراد دیگر را بدون رضایتشان تغییر نده یا منتشر نکن.';
    if(resource.includes('none') || (!resource.length)) step+=' برای نسخه‌ی اول به تجهیزات حرفه‌ای نیاز نداری؛ ضبط آزمایشی با گوشی و محیط آرام کافی است.';
    document.getElementById('pp-compass-first-step').textContent=step;

    form.hidden=true;
    results.hidden=false;
    results.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }

  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(!form.reportValidity()) return;
    render();
  });
  document.getElementById('pp-compass-edit').addEventListener('click',()=>{
    results.hidden=true; form.hidden=false; form.scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.getElementById('pp-compass-print').addEventListener('click',()=>window.print());
})();
