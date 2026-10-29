// QA #90: unordered legacy journal actions must never be remotely reordered.
// Run: node web/test/qa_journal_unsequenced_delivery_test.js
'use strict';
const assert = require('node:assert/strict');
const { qaOutboxJournal } = require('../logic/outbox-journal.js');
const { qaJournalDelivery } = require('../logic/outbox-delivery.js');

function fixture() {
  const disk = new Map();
  const storage = {
    get length() { return disk.size; },
    key(i) { return [...disk.keys()][i] ?? null; },
    getItem(k) { return disk.get(k) ?? null; },
    setItem(k,v) { disk.set(k,v); },
    removeItem(k) { disk.delete(k); }
  };
  const locks = { request: async (_name, opts, fn) => {
    assert.equal(opts.mode, 'exclusive');
    return fn({});
  }};
  const journal = (id, uid='alice') =>
    qaOutboxJournal(storage, uid, 's1', () => id);
  const op = note => ({path:'days/same',kind:'set',data:{note}});
  const drain = (uid='alice') => {
    const sent = [];
    const delivery = qaJournalDelivery(journal('reader',uid), locks,
      uid, 's1', async operation => { sent.push(operation.data.note); }, () => true);
    return {sent, run: () => delivery.drain()};
  };
  return {disk, journal, op, drain, locks};
}

(async () => {
  const f = fixture();
  // Deliberately reverse lexical key order relative to user action order.
  assert(f.journal('z_first').appendBatch([f.op('first')]).ok);
  assert(f.journal('a_second').appendBatch([f.op('second')]).ok);
  const before = [...f.disk.entries()];
  const delivery = f.drain();
  assert.deepEqual(await delivery.run(),
    {ok:false,error:'unordered-pending',sent:0,acknowledged:0});
  assert.deepEqual(delivery.sent, [], 'no remote write before full preflight');
  assert.deepEqual([...f.disk.entries()], before, 'no pending edit discarded');
  assert.deepEqual(await delivery.run(),
    {ok:false,error:'unordered-pending',sent:0,acknowledged:0});

  // A single pre-ordered action is still compatible with the original API.
  const single = fixture();
  assert(single.journal('one').appendBatch([single.op('single')]).ok);
  const oldDelivery = single.drain();
  assert.deepEqual(await oldDelivery.run(), {ok:true,sent:1,acknowledged:1});
  assert.deepEqual(oldDelivery.sent, ['single']);

  // Ordered actions are unambiguous even when IDs enumerate in reverse order.
  const ordered = fixture();
  assert((await ordered.journal('z_first').appendOrdered(
    ordered.op('first'), ordered.locks, () => true)).ok);
  assert((await ordered.journal('a_second').appendOrdered(
    ordered.op('second'), ordered.locks, () => true)).ok);
  const orderedDelivery = ordered.drain();
  assert.deepEqual(await orderedDelivery.run(),
    {ok:true,sent:2,acknowledged:2});
  assert.deepEqual(orderedDelivery.sent, ['first','second']);

  // A staged migration copy always takes priority over the unordered error.
  const staged = fixture();
  assert(staged.journal('normal').appendBatch([staged.op('normal')]).ok);
  assert(staged.journal('legacy_chunk_v1_000000').appendBatch(
    [staged.op('copy')]).ok);
  const stagedDelivery = staged.drain();
  assert.equal((await stagedDelivery.run()).error,'migration-staged');
  assert.deepEqual(stagedDelivery.sent, []);
  assert.equal(staged.journal('reader').list().records.length, 2);

  // A second account cannot influence this account's ordering.
  const isolated = fixture();
  assert(isolated.journal('one').appendBatch([isolated.op('alice')]).ok);
  assert(isolated.journal('two','bob').appendBatch([isolated.op('bob')]).ok);
  const alice = isolated.drain('alice'), bob = isolated.drain('bob');
  assert.equal((await alice.run()).ok,true);
  assert.equal((await bob.run()).ok,true);
  assert.deepEqual(alice.sent,['alice']);
  assert.deepEqual(bob.sent,['bob']);
  console.log('QA JOURNAL UNSEQUENCED DELIVERY TESTS PASSED');
})().catch(e => { console.error(e); process.exitCode = 1; });
