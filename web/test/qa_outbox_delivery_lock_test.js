// Run: node web/test/qa_outbox_delivery_lock_test.js
'use strict';
const assert = require('node:assert/strict');
const { qaOutboxJournal } = require('../logic/outbox-journal.js');
const { qaJournalDelivery } = require('../logic/outbox-delivery.js');

function device() {
  const disk = new Map();
  let failDelete = false, failRead = false;
  const storage = {
    get length() { return disk.size; },
    key(i) { return [...disk.keys()][i] ?? null; },
    getItem(k) { if (failRead) throw Error('SecurityError'); return disk.get(k) ?? null; },
    setItem(k,v) { disk.set(k,v); },
    removeItem(k) { if (failDelete) throw Error('SecurityError'); disk.delete(k); }
  };
  return { disk, storage, failDelete: v => failDelete = v, failRead: v => failRead = v };
}
function locks() {
  const held = new Set();
  return { request: async (name, opts, callback) => {
    assert.equal(opts.mode, 'exclusive');
    assert(opts.ifAvailable === undefined || opts.ifAvailable === true);
    if (held.has(name)) return callback(null);
    held.add(name);
    try { return await callback({ name }); } finally { held.delete(name); }
  }};
}
const edit = (day, note) => ({ path:'days/' + day, kind:'set', data:{note} });
(async () => {
  const d = device(), sharedLocks = locks();
  const a = qaOutboxJournal(d.storage,'alice','s1',()=> 'a_00001');
  const b = qaOutboxJournal(d.storage,'alice','s1',()=> 'b_00002');
  // Multiple actions require the explicit ordering protocol. The legacy
  // appendBatch() API alone cannot establish FIFO across browser tabs.
  const first = await a.appendBatchOrdered(
    [edit('2026-10-29','a1'),edit('2026-10-30','a2')], sharedLocks, () => true);
  const second = await b.appendBatchOrdered(
    [edit('2026-10-31','b1')], sharedLocks, () => true);
  assert(first.ok && second.ok);
  const delivered = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  const deliverA = qaJournalDelivery(a, sharedLocks, 'alice','s1', async op => {
    delivered.push(op.data.note);
    if (op.data.note === 'a1') { started(); await gate; }
  }, () => true);
  const deliverB = qaJournalDelivery(b, sharedLocks, 'alice','s1', async op => {
    delivered.push(op.data.note);
  }, () => true);
  const ongoing = deliverA.drain();
  await entered;
  assert.deepEqual(await deliverB.drain(),
    {ok:false,error:'busy',sent:0,acknowledged:0});
  release();
  assert.deepEqual(await ongoing,{ok:true,sent:3,acknowledged:2});
  assert.deepEqual(delivered,['a1','a2','b1'], 'batch ops remain in order');
  assert.deepEqual(await deliverB.drain(),{ok:true,sent:0,acknowledged:0},
    'second tab must enumerate AFTER lock and not replay acknowledged work');
  assert.equal(a.list().records.length,0);

  // Partial remote success keeps the whole batch. Server idempotency is not promised.
  let n = 0;
  const failBatch = qaOutboxJournal(d.storage,'alice','s1',()=> 'c_00003');
  failBatch.appendBatch([edit('2026-11-01','c1'),edit('2026-11-02','c2')]);
  const partial = qaJournalDelivery(failBatch,sharedLocks,'alice','s1',async () => ++n !== 2,()=>true);
  assert.deepEqual(await partial.drain(),{ok:false,error:'send',sent:1,acknowledged:0});
  assert.equal(failBatch.list().records.length,1);
  assert.deepEqual(await partial.drain(),{ok:true,sent:2,acknowledged:1});

  // Failed cleanup retains the operation for a later retry.
  const ackItem = qaOutboxJournal(d.storage,'alice','s1',()=> 'd_00004');
  ackItem.appendBatch([edit('2026-11-03','d')]);
  d.failDelete(true);
  assert.deepEqual(await deliverB.drain(),{ok:false,error:'ack',sent:1,acknowledged:0});
  assert.equal(ackItem.list().records.length,1);
  d.failDelete(false);
  assert.deepEqual(await deliverB.drain(),{ok:true,sent:1,acknowledged:1});

  // No Web Locks means no journal dispatch; a racy storage lease is forbidden.
  ackItem.appendBatch([edit('2026-11-04','e')]);
  const unsupported = qaJournalDelivery(ackItem,null,'alice','s1',()=>{throw Error('must not send')},()=>true);
  assert.equal((await unsupported.drain()).error,'locks-unavailable');
  assert.equal(ackItem.list().records.length,1);
  d.failRead(true);
  assert.equal((await deliverB.drain()).error,'storage');
  d.failRead(false);

  // Stale identity during an in-flight write cannot acknowledge or send another.
  let current = true;
  const fenced = qaJournalDelivery(ackItem,sharedLocks,'alice','s1',async()=>{current=false;},()=>current);
  assert.deepEqual(await fenced.drain(),{ok:false,error:'stale-session',sent:1,acknowledged:0});
  assert.equal(ackItem.list().records.length,1);
  assert.equal((await fenced.drain()).error,'stale-session');
  const wrong = qaOutboxJournal(d.storage,'bob','s1',()=> 'z_00005');
  const other = qaJournalDelivery(wrong,sharedLocks,'bob','s1',async()=>{},()=>true);
  assert.notEqual(deliverB.lockName,other.lockName);
  assert.deepEqual(await other.drain(),{ok:true,sent:0,acknowledged:0});
  assert.equal(ackItem.list().records.length,1);
  assert.throws(()=>qaJournalDelivery(ackItem,sharedLocks,'','s1',()=>{},()=>true));
  assert.throws(()=>qaJournalDelivery(ackItem,sharedLocks,'bob','s1',()=>{},()=>true),
    'cannot drain another account under the wrong lock');
  assert.equal((await qaJournalDelivery(ackItem,{request:()=>{throw Error('blocked')}},'alice','s1',()=>{},()=>true).drain()).error,'lock');
  console.log('QA JOURNAL DELIVERY LOCK TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
