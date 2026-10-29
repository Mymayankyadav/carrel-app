// QA #90: no-write migration preflight; production queue remains authoritative.
'use strict';
const assert = require('node:assert/strict');
const { qaJournalLegacyPreflight } = require('../logic/outbox-migration.js');
const { qaOutboxJournal } = require('../logic/outbox-journal.js');
function device() {
  const disk = new Map();
  let blockRead = false;
  const storage = {
    get length() { return disk.size; },
    key(i) { return [...disk.keys()][i] ?? null; },
    getItem(k) { if (blockRead) throw Error('SecurityError'); return disk.get(k) ?? null; },
    setItem(k, v) { disk.set(k, v); },
    removeItem(k) { disk.delete(k); }
  };
  return { disk, storage, block: v => { blockRead = v; } };
}
const d = device();
const journal = qaOutboxJournal(d.storage, 'alice', 'session_1', () => 'new_action');
const pre = qaJournalLegacyPreflight(d.storage, journal, 'alice', 'session_1');
const key = pre.sourceKey;
const op = n => ({ path:'days/2026-10-29', kind:'update', data:{entries:{e:{note:n}}},
  ensure:{date:'2026-10-29'}, cond:null });
const original = [op('first'), op('second')];
d.disk.set(key, JSON.stringify(original));
d.disk.set('carrel.pending:bob:session_1', JSON.stringify([op('private')]));
d.disk.set('carrel.pending:alice', JSON.stringify([op('older')]));
d.disk.set('carrel.pending', JSON.stringify([op('unowned')]));
const inspected = pre.inspect();
assert.equal(inspected.ok, true);
assert.equal(inspected.count, 2);
assert.deepEqual(inspected.ops, original);
assert.deepEqual(pre.verify(inspected, () => true), {ok:true,count:2});
assert.equal(pre.verify({...inspected, ops:[op('tampered')]}, () => true).error,
  'plan-changed', 'a mutated plan cannot reuse a valid source snapshot');
assert.equal(pre.verify(inspected, () => false).error, 'stale-session');
assert.equal(journal.list().records.length, 0, 'preflight never copies into journal');
assert.equal(d.disk.size, 4, 'preflight never removes or changes source or legacy queues');
d.disk.set(key, JSON.stringify([op('first'), op('changed')]));
assert.equal(pre.verify(inspected, () => true).error, 'source-changed');
d.disk.set(key, '{broken');
assert.equal(pre.inspect().error, 'source-corrupt');
d.disk.set(key, JSON.stringify([op('good'), {kind:'set', path:'days/bad'}]));
assert.equal(pre.inspect().error, 'source-corrupt', 'never drop malformed entries');
d.disk.set(key, JSON.stringify(original));
d.block(true);
assert.equal(pre.inspect().error, 'source-unreadable');
d.block(false);
assert.equal(journal.appendBatch([op('journal')]).ok, true);
assert.equal(pre.inspect().error, 'journal-not-empty', 'never combine two authoritative queues');
d.disk.delete(journal.prefix + 'new_action'); // fixture cleanup only; production never does this
assert.equal(d.disk.get(key), JSON.stringify(original));
// A concurrent tab can change the source during preflight enumeration.
const savedRead = d.storage.getItem;
let reads = 0;
d.storage.getItem = k => {
  const raw = savedRead(k);
  if (k === key && ++reads === 1)
    d.disk.set(key, JSON.stringify([op('raced')]));
  return raw;
};
assert.equal(pre.inspect().error, 'source-changed');
d.storage.getItem = savedRead;
d.disk.set(key, JSON.stringify(original));
// A malformed journal is unknown, not evidence that it is empty.
const badKey = journal.prefix + 'corrupt';
d.disk.set(badKey, '{');
assert.equal(pre.inspect().error, 'journal-unreadable');
d.disk.delete(badKey);
assert.throws(() => qaJournalLegacyPreflight(d.storage, journal, 'bob', 'session_1'));
console.log('QA JOURNAL LEGACY PREFLIGHT TESTS PASSED');
