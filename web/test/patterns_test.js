// S1 Stats and existing math logic regression checks.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const L=require('../logic.js');
const {CTX,MIN,HOUR}=L;
CTX.cfg={dayStart:'04:00',planStart:'08:00',planEnd:'22:30',gap:10,dailyGoal:60,weekStart:1};
CTX.act=id=>({id,kind:id==='math'?'study':'life',role:id==='phone'?'drift':'',color:'#123456'});
const T=s=>Date.parse(s+'+05:30');
const day='2026-10-26';
const ent=(id,k,h,a='math')=>({id,a,s:T(k+'T'+h+':00'),e:T(k+'T'+String(+h.slice(0,2)+1).padStart(2,'0')+h.slice(2)+':00'),focus:null,block:null,running:false});
const a=[ent('a',day,'09:00'),ent('b','2026-10-25','09:00')];
const pm=L.patternsModel(a,T('2026-10-27T21:00:00'),4);
assert.equal(pm.studyDays,2);assert.equal(pm.daysWithData,2);
const seven=Array.from({length:7},(_,i)=>ent(String(i),L.addDaysKey('2026-10-20',i),'09:00'));
assert.equal(L.patternsModel(seven,T('2026-10-27T21:00:00'),4).studyDays,7);
const stats=fs.readFileSync(path.join(__dirname,'../ui/stats.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/stats.css'),'utf8');
const ACT={},VIEWS={},UI={weekOff:0,s1Range:'week'};
const PAGES={'stats.subject':{},'stats.patterns':{},'stats.insights':{}};
const calls=[],ACTS=[{id:'math',name:'Mathematics',kind:'study',color:'#345678',order:1,goal:120}];
const env={
 ACT,VIEWS,PAGES,UI,ACTS,ACTMAP:{math:ACTS[0]},
 MIN,HOUR,ENTRIES:seven,CFG:{weekStart:1,dailyGoal:60},Date,Math,Object,
 todayKey:()=> '2026-10-27',weekStartKey:()=> '2026-10-26',
 dateOfKey:L.dateOfKey,weekdayOfKey:L.weekdayOfKey,addDaysKey:L.addDaysKey,
 rowWeekday:()=> 'Monday',DF:()=>({format:()=> 'Oct'}),shortDay:k=>k,longDay:k=>k,
 ensureRange:()=>{},aggregate:()=>({'2026-10-26':{acts:{math:2*HOUR},study:2*HOUR}}),
 isStudyId:id=>id==='math',act:()=>ACTS[0],kSafeColour:s=>s,
 fmtDur:v=>Math.round(v/MIN)+'m',esc:s=>String(s),icon:()=>'<svg></svg>',
 kEmpty:s=>s,kIconBtn:(_ic,label,attrs)=>'<button '+attrs+'>'+label+'</button>',
 kSeg:()=>'<div class="segment">Week Month</div>',
 kRow:o=>'<button '+(o.attrs||'')+'>'+o.label+'</button>',kGroup:(l,rows)=>l+rows,
 pushPage:(id,p)=>calls.push([id,p]),render:()=>calls.push('render')
};
vm.createContext(env);vm.runInContext(stats,env);
assert.equal(typeof VIEWS.stats,'function');assert(!VIEWS.patterns,'removed legacy Patterns tab');
let html=VIEWS.stats();assert(html.includes('Subjects')&&html.includes('Mathematics'));
assert(html.includes('This week')&&html.includes('Insights')&&html.includes('Patterns'));
assert(!html.includes('Example data'),'real data only');
ACT['s1-range']({getAttribute:()=> 'month'});assert.equal(UI.s1Range,'month');
html=VIEWS.stats();assert(html.includes('Last 4 weeks'));
ACT['s1-prev']();assert.equal(UI.s1MonthOff,1);
ACT['s1-next']();assert.equal(UI.s1MonthOff,0);
ACT['s1-subject']({getAttribute:()=> 'math'});assert.equal(calls.at(-1)[0],'stats.subject');
ACT['s1-insights']();assert.equal(calls.at(-1)[0],'stats.insights');
assert(!/#[0-9a-fA-F]{3,8}\b|font-family|box-shadow/.test(css),'Stats uses only tokens');
console.log('PATTERNS TESTS PASSED');
