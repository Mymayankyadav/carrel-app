// QA: parking and moving a thought must not claim success before durable enqueue.
// Run: node web/test/qa_park_durable_test.js
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../ui/today.js'),'utf8');
const start=src.indexOf('function parkAdd('),end=src.indexOf('/* L1:',start);
assert(start>=0&&end>start,'load the actual parked-thought implementation');
let durable=false,writable=true,renders=0;
const commits=[];
const ctx={
  UI:{parkText:'Keep this idea'},CUR:null,
  V:{distractions:{'2026-10-27':{items:{p1:{type:'park',text:'Proof sketch',activity:'math'}}}},
    planning:{backlog:{items:{}}}},
  ACTS:[{id:'math',kind:'study',archived:false}],
  canWrite:()=>writable,dayKeyOf:()=> '2026-10-27',
  isoLocal:()=> '2026-10-27T12:00:00+05:30',uid:p=>p==='d'?'d1':'t1',
  isStudyId:id=>id==='math',
  W:()=>({ops:[],dis(k,id,doc){this.ops.push(['dis',k,id,doc]);return this;},
    update(k,patch,ensure){this.ops.push(['update',k,patch,ensure]);return this;}}),
  commit:(message,w)=>{commits.push({message,ops:w.ops});return durable;},
  render:()=>{renders++;},Date,String,Object
};
vm.createContext(ctx);
vm.runInContext(src.slice(start,end),ctx,{filename:'today-park-extract.js'});
assert.equal(ctx.parkAdd('Keep this idea'),false,'failed commit returns failure');
assert.equal(ctx.UI.parkText,'Keep this idea','failed commit keeps typed thought');
assert.equal(renders,0,'failed commit cannot redraw and clear the draft');
assert.equal(commits[0].ops[0][0],'dis');
durable=true;
assert.equal(ctx.parkAdd('Keep this idea'),true);
assert.equal(ctx.UI.parkText,'','successful commit clears the draft');
assert.equal(renders,1,'successful commit updates Today');
writable=false;
assert.equal(ctx.parkAdd('Another idea'),false,'read-only mode fails closed');
assert.equal(commits.length,2,'read-only mode never queues a write');
writable=true;durable=false;
assert.equal(ctx.parkToBacklog('2026-10-27','p1'),false,'failed dual-write returns failure');
const attempted=commits.at(-1).ops;
assert.deepEqual(attempted.map(x=>x[0]),['update','dis'],
  'move is one backlog plus parked-marker write set');
assert.equal(ctx.parkedItems('2026-10-27').length,1,'failed move leaves the thought visible');
durable=true;
assert.equal(ctx.parkToBacklog('2026-10-27','p1'),true,'durable move returns success');
assert.equal(ctx.parkToBacklog('2026-10-27','missing'),false,'unknown thought fails closed');
console.log('PARK DURABILITY TESTS PASSED');
