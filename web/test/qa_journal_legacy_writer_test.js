// QA #90: lock-aware legacy writer prototype, not wired to production sync.
'use strict';
const assert = require('node:assert/strict');
const { qaLegacyLockedWriter } = require('../logic/outbox-legacy-writer.js');
function serialLocks() {
  const tails = new Map();
  return { request: async (name, opts, cb) => {
    assert.deepEqual(opts, { mode: 'exclusive' });
    const previous = tails.get(name) || Promise.resolve();
    let release;
    const done = new Promise(resolve => { release = resolve; });
    tails.set(name, previous.then(() => done));
    await previous;
    try { return await cb({ name }); } finally { release(); }
  }};
}
function fixture() {
  const disk = new Map();
  let unreadable = false, quota = false, current = true, onRead = null, onWrite = null;
  const storage = {
    getItem(k) { if (unreadable) throw Error('SecurityError'); if (onRead) onRead(k); return disk.get(k) ?? null; },
    setItem(k,v) { if (quota) throw Error('QuotaExceededError'); disk.set(k,v); if (onWrite) onWrite(k); }
  };
  const locks = serialLocks();
  const writer = (u='alice',s='session_1',l=locks) => qaLegacyLockedWriter(storage,u,s,l,()=>current);
  const op = i => ({path:'days/2026-10-30',kind:'update',data:{note:String(i)},ensure:null,cond:null});
  return {disk,storage,locks,writer,op,unreadable:x=>unreadable=x,quota:x=>quota=x,
    current:x=>current=x,onRead:x=>onRead=x,onWrite:x=>onWrite=x};
}
(async () => {
  const f = fixture(), a = f.writer(), b = f.writer();
  const [x,y] = await Promise.all([a.appendBatch([f.op(1)]), b.appendBatch([f.op(2)])]);
  assert.equal(x.ok,true); assert.equal(y.ok,true);
  assert.deepEqual(a.snapshot().ops,[f.op(1),f.op(2)]);
  assert.equal(a.lockName,'carrel-journal-delivery.v1:alice:session_1');
  assert.equal(f.disk.size,1);
  // Preserve pre-existing byte-level legacy entries and payload-free deletes.
  const old = [{path:'days/old',kind:'delete'},f.op(3)];
  f.disk.set(a.sourceKey,JSON.stringify(old));
  assert.equal((await b.appendBatch([{path:'days/new',kind:'delete'}])).ok,true);
  assert.deepEqual(a.snapshot().ops,[...old,{path:'days/new',kind:'delete'}]);
  assert.equal(f.writer('bob').snapshot().ops.length,0);
  assert.equal(f.writer('alice','session_2').snapshot().ops.length,0);
  // Staged copies must never be silently made stale by a cooperating writer.
  const marker = 'carrel.pending-migration-chunks.v1:alice:session_1';
  f.disk.set(marker,'{}');
  assert.equal((await a.appendBatch([f.op(4)])).error,'migration-staged');
  f.disk.delete(marker);
  const oldMarker = 'carrel.pending-migration-stage.v1:alice:session_1';
  f.disk.set(oldMarker,'{}');
  assert.equal((await a.appendBatch([f.op(4)])).error,'migration-staged');
  f.disk.delete(oldMarker);
  // Bad legacy data cannot be overwritten by an apparently valid append.
  f.disk.set(a.sourceKey,'{broken');
  assert.equal((await a.appendBatch([f.op(4)])).error,'source-corrupt');
  assert.equal(f.disk.get(a.sourceKey),'{broken');
  f.disk.set(a.sourceKey,JSON.stringify([f.op(1)]));
  f.unreadable(true);
  assert.equal((await a.appendBatch([f.op(4)])).error,'storage-unreadable');
  f.unreadable(false);
  f.quota(true);
  assert.deepEqual(await a.appendBatch([f.op(4)]),{ok:false,error:'storage-write',uncertain:true});
  f.quota(false);
  assert.deepEqual(a.snapshot().ops,[f.op(1)]);
  f.current(false);
  assert.equal((await a.appendBatch([f.op(4)])).error,'stale-session');
  f.current(true);
  assert.equal((await f.writer('alice','session_1',null).appendBatch([f.op(4)])).error,'locks-unavailable');
  assert.equal((await a.appendBatch([{path:'days/x',kind:'set',data:undefined}])).error,'invalid');
  assert.equal((await a.appendBatch([{path:'days/x',kind:'bad',data:{}}])).error,'invalid');
  // Nonparticipating legacy writer mutation during the read window is
  // detected when observable; this does NOT prove old tabs are fenced.
  let raced = false;
  f.onRead(k => { if (k===a.sourceKey && !raced) { raced=true; f.disk.set(k,JSON.stringify([f.op('race')])); } });
  assert.equal((await a.appendBatch([f.op(5)])).ok,true);
  f.onRead(null);
  assert.deepEqual(a.snapshot().ops,[f.op('race'),f.op(5)]);
  // Mutating between two reads must abort rather than erase the other writer.
  let reads=0;
  f.onRead(k=>{ if(k===a.sourceKey && ++reads===2) f.disk.set(k,JSON.stringify([f.op('other')])); });
  assert.equal((await a.appendBatch([f.op(6)])).error,'source-changed');
  f.onRead(null);
  assert.deepEqual(a.snapshot().ops,[f.op('other')]);
  // Readback corruption is uncertain, never treated as a safe retry.
  f.onWrite(k=>{ if(k===a.sourceKey) f.disk.set(k,'{}'); });
  assert.deepEqual(await a.appendBatch([f.op(7)]),{ok:false,error:'storage-verify',uncertain:true});
  f.onWrite(null);
  assert.equal(f.disk.get(a.sourceKey),'{}');
  console.log('QA LEGACY LOCKED WRITER TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1});
