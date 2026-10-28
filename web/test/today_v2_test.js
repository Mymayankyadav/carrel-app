// L1: pure ribbon geometry, day clipping, deadline ranks and rendering invariants.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../ui/ribbon.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../ui/ribbon.css'),'utf8');
const MIN=60000,HOUR=3600000,DAY=86400000,day=Date.UTC(2026,9,28,4);
let deadlines=[{id:'d',title:'Topology exam',date:'2026-10-30',activity:'maths',done:false}];
const ACT={},CARDS={},callbacks=[];
const c={
 ACT,CARDS,Date,Math,MIN,HOUR,DAY,
 document:{addEventListener:(name,fn)=>{if(name==='DOMContentLoaded')callbacks.push(fn);}},
 V:{planning:{deadlines:{items:{d:{created:'2026-10-20T09:00:00Z'}}}}},
 ENTRIES:[{a:'maths',s:day+5*HOUR,e:day+6*HOUR}],
 ACTMAP:{maths:{id:'maths',name:'Mathematics'}},PAGES:{subject:{}},
 todayKey:()=> '2026-10-28',
 dayStartMs:()=>day,dayEndMs:()=>day+DAY,
 hmOnDay:()=>day+8*HOUR,
 fmtT:()=> '4:00',fmtDur:()=> '1h',
 dateOfKey:k=>new Date(k+'T00:00:00Z'),
 addDaysKey:(k,n)=>new Date(Date.parse(k+'T00:00:00Z')+n*DAY).toISOString().slice(0,10),
 busyOf:()=>[{s:day+3*HOUR,e:day+4*HOUR,title:'Class'}],
 planModelFor:()=>({rows:[{id:'b',activity:'maths',title:'Proof',remaining:HOUR,pieces:[[day+7*HOUR,day+8*HOUR]]}]}),
 deadlineList:()=>deadlines,
 act:()=>({color:'#ff8800',name:'Mathematics'}),
 kSafeColour:x=>x,
 esc:x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 icon:()=>'<svg></svg>',
 parseT:x=>Date.parse(x),
 patternsModel:()=>({studyDays:0,studyTotal:0}),
 insights:()=>[],fmtHourL:()=>'',rowWeekday:()=>'',fmtMinOfDay:()=>'',
 pushPage:()=>{},openDeadlineSheet:()=>{},render:()=>{}
};
vm.createContext(c);vm.runInContext(source,c);
const g=c.l1RibbonGeometry(day+5*HOUR,day+6*HOUR,day,day+DAY);
assert(Math.abs(g.left-20.83333)<.001,'9:00 starts at 20.83% of 4:00 logical day');
assert(Math.abs(g.width-4.16667)<.001);
assert.equal(c.l1RibbonGeometry(day-2*HOUR,day+HOUR,day,day+DAY).left,0);
assert.equal(c.l1RibbonGeometry(day-HOUR,day,day,day+DAY),null);
assert.equal(c.l1RibbonGeometry(NaN,day,day,day+DAY),null);
const items=c.l1RibbonItems('2026-10-28',{now:day+9*HOUR});
assert.equal(items.items.filter(x=>x.type==='entry').length,1);
assert.equal(items.items.filter(x=>x.type==='plan').length,1);
assert.equal(items.items.filter(x=>x.type==='busy').length,1);
const html=c.ribbon('2026-10-28',{now:day+9*HOUR});
assert(html.includes('data-act="l1-ribbon"')&&html.includes('l1-ribbon-now'));
assert(html.includes('aria-label="Open today plan timeline"'));
callbacks.forEach(fn=>fn());
assert.equal(CARDS.deadline.rank({k:'2026-10-28'}),90);
assert.equal(CARDS.deadline.rank({k:'2026-10-28'}),90);
assert(CARDS.deadline.render({k:'2026-10-28',now:day+9*HOUR}).includes('Topology exam'));
deadlines=[{...deadlines[0],date:'2026-11-10'}];
assert.equal(CARDS.deadline.rank({k:'2026-10-28'}),40);
deadlines=[{...deadlines[0],date:'2026-11-15'}];
assert.equal(CARDS.deadline.rank({k:'2026-10-28'}),0);
assert.equal(CARDS.insight.rank(),0);
assert(css.includes('.l1-ribbon-track')&&css.includes('.l1-goal'));
console.log('L1 RIBBON AND CARDS TESTS PASSED');
