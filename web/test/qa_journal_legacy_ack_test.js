// QA #90: guarded legacy acknowledgement prototype (not production-wired).
'use strict';
const assert = require('node:assert/strict');
const { qaLegacyLockedWriter } = require('../logic/outbox-legacy-writer.js');
function locks() {
  const tails = new Map();
  return { request: async (name, opts, callback) => {
    assert.deepEqual(opts, { mode: 'exclusive' });
    const previous = tails.get(name) || Promise.resolve();
    let release;
    const done = new Promise(resolve => { release = resolve; });
    tails.set(name, previous.then(() => done));
    await previous;
    try { return await callback({ name }); } finally { release(); }
  }};
}
function fixture() {
  const disk = new Map();
  let current = true, quota = false, unreadable = false, afterWrite = null, onRead = null;
  const storage = {
    getItem(k) { if (unreadable) throw Error('SecurityError'); if (onRead) onRead(k); return disk.get(k) ?? null; },
    setItem(k,v) { if (quota) throw Error('QuotaExceededError'); disk.set(k,v); if (afterWrite) afterWrite(k); }
  };
  const lock = locks();
  const writer = (u='alice',s='s1',l=lock) =>
    qaLegacyLockedWriter(storage,u,s,l,()=>current);
  const op = n => ({path:'days/2026-10-30',kind:'update',data:{n}});
  return {disk,writer,op,current:x=>current=x,quota:x=>quota=x,
    unreadable:x=>unreadable=x,afterWrite:x=>afterWrite=x,onRead:x=>onRead=x};
}
(async () => {
  const f = fixture(), a = f.writer(), b = f.writer(), o1=f.op(1), o2=f.op(2), o3=f.op(3);
  assert.equal((await a.appendBatch([o1,o2])).ok,true);
  const initial = a.snapshot().raw;
  assert.equal((await b.acknowledgePrefix(initial,[o2])).error,'ack-prefix-mismatch');
  assert.equal((await b.acknowledgePrefix(initial,[o1,o2,o3])).error,'ack-prefix-mismatch');
  assert.equal((await b.acknowledgePrefix(initial,[])).error,'invalid-ack');
  assert.equal((await b.acknowledgePrefix(null,[o1])).error,'invalid-ack');
  assert.equal((await b.acknowledgePrefix(initial,[{path:'days/x',kind:'bad'}])).error,'invalid-ack');
  assert.deepEqual(await b.acknowledgePrefix(initial,[o1]),
    {ok:true,acknowledged:1,remaining:1});
  assert.deepEqual(a.snapshot().ops,[o2]);
  assert.equal((await a.acknowledgePrefix(initial,[o1])).error,'source-changed');
  // A second tab's append must not be erased by a stale ack.
  const beforeAppend = a.snapshot().raw;
  assert.equal((await b.appendBatch([o3])).ok,true);
  assert.equal((await a.acknowledgePrefix(beforeAppend,[o2])).error,'source-changed');
  assert.deepEqual(a.snapshot().ops,[o2,o3]);
  // Concurrent ack and append serialize through the same lock.
  const currentRaw = a.snapshot().raw;
  const [ack,append] = await Promise.all([
    a.acknowledgePrefix(currentRaw,[o2]), b.appendBatch([o1])
  ]);
  assert.equal(ack.ok,true); assert.equal(append.ok,true);
  assert.deepEqual(a.snapshot().ops,[o3,o1]);
  assert.equal((await a.acknowledgePrefix(a.snapshot().raw,[o3,o1])).ok,true);
  assert.equal(a.snapshot().raw,'[]');
  assert.deepEqual(a.snapshot().ops,[]);
  assert.equal(f.writer('bob').snapshot().raw,null);
  assert.equal(f.writer('alice','s2').snapshot().raw,null);
  // A migration marker blocks deletion as well as appending.
  assert.equal((await a.appendBatch([o1])).ok,true);
  const marker='carrel.pending-migration-chunks.v1:alice:s1';
  f.disk.set(marker,'{}');
  assert.equal((await a.acknowledgePrefix(a.snapshot().raw,[o1])).error,'migration-staged');
  f.disk.delete(marker);
  // Unreadable, quota and stale-session failures must not report an ack.
  const raw = a.snapshot().raw;
  f.unreadable(true);
  assert.equal((await a.acknowledgePrefix(raw,[o1])).error,'storage-unreadable');
  f.unreadable(false);
  f.quota(true);
  assert.deepEqual(await a.acknowledgePrefix(raw,[o1]),
    {ok:false,error:'storage-write',uncertain:true});
  f.quota(false);
  assert.equal(a.snapshot().raw,raw);
  f.current(false);
  assert.equal((await a.acknowledgePrefix(raw,[o1])).error,'stale-session');
  f.current(true);
  assert.equal((await f.writer('alice','s1',null).acknowledgePrefix(raw,[o1])).error,
    'locks-unavailable');
  // An observable mutation by an old, unlocked writer is rejected.
  let reads=0;
  f.onRead(k => { if (k===a.sourceKey && ++reads===2)
    f.disk.set(k,JSON.stringify([o1,o2])); });
  assert.equal((await a.acknowledgePrefix(raw,[o1])).error,'source-changed');
  f.onRead(null);
  assert.deepEqual(a.snapshot().ops,[o1,o2]);
  // If a storage write succeeds but verification fails, caller must reconcile.
  f.afterWrite(k=>{ if(k===a.sourceKey) f.disk.set(k,'{}'); });
  assert.deepEqual(await a.acknowledgePrefix(a.snapshot().raw,[o1]),
    {ok:false,error:'storage-verify',uncertain:true});
  f.afterWrite(null);
  assert.equal(f.disk.get(a.sourceKey),'{}');
  console.log('QA LEGACY ACK LOCK TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1});
