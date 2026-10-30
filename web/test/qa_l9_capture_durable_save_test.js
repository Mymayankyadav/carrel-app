'use strict';
// L9 QA: a failed durable enqueue must not discard the only capture draft.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../ui/capture.js'),'utf8');
let saveOK=false,commits=0,closes=0,renders=0,writeCount=0;
const ctx={
  Date,Math,Object,Number,String,
  ACT:{},SHEETS:{},UI:{sheet:null},
  ACTS:[{id:'math',kind:'study',archived:false}],
  ACTMAP:{math:{id:'math',kind:'study',archived:false}},
  CFG:{weekStart:1},
  l9Parse:()=>ctx.parsed,
  renderSheet:()=>{renders++;},
  closeSheet:()=>{closes++;ctx.UI.sheet=null;},
  firstStudyId:()=> 'math',
  nextOrder:()=>1,nextBacklogOrder:()=>1,
  uid:prefix=>prefix+'-id',
  blockDoc:x=>x,
  isoLocal:()=> '2026-10-31T03:00:00+05:30',
  W:()=>({
    update(){writeCount++;return this;},
    plan(){writeCount++;return this;},
    set(){writeCount++;return this;}
  }),
  commit:()=>{commits++;return saveOK;}
};
vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'capture.js'});
for(const type of ['task','deadline','block','ask']){
  const before={commits,closes,renders,writeCount};
  const sh={type:'capture',text:'Review topology before exam',
    manualType:null,override:{prio:1},err:''};
  ctx.parsed={type,title:'Review topology',activity:'math',minutes:60,
    date:type==='ask'?null:'2026-11-02',
    time:type==='block'?'09:30':null,prio:2,kind:'other',invalidDate:false};
  ctx.UI.sheet=sh;
  saveOK=false;
  ctx.l9CaptureSave();
  assert.equal(commits,before.commits+1,type+': failed enqueue attempted');
  assert.equal(writeCount,before.writeCount+1,type+': write set prepared');
  assert.equal(closes,before.closes,type+': failure cannot close editor');
  assert.equal(ctx.UI.sheet,sh,type+': failed draft remains editable');
  assert.equal(sh.text,'Review topology before exam',type+': typed text retained');
  assert.equal(sh.override.prio,1,type+': edits retained');
  assert.match(sh.err,/not saved.*retry/i,type+': accessible retry error');
  assert.equal(renders,before.renders+1,type+': error re-rendered');
  saveOK=true;
  ctx.l9CaptureSave();
  assert.equal(commits,before.commits+2,type+': retry really enqueued');
  assert.equal(closes,before.closes+1,type+': success closes editor');
  assert.equal(ctx.UI.sheet,null,type+': no stale sheet after success');
  assert.equal(sh.err,'',type+': retry clears previous error');
}
// A failed enqueue must also keep a user-selected date/time override.
ctx.parsed={type:'block',title:'Exercise',activity:'math',minutes:45,
  date:'2026-11-03',time:'11:00',prio:2,invalidDate:false};
const edited={type:'capture',text:'Exercise',manualType:'block',
  override:{date:'2026-11-04',time:'14:00',minutes:90},err:''};
ctx.UI.sheet=edited;saveOK=false;
const closedBefore=closes;
ctx.l9CaptureSave();
assert.equal(closes,closedBefore);
assert.equal(ctx.UI.sheet,edited);
assert.equal(edited.override.date,'2026-11-04');
assert.equal(edited.override.time,'14:00');
assert.equal(edited.override.minutes,90);
console.log('QA L9 CAPTURE DURABLE SAVE TESTS PASSED');
