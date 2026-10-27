// A5 Patterns and Week regressions. Run: TZ=Asia/Kolkata node web/test/patterns_test.js
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const L = require('../logic.js');
const { CTX, MIN, HOUR } = L;
CTX.cfg = { dayStart: '04:00', planStart: '08:00', planEnd: '22:30', gap: 10, dailyGoal: 60, weekStart: 1 };
CTX.act = id => ({ id, kind: id === 'math' ? 'study' : 'life',
  role: id === 'phone' ? 'drift' : id === 'sleep' ? 'sleep' : '',
  color: '#123456' }); // Intentionally omit "name" to test defensive insight fallback.
const T = s => Date.parse(s + '+05:30');
const now = T('2026-10-27T21:00:00');
const iso = (s, d = '2026-10-26') => T(d + 'T' + s);
const entry = (id, day, hour, act = 'math') => ({
  id, a: act, s: T(day + 'T' + hour + ':00'),
  e: T(day + 'T' + String(Number(hour.slice(0, 2)) + 1).padStart(2, '0') + hour.slice(2) + ':00'),
  focus: null, block: null, running: false
});
const two = [entry('1','2026-10-25','08:00'), entry('2','2026-10-26','08:00')];
const pm2 = L.patternsModel(two, now, 4);
assert.equal(pm2.studyDays, 2, 'two distinct logged study days');
assert.equal(pm2.daysWithData, 2, 'two distinct days containing data');
const seven = Array.from({length:7},(_,i)=>entry(String(i), L.addDaysKey('2026-10-20',i),'09:00'));
const pm7 = L.patternsModel(seven, now, 4);
assert.equal(pm7.studyDays, 7, 'threshold counts distinct days, not hours or sessions');

const app = require('./src').app;
const css = require('./src').css;
function section(name, after) {
  const i=app.indexOf('function '+name+'('), j=app.indexOf('function '+after+'(',i);
  assert(i >= 0 && j > i, 'found function '+name);
  return app.slice(i,j);
}
const context = { esc: s=>String(s), MIN, HOUR,
  fmtDur: ms=>Math.round(ms/MIN)+'m',
  fmtT: ms=>String(ms), fmtHourL: h=>String(h),
  fmtHourS: h=>String(h), rowWeekday:()=> 'Mon', weekdayOfKey:()=> 1,
  longDay:k=>k, dateOfKey:L.dateOfKey, dayKeyOf:L.dayKeyOf,
  addDaysKey:L.addDaysKey, weekStartKey:L.weekStartKey,
  todayKey:()=> '2026-10-27',
  CFG:{ weekStart:1 }, V:{reviews:[]},
  icon:()=>'', parseT:()=>0, shortDay:k=>k
};
const v = vm.createContext(context);
const pending = vm.runInContext(section('patternsPending','heatColor')+'\npatternsPending',v);
assert.match(pending(pm2,'When you study'),/Needs 5 more days of study logs/);
assert.match(pending({...pm2,studyDays:6},'When you study'),/Needs 1 more day of study logs/);
assert.equal(pending(pm7,'When you study'),'');
for(const [fn,next,title] of [
 ['vHeat','vCal','When you study'],['vCal','vHist','Consistency'],
 ['vHist','vMix','How long you stay with it'],['vMix','vSpans','Subjects by week'],
 ['vSpans','vFocusHours','Study hours of each day'],['vFocusHours','vSheet','Focus by hour']
]) {
  const func = vm.runInContext(section(fn,next)+'\n'+fn,vm.createContext({...context,patternsPending:pending}));
  const html = fn==='vCal'?func(pm2,pm2.tk):func(pm2);
  assert(html.includes('Needs 5 more days of study logs'), fn+' shows small-data state');
  assert(html.includes(title), fn+' retains card title');
}
assert(css.includes('.abar.wide .an span')&&css.includes('white-space:normal'), 'Week life labels wrap');

const insData = L.patternsModel([
 ...seven,
 ...Array.from({length:5},(_,i)=>entry('phone-'+i,L.addDaysKey('2026-10-20',i),'17:00','phone'))
],now,4);
const ins = L.insights(insData,h=>String(h), {weekday:i=>String(i),minuteOfDay:m=>String(m)},null);
const drift = ins.find(x=>x.k==='drift');
assert(drift && drift.text.startsWith('phone takes'), 'fallback to activity id rather than undefined');
assert(ins.every(x=>!/\bundefined\b/.test(x.text)), 'all insight text excludes undefined');

// Weekly review prompts appear on Friday onward; previously written reviews always render.
const review = vm.runInContext(section('vReview','patternsPending')+'\nvReview',v);
assert(review('2026-10-26',false).includes('appears on Friday'), 'Tuesday hides review copy prompt');
assert(!review('2026-10-26',false).includes('data-act="copy"'), 'Tuesday no premature review prompt');
assert(review('2026-10-19',false).includes('Copy prompt'), 'past week offers review prompt');
v.CFG.weekStart=0; v.todayKey=()=> '2026-10-30';
v.V.reviews=[];
assert(review('2026-10-25',false).includes('Copy prompt'), 'Friday works for Sunday-first calendars');
assert(review('2026-10-25',false).includes('ask Claude'), 'review copy remains usable');

// Sleep summary remains editable and removes the full-height overnight block.
const appTimeline = section('vTimeline','vList');
const dates = {
 sleep: {id:'sleep', a:'sleep', s:T('2026-10-25T23:00:00'), e:T('2026-10-26T07:05:00')},
 maths: {id:'maths', a:'math', s:T('2026-10-26T10:00:00'), e:T('2026-10-26T19:00:00')}
};
const timelineCtx = {...context,
  act: id => ({name:id==='sleep'?'Sleep':'Mathematics',role:id==='sleep'?'sleep':'',color:'#123456'}),
  entryEnd: en=>en.e, todayKey:()=> '2026-10-27', floorLocal:ms=>Math.floor(ms/HOUR)*HOUR,
  ceilLocal:ms=>Math.ceil(ms/HOUR)*HOUR, clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
  H12:false, gapsOf:()=>[], fmtHourS:h=>String(h),
  fmtT:ms=>String(new Date(ms).getHours()),
  busyOf:()=>[]
};
const timeline=vm.runInContext(appTimeline+'\nvTimeline',vm.createContext(timelineCtx));
const dayStart=T('2026-10-26T04:00:00'), dayEnd=T('2026-10-27T04:00:00');
const html=timeline('2026-10-26',[dates.sleep,dates.maths],now,dayStart,dayEnd,false,null);
assert(html.includes('tl-sleep-summary') && html.includes('data-id="sleep"'), 'sleep summary visible and editable');
assert(html.includes('data-id="maths"'), 'later study entry stays editable');
assert(!html.includes('class="tl-e " style="') || !html.includes('data-id="sleep" aria-label='), 'sleep not rendered as full-height timeline event');
assert(css.includes('.tl-sleep-summary'), 'sleep summary styled');
assert(app.includes('a5-chart-summary') && app.includes('Study by day: '), 'weekly chart has accessible text summary');
assert(app.includes('role="img" aria-label="Average study by weekday and hour'), 'heat chart has accessible summary');
console.log('PATTERNS TESTS PASSED');
