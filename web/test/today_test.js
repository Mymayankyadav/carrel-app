// Today/timer UI regressions. Run: TZ=Asia/Kolkata node web/test/today_test.js
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const app = require('./src').app;
const css = require('./src').css;
const cal = fs.readFileSync(path.join(__dirname, '../cal.js'), 'utf8');
const todaySource = fs.readFileSync(path.join(__dirname, '../ui/today.js'), 'utf8');
// Extract a single top-level renderer, never the view-registry statements that
// follow the last renderer after the R0a file split.
const fn = (name, next) => {
  const a = todaySource.indexOf('function ' + name + '(');
  assert(a >= 0, name + ' renderer exists');
  const nextMatch = /^function [A-Za-z_$]/gm;
  nextMatch.lastIndex = a + 9;
  const m = nextMatch.exec(todaySource);
  const explicit = todaySource.indexOf('function ' + next + '(', a + 9);
  const registration = todaySource.indexOf('\nVIEWS.', a);
  const ends = [m && m.index, explicit, registration]
    .filter(x => Number.isInteger(x) && x > a);
  const b = ends.length ? Math.min(...ends) : todaySource.length;
  return todaySource.slice(a, b);
};
const clean = s => String(s).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));

// Toggle preferences are persisted by the capture listener and used during render.
const values = new Map();
const doc = { event: null, addEventListener(type, callback, capture) { if (type === 'toggle') this.event = { callback, capture }; } };
const foldCtx = {store: {
  get: k => values.has(k) ? values.get(k) : null,
  set: (k,v) => values.set(k,v)
}, document:doc};
const fold = vm.runInNewContext(fn('todayFold','vToday') + '\ntodayFold',foldCtx);
assert(fold('log','<p>items</p>').includes('data-fold="log" open'), 'log starts open');
assert(!fold('breakdown','<p>stats</p>').includes('data-fold="breakdown" open'), 'breakdown starts closed');
assert(doc.event && doc.event.capture === true, 'toggle captured on details');
doc.event.callback({target:{matches:s=>s==='details.fold',dataset:{fold:'log'},open:false}});
assert.equal(values.get('fold:log'),0);
assert(!fold('log','').includes('data-fold="log" open'), 'closed Log remains closed after render');
doc.event.callback({target:{matches:s=>s==='details.fold',dataset:{fold:'breakdown'},open:true}});
assert.equal(values.get('fold:breakdown'),1);
assert(fold('breakdown','').includes('data-fold="breakdown" open'), 'breakdown reopens on return');
assert(fold('log','').includes('data-key="today-fold:log"'), 'fold keyed for DOM morph');

const ring = vm.runInNewContext(fn('vRing','vTimer') + '\nvRing',{
  Date:{now:()=>5000}, clamp:(x,a,b)=>Math.max(a,Math.min(b,x)), Math
});
const r50=ring({ps:0,len:10000,left:5000},'#333');
assert(r50.includes('role="progressbar"') && r50.includes('aria-valuenow="50"'), 'ring exposes 50%');
assert(r50.includes('aria-valuemin="0"') && r50.includes('aria-valuemax="100"'), 'ring exposes bounds');
assert(!r50.includes('aria-hidden="true"'), 'ring readable by assistive tech');
assert(ring({ps:0,len:10000,left:-1},'#333').includes('aria-valuenow="50"'), 'ring progress is bounded and computed at render');

const base = {
  CUR:{activity:'math',start:'2026-10-27T16:00:00+05:30',id:'e1',block:'b1',note:'Chapter 3 proofs'},
  S:{db:null,loaded:{current:true}},
  ACTMAP:{math:{name:'Mathematics'}},
  act:()=>({name:'Mathematics',color:'#123456',role:''}),parseT:()=>1000,
  pomoState:()=>null, guardInfo:()=>null, fmtClock:()=> '1:00',
  fmtDur:()=> '1h',fmtEl:()=> '15m',fmtT:()=> '4pm', dayKeyOf:()=> '2026-10-27',
  todayKey:()=> '2026-10-27', shortDay:k=>k,fmtDur:()=> '1h',
  UI:{guardOpen:false},vNoticeBar:()=>'',vGuardFix:()=>'',vRing:()=>'',vTimerIdle:()=> '',
  icon:()=>'', esc:clean,fmtClock:()=> '1:00',Math
};
const renderTimer = obj => vm.runInNewContext(fn('vTimer','noticeOpen')+'\nvTimer',{...base,...obj})(5000,{
  activeId:'b1',rows:[{id:'b1',title:'Chapter 3 proofs',done:1800000,target:7200000}]
});
const dedup=renderTimer({});
assert(dedup.includes('Chapter 3 proofs'), 'block title in timer metadata');
assert(!dedup.includes('id="cur-note"'), 'duplicate note line hidden');
const withNote=renderTimer({CUR:{...base.CUR,note:'Try the induction step'}});
assert(withNote.includes('id="cur-note"'), 'distinct session note remains editable');
const emptyNote=renderTimer({CUR:{...base.CUR,note:''}});
assert(emptyNote.includes('id="cur-note"'), 'empty note remains available for editing');

const notice = vm.runInNewContext(fn('vNoticeBar','backText') + '\nvNoticeBar', {
  CUR:{activity:'math'}, UI:{back:null,notice:null,parkText:''},noticeOpen:()=>false,
  esc:clean,Date
})();
assert(notice.includes('Noticed <kbd class="kbd">X</kbd>'), 'X uses desktop-only shortcut style');
assert(notice.includes('aria-label="Noticed an urge (shortcut X)"'), 'noticed has spoken action');

const sw = vm.runInNewContext(fn('vSwitcher','planDisplayRows') + '\nvSwitcher',{
  ACTS:[{id:'math',name:'Mathematics',kind:'study',color:'#aabbcc'},
        {id:'sleep',name:'Sleep',kind:'life',color:'#ccddee'}],
  CUR:{activity:'math'},UI:{from:'now',pomoPreset:'25/5'},
  CFG:{pomodoro:{focus:25,short:5}},PRESETS:{'25/5':{}},
  MIN:60000,HOUR:3600000,presetLabel:()=> '25/5',
  lastEntry:()=>null,pomoShown:()=>false,fmtDur:()=> '10m',fmtT:()=> '4pm',esc:clean,
  icon:()=>''
})(0,{acts:{}});
assert(sw.includes('class="act on"'), 'active study activity highlighted');
assert(sw.includes('data-id="math" aria-pressed="true"'), 'running activity pressed');
assert(sw.includes('data-id="sleep" aria-pressed="false"'), 'other activity explicitly not pressed');

const vToday = vm.runInNewContext(fn('vToday','vNoActs') + '\nvToday',{
  Date:{now:()=>5000}, UI:{date:null},
  S:{loaded:{activities:true}}, ACTS:[{id:'math'}], ENTRIES:[], todayKey:()=> '2026-10-27',
  aggregate:()=>({ '2026-10-27':{acts:{},study:0,all:0} }),
  planModelFor:()=>null, pomodoroByDay:()=>({}),fmtDur:()=> '0m',
  stampText:()=> 'Oct 27',icon:()=> '',esc:clean,
  vOnboard:()=> '',vTimer:()=>'<div>timer</div>',vParking:()=>'',vSwitcher:()=>'',vPlan:()=>'',vLog:()=>'<section>log</section>',
  vBreakdown:()=>'<section>breakdown</section>',vDeadlineChips:()=>'<div class="dlc">deadlines</div>',
  todayFold:fold
});
const todayHtml=vToday();
assert(todayHtml.includes('data-fold="log"') && todayHtml.includes('data-fold="breakdown"'), 'Today wraps both lower sections');
assert(todayHtml.includes('<div class="dlc">deadlines</div>'), 'deadline strip retained');
assert(css.includes('.dayhead + .dlc{display:flex;flex-wrap:nowrap;overflow-x:auto'), 'deadlines one scrollable row');
assert(css.includes('.dayhead + .dlc > button{flex:none'), 'chips never shrink to several rows');
assert(css.includes('details.fold') === false || css.includes('.fold > summary'), 'native fold summary styling present');
assert(css.includes('@media (pointer:fine) and (min-width:860px){.kbd{display:inline-block}}'), 'shortcut hidden on touch devices');
assert(fs.readFileSync(path.join(__dirname, '../ui/tasks.js'), 'utf8').includes('function vDeadlineChips(tk)'), 'tasks module supplies deadline chips');
console.log('TODAY TESTS PASSED');
