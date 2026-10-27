// A4 Calendar UI regressions. Run: TZ=Asia/Kolkata node web/test/calendar_test.js
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const logic = require('../logic.js');
const cal = fs.readFileSync(path.join(__dirname, '../cal.js'), 'utf8');
const gcal = fs.readFileSync(path.join(__dirname, '../gcal.js'), 'utf8');
const css = require('./src').css;
const MIN = 60000, HOUR=3600000;
const esc = v => String(v).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function between(code, a, b) {
  const i=code.indexOf(a), j=code.indexOf(b,i+a.length);
  assert(i>=0 && j>i, 'has ' + a + ' and ' + b);
  return code.slice(i,j);
}
function func(code, start, next, name, vars) {
  return vm.runInNewContext(between(code,'function '+start+'(','function '+next+'(')+'\n'+start, vars);
}

// C1: a new calendar defaults to Day on phones and preserves a stored choice.
const calViewSource = between(cal,'function calView(', 'function calDays(');
const view = width => {
  const UI={cal:{view:null}}, window={innerWidth:width};
  const choose=vm.runInNewContext(calViewSource+'\ncalView',{UI,window});
  return {UI,choose};
};
const phone=view(390);
assert.equal(phone.choose(),'day', '390px defaults to Day');
phone.UI.cal.view='3day';assert.equal(phone.choose(),'3day','existing user choice wins');
assert.equal(view(479).choose(),'day','narrow breakpoint');
assert.equal(view(480).choose(),'3day','tablet defaults to three days');
assert.equal(view(900).choose(),'week','desktop keeps week default');
assert(cal.includes("store.set('calView', UI.cal.view)"),'explicit calendar choices persist');

// C2: three-way overlap, tiny screen and full accessible names.
const it1={s:100,e:300},it2={s:120,e:260},it3={s:140,e:250};
logic.layoutOverlaps([it1,it2,it3]);
assert.equal(it1.ncol,3);assert.equal(it2.ncol,3);assert.equal(it3.ncol,3);
const env={window:{innerWidth:390},UI:{cal:{view:'day'}},HPX:52,
  fmtT: t=>String(t),fmtDur: t=>String(t),ACTMAP:{},icon:()=>'*',
  esc,act:()=>({name:'Mathematics',color:'#225588'})};
const calItem=vm.runInNewContext(between(cal,'function calItem(', '/* ---------- side panels ---------- */')+'\ncalItem',env);
const yt=t=>t / MIN;
let html=calItem({kind:'busy',s:100,e:3600100,ncol:3,z:{id:'z',title:'Chemistry seminar with a very long name',rec:true}},
  '2026-10-27',yt,0,33.33);
assert(html.includes('ce-narrow'),'three-way overlap receives narrow style');
assert(html.includes('aria-label="Busy: Chemistry seminar with a very long name'),'busy title accessible');
html=calItem({kind:'blk',s:100,e:3600100,ncol:3,r:{
  id:'b',activity:'math',at:'',late:false,st:'open',
  title:'Proof of a complicated theorem',clash:false
 },piece:0,last:true},'2026-10-27',yt,0,33.33);
assert(html.includes('ce-narrow'),'plan item receives narrow style');
assert(html.includes('aria-label="Planned Mathematics: Proof of a complicated theorem'),'full plan title accessible');
env.UI.cal.view='3day';
html=calItem({kind:'log',s:100,e:3600100,ncol:1,en:{id:'e',a:'math',s:100,e:3600100}},
  '2026-10-27',yt,0,100);
assert(html.includes('ce-narrow'),'single lane in mobile 3-day calendar is treated as narrow');
assert(html.includes('aria-label="Logged Mathematics'),'log activity accessible');
assert(css.includes('.ce-narrow .t{display:block;writing-mode:horizontal-tb'),'narrow title wraps horizontally');
assert(css.includes('.ce-narrow .m{display:none}'),'narrow card hides metadata');

// C3: bottom hours can scroll past floating button.
assert(css.includes('.cv-scroll{padding-bottom:80px;scroll-padding-bottom:80px}'),'calendar scrolls beyond last hour');
assert(css.includes('bottom:calc(62px + 16px + env(safe-area-inset-bottom,0px))'),'FAB sits above navigation and safe area');

// C4: over-capacity language includes an explanatory tooltip.
const k='2026-10-27';
const makeHead=(need,free)=>func(cal,'vCalHead','vCalCol','vCalHead',{
  dayCapacity:()=>({need,free}), V:{plans:{}},busyIv:()=>[],
  dateOfKey:()=>new Date(2026,9,27), longDay:()=> 'Tue 27 Oct',
  wdName:()=> 'Tue',fmtDur:m=> Math.round(m/MIN)+'m',esc,
  deadlineList:()=>[],gcAllDay:()=>[],icon:()=>'',dayKeyOf:()=>k,
  aggregate:()=>({}),ENTRIES:[],MIN
})(k,0,k,{pm:{remaining:need}});
assert(makeHead(81*MIN,60*MIN).includes('21m over'),'shortened over-capacity text');
assert(makeHead(81*MIN,60*MIN).includes('Planned 21m more than the free time today'),'over-capacity tooltip');
assert(!makeHead(40*MIN,60*MIN).includes('21m over'),'free day is not styled as over');

// C5: stale timestamp alone controls suggestion; don't label fresh data as old.
const now=Date.parse('2026-10-27T17:00:00+05:30');
function panel(ageMin,status='ok'){
  const GC={status,at:now-ageMin*MIN,events:[],msg:''};
  return vm.runInNewContext(between(gcal,'function vGcalPanel(', 'Object.assign(ACT,')+'\nvGcalPanel',{
    S:{mcp:{}},GC,MIN,Date:{now:()=>now},fmtT:()=> '4:30 pm',
    todayKey:()=> '2026-10-27',esc
  })();
}
assert(panel(29).includes('Updated 4:30 pm.'),'recent refresh unchanged');
assert(!panel(30).includes('tap Refresh to sync'),'exactly 30 minutes is fresh');
assert(panel(31).includes('Updated 4:30 pm · tap Refresh to sync.'),'over 30 minutes suggests syncing');
assert(!panel(31,'stale').includes('Updated '),'failed refresh uses existing stale message');
console.log('CALENDAR TESTS PASSED');
