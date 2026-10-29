// Run: node web/test/qa_outbox_journal_test.js
// Pure foundation for #90: per-operation keys avoid shared-array lost updates.
// Integration, cross-tab delivery ownership and sign-out are separate gates.
'use strict';
const assert = require('node:assert/strict');
const { qaOutboxJournal } = require('../logic/outbox-journal.js');

function device() {
  const disk = new Map();
  let quota = false, blockedRead = false, blockedKeys = false, blockedDelete = false;
  const storage = {
    get length() { if (blockedKeys) throw Error('SecurityError'); return disk.size; },
    key(i) { if (blockedKeys) throw Error('SecurityError'); return [...disk.keys()][i] ?? null; },
    getItem(k) { if (blockedRead) throw Error('SecurityError'); return disk.get(k) ?? null; },
    setItem(k, v) { if (quota) throw Error('QuotaExceededError'); disk.set(k, v); },
    removeItem(k) { if (blockedDelete) throw Error('SecurityError'); disk.delete(k); }
  };
  return { disk, storage, quota: v => quota = v, blockRead: v => blockedRead = v,
    blockKeys: v => blockedKeys = v, blockDelete: v => blockedDelete = v };
}
const edit = n => ({ path: 'days/' + n, kind: 'set',
  data: { date: n, entries: { e: { note: n } } } });
const d = device();
const a = qaOutboxJournal(d.storage, 'alice', 'session_1', () => 'tabA_op00001');
const b = qaOutboxJournal(d.storage, 'alice', 'session_1', () => 'tabB_op00002');
const other = qaOutboxJournal(d.storage, 'bob', 'session_1', () => 'tabC_op00003');
const later = qaOutboxJournal(d.storage, 'alice', 'session_2', () => 'tabD_op00004');

// Two tabs begin with an empty journal and append without a shared-array
// read/modify/write. Both survive even when one tab never refreshes its view.
assert.equal(a.list().records.length, 0);
assert.equal(b.list().records.length, 0);
const first = a.append(edit('2026-10-29'));
const second = b.append(edit('2026-10-30'));
assert.equal(first.ok, true);
assert.equal(second.ok, true);
assert.equal(a.list().records.length, 2);
assert.equal(b.list().records.length, 2);
assert.equal(other.list().records.length, 0, 'different UID is isolated');
assert.equal(later.list().records.length, 0, 'new sign-in is isolated');

// Crash/reload: a new context sees both edits, including the crashed tab's.
const recovered = qaOutboxJournal(d.storage, 'alice', 'session_1', () => 'tabE_op00005');
assert.equal(recovered.list().records.length, 2);
assert.equal(recovered.acknowledge(first), true);
assert.equal(recovered.list().records.length, 1);
assert.equal(recovered.list().records[0].key, second.key);
assert.equal(recovered.acknowledge(first), false, 'stale ack cannot erase anything');
assert.equal(recovered.acknowledge({ ...second, raw: '{}' }), false);
assert.equal(recovered.list().records.length, 1);

// Quota failure never overwrites the existing durable operation.
d.quota(true);
assert.equal(recovered.append(edit('2026-10-31')).ok, false);
assert.equal(recovered.list().records.length, 1);
d.quota(false);
d.blockRead(true);
assert.equal(recovered.append(edit('2026-10-31')).ok, false);
assert.equal(recovered.list().ok, false, 'inaccessible storage is unknown, not empty');
d.blockRead(false);
d.blockKeys(true);
assert.equal(recovered.list().ok, false);
d.blockKeys(false);
d.blockDelete(true);
assert.equal(recovered.acknowledge(second), false);
assert.equal(recovered.list().records.length, 1);
d.blockDelete(false);

// A malformed record poisons enumeration rather than silently dropping it.
const malformed = recovered.prefix + 'corrupt_op00006';
d.disk.set(malformed, '{not-json');
assert.equal(recovered.list().ok, false);
assert.equal(recovered.acknowledge({ key: malformed, raw: '{not-json' }), false,
  'acknowledgement cannot silently delete corrupted user data');
assert.equal(recovered.list().ok, false);
d.disk.delete(malformed); // explicit fixture cleanup; production never auto-discards
assert.equal(recovered.list().records.length, 1);

// No collision overwrite, no cross-account acknowledgement.
const collision = qaOutboxJournal(d.storage, 'alice', 'session_1', () => 'tabB_op00002');
assert.equal(collision.append(edit('2026-11-01')).error, 'collision');
assert.equal(other.acknowledge(second), false);
assert.equal(recovered.list().records.length, 1);
assert.equal(recovered.acknowledge(second), true);
assert.equal(recovered.list().records.length, 0);
assert.equal(d.disk.size, 0);
assert.throws(() => qaOutboxJournal(d.storage, '', 'session_1', () => 'valid_op00001'));
assert.equal(a.append({path: 'days/x', kind: 'nonsense', data: {}}).ok, false);
assert.equal(a.append({path: 'days/x', kind: 'set', data: undefined}).ok, false,
  'JSON cannot silently drop the operation payload');
assert.equal(d.disk.size, 0);
// A multi-document user action is one durable record, never a partial list.
// Two browser tabs can append independent actions without read-modify-write.
const batchedDevice = device();
const batchA = qaOutboxJournal(batchedDevice.storage, 'alice', 'session_1',
  () => 'actionA_00001');
const batchB = qaOutboxJournal(batchedDevice.storage, 'alice', 'session_1',
  () => 'actionB_00002');
const batchOther = qaOutboxJournal(batchedDevice.storage, 'alice', 'session_2',
  () => 'actionC_00003');
const multiOps = [edit('2026-11-02'), {path:'plans/2026-11-02', kind:'update',
  data:{blocks:{one:{minutes:30}}}, ensure:{date:'2026-11-02'}}];
const multi = batchA.appendBatch(multiOps);
assert.equal(multi.ok, true);
assert.equal(batchedDevice.disk.size, 1, 'one key per action, not per document');
assert.deepEqual(batchB.list().records[0].record.ops, multiOps);
const concurrent = batchB.appendBatch([edit('2026-11-03')]);
assert.equal(concurrent.ok, true);
assert.equal(batchA.list().records.length, 2, 'both tab actions survive');
assert.equal(batchOther.list().records.length, 0, 'session isolation holds');
assert.equal(batchA.acknowledge(multi), true);
assert.deepEqual(batchB.list().records[0].record.ops, [edit('2026-11-03')]);
assert.equal(batchA.acknowledge(multi), false, 'old batch ack cannot delete new work');

// Crash/reload and storage failure: never partially publish an action.
const reloaded = qaOutboxJournal(batchedDevice.storage, 'alice', 'session_1',
  () => 'actionD_00004');
assert.equal(reloaded.list().records.length, 1);
batchedDevice.quota(true);
assert.equal(reloaded.appendBatch(multiOps).ok, false);
assert.equal(reloaded.list().records.length, 1);
batchedDevice.quota(false);
assert.equal(reloaded.appendBatch([]).error, 'invalid');
assert.equal(reloaded.appendBatch([edit('x'), {kind:'set'}]).error, 'invalid');
assert.equal(reloaded.appendBatch(Array.from({length:257}, (_, i) => edit(String(i)))).error, 'invalid');
assert.equal(reloaded.appendBatch([edit('x'), {...edit('y'), data:undefined}]).error, 'serialize');
assert.equal(reloaded.list().records.length, 1);
assert.equal(reloaded.appendBatch([edit('x')]).ok, true);
assert.equal(reloaded.list().records.length, 2);
assert.equal(reloaded.acknowledge(concurrent), true);
assert.equal(reloaded.list().records.length, 1);

// Malformed or partially serialized batches poison the whole scan; never
// silently drop one document from an action during crash recovery.
const corruptBatch = reloaded.prefix + 'corrupt_batch_0001';
batchedDevice.disk.set(corruptBatch, JSON.stringify({
  v:1,uid:'alice',session:'session_1',id:'corrupt_batch_0001',
  ops:[edit('x'),{path:'days/y',kind:'set'}]
}));
assert.equal(reloaded.list().ok, false);
batchedDevice.disk.delete(corruptBatch);
assert.equal(reloaded.list().ok, true);

console.log('QA OUTBOX JOURNAL BATCH TESTS PASSED');
