/* ============================================================
   TAJ RESTAURANT — app.js (customer menu)
   Live data comes from Supabase (categories / products / announcements).
   The built-in menu below is only an offline fallback.
   The key is the PUBLIC anon key: Row Level Security protects the data.
   ============================================================ */
const SB_URL='https://ppdzgsdfrptsoeuwszcu.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZHpnc2RmcnB0c29ldXdzemN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1MjEzNzEsImV4cCI6MjExMTA5NzM3MX0.MgeOyHgxauzD_pwl03uTNU2Qa1SEcUtWZeMmyamY5RQ';
const WA='9647753181418';
const H={apikey:SB_KEY,Authorization:'Bearer '+SB_KEY};
const $=id=>document.getElementById(id);
const f=n=>Number(n).toLocaleString('en');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tabs=document.querySelector('.tabs'),out=$('out'),ord=$('orderBtn');

/* 1. OFFLINE FALLBACK MENU — [name, price] or [name, mediumPrice, largePrice] (IQD) */
const FB=[
{k:'Burgers',t:'برگر',note:'وجبة (بيبسي + فنكر) +2000',i:[['تشيز برگر لحم',5750],['برگر سبايسي',5750],['برگر تكساس',5750],['برگر لحم كلاسك',5500],['برگر دجاج',5000],['برگر فلافل تاج',3500],['برگر لحم دبل',6750],['برگر تاج',6500],['برگر دجاج دبل',6500],['برگر مشروم',6000]]},
{k:'Rizzo',t:'ريزو',i:[['ريزو باربكيو',5750],['ريزو هني ماستر',5750],['ريزو قص دجاج',5750],['ريزو كلاسك',5500],['ريزو قص لحم',6000],['ريزو تاج',6000],['ريزو سبايسي',5750],['ريزو بالجبن',5750],['ريزو مشروم',5750]]},
{k:'Crispy',t:'كريسبي',i:[['وجبة كريسبي عائلية 12 قطعة',15750],['وجبة كريسبي 6 قطع',12000],['وجبة كريسبي 4 قطع',6750]]},
{k:'Zinger',t:'زنجر',i:[['زنجر دبل',6500],['زنجر تاج',6000],['زنجر سبايسي',5500],['سندويچ زنجر',5000]]},
{k:'Taj Box',t:'بوكسات',i:[['بوكس ميني برگر لحم',7000],['بوكس ميني برگر دجاج',6750],['چيز چكن فراي',5500],['بوكس زنكر',9000],['ماكسي بوكس',11000],['باستا',6500],['بوكس ميني لبناني لحم',10500],['بوكس ميني لبناني دجاج',9000],['بوكس ميني لبناني مشكل',10000]]},
{k:'Pizza',t:'بيتزا',pz:1,i:[['بيتزا خمار',5500,6000],['بيتزا بيبروني',7500,10000],['بيتزا تاج',9000,13000],['بيتزا ماركريتا',5000,6000],['بيتزا دجاج',6000,9000],['بيتزا لحم',8000,12000]]},
{k:'Shawarma & Saj',t:'شاورما وصاج',i:[['سندويش فاهيتا لحم',5500],['سندويش فاهيتا دجاج',5000],['سندويش لبناني لحم',3000],['سندويش لبناني دجاج',2500],['سندويش كس لحم',4000],['سندويش كس دجاج',3000],['ماج دجاج',5500],['ماج لحم',6500],['ماج برگر دجاج',5500],['ماج برگر لحم',5750],['عرايس دجاج تاج',6500],['عرايس لحم تاج',7000]]},
{k:'Twister',t:'تويستر',i:[['تويستر كلاسك',4500],['تويستر سبايسي',4750],['تويستر توريتوز',5000]]},
{k:'Sides & Drinks',t:'جانبيات ومشروبات',i:[['طبق فنكر عادي',2000],['طبق فنكر بالجبن',2500],['طبق فنكر تاج',3000],['كرنچي تاج فنكر',4500],['صوص تاج',750],['صوص هني ماستر',500],['صوص سبايسي',500],['صوص جبن',500],['صوص باربيكيو',500],['صوص فنكر تاج',1000],['مشروبات غازية',500],['ماء',250]]}
];
const fbToM=()=>FB.map((s,ci)=>({id:'fb'+ci,k:s.k,t:s.t,note:s.note,pz:!!s.pz,i:s.i.map(r=>({id:null,n:r[0],p:r[1],p2:r[2]||null,old:null,d:'',ing:'',img:'',feat:false,nw:false,av:true}))}));
let M=fbToM(),ADS=[],live=false,sig='';

/* 2. LOAD FROM SUPABASE */
const get=p=>fetch(SB_URL+'/rest/v1/'+p,{headers:H,cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('http '+r.status);return r.json()});
function fromDB(cats,prods){
  const by={};prods.forEach(p=>(by[p.category_id]=by[p.category_id]||[]).push(p));
  return cats.map(c=>{const L=by[c.id]||[];return {id:c.id,k:c.name_en||c.name_ar,t:c.name_ar,note:c.note,pz:L.some(p=>p.price_large!=null),
    i:L.map(p=>({id:p.id,n:p.name,p:+p.price,p2:p.price_large!=null?+p.price_large:null,old:p.old_price?+p.old_price:null,d:p.description||'',ing:p.ingredients||'',img:p.image_url||'',feat:!!p.is_featured,nw:!!p.is_new,av:p.is_available!==false}))}}).filter(c=>c.i.length);
}
async function loadAll(){
  try{
    const [cats,prods,anns]=await Promise.all([get('categories?select=*&order=sort_order'),get('products?select=*&order=sort_order,created_at'),get('announcements?select=*&order=sort_order')]);
    const nm=fromDB(cats,prods),s=JSON.stringify([nm,anns]);
    live=true;
    if(s===sig)return;
    sig=s;M=nm;ADS=anns;
    const cur=[...tabs.children].findIndex(t=>t.getAttribute('aria-selected')==='true');
    renderAds();build(cur);syncCart();
  }catch(e){/* offline: keep whatever is on screen */}
}
function renderAds(){
  const el=$('ads');
  if(!ADS.length){el.hidden=true;el.innerHTML='';return}
  el.hidden=false;
  el.innerHTML='<div class="adrow">'+ADS.map(a=>'<article class="ad">'+(a.image_url?'<img src="'+esc(a.image_url)+'" alt="" loading="lazy">':'')+'<div class="adb"><span class="adk">'+(a.kind==='offer'?'عرض':'إعلان')+'</span>'+(a.discount_text?'<span class="add">'+esc(a.discount_text)+'</span>':'')+'<h3>'+esc(a.title)+'</h3>'+(a.body?'<p>'+esc(a.body)+'</p>':'')+'</div></article>').join('')+'</div>';
}

/* 3. RENDER MENU */
const key=(it,z)=>(it.id||it.n)+'|'+(z||'');
const slot=(it,z)=>it.av
  ?'<span class="qty" data-k="'+esc(key(it,z))+'" data-i="'+esc(it.id||'')+'" data-n="'+esc(it.n)+'" data-p="'+(z==='كبير'?it.p2:it.p)+'" data-s="'+(z||'')+'"></span>'
  :'<span class="na">غير متوفر</span>';
function rowHTML(it){
  const bg=(it.feat?'<i class="bg">الأكثر طلباً</i>':'')+(it.nw?'<i class="bg nw">جديد</i>':'');
  const pr=it.p2!=null
    ?'<span class="opt"><small>وسط</small><span class="p">'+f(it.p)+'</span>'+slot(it,'وسط')+'</span><span class="opt"><small>كبير</small><span class="p">'+f(it.p2)+'</span>'+slot(it,'كبير')+'</span>'
    :(it.old?'<s class="op">'+f(it.old)+'</s>':'')+'<span class="p">'+f(it.p)+'</span>'+slot(it,'');
  return '<div class="row'+(it.av?'':' un')+'">'+(it.img?'<img class="th" src="'+esc(it.img)+'" alt="" loading="lazy">':'')
    +'<span class="nmw"><b>'+esc(it.n)+'</b>'+bg+(it.d?'<small class="dsc">'+esc(it.d)+'</small>':'')+(it.ing?'<small class="dsc">'+esc(it.ing)+'</small>':'')+'</span><u></u><span class="pr">'+pr+'</span></div>';
}
$('mq').innerHTML=Array(8).fill('OPEN 24/7 ★ TAJ ★ BAGHDAD ROAD ★ ').join('');
function build(sel){
  tabs.innerHTML='';out.innerHTML='';
  if(!M.length){out.innerHTML='<p class="emptym">المنيو قيد التحديث، تواصل معنا واتصل بنا للطلب.</p>';paint();return}
  M.forEach((s,idx)=>{
    const b=document.createElement('button');b.className='tab';b.role='tab';b.textContent=s.t;b.onclick=()=>show(idx);tabs.append(b);
    const d=document.createElement('section');d.className='sec'+(s.pz?' pz':'');d.setAttribute('role','tabpanel');
    d.innerHTML='<h2>'+esc(s.k)+'</h2>'+(s.note?'<div class="note">'+esc(s.note)+'</div>':'')+(s.pz?'<div class="note">وسط / كبير</div>':'')+s.i.map(rowHTML).join('');
    out.append(d);
  });
  show(Math.max(0,Math.min(sel||0,M.length-1)));paint();
  if($('qs')&&$('qs').value)search($('qs').value);
}
function search(q){
  q=(q||'').trim();
  const rows=[...out.querySelectorAll('.row')];
  if(!q){rows.forEach(r=>r.style.display='');const cur=[...tabs.children].findIndex(t=>t.getAttribute('aria-selected')==='true');show(Math.max(cur,0));return}
  [...tabs.children].forEach(t=>t.setAttribute('aria-selected',false));
  [...out.children].forEach(s=>{let n=0;[...s.querySelectorAll('.row')].forEach(r=>{const m=r.textContent.includes(q);r.style.display=m?'':'none';r.style.animation='none';r.style.opacity=1;r.style.transform='none';if(m)n++});s.classList.toggle('on',n>0)});
}
function show(n){
  [...tabs.children].forEach((t,i)=>t.setAttribute('aria-selected',i===n));
  [...out.children].forEach((s,i)=>{s.classList.toggle('on',i===n);if(i===n)[...s.querySelectorAll('.row')].forEach((r,j)=>{r.style.animation='none';r.offsetWidth;r.style.animation='';r.style.animationDelay=(j*60)+'ms'})});
  if(tabs.children[n])tabs.children[n].scrollIntoView({inline:'center',block:'nearest'});
}

/* 4. CART STATE — C[key] = {k, i:productId|null, n:name, s:size, p:price, q:qty} */
let C={};try{C=JSON.parse(localStorage.getItem('tajcart2')||'{}')}catch(e){}
const tot=()=>Object.values(C).reduce((a,x)=>[a[0]+x.q,a[1]+x.q*x.p],[0,0]);
const cslot=x=>'<span class="qty" data-k="'+esc(x.k)+'" data-i="'+esc(x.i||'')+'" data-n="'+esc(x.n)+'" data-p="'+x.p+'" data-s="'+esc(x.s)+'"></span>';
const itemHTML=x=>'<div class="li"><table><tr><td class="nm">'+esc(x.n)+(x.s?'<i class="sz">'+esc(x.s)+'</i>':'')+'</td><td class="dl"><button class="del" data-k="'+esc(x.k)+'" aria-label="حذف">✕</button></td></tr></table><div class="pc">'+f(x.p)+' د.ع</div><table class="l2"><tr><td class="c2"><small>الإجمالي</small><b>'+f(x.q*x.p)+' د.ع</b></td><td class="c1">'+cslot(x)+'</td></tr></table></div>';
function syncCart(){
  /* drop items that are no longer available, refresh prices and names from the live menu */
  const byId={};M.forEach(c=>c.i.forEach(it=>{if(it.id)byId[it.id]=it}));
  Object.keys(C).forEach(k=>{
    const x=C[k];if(!live)return;
    const it=x.i&&byId[x.i];
    if(!it||!it.av||(x.s==='كبير'&&it.p2==null)){delete C[k];return}
    x.n=it.n;x.p=x.s==='كبير'?it.p2:it.p;
  });
  paint();
}
function paint(){
  const[c,t]=tot();
  $('list').innerHTML=Object.values(C).map(itemHTML).join('')||'<p class="empty">السلة فارغة. اضغط + قدام أي وجبة لإضافتها.</p>';
  document.querySelectorAll('.qty').forEach(e=>{
    const o=C[e.dataset.k],q=o?o.q:0;
    e.innerHTML='<button class="mn'+(q?'':' off')+'" aria-label="إنقاص">−</button><em'+(q?'':' class="z"')+'>'+q+'</em><button class="pl" aria-label="زيادة">+</button>';
  });
  $('cc').textContent=c;$('hc').textContent=c;
  $('ct').textContent=$('st').textContent=f(t)+' د.ع';
  $('sc').textContent=c+(c===1?' وجبة':' وجبات');
  $('cartbtn').classList.toggle('show',c>0);
  ord.href=$('send').href=link();
  if(!c&&document.body.classList.contains('cartmode'))closeCart();
  try{localStorage.setItem('tajcart2',JSON.stringify(C))}catch(e){}
}

/* 5. WHATSAPP MESSAGE + ORDER SAVING */
const LINE='\u2500'.repeat(12);
const val=id=>$(id).value.trim();
function link(no){
  const[c,t]=tot();let m='مرحباً، أريد أن أطلب من مطعم تاج';
  if(c){
    m='*طلب جديد من موقع تاج* 🍔'+(no?'\n*رقم الطلب: #'+no+'*':'')+'\n'+LINE+'\n*تفاصيل الطلب:*\n\n'
     +Object.values(C).map((x,i)=>(i+1)+') *'+x.n+'*'+(x.s?' — '+x.s:'')+'\n    العدد: '+x.q+'  ×  '+f(x.p)+'  =  '+f(x.q*x.p)+' د.ع').join('\n\n')
     +'\n\n'+LINE+'\nعدد الوجبات: '+c+'\n*المجموع الكلي: '+f(t)+' د.ع*\n'+LINE
     +'\n*بيانات الزبون:*\nالاسم: '+(val('cname')||'—')+'\nالهاتف: '+(val('cphone')||'—')+'\nالعنوان: '+(val('caddr')||'—')
     +'\n\n*ملاحظات:*\n'+(val('note')||'لا يوجد');
  }
  return 'https://wa.me/'+WA+'?text='+encodeURIComponent(m);
}
let tt;function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),3500)}
async function sendOrder(ev){
  ev.preventDefault();
  const[c]=tot();if(!c)return;
  const lines=Object.values(C);
  let w=null;try{w=window.open('about:blank','_blank')}catch(e){}
  let no=null;
  if(live&&lines.every(x=>x.i)){
    try{
      const r=await fetch(SB_URL+'/rest/v1/rpc/place_order',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},H),
        body:JSON.stringify({p_name:val('cname'),p_phone:val('cphone'),p_address:val('caddr'),p_notes:val('note'),p_items:lines.map(x=>({product_id:x.i,size:x.s,qty:x.q}))})});
      const j=await r.json().catch(()=>({}));
      if(r.ok)no=j.order_id;
      else{toast(j.message||'تعذر إرسال الطلب، حاول مرة أخرى');if(w)w.close();loadAll();return}
    }catch(e){/* offline: still send through WhatsApp */}
  }
  const url=link(no);
  if(w)w.location.href=url;else location.href=url;
  if(no){C={};paint();closeCart();toast('تم إرسال طلبك رقم #'+no+' ✓')}
}

/* 6. EVENTS */
let lastY=0;
function jump(y){const s=document.documentElement.style;s.scrollBehavior='auto';window.scrollTo(0,y);s.scrollBehavior=''}
function openCart(){lastY=window.scrollY||0;document.body.classList.add('cartmode');jump(0)}
function closeCart(){document.body.classList.remove('cartmode');jump(lastY)}
document.addEventListener('click',e=>{
  const b=e.target.closest('.qty button');
  if(b){
    const d=b.parentNode.dataset,k=d.k;
    if(b.classList.contains('pl'))(C[k]=C[k]||{k,i:d.i||null,n:d.n,s:d.s,p:+d.p,q:0}).q++;
    else if(C[k]&&--C[k].q<1)delete C[k];
    paint();return;
  }
  const x=e.target.closest('.del');if(x){delete C[x.dataset.k];paint()}
});
$('qs').addEventListener('input',e=>search(e.target.value));
$('cartbtn').onclick=openCart;
$('x').onclick=closeCart;
$('clr').onclick=()=>{C={};paint()};
['cname','cphone','caddr','note'].forEach(id=>{
  try{const s=JSON.parse(localStorage.getItem('tajinfo')||'{}');if(s[id])$(id).value=s[id]}catch(e){}
  $(id).oninput=()=>{ord.href=$('send').href=link();try{const s={};['cname','cphone','caddr'].forEach(i=>s[i]=$(i).value);localStorage.setItem('tajinfo',JSON.stringify(s))}catch(e){}};
});
$('send').addEventListener('click',sendOrder);
ord.addEventListener('click',e=>{if(tot()[0])sendOrder(e)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCart()});
new IntersectionObserver((e,o)=>e.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');o.disconnect()}}),{threshold:.3}).observe($('visit'));
/* keep the menu fresh without a redeploy */
setInterval(()=>{if(!document.hidden&&!document.body.classList.contains('cartmode'))loadAll()},45000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadAll()});
build(0);loadAll();
