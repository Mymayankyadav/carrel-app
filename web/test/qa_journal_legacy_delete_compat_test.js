// QA #90: payload-free deletes are valid legacy offline writes, not corruption.
// This exercises the actual JSON serialization used by sync.js.
'use strict';
const assert = require('node:assert/strict');
const { qaOutboxJournal } = require('../logic/outbox-journal.js');
const { qaJournalLegacyPreflight } = require('../logic/outbox-migration.js');
const { qaJournalChunkStage } = require('../logic/outbox-migration-chunks.js');
const { qaJournalDelivery } = require('../logic/outbox-delivery.js');

function fixture() {
  const disk = new Map();
  const storage = {
    get length() { return disk.size; },
    key(i) { return [...disk.keys()][i] ?? null; },
    getItem(k) { return disk.get(k) ?? null; },
    setItem(k, v) { disk.set(k, v); },
    removeItem(k) { disk.delete(k); }
  };
  const uid = 'alice', session = 'session_1';
  const makeJournal = id => qaOutboxJournal(storage, uid, session, () => id);
  const locks = { request: async (name, opts, callback) => {
    assert.equal(name, 'carrel-journal-delivery.v1:alice:session_1');
    assert.equal(opts.mode, 'exclusive');
    return callback({ name });
  }};
  return { disk, storage, uid, session, makeJournal, locks };
}

(async () => {
  const f = fixture();
  const sourceKey = 'carrel.pending:alice:session_1';
  const del = { path: 'topics/obsolete', kind: 'delete' };
  const upd = { path: 'days/2026-10-30', kind: 'update',
    data: { entries: { a: { note: 'kept' } } } };
  // savePending() writes JSON.stringify({data:undefined}) for delete, which
  // produces no data field at all. Include >256 ops to test chunk boundaries.
  const sourceOps = Array.from({ length: 260 }, (_, i) =>
    i % 2 ? { ...del, path: 'topics/obsolete_' + i } :
      { ...upd, path: 'days/2026-10-' + String(1 + (i % 30)).padStart(2, '0') });
  sourceOps[259] = { path: 'topics/last', kind: 'delete', data: null };
  const raw = JSON.stringify(sourceOps);
  f.disk.set(sourceKey, raw);
  f.disk.set('carrel.pending:bob:session_1', JSON.stringify([del]));
  const pre = qaJournalLegacyPreflight(f.storage, f.makeJournal('pre'), f.uid, f.session);
  const inspection = pre.inspect();
  assert.equal(inspection.ok, true);
  assert.equal(inspection.count, 260);
  assert.equal(Object.hasOwn(inspection.ops[1], 'data'), false);
  assert.equal(inspection.ops[259].data, null);
  assert.deepEqual(pre.verify(inspection, () => true), { ok: true, count: 260 });

  const stage = qaJournalChunkStage(f.storage, f.makeJournal, pre,
    f.uid, f.session, f.locks, () => true);
  const result = await stage.stage();
  assert.equal(result.ok, true);
  assert.equal(result.complete, true);
  assert.equal(result.staged, 2);
  const staged = f.makeJournal('read').list();
  assert.equal(staged.ok, true);
  assert.equal(staged.records.length, 2);
  const copied = staged.records.flatMap(item => item.record.ops);
  assert.equal(copied.length, 260);
  assert.equal(copied[1].kind, 'delete');
  assert.equal(Object.hasOwn(copied[1], 'data'), false);
  assert.equal(copied[259].data, null);
  assert.equal(f.disk.get(sourceKey), raw, 'legacy queue remains authoritative');
  assert(f.disk.has('carrel.pending:bob:session_1'), 'other account is untouched');

  let sends = 0;
  const delivery = qaJournalDelivery(f.makeJournal('read'), f.locks,
    f.uid, f.session, async () => { sends++; }, () => true);
  assert.equal((await delivery.drain()).error, 'migration-staged');
  assert.equal(sends, 0, 'non-authoritative migration copies must never be sent');
  assert.equal(f.makeJournal('read').acknowledge(staged.records[0]), false);
  assert.equal(f.makeJournal('read').list().records.length, 2);

  // An ordinary ordered journal action can also contain a delete without data.
  const g = fixture();
  const journal = g.makeJournal('ordered_delete');
  const appended = await journal.appendBatchOrdered([del], g.locks, () => true);
  assert.equal(appended.ok, true);
  assert.equal(journal.list().records[0].record.seq, 1);
  assert.equal(Object.hasOwn(journal.list().records[0].record.ops[0], 'data'), false);
  const delivered = [];
  const normal = qaJournalDelivery(journal, g.locks, g.uid, g.session,
    async op => { delivered.push(op); return true; }, () => true);
  assert.equal((await normal.drain()).ok, true);
  assert.deepEqual(delivered, [del]);
  assert.equal(journal.list().records.length, 0);

  // Missing payloads for set/update remain invalid; no silent data omission.
  const invalid = fixture();
  const invalidPre = qaJournalLegacyPreflight(invalid.storage,
    invalid.makeJournal('pre'), invalid.uid, invalid.session);
  for (const kind of ['set', 'update']) {
    invalid.disk.set(sourceKey, JSON.stringify([{ path: 'days/x', kind }]));
    assert.equal(invalidPre.inspect().error, 'source-corrupt');
    assert.equal(invalid.makeJournal('bad').appendBatch([{ path: 'days/x', kind }]).ok, false);
  }
  console.log('QA JOURNAL LEGACY DELETE COMPAT TESTS PASSED');
})().catch(error => { console.error(error); process.exitCode = 1; });
