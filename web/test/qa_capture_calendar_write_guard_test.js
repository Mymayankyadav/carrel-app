'use strict';
/* QA/ORC: malformed capture overrides must never write invisible calendar keys. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const writes=[];
const ctx={
  Date,Math,Object,Number,String,
  ACT:{},SHEETS:{},UI:{sheet:null},
  ACTS:[{id:'math',kind:'study',archived:false}],
  ACTMAP:{math:{id:'math',kind:'study',archived:false}},
  CFG:{weekStart:1},
  l9Parse:()=>ctx.parsed,
  renderSheet:()=>writes.push({type:'render'}),
  closeSheet:()=>{writes.push({type:'close'});ctx.UI.sheet=null;},
  firstStudyId:()=> 'math',
  nextOrder:()=>1,nextBacklogOrder:()=>1,
  uid:prefix=>prefix+'-id',
  blockDoc:x=>x,
  isoLocal:()=> '2026-10-30T10:00:00+05:30',
  W:()=>{
    writes.push({type:'begin'});
    return {
      update(patch,data,ensure){writes.push({type:'update',patch,data,ensure});return this;},
      plan(date,data){writes.push({type:'plan',date,data});return this;},
      set(patch,data){writes.push({type:'set',patch,data});return this;}
    };
  },
  commit:(message)=>{writes.push({type:'commit',message});return true;}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/capture.js'),'utf8'),ctx);
const run=(type,date,time,override={})=>{
  writes.length=0;
  ctx.parsed={type,title:'Review topology',activity:'math',minutes:60,
    date,time,prio:2,kind:'other'};
  const sh={type:'capture',text:'Review topology',manualType:null,override,err:''};
  ctx.UI.sheet=sh;
  ctx.l9CaptureSave();
  return {writes:[...writes],err:sh.err};
};
const rejected=(type,date,time,override={})=>{
  const r=run(type,date,time,override);
  assert.equal(r.writes.some(x=>x.type==='begin'||x.type==='commit'),false,
    'invalid capture must not create a write set or commit');
  assert(r.err.length>0,'invalid capture must explain the problem');
  assert.equal(r.writes.filter(x=>x.type==='render').length,1);
  return r;
};
assert.equal(ctx.l9ValidCalendarDate('2024-02-29'),true);
assert.equal(ctx.l9ValidCalendarDate('2025-02-29'),false);
assert.equal(ctx.l9ValidCalendarDate('2026-02-31'),false);
assert.equal(ctx.l9ValidCalendarDate('2026-13-01'),false);
assert.equal(ctx.l9ValidCalendarDate('2026-10-30'),true);
assert.equal(ctx.l9ValidCalendarDate('2026-1-01'),false);
assert.equal(ctx.l9ValidCalendarDate(null),false);

assert.match(rejected('block','2026-02-31','10:00').err,/valid date/);
assert.match(rejected('deadline','2025-02-29',null).err,/valid date/);
assert.match(rejected('task','2026-04-31',null).err,/valid date/);
assert.match(rejected('block','2026-10-30','24:00').err,/date and time/);
assert.match(rejected('deadline','2026-10-30','25:00').err,/valid time/);
assert.match(rejected('deadline','2026-10-30','12:60').err,/valid time/);
assert.match(rejected('unrecognized','2026-10-30',null).err,/what to add/);
// The override path is used by editable chips; validate it too.
assert.match(rejected('task','2026-10-30',null,{date:'2026-02-30'}).err,/valid date/);

let r=run('block','2024-02-29','09:30');
assert.equal(r.err,'');
assert.equal(r.writes.find(x=>x.type==='plan').date,'2024-02-29');
assert.equal(r.writes.filter(x=>x.type==='commit').length,1);
r=run('deadline','2024-02-29','13:45');
assert.equal(r.err,'');
assert.equal(r.writes.find(x=>x.type==='update').data.items['dl-id'].time,'13:45');
assert.equal(r.writes.filter(x=>x.type==='commit').length,1);
r=run('task','2026-10-30',null);
assert.equal(r.err,'');
assert.equal(r.writes.find(x=>x.type==='update').data.items['t-id'].due,'2026-10-30');
r=run('ask',null,null);
assert.equal(r.err,'');
assert.equal(r.writes.find(x=>x.type==='set').patch,'coach/ask-id');
assert.equal(r.writes.filter(x=>x.type==='commit').length,1);
console.log('QA CAPTURE CALENDAR WRITE GUARD TESTS PASSED');
