'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../ui/rituals.js'),'utf8');
const MIN=60000,HOUR=60*MIN,DAY=24*HOUR,k='2026-10-28',y='2026-10-27';
const calls=[],ACT={},SHEETS={},CARDS={},handlers=[];
const V={rituals:{},plans:{[k]:{},[y]:{}},planning:{deadlines:{items:{}}},topics:{}};
const now=Date.now();
const rows={
 [y]:[{id:'old',activity:'maths',title:'Old problem set',remaining:60*MIN,st:'open',done:0,pomo:null}],
 [k]:[{id:'b1',activity:'maths',title:'Algebra proofs',remaining:45*MIN,st:'open',done:0},
      {id:'b2',activity:'maths',title:'Finished',remaining:0,st:'done',done:60*MIN}]
};
const backlog=[{id:'urgent',title:'Exam problems',activity:'maths',minutes:50,prio:1,order:1,due:k},
               {id:'later',title:'Reading',activity:'maths',minutes:60,prio:3,order:2,due:null}];
const ctx={
 MIN,HOUR,DAY,Date,Math,ACT,SHEETS,CARDS,V,
 ACTMAP:{maths:{name:'Maths',kind:'study',color:'#123456'}},
 ENTRIES:[],CUR:null,CFG:{gap:5,planEnd:'22:30'},
 UI:{sheet:null},
 document:{addEventListener:(event,fn)=>{if(event==='DOMContentLoaded')handlers.push(fn);}},
 dayStartMs:()=>now-15*MIN,dayEndMs:()=>now+DAY,
 hmOnDay:()=>now+2*HOUR,
 addDaysKey:(date,n)=>date===k&&n===-1?y:n===1?'2026-10-29':date,
 todayKey:()=>k,
 planModelFor:date=>({rows:rows[date]||[],planned:90*MIN,done:60*MIN}),
 backlogList:()=>backlog,
 deadlineList:()=>[],
 l4DueTopics:()=>[{id:'topic',title:'Sylow theory',subject:'maths'}],
 firstStudyId:()=> 'maths',act:()=>({name:'Maths',color:'#123456'}),
 l3FreeIntervals:()=>[[now,now+5*HOUR]],l3HourStats:()=>({}),l3Factor:()=>1,
 energyWindows:()=>[],
 autoPlan:opts=>({blocks:opts.items.map((item,i)=>({itemId:item.id,activity:item.activity,
   title:item.title,minutes:item.minutes,at:'09:'+String(i*5).padStart(2,'0')})),unplaced:[]}),
 nextOrder:()=>5,blockDoc:x=>x,uid:(()=>{let n=0;return p=>p+(++n);})(),
 W:()=>({ops:[],plan(k,data){this.ops.push(['plan',k,data]);return this;},
   update(path,data){this.ops.push(['update',path,data]);return this;}}),
 commit:(msg,w)=>{calls.push({msg,ops:w.ops});return true;},
 closeSheet:()=>{ctx.UI.sheet=null;},
 openSheet:sh=>{ctx.UI.sheet=sh;},
 kFlow:(sh,steps)=>{sh.flowSteps=steps;return steps[sh.step].body();},
 kRow:o=>'<row>'+o.label+'</row>',
 kChips:o=>'<chips>'+o.options.map(x=>x.label).join('|')+'</chips>',
 kSeg:o=>'<seg>'+o.options.map(x=>'<button data-v="'+x.v+'">'+x.label+'</button>').join('')+'</seg>',
 kBtn:(label,attrs)=>'<button '+attrs+'>'+label+'</button>',
 kText:o=>'<input data-bind="'+o.bind+'" value="'+o.value+'">',
 kField:(label,body)=>'<label>'+label+body+'</label>',kEmpty:()=>'<empty></empty>',
 renderSheet:()=>{},toast:()=>{},fmtDur:m=>Math.round(m/MIN)+'m',fmtHM:x=>x,
 isoLocal:ms=>new Date(ms).toISOString(),aggregate:()=>({[k]:{study:120*MIN,all:160*MIN}}),
 esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;'),
 kSafeColour:c=>c,carryTo:(w,k,items)=>w.plan('2026-10-29',{carry:items}),
 nextBacklogOrder:()=>10,canWrite:()=>true
};
vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'rituals.js'});
const candidates=ctx.l2Candidates(k);
assert(candidates.some(x=>x.id==='carry:old'&&x.pick));
assert(candidates.some(x=>x.id==='review:topic'&&x.pick));
assert(candidates.some(x=>x.id==='backlog:urgent'&&x.pick));
assert(candidates.some(x=>x.id==='backlog:later'&&!x.pick));
const picks=Object.fromEntries(candidates.map(t=>[t.id,t.pick]));
assert.equal(ctx.l2Minutes(candidates,picks),60+30+50);
ctx.l2OpenMorning(k);
let sh=ctx.UI.sheet;
assert.equal(sh.type,'morning');
assert(ctx.l2MorningSheet(sh).includes('Old problem set'));
sh.step=1;ctx.l2MorningSheet(sh);
assert(sh.proposal.blocks.length>=3);
assert.equal(sh.flowSteps[1].canNext(),true,'accept is enabled on the first preview render');
assert.equal(sh.flowSteps[1].onNext(),true);
assert(sh.accepted);
const accept=calls.at(-1);
assert(accept.ops.some(op=>op[0]==='plan'&&op[1]===k));
assert(accept.ops.some(op=>op[0]==='update'&&op[1]==='planning/backlog'));
sh.step=2;sh.intent='Prove something';ctx.l2MorningSheet(sh);
assert.equal(sh.done(),true);
assert(calls.at(-1).ops.some(op=>op[0]==='update'&&op[1]==='rituals/'+k));
handlers.forEach(fn=>fn());
const morningCtx={now:now,k};
assert.equal(CARDS.morning.rank(morningCtx),0,'open plan suppresses morning card');
rows[k]=[];
assert.equal(CARDS.morning.rank(morningCtx),95);
V.rituals[k]={morning:{at:'test'}};
assert.equal(CARDS.morning.rank(morningCtx),0);
delete V.rituals[k];
rows[k]=[{id:'b1',activity:'maths',title:'Algebra proofs',remaining:45*MIN,st:'open',done:0}];
ctx.l2OpenShutdown(k);sh=ctx.UI.sheet;
assert.equal(sh.type,'shutdown');
sh.decisions.b1='tomorrow';sh.first='b1';
assert.equal(ctx.l2ShutdownSave(sh),true);
let op=calls.at(-1).ops;
assert(op.some(x=>x[0]==='plan'&&x[1]==='2026-10-29'),'tomorrow carry');
assert(op.some(x=>x[0]==='update'&&x[1]==='rituals/'+k));
ctx.l2OpenShutdown(k);sh=ctx.UI.sheet;sh.decisions.b1='backlog';
assert.equal(ctx.l2ShutdownSave(sh),true);
op=calls.at(-1).ops;
assert(op.some(x=>x[0]==='update'&&x[1]==='planning/backlog'),'backlog created');
ctx.l2OpenShutdown(k);sh=ctx.UI.sheet;sh.decisions.b1='drop';
assert.equal(ctx.l2ShutdownSave(sh),true);
op=calls.at(-1).ops;
assert(op.some(x=>x[0]==='plan'&&x[2].blocks.b1.status==='skipped'),'drop skips');
V.rituals[k]={shutdown:{at:'test'}};
assert.equal(CARDS.shutdown.rank({k,now:now+2*HOUR}),0);
assert.equal(ctx.l2ShutdownSave({k,decisions:{},first:''}),false,'no double shutdown');
console.log('L2 RITUAL TESTS PASSED');
