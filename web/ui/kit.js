/* R0b: minimalist UI kit, used by R0a shell and phase-2 screens.
 * All content strings are escaped unless explicitly named *Html or attrs (internal trusted markup).
 * Assumes core/state.js declares UI, ACT, PAGES, and that icons.js updates P. */
const kEsc = value => typeof esc === 'function' ? esc(value) : String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kSafeColour = value => /^#[0-9A-Fa-f]{3,8}$/.test(String(value)) ? value : 'var(--accent)';

function kIconBtn(name,label,attrs){
  return '<button type="button" class="k-icon" aria-label="'+kEsc(label)+'" title="'+kEsc(label)+'" '+(attrs||'')+'>'+icon(name)+'</button>';
}

function kBtn(label,attrs,options){
  options=options||{};const kind=['primary','tonal','text','danger'].includes(options.kind)?options.kind:'tonal';
  return '<button type="button" class="k-btn '+kind+'" '+(attrs||'')+'>'+(options.icon?icon(options.icon):'')+kEsc(label)+'</button>';
}

function kRow(o){
  o=o||{};const tag=/\bdata-act=/.test(o.attrs||'')?'button':'div';
  const dot=o.dot?'<i class="k-dot" style="--c:'+kSafeColour(o.dot)+'" aria-hidden="true"></i>':'';
  const prefix=o.icon?'<span class="k-row-icon">'+icon(o.icon)+'</span>':dot;
  const suffix=o.right||((o.value!=null?'<span class="k-row-value">'+kEsc(o.value)+'</span>':'')+(o.open?icon('open'):''));
  return '<'+tag+(tag==='button'?' type="button"':'')+' class="k-row'+(o.sub?' has-sub':'')+'" '+(o.attrs||'')+'><span class="k-row-left">'+prefix+
    '<span class="k-row-text"><span class="k-row-label">'+kEsc(o.label||'')+'</span>'+(o.sub?'<span class="k-row-sub">'+kEsc(o.sub)+'</span>':'')+
    '</span></span><span class="k-row-right">'+suffix+'</span></'+tag+'>';
}

function kGroup(label,rowsHtml){return '<section class="k-group">'+(label?'<div class="k-h2 k-group-label">'+kEsc(label)+'</div>':'')+(rowsHtml||'')+'</section>';}

function kField(label,controlHtml){return '<label class="k-field"><span>'+kEsc(label)+'</span>'+(controlHtml||'')+'</label>';}

function kSwitch(o){
  const value=!o.on;const attrs=o.act?'data-act="'+kEsc(o.act)+'" data-v="'+String(value)+'"': 'data-act="k-set" data-bind-to="'+kEsc(o.bind||'')+'" data-v="'+String(value)+'"';
  return '<button type="button" class="k-switch" role="switch" aria-label="'+kEsc(o.label||'Toggle')+'" aria-checked="'+String(!!o.on)+'" '+attrs+'><span class="k-switch-thumb"></span></button>';
}

function kSeg(o){
  const opts=(o.options||[]).map(x=>{const active=x.v===o.value;const attrs=o.act?'data-act="'+kEsc(o.act)+'"':'data-act="k-set" data-bind-to="'+kEsc(o.bind||'')+'"';
    return '<button type="button" role="button" aria-pressed="'+active+'" '+attrs+' data-v="'+kEsc(x.v)+'">'+(x.icon?icon(x.icon):'')+kEsc(x.label||'')+'</button>';});
  return '<div class="k-seg" role="group" aria-label="Choose one">'+opts.join('')+'</div>';
}

function kChips(o){
  const values=o.multi?(Array.isArray(o.value)?o.value:[]):[o.value];
  return '<div class="k-chips" role="group">'+(o.options||[]).map(x=>{
    const active=values.includes(x.v);const attrs=o.act?'data-act="'+kEsc(o.act)+'"':'data-act="k-set" data-bind-to="'+kEsc(o.bind||'')+'"';
    return '<button type="button" class="k-chip" aria-pressed="'+active+'" '+attrs+' data-multi="'+(o.multi?'1':'0')+'" data-v="'+kEsc(x.v)+'">'+
      (x.dot?'<i class="k-dot" style="--c:'+kSafeColour(x.dot)+'"></i>':'')+(x.icon?icon(x.icon):'')+kEsc(x.label||'')+'</button>';
  }).join('')+'</div>';
}

function kStepper(o){
  const min=Number.isFinite(+o.min)?+o.min:0,max=Number.isFinite(+o.max)?+o.max:99999,step=+o.step||1,val=+o.value||0;
  const bind=o.bind?'data-bind-to="'+kEsc(o.bind)+'"':'data-act-to="'+kEsc(o.act||'')+'"';
  const fmt=typeof o.fmt==='function'?o.fmt(val):typeof o.fmt==='string'?o.fmt.replace('%s',String(val)):String(val);
  return '<div class="k-stepper">'+
    '<button type="button" class="k-step-btn" aria-label="Decrease" title="Decrease" data-act="k-step" data-delta="'+(-step)+'" data-v="'+val+'" data-min="'+min+'" data-max="'+max+'" '+bind+'>'+icon('minus')+'</button>'+
    '<span class="k-step-value">'+kEsc(fmt)+'</span>'+
    '<button type="button" class="k-step-btn" aria-label="Increase" title="Increase" data-act="k-step" data-delta="'+step+'" data-v="'+val+'" data-min="'+min+'" data-max="'+max+'" '+bind+'>'+icon('add')+'</button></div>';
}

function kTime(o){
  const input='<input class="k-input" type="time" aria-label="Time" data-bind="'+kEsc(o.bind||'')+'" value="'+kEsc(o.hm||'')+'">';
  return o.nudge?'<div class="k-stepper">'+kBtn('−5m','data-act="k-nudge-time" data-min="-5" data-bind-to="'+kEsc(o.bind||'')+'"',{kind:'text'})+input+
    kBtn('+5m','data-act="k-nudge-time" data-min="5" data-bind-to="'+kEsc(o.bind||'')+'"',{kind:'text'})+'</div>':input;
}

function kDate(o){return '<input type="date" class="k-input" aria-label="Date" data-bind="'+kEsc(o.bind||'')+'" value="'+kEsc(o.key||'')+'">';}

function kDur(o){
  const presets=o.presets||[15,25,45,60,90];
  return '<div class="k-duration"><input class="k-input" type="number" inputmode="numeric" min="1" aria-label="Minutes" data-bind="'+kEsc(o.bind||'')+'" value="'+kEsc(o.minutes==null?25:o.minutes)+'">'+
    kChips({bind:o.bind,value:o.minutes,options:presets.map(x=>({v:x,label:x+'m'}))})+'</div>';
}

function kText(o){return '<input class="k-input" type="text" enterkeyhint="done" data-bind="'+kEsc(o.bind||'')+'" value="'+kEsc(o.value||'')+'" placeholder="'+kEsc(o.placeholder||'')+'" '+(o.attrs||'')+'>';}

function kArea(o){return '<textarea class="k-textarea" data-bind="'+kEsc(o.bind||'')+'" placeholder="'+kEsc(o.placeholder||'')+'" rows="'+(Math.max(1,Math.min(8,+o.rows||3)))+'">'+kEsc(o.value||'')+'</textarea>';}

function kActPick(o){
  const acts=(typeof ACTS!=='undefined'?ACTS:[]).filter(a=>!a.archived&&((a.kind==='study'&&o.study!==false)||(a.kind!=='study'&&o.life!==false)));
  const item=acts.find(a=>a.id===o.id), options=(o.none?[{v:'',label:'None'}]:[]).concat(acts.map(a=>({v:a.id,label:a.name,dot:a.color})));
  return '<div class="k-act-pick">'+kRow({dot:item&&item.color,label:item?item.name:'Choose activity',right:icon('expand'),attrs:'data-act="k-act-toggle" data-id="'+kEsc(o.bind||'')+'"'} )+
   '<div class="k-act-options" hidden>'+kChips({bind:o.bind,value:o.id,options})+'</div></div>';
}

function kSwatches(o){
  const choices=o.palette||['#3D7EA6','#C2603E','#2F9C8A','#8A63B8','#B8912E','#5B8C3A','#C24E7A','#4F6BD8'];
  return '<div class="k-swatches" role="group" aria-label="Colour">'+choices.map(c=>'<button type="button" class="k-swatch" aria-label="'+kEsc(c)+'" title="'+kEsc(c)+'" aria-pressed="'+(c===o.color)+'" '+(o.act?'data-act="'+kEsc(o.act)+'"':'data-act="k-set" data-bind-to="'+kEsc(o.bind||'')+'"')+' data-v="'+kEsc(c)+'"><i style="--c:'+kSafeColour(c)+'"></i></button>').join('')+'</div>';
}

function kCollapse(id,summaryHtml,bodyHtml){
  const open=!!((typeof UI!=='undefined'&&UI.open||{})[id]);return '<details class="k-collapse" data-k-collapse="'+kEsc(id)+'"'+(open?' open':'')+'><summary>'+summaryHtml+icon('expand')+'</summary><div class="k-collapse-body">'+bodyHtml+'</div></details>';
}

function kEmpty(text,actionHtml){return '<div class="k-empty">'+kEsc(text||'')+(actionHtml?'<div>'+actionHtml+'</div>':'')+'</div>';}

function kSheetHead(title,actionsHtml){return '<header class="k-sheet-head"><span class="k-sheet-title" id="sh-title">'+kEsc(title)+'</span><span class="k-sheet-actions">'+(actionsHtml||'')+kIconBtn('close','Close','data-act="sheet-close"')+'</span></header>';}

function kSheetFoot(html){return '<footer class="k-sheet-foot">'+(html||'')+'</footer>';}

function kPageHead(title,actionsHtml){return '<header class="k-page-head">'+kIconBtn('back','Back','data-act="k-back"')+'<span class="k-page-title">'+kEsc(title)+'</span><span class="k-page-actions">'+(actionsHtml||'')+'</span></header>';}

function kNav(view){
  return '<nav class="k-nav" aria-label="Main navigation">'+[['today','Today'],['plan','Plan'],['stats','Stats'],['settings','Settings']].map(([id,label])=>
    '<button type="button" class="k-nav-item" data-act="view" data-v="'+id+'" aria-current="'+(id===view?'page':'false')+'">'+icon(id)+kEsc(label)+'</button>').join('')+'</nav>';
}

function pushPage(id,params){
  if(typeof PAGES==='undefined'||!PAGES[id]){if(typeof console!=='undefined')console.warn('Unknown page:',id);return false;}
  UI.pages=UI.pages||[];UI.pages.push({id:id,params:params||{}});render();return true;
}

function popPage(){if(!UI.pages||!UI.pages.length)return false;UI.pages.pop();render();return true;}

function openPage(tab,id,params){
  if(typeof PAGES==='undefined'||!PAGES[id]){console.warn('Unknown page:',id);return false;}
  UI.view=tab;UI.pages=[];return pushPage(id,params);
}

function goBack(){
  if(UI.kDialog){const resolve=UI.kDialog.resolve;UI.kDialog=null;kRenderPop();if(resolve)resolve(false);return true;}
  if(UI.kMenu){UI.kMenu=null;kRenderPop();return true;}
  if(UI.sheet){if(typeof closeSheet==='function')closeSheet();else {UI.sheet=null;render();}return true;}
  if(UI.pages&&UI.pages.length)return popPage();
  if(UI.view!=='today'){UI.view='today';render();return true;}
  return false;
}

function kRenderPop(){
  if(typeof document==='undefined')return;
  const pop=document.getElementById('pop');if(!pop)return;
  const menu=UI.kMenu,dialog=UI.kDialog;
  if(dialog){
    pop.innerHTML='<div class="k-dialog-bg" data-act="k-dialog-cancel"><div role="alertdialog" aria-modal="true" class="k-dialog" aria-labelledby="k-dialog-title">'+
      '<h2 id="k-dialog-title">'+kEsc(dialog.title)+'</h2><p>'+kEsc(dialog.text)+'</p><div class="k-dialog-actions">'+
      kBtn('Cancel','data-act="k-dialog-cancel"',{kind:'text'})+kBtn(dialog.ok||'Continue','data-act="k-dialog-ok"',{kind:dialog.danger?'danger':'primary'})+'</div></div></div>';
    const btn=pop.querySelector('[data-act="k-dialog-cancel"].k-btn');if(btn)btn.focus();return;
  }
  if(!menu){pop.innerHTML='';return;}
  const body=menu.items.map((it,i)=>'<button type="button" class="'+(it.danger?'danger':'')+'" data-act="k-menu-item" data-idx="'+i+'">'+(it.icon?icon(it.icon):'')+kEsc(it.label)+'</button>').join('');
  pop.innerHTML='<div class="k-menu" role="menu" style="top:'+menu.top+'px;left:'+menu.left+'px">'+body+'</div>';
}

function openMenu(anchorEl,items){
  if(!anchorEl||typeof document==='undefined')return;
  const rect=anchorEl.getBoundingClientRect(),width=220;UI.kMenu={
    left:Math.max(16,Math.min(rect.right-width,window.innerWidth-width-16)),
    top:Math.min(rect.bottom+4,window.innerHeight-((items||[]).length*44+16)),
    items:(items||[]).filter(x=>!x.danger).concat((items||[]).filter(x=>x.danger))
  };kRenderPop();
}

function confirmDialog(o){
  if(typeof document==='undefined'||!document.getElementById('pop'))return Promise.resolve(false);
  return new Promise(resolve=>{UI.kDialog={title:o.title,text:o.text,ok:o.ok,danger:o.danger,resolve};UI.kMenu=null;kRenderPop();});
}

function kGallery(){
  return '<div class="k-screen"><div class="k-head"><h1 class="k-h1">Kit gallery</h1></div>'+
    '<div class="k-card"><div class="k-h1">64:00</div><div class="k-h2">Timer</div>'+kBtn('Stop','data-act="noop"',{kind:'primary',icon:'stop'})+'</div>'+
    kGroup('Actions',kBtn('Add','data-act="noop"',{icon:'add',kind:'tonal'})+kBtn('Remove','data-act="noop"',{kind:'danger'}))+
    kGroup('Rows',kRow({icon:'timer',label:'Timer',value:'25m',open:true})+kRow({dot:'#3D7EA6',label:'Mathematics',sub:'Today',value:'45m'}))+
    kGroup('Controls',kSwitch({bind:'on',on:true,label:'Notifications'})+kSeg({bind:'cal.view',value:'day',options:[{v:'day',label:'Day'},{v:'week',label:'Week'}]})+
    kChips({bind:'demo',value:'study',options:[{v:'study',label:'Study'},{v:'break',label:'Break'}]})+
    kStepper({bind:'demo',value:25,min:0,max:90,step:5})+kTime({bind:'demo',hm:'08:00'})+kDate({bind:'demo',key:'2026-10-27'})+
    kDur({bind:'demo',minutes:25})+kText({bind:'demo',placeholder:'Note'})+kArea({bind:'demo',placeholder:'Thought'})+
    kActPick({bind:'demo',id:'study',none:true})+kSwatches({bind:'demo',color:'#3D7EA6'})+
    kCollapse('kit-more','More',kField('Note',kText({bind:'demo'})))+
    kEmpty('Nothing yet',kBtn('Add','data-act="noop"',{kind:'text'})))+
    kSheetHead('Sheet preview')+kSheetFoot(kBtn('Save','data-act="noop"',{kind:'primary'}))+
    kPageHead('Page preview')+kNav('settings')+'</div>';
}


/* R0a installs this script after core/state.js; handlers share the shell delegation. */
Object.assign(ACT, {
  'k-set'(el) {
    const bind=el.getAttribute('data-bind-to');
    if(!bind)return;
    let v=el.getAttribute('data-v');
    if(v==='true')v=true; else if(v==='false')v=false;
    else if(/^\\d+(?:\\.\\d+)?$/.test(String(v)))v=+v;
    if(el.getAttribute('data-multi')==='1'){
      const old=bind.split('.').reduce((obj,k)=>obj==null?undefined:obj[k], bind.startsWith('sheet.')?UI:{...UI});
      if(Array.isArray(old))v=old.includes(v)?old.filter(x=>x!==v):old.concat([v]);else v=[v];
    }
    setBind(bind,v);render();
  },
  'k-step'(el){
    const v=Math.max(+el.getAttribute('data-min'),Math.min(+el.getAttribute('data-max'),+el.getAttribute('data-v')+ +el.getAttribute('data-delta')));
    const bind=el.getAttribute('data-bind-to'), act=el.getAttribute('data-act-to');
    if(bind){setBind(bind,v);render();}
    else if(act&&ACT[act])ACT[act]({getAttribute:k=>k==='data-v'?String(v):null});
  },
  'k-nudge-time'(el){
    const bind=el.getAttribute('data-bind-to'),inp=el.parentNode&&el.parentNode.querySelector('input[type="time"]');
    if(!bind||!inp||!/^(\\d{2}):(\\d{2})$/.test(inp.value))return;
    const [h,m]=inp.value.split(':').map(Number),delta=+el.getAttribute('data-min')||0;
    const value=((h*60+m+delta)%1440+1440)%1440;
    setBind(bind,String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0'));render();
  },
  'k-act-toggle'(el){const list=el.parentNode&&el.parentNode.querySelector('.k-act-options');if(list){list.hidden=!list.hidden;}},
  'k-back'(){goBack();},
  'k-menu-close'(){UI.kMenu=null;kRenderPop();},
  'k-menu-item'(el){
    const menu=UI.kMenu, item=menu&&menu.items[+el.getAttribute('data-idx')];
    UI.kMenu=null;kRenderPop();
    if(!item)return;
    if(item.act&&ACT[item.act]){const fake=document.createElement('button');fake.setAttribute('data-act',item.act);
      const holder=document.createElement('div');holder.innerHTML='<button '+(item.attrs||'')+'></button>';
      const target=holder.firstChild||fake; ACT[item.act](target);}
  },
  'k-dialog-cancel'(_el,e){
    if(e&&e.target.closest('.k-dialog')&&e.target.classList.contains('k-dialog-bg'))return;
    const d=UI.kDialog;UI.kDialog=null;kRenderPop();if(d)d.resolve(false);
  },
  'k-dialog-ok'(){
    const d=UI.kDialog;UI.kDialog=null;kRenderPop();if(d)d.resolve(true);
  }
});
if(typeof PAGES!=='undefined')PAGES.kit={title:()=> 'Kit gallery',render:()=>kGallery(),actions:()=>''};
if(typeof document!=='undefined'){
  document.addEventListener('toggle', e=>{const el=e.target;if(!el||!el.dataset||!el.dataset.kCollapse)return;
    UI.open=UI.open||{};UI.open[el.dataset.kCollapse]=el.open;
  }, true);
  document.addEventListener('pointerdown', e=>{
    const el=e.target.closest&&e.target.closest('[data-long]');
    if(!el||e.button!==0)return;
    const x=e.clientX,y=e.clientY,action=el.dataset.long;
    const cleanup=()=>{
      clearTimeout(timer);document.removeEventListener('pointermove',move,true);
      document.removeEventListener('pointerup',cleanup,true);document.removeEventListener('pointercancel',cleanup,true);
    };
    const move=ev=>{if(Math.hypot(ev.clientX-x,ev.clientY-y)>8)cleanup();};
    const timer=setTimeout(()=>{cleanup();if(ACT[action]){ACT[action](el);el.dataset.kLongFired='1';
      if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(8);}},450);
    document.addEventListener('pointermove',move,true);
    document.addEventListener('pointerup',cleanup,true);
    document.addEventListener('pointercancel',cleanup,true);
  },true);
  document.addEventListener('click', e=>{
    const el=e.target.closest&&e.target.closest('[data-long]');
    if(el&&el.dataset.kLongFired==='1'){delete el.dataset.kLongFired;e.preventDefault();e.stopImmediatePropagation();}
    const pop=document.getElementById('pop');
    if(UI.kMenu&&pop&&!e.target.closest('.k-menu')&&!e.target.closest('[data-act="k-menu-open"]')){
      UI.kMenu=null;kRenderPop();
    }
  },true);
}
