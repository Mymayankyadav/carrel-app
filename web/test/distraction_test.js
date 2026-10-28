'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

let logged=0,opened=[],rendered=0,closed=0;
const ctx={
  console,Date,Math,
  module:{exports:{}},
  SHEETS:{},ACT:{},CARDS:{},
  CUR:{id:'session',activity:'physics'},
  UI:{notice:null,sheet:null},
  V:{distractions:{}},
  MIN:60000,
  canWrite:()=>true,
  noticeNow(){logged++;ctx.UI.notice={k:'2026-10-28',id:'urge1',until:Date.now()+6000};},
  openSheet(sh){opened.push(sh);ctx.UI.sheet=sh;},
  closeSheet(){ctx.UI.sheet=null;closed++;},
  render(){rendered++;},
  renderSheet(){rendered++;},
  setTimeout(){},
  kSheetHead:label=>label,
  kSheetFoot:body=>body,
  kBtn:(label,attrs)=>label+attrs,
  fmtClock:ms=>String(Math.ceil(ms/1000)),
  fmtDur:ms=>Math.round(ms/60000)+'m',
  addDaysKey:(day,n)=>{
    const d=new Date(day+'T12:00:00Z');
    d.setUTCDate(d.getUTCDate()+n);
    return d.toISOString().slice(0,10);
  },
  todayKey:()=> '2026-10-28'
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/distraction.js'),'utf8'),ctx);
const {l6DriftWeek,l6DriftRank}=ctx.module.exports;

const doc={
  '2026-10-26':{items:{
    urge:{type:'urge'},
    first:{type:'drift',driftMin:5},
    second:{type:'drift',driftMin:15},
    dismissed:{type:'drift',driftMin:30,dismissed:true}
  }},
  '2026-10-28':{items:{third:{type:'drift',driftMin:10}}}
};
const totals=l6DriftWeek(doc,'2026-10-26');
assert.equal(totals.total,30);
assert.equal(totals.days.length,7);
assert.deepEqual(Array.from(totals.days.slice(0,3)),[20,0,10]);
assert.equal(l6DriftRank({current:{total:0},prev:{total:4},sunday:true}),0);
assert.equal(l6DriftRank({current:{total:20},prev:{total:9},sunday:true}),24);
assert.equal(l6DriftRank({current:{total:60},prev:{total:20},sunday:false}),42);
assert.equal(l6DriftRank({current:{total:20},prev:{total:1},sunday:false}),0);
assert.equal(l6DriftRank({current:{total:40},prev:{total:25},sunday:false}),0);

ctx.l6OnNoticed();
assert.equal(logged,1,'only the existing durable notice should be written');
assert.equal(opened.length,1);
assert.equal(opened[0].type,'urge');
assert.ok(opened[0].until>Date.now()+59000);
const html=ctx.SHEETS.urge(opened[0]);
assert.match(html,/Wait it out/);
assert.match(html,/Back to work/);
assert.match(html,/Log drift/);
assert.match(html,/role="timer"/);
assert.match(html,/aria-live="off"/);
ctx.ACT['l6-urge-log']();
assert.equal(closed,1);
assert.ok(ctx.UI.notice.until>Date.now()+9000);
assert.equal(logged,1);
ctx.UI.sheet={type:'urge'};
ctx.ACT['l6-urge-back']();
assert.equal(closed,2);
assert.equal(ctx.UI.notice,null);
console.log('distraction_test: L6 urge surf and drift rules passed');
