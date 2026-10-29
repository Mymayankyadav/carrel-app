// Run: node web/test/sync_historical_range_fence_test.js
// A slow historical query must not overwrite newer realtime or range results.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const blank = () => ({
  current:null, activities:null, settings:null, days:{}, plans:{},
  distractions:{}, planning:{}, reviews:[], topics:{}, rituals:{},
  coach:{}, usage:{}
});
const S = {
  db:null, uid:'alice', conn:'live', owner:true, base:blank(),
  loaded:{}, pending:[], inflight:new Set(), fetched:new Set(),
  unsubs:[], resubT:0, windowFrom:'2026-10-01'
};
let changes = 0;
const ctx = {
  S, console:{warn(){}}, clone:x=>x, deepMerge:Object.assign,
  store:{get(){return null;},set(){}}, toast(){},
  changed(){changes++;}, recoverAuth(){throw Error('unexpected auth recovery');},
  setTimeout(){throw Error('unexpected retry');}, clearTimeout(){},
  addDaysKey(k, n) {
    const d = new Date(k + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0,10);
  }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../core/sync.js'),'utf8'),ctx);

function adapter() {
  const handlers = new Map(), reads = [];
  function query(key) {
    const q = {
      where(){return q;}, orderBy(){return q;}, limit(){return q;},
      onSnapshot(next,err) {
        if (!handlers.has(key)) handlers.set(key,[]);
        handlers.get(key).push({next,err});
        return () => {};
      },
      get(){return new Promise((resolve,reject)=>reads.push({key,resolve,reject}));}
    };
    return q;
  }
  return {handlers,reads,doc:query,collection:query};
}
const row = (id, data) => ({id, exists:true, data:()=>data});
const snapshot = (...docs) => ({docs});
const latest = (db, key) => db.handlers.get(key).at(-1);
const settle = async () => {for(let i=0;i<12;i++) await Promise.resolve();};
function resolveRead(db, start, values) {
  assert.deepEqual(db.reads.slice(start,start+3).map(r=>r.key),
    ['days','plans','distractions']);
  for(const read of db.reads.slice(start,start+3))
    read.resolve(snapshot(...(values[read.key] || []).map(([id,data])=>row(id,data))));
}

(async () => {
  const db = adapter();
  S.db = db;
  ctx.subscribe();

  // A historical request is started before a widened live window.
  // Its stale result must not resurrect a live deletion, even if the
  // window later shrinks and those dates become historical again.
  S.base.days['2026-09-02'] = {value:'old-cached'};
  ctx.ensureRange('2026-09-01','2026-09-02');
  assert.equal(db.reads.length,3);
  S.windowFrom = '2026-09-01';
  ctx.subscribe();
  latest(db,'days').next(snapshot(row('2026-09-01',{value:'live'})));
  latest(db,'plans').next(snapshot(row('2026-09-01',{value:'live-plan'})));
  latest(db,'distractions').next(snapshot(row('2026-09-01',{value:'live-drift'})));
  assert.equal(S.base.days['2026-09-02'],undefined,'live snapshot deleted Sept 2');
  S.windowFrom = '2026-10-01';
  ctx.subscribe();
  resolveRead(db,0,{
    days:[['2026-09-01',{value:'stale'}],['2026-09-02',{value:'resurrected'}]],
    plans:[['2026-09-01',{value:'stale-plan'}]],
    distractions:[['2026-09-01',{value:'stale-drift'}]]
  });
  await settle();
  assert.equal(S.base.days['2026-09-01'].value,'live');
  assert.equal(S.base.days['2026-09-02'],undefined);
  assert.equal(S.base.plans['2026-09-01'].value,'live-plan');
  assert.equal(S.base.distractions['2026-09-01'].value,'live-drift');

  // Two overlapping historical queries: the newer one finishes first.
  // A missing document in the newer response must fence resurrection.
  ctx.ensureRange('2026-08-01','2026-08-03');
  ctx.ensureRange('2026-08-02','2026-08-04');
  assert.equal(db.reads.length,9);
  resolveRead(db,6,{
    days:[['2026-08-02',{value:'newer'}],['2026-08-04',{value:'newer'}]],
    plans:[['2026-08-02',{value:'newer-plan'}]],
    distractions:[['2026-08-02',{value:'newer-drift'}]]
  });
  await settle();
  resolveRead(db,3,{
    days:[['2026-08-01',{value:'older-only'}],['2026-08-02',{value:'stale'}],['2026-08-03',{value:'resurrected'}]],
    plans:[['2026-08-02',{value:'stale-plan'}]],
    distractions:[['2026-08-02',{value:'stale-drift'}]]
  });
  await settle();
  assert.equal(S.base.days['2026-08-01'].value,'older-only');
  assert.equal(S.base.days['2026-08-02'].value,'newer');
  assert.equal(S.base.days['2026-08-03'],undefined);
  assert.equal(S.base.days['2026-08-04'].value,'newer');
  assert.equal(S.base.plans['2026-08-02'].value,'newer-plan');
  assert.equal(S.base.distractions['2026-08-02'].value,'newer-drift');

  // Reverse completion order: a newer query must replace the older row,
  // and its empty result must remove a server-deleted historical row.
  ctx.ensureRange('2026-08-05','2026-08-07');
  ctx.ensureRange('2026-08-06','2026-08-08');
  resolveRead(db,9,{
    days:[['2026-08-06',{value:'old'}],['2026-08-07',{value:'deleted'}]],
    plans:[['2026-08-06',{value:'old'}]]
  });
  await settle();
  assert.equal(S.base.days['2026-08-07'].value,'deleted');
  resolveRead(db,12,{
    days:[['2026-08-06',{value:'new'}]],
    plans:[['2026-08-06',{value:'new'}]]
  });
  await settle();
  assert.equal(S.base.days['2026-08-06'].value,'new');
  assert.equal(S.base.days['2026-08-07'],undefined);
  assert.equal(S.base.plans['2026-08-06'].value,'new');
  assert.ok(changes >= 5);
  console.log('SYNC HISTORICAL RANGE FENCE TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
