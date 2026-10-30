'use strict';
const assert=require('node:assert/strict');
const {estimateFactor,energyWindows,autoPlan,backwardPlan}=require('../logic/sched.js');
const history=(ratio,n=6)=>Array.from({length:n},()=>({planned:60,actual:60*ratio}));
assert.equal(estimateFactor([]),1);
assert.equal(estimateFactor(history(2,4)),1,'five valid blocks required');
assert.equal(estimateFactor(history(1.32)),1.3,'median rounds to one decimal');
assert.equal(estimateFactor(history(0.1)),0.8,'low clamp');
assert.equal(estimateFactor(history(6)),2,'high clamp');
assert.equal(estimateFactor(history(1).concat([{planned:4,actual:1000}])),1,'ignore too-short plans');
assert.equal(estimateFactor(history(1,30).concat(history(2,3))),1,'last 30 ignored');
assert.equal(estimateFactor([{planned:60,actual:20},{planned:60,actual:50},...history(1,4)]),1,'robust median');
assert.deepEqual(energyWindows({}),[]);
assert.deepEqual(energyWindows({9:{min:10,focus:3},10:{min:120,focus:1},11:{min:60,focus:3}}),[11,10],'minimum observations and score');
assert.deepEqual(energyWindows({9:{min:30,focus:null}}),[9],'missing focus neutral');
const at=(h,m=0)=>new Date(2026,9,29,h,m).getTime();
const free=[[at(8),at(12)]];
const task=(id,activity,minutes=50,prio=2,hard=false)=>({id,activity,title:id,minutes,prio,hard});
let p=autoPlan({items:[],free,now:at(7),gapMin:10});
assert.deepEqual(p,{blocks:[],unplaced:[]});
p=autoPlan({items:[task('a','math',60)],free,now:at(7),gapMin:10});
assert.equal(p.blocks.length,1);
assert.equal(p.blocks[0].at,'08:00');
assert.equal(p.blocks[0].minutes,60);
p=autoPlan({items:[task('a','math',50,1,true)],free,now:at(7),windows:[10],gapMin:5});
assert.equal(p.blocks[0].at,'10:00','hard subjects favour peak hours');
p=autoPlan({items:[task('peak','math',50,1,true),task('base','physics',140)],
  free,now:at(7),windows:[10],gapMin:10});
assert.deepEqual(p.blocks.map(b=>b.at),['08:00','10:00','11:00'],
  'preserve the free time before a preferred peak slot and sort the preview chronologically');
assert.deepEqual(p.blocks.map(b=>b.minutes),[110,50,30],
  'use the pre-peak window rather than silently leaving ordinary work unplanned');
assert.deepEqual(p.unplaced,[],'all feasible work is scheduled');
assert(p.blocks.every((b,i,arr)=>!i ||
  (+arr[i-1].at.slice(0,2)*60 + +arr[i-1].at.slice(3) + arr[i-1].minutes + 10 <=
   +b.at.slice(0,2)*60 + +b.at.slice(3))),
  'all scheduled blocks retain the requested ten-minute gap');
assert(p.blocks.reduce((n,b)=>n+b.minutes,0)<=216,'peak scheduling keeps the 10% capacity buffer');
p=autoPlan({items:[task('peak','math',25,1,true),task('base','physics',30)],
  free:[[at(9,40),at(11)]],now:at(7),windows:[10],gapMin:10});
assert(p.blocks.every(b=>b.at!=='09:40'),
  'do not offer a sub-25-minute pre-peak fragment after reserving the gap');
p=autoPlan({items:[task('a','math',50)],free,now:at(7),factor:()=>1.3});
assert.equal(p.blocks[0].minutes,65,'estimate multiplier rounds upward to 5');
p=autoPlan({items:[task('a','math',120)],free:[[at(8),at(9)],[at(10),at(11)]],now:at(7)});
assert.equal(p.blocks.length,2,'remainder splits across free intervals');
assert.deepEqual(p.blocks.map(b=>b.at),['08:00','10:00']);
p=autoPlan({items:[task('a','math',120)],free:[[at(8),at(9)],[at(10),at(11)]],now:at(7),gapMin:10});
assert(p.blocks.every(b=>b.at<'09:00'||b.at>='10:00'),'no busy overlaps');
p=autoPlan({items:[task('a','math',150)],free:[[at(8),at(9,40)]],now:at(7),gapMin:0});
assert.equal(p.blocks.reduce((n,b)=>n+b.minutes,0),90,'ten-percent buffer');
assert.deepEqual(p.unplaced,['a']);
p=autoPlan({items:[task('a','math',30),task('b','physics',30)],free:[[at(8),at(10)]],now:at(7),gapMin:10});
assert.equal(p.blocks[1].at,'08:40','gap between consecutive blocks');
p=autoPlan({items:[task('a','math',30),task('b','math',30),task('c','physics',30)],free:[[at(8),at(13)]],now:at(7)});
assert.notEqual(p.blocks[0].activity,p.blocks[1].activity,'interleave different subjects');
p=autoPlan({items:[task('a','math',60)],free,now:at(11,40)});
assert.equal(p.blocks.length,0,'not enough future capacity for a 25m session');
p=autoPlan({items:[task('a','math',5)],free,now:at(7)});
assert.equal(p.blocks[0].minutes,25,'session minimum');
assert.deepEqual(backwardPlan({today:'2026-10-29',deadline:'2026-10-29',hoursNeeded:10}),[]);
assert.deepEqual(backwardPlan({today:'2026-10-29',deadline:'2026-10-30',hoursNeeded:0}),[]);
let b=backwardPlan({today:'2026-10-29',deadline:'2026-11-02',hoursNeeded:6,hoursDone:0,maxPerDay:3});
assert.equal(b.length,4);
assert(!b.some(x=>x.date==='2026-11-02'),'never on deadline');
assert(Math.abs(b.reduce((sum,x)=>sum+x.minutes,0)-360)<=5,'distributes total work');
assert(b.at(-1).minutes<=b[0].minutes,'final day review is lighter');
b=backwardPlan({today:'2026-10-29',deadline:'2026-10-31',hoursNeeded:20,maxPerDay:2});
assert(b.every(x=>x.minutes<=120),'daily hard cap');
assert.equal(b.reduce((a,x)=>a+x.minutes,0),240);
b=backwardPlan({today:'2026-10-30',deadline:'2026-11-01',hoursNeeded:2,hoursDone:1,maxPerDay:3});
assert(Math.abs(b.reduce((a,x)=>a+x.minutes,0)-60)<=5);
// Duplicate or touching free intervals must not inflate capacity or double-book.
p=autoPlan({items:[task('a','math',120)],free:[[at(8),at(9)],[at(8,30),at(9,30)]],now:at(7)});
assert.equal(p.blocks.reduce((n,x)=>n+x.minutes,0),81,'overlap counts only once toward the 90% budget');
assert.equal(p.blocks.length,1,'overlapping windows produce one contiguous block');
p=autoPlan({items:[task('a','math',30)],free:[[at(8),at(8,15)],[at(8,15),at(8,45)]],now:at(7)});
assert.equal(p.blocks.length,1,'touching short windows form a usable free interval');
assert.equal(p.blocks[0].minutes,30);
// Malformed dates or non-finite quantities must not hang morning planning.
assert.deepEqual(backwardPlan({today:'2026-02-31',deadline:'2026-03-10',hoursNeeded:10}),[]);
assert.deepEqual(backwardPlan({today:'2026-10-29',deadline:'2026-11-02',hoursNeeded:10,maxPerDay:Infinity}),[]);
assert.deepEqual(backwardPlan({today:'2026-10-29',deadline:'2026-11-02',hoursNeeded:Infinity}),[]);
assert.deepEqual(backwardPlan({today:'2026-10-29',deadline:'2026-11-02',hoursNeeded:10,maxPerDay:0}),[]);
assert(backwardPlan({today:'2026-10-29',deadline:'2026-10-30',hoursNeeded:30,maxPerDay:100})[0].minutes<=1440,'daily capacity never exceeds 24h');
console.log('SCHED TESTS PASSED');
