// T1 minimalist Today regressions; no mocked Supabase or production writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../ui/today.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/today.css'),'utf8');
const marker='/* T1 — minimalist Today view;';
assert(js.includes(marker),'T1 view source present');
const code=js.slice(js.indexOf(marker)),MIN=60000,HOUR=3600000,now=Date.now();
const ACT={},VIEWS={},calls=[];
const UI={lastRate:null,notice:null,back:null,guardTime:'',desk:false};
const S={loaded:{activities:true}};
const A={
  maths:{id:'maths',name:'Mathematics',color:'#3D7EA6',kind:'study',archived:false},
  chem:{id:'chem',name:'Chemistry',color:'#2F9C8A',kind:'study',archived:false},
  break:{id:'break',name:'Break',color:'#B8912E',kind:'life',role:'break',archived:false}
};
const ACTS=Object.values(A);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pm={rows:[{id:'b1',title:'A proof',activity:'maths',remaining:45*MIN,st:'open',pieces:[[now+10*MIN,now+55*MIN]],at:null}],over:10*MIN};
const base={
  ACT,VIEWS,UI,S,ACTS,ENTRIES:[],Math,Date,MIN,HOUR,
  CUR:null,
  act:id=>A[id]||A.maths,isStudyId:id=>id==='maths'||id==='chem',
  aggregate:()=>({'2026-10-27':{study:90*MIN}}),
  todayKey:()=> '2026-10-27',stampText:()=> 'Tue 27 Oct',
  fmtDur:x=>Math.round(x/MIN)+'m',fmtT:()=> '7:10 pm',
  fmtClock:()=> '5:55',fmtEl:()=> '5m',
  parseT:()=>now-5*MIN,fmtClock:()=> '5:55',
  kSafeColour:x=>x,kEmpty:x=>x,
  esc,icon:x=>'<svg>'+x+'</svg>',
  kBtn:(title,attrs)=>'<button '+attrs+'>'+title+'</button>',
  kIconBtn:(name,label,attrs)=>'<button '+attrs+' aria-label="'+label+'"></button>',
  planModelFor:()=>pm,vSyncLine:()=> '',
  lastEntry:()=>({a:'break',e:now-2*MIN}),lastStudy:()=>({a:'maths',e:now-30*MIN}),
  ACTMAP:A,startActivity:id=>calls.push(['resume',id]),pomoState:()=>null,guardInfo:()=>null,
  noticeOpen:()=>false,parkedItems:()=>[],
  w1NeedsSetup:()=>false,w1FirstRun:()=>'<main>First run</main>',
  pushPage:(id,params)=>calls.push(['page',id,params]),
  W:()=>({day:(k,v)=>calls.push(['day',k,v])}),
  commit:()=>calls.push('commit'),
  setTimeout:()=>{},render:()=>{},
  planFocus:(k,id)=>calls.push(['plan',k,id]),
  openSheet:sh=>calls.push(['sheet',sh]),
  msToHm:()=> '14:00',clamp:(x,a,b)=>Math.max(a,Math.min(b,x))
};
vm.createContext(base);
vm.runInContext(code,base,{filename:'today-t1.js'});
assert.equal(typeof VIEWS.today,'function');
let html=VIEWS.today();
assert(html.includes('t1-today')&&html.includes('90m')&&html.includes('t1-timer'));
assert(html.includes('Not tracking')&&html.includes('Resume Mathematics'));
assert.equal((html.match(/data-id="maths"/g)||[]).length,1,'idle study appears once, in its tile');
assert(html.includes('data-act="t1-resume-study"'));
ACT['t1-resume-study']({getAttribute:()=> 'maths'});
assert.equal(calls.at(-1)[0],'resume');
assert(html.includes('data-act="t1-log"')&&html.includes('data-long="t2-start-opts"'));
assert(html.includes('data-act="t1-plan-focus"')&&html.includes('data-act="t1-fit"'));
assert(!html.includes('Timeline')&&!html.includes('Where the day went')&&!html.includes('Untracked since'));
assert(!html.includes('day-pick')&&!html.includes('pomo-preset'));
ACT['t1-log']();assert.equal(calls.at(-1)[1],'log');
ACT['t1-plan-focus']({getAttribute:k=>k==='data-k'?'2026-10-27':'b1'});
assert.equal(calls.at(-1)[0],'plan');
ACT['t1-fit']();assert.equal(calls.at(-1)[1].type,'fit');
ACT['t1-activities']();assert.equal(calls.at(-1)[1].type,'activities');
ACT['t1-park']();assert.equal(calls.at(-1)[1].type,'park');
ACT['t1-parked']();assert.equal(calls.at(-1)[1].type,'parked');
base.CUR={activity:'chem',start:now-5*MIN,id:'run1',block:'b1',note:''};
base.pomoState=()=>({left:19*MIN,phase:'focus',ps:now-6*MIN,len:25*MIN,end:now+19*MIN,cycle:2,every:4});
html=VIEWS.today();
assert(html.includes('Focus 2 of 4')&&html.includes('t1-progress'));
assert(html.includes('data-act="stop"')&&html.includes('data-act="break"'));
assert(html.includes('data-act="notice"')&&!html.includes('class="t1-tiles"'));
assert(html.includes('data-act="edit-running"')&&html.includes('data-act="desk"'));
base.pomoState=()=>({left:-MIN,phase:'focus',ps:now-26*MIN,len:25*MIN,end:now-MIN,cycle:2,every:4});
html=VIEWS.today();
assert(html.includes('Break time')&&html.includes('data-act="break"'));
base.CUR={activity:'break',start:now-5*MIN,ret:{activity:'maths'}};
base.pomoState=()=>null;
html=VIEWS.today();
assert(html.includes('data-act="back"')&&!html.includes('data-act="notice"'));
base.CUR={activity:'chem',start:now-5*MIN,id:'run1'};
base.guardInfo=()=>({ran:4*HOUR});
html=VIEWS.today();
assert(html.includes('Still going')&&html.includes('data-act="t1-fixstop"'));
ACT['t1-fixstop']();assert.equal(calls.at(-1)[1].type,'fixstop');
base.CUR=null;base.guardInfo=()=>null;UI.lastRate={day:'2026-10-27',id:'focus1'};
html=VIEWS.today();
assert(html.includes('Focus?') && html.includes('aria-label="Scattered"') &&
  html.includes('aria-label="Deep"'),'quick focus rating appears after stopping');
ACT['t1-rate']({getAttribute:()=> '3'});
assert(calls.some(x=>Array.isArray(x)&&x[0]==='day'&&x[2].focus1.focus===3));
assert(UI.lastRate===null && UI.t1RateDoneUntil>0,'rating is one tap and closes prompt');
assert(css.includes('.t1-today')&&css.includes('.t1-tiles')&&css.includes('.t1-next-row'));
assert(css.includes('min-height:44px')&&css.includes('var(--surface)'));
console.log('T1 TODAY TESTS PASSED');
