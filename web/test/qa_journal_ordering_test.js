// QA #90: explicit append-order protocol; run: node web/test/qa_journal_ordering_test.js
'use strict';
const assert = require('node:assert/strict');
const { qaOutboxJournal } = require('../logic/outbox-journal.js');
const { qaJournalDelivery } = require('../logic/outbox-delivery.js');

function device() {
  const disk = new Map();
  let quota = false, unreadable = false;
  const storage = {
    get length() { return disk.size; },
    key(i) { return [...disk.keys()][i] ?? null; },
    getItem(k) { if (unreadable) throw Error('SecurityError'); return disk.get(k) ?? null; },
    setItem(k, v) { if (quota) throw Error('QuotaExceededError'); disk.set(k, v); },
    removeItem(k) { disk.delete(k); }
  };
  return { disk, storage, quota: v => quota = v, unreadable: v => unreadable = v };
}
// A serial Web Locks mock exercises queued acquisition without timing races.
function serialLocks() {
  const tails = new Map(), held = new Set();
  return { request: async (name, opts, cb) => {
    if (opts.ifAvailable && held.has(name)) return cb(null);
    const previous = tails.get(name) || Promise.resolve();
    let release;
    const completed = new Promise(resolve => { release = resolve; });
    tails.set(name, previous.then(() => completed));
    await previous;
    held.add(name);
    try { return await cb({ name }); }
    finally { held.delete(name); release(); }
  }};
}
const edit = note => ({ path:'days/same', kind:'set', data:{note} });
(async () => {
  const d = device(), locks = serialLocks();
  const a = qaOutboxJournal(d.storage, 'alice', 'session_1', () => 'z_first');
  const b = qaOutboxJournal(d.storage, 'alice', 'session_1', () => 'a_second');
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  // Hold the SAME lock as delivery: another tab's append waits, not races.
  const lockName = 'carrel-journal-delivery.v1:alice:session_1';
  const holding = locks.request(lockName, {mode:'exclusive'}, async () => {
    entered(); await gate;
  });
  await ready;
  const firstPending = a.appendBatchOrdered([edit('first')], locks, () => true);
  const secondPending = b.appendOrdered(edit('second'), locks, () => true);
  assert.equal(d.disk.size, 0, 'pending lock cannot publish a partial action');
  release();
  await holding;
  const first = await firstPending, second = await secondPending;
  assert(first.ok && second.ok);
  assert.equal(first.id, 'z_first');
  assert.equal(second.id, 'a_second');
  const rows = b.list();
  assert.equal(rows.ok, true);
  assert.deepEqual(rows.records.map(x => x.record.seq), [1, 2]);
  assert.deepEqual(rows.records.map(x => x.record.ops[0].data.note), ['first','second'],
    'lexically reversed IDs must not change FIFO delivery');
  const delivered = [];
  const drain = qaJournalDelivery(a, locks, 'alice', 'session_1',
    async op => delivered.push(op.data.note), () => true);
  assert.deepEqual(await drain.drain(), {ok:true,sent:2,acknowledged:2});
  assert.deepEqual(delivered, ['first','second']);
  assert.equal(b.list().records.length, 0);

  // Restart with empty pending records: sequence may restart after all acks.
  const restarted = qaOutboxJournal(d.storage, 'alice', 'session_1', () => 'restart');
  assert.equal((await restarted.appendOrdered(edit('new'), locks, () => true)).ok, true);
  assert.deepEqual(restarted.list().records.map(x => x.record.seq), [1]);
  assert.equal((await restarted.appendOrdered(edit('no-lock'), null, () => true)).error,
    'locks-unavailable');
  assert.equal((await restarted.appendOrdered(edit('stale'), locks, () => false)).error,
    'stale-session');
  d.quota(true);
  assert.equal((await restarted.appendOrdered(edit('quota'), locks, () => true)).ok, false);
  d.quota(false);
  assert.deepEqual(restarted.list().records.map(x => x.record.seq), [1]);
  d.unreadable(true);
  assert.equal((await restarted.appendOrdered(edit('read'), locks, () => true)).error, 'read');
  d.unreadable(false);

  // Unsequenced legacy pending data cannot be silently interleaved.
  const legacy = qaOutboxJournal(d.storage, 'bob', 'session_1', () => 'old');
  assert.equal(legacy.appendBatch([edit('legacy')]).ok, true);
  assert.equal((await legacy.appendOrdered(edit('new'), locks, () => true)).error,
    'legacy-pending');
  assert.equal(legacy.list().records.length, 1);
  const mixed = qaOutboxJournal(d.storage, 'alice', 'session_1', () => 'unsequenced');
  assert.equal(mixed.appendBatch([edit('bad-mix')]).ok, true);
  assert.equal(restarted.list().error, 'mixed-order');
  assert.equal((await restarted.appendOrdered(edit('blocked'), locks, () => true)).error,
    'mixed-order');
  assert.equal(d.disk.has(restarted.prefix + 'restart'), true);

  // Duplicate sequences are ambiguous and must never be delivered.
  d.disk.delete(mixed.prefix + 'unsequenced');
  const raw = JSON.parse(d.disk.get(restarted.prefix + 'restart'));
  d.disk.set(restarted.prefix + 'duplicate', JSON.stringify({...raw, id:'duplicate'}));
  assert.equal(restarted.list().error, 'duplicate-order');
  assert.equal((await drain.drain()).error, 'storage');

  const other = qaOutboxJournal(d.storage, 'alice', 'session_2', () => 'other');
  assert.equal(other.list().records.length, 0);
  assert.equal((await other.appendOrdered(edit('isolated'), locks, () => true)).ok, true);
  console.log('QA JOURNAL ORDERED APPEND TESTS PASSED');
})().catch(e => { console.error(e); process.exitCode = 1; });
