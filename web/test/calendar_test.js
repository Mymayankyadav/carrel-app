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

// P1: Day is the default everywhere; stored Week wins. The three-day mode is gone.
const calViewSource=between(cal,'function calView(', 'function calDays(');
const view=width=>{
  const UI={cal:{view:null}},window={innerWidth:width};
  const choose=vm.runInNewContext(calViewSource+'\ncalView',{UI,window});
  return {UI,choose};
};
const phone=view(390);
assert.equal(phone.choose(),'day','390px defaults to Day');
phone.UI.cal.view='week';assert.equal(phone.choose(),'week','explicit Week choice wins');
phone.UI.cal.view='3day';assert.equal(phone.choose(),'day','old three-day preference migrates to Day');
assert.equal(view(480).choose(),'day','tablet defaults to Day');
assert.equal(view(900).choose(),'day','wide default remains Day');
assert(cal.includes("store.set('calView', UI.cal.view)"),'explicit calendar choices persist');

// C2: three-way overlap, tiny screen and full accessible names.
const it1={s:100,e:300},it2={s:120,e:260},it3={s:140,e:250};
logic.layoutOverlaps([it1,it2,it3]);
assert.equal(it1.ncol,3);assert.equal(it2.ncol,3);assert.equal(it3.ncol,3);
const env={window:{innerWidth:390},UI:{cal:{view:'day'}},HPX:56,
  calView:()=>env.UI.cal.view,kSafeColour:s=>s,
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
env.UI.cal.view='week';
html=calItem({kind:'log',s:100,e:3600100,ncol:1,en:{id:'e',a:'math',s:100,e:3600100}},
  '2026-10-27',yt,0,100);
assert(html.includes('ce-narrow'),'single lane in mobile Week calendar is treated as narrow');
assert(html.includes('aria-label="Logged Mathematics'),'log activity accessible');
assert(css.includes('.ce-narrow .t{display:block;writing-mode:horizontal-tb'),'narrow title wraps horizontally');
assert(css.includes('.ce-narrow .m{display:none}'),'narrow card hides metadata');

// P1: quiet calendar, a floating new-item control and Day-specific headers.
assert(css.includes('.p1-plan .cv-scroll'),'calendar uses a bounded timeline viewport');
assert(css.includes('.p1-fab{position:fixed'),'FAB follows the viewport');
assert(css.includes('bottom:calc(80px + env(safe-area-inset-bottom,0px))'),'FAB clears the mobile nav');
const k='2026-10-27';
const makeHead=()=>func(cal,'vCalHead','vCalCol','vCalHead',{
  dateOfKey:()=>new Date(2026,9,27),longDay:()=> 'Tue 27 Oct',
  wdName:()=> 'Tue',esc
})(k,0,k,{pm:{remaining:MIN}});
const head=makeHead();
assert(head.includes('data-act="p1-day"'),'weekday header opens Day view');
assert(!head.includes('spare')&&!head.includes('over'),'day capacity copy moved to Fit row');
assert(cal.includes('data-act="p2-open-fit"'),'overflow opens P2 Does not fit sheet');
assert(cal.includes("data-act=\"p1-open-tasks\""),'Tasks button on Plan header');
assert(cal.includes('function planFocus(k,id)'),'Plan implements shared focus contract');

console.log('CALENDAR TESTS PASSED');
