// QA #90: migration COPY records must never reach remote delivery or generic ack.
// Run: node web/test/qa_journal_staged_delivery_fence_test.js
'use strict';
const assert = require('node:assert/strict');
const { qaOutboxJournal } = require('../logic/outbox-journal.js');
const { qaJournalDelivery } = require('../logic/outbox-delivery.js');
const { qaJournalLegacyPreflight, qaJournalStageLegacy } = require('../logic/outbox-migration.js');
const { qaJournalChunkStage } = require('../logic/outbox-migration-chunks.js');

function fixture() {
  const disk = new Map();
  const storage = {
    get length() { return disk.size; },
    key(i) { return [...disk.keys()][i] ?? null; },
    getItem(k) { return disk.get(k) ?? null; },
    setItem(k, v) { disk.set(k, v); },
    removeItem(k) { disk.delete(k); }
  };
  const uid = 'alice', session = 's1';
  const sourceKey = 'carrel.pending:' + uid + ':' + session;
  const factory = id => qaOutboxJournal(storage, uid, session, () => id);
  const locks = { request: async (_name, _opts, fn) => fn({}) };
  const preflight = qaJournalLegacyPreflight(storage, factory('preflight'), uid, session);
  const edit = n => ({path:'days/2026-10-30', kind:'set', data:{note:String(n)}});
  const drain = async (send, current=()=>true) =>
    qaJournalDelivery(factory('reader'), locks, uid, session, send, current).drain();
  return { disk, storage, uid, session, sourceKey, factory, locks, preflight, edit, drain };
}

(async () => {
  // Copy 600 operations across three durable chunks, then try delivery.
  const f = fixture();
  const ops = Array.from({length:600}, (_, i) => f.edit(i));
  const sourceRaw = JSON.stringify(ops);
  f.disk.set(f.sourceKey, sourceRaw);
  const staging = qaJournalChunkStage(f.storage, f.factory, f.preflight,
    f.uid, f.session, f.locks, () => true);
  assert.equal((await staging.stage()).complete, false);
  assert.equal((await staging.stage()).complete, true);
  const staged = f.factory('reader').list().records;
  assert.equal(staged.length, 3);
  let sends = 0;
  const forbidden = await f.drain(async () => { sends++; });
  assert.deepEqual(forbidden,
    {ok:false, error:'migration-staged', sent:0, acknowledged:0});
  assert.equal(sends, 0);
  for (const item of staged)
    assert.equal(f.factory('reader').acknowledge(item), false,
      'a generic remote ack must never retire a non-authoritative copy');
  assert.equal(f.disk.get(f.sourceKey), sourceRaw);
  assert.equal(f.factory('reader').list().records.length, 3);

  // A normal action appearing BEFORE a staged copy must not be sent either.
  const live = f.factory('normal').appendBatch([f.edit('normal')]);
  assert.equal(live.ok, true);
  for (const item of staged) {
    const raw = f.disk.get(item.key);
    f.disk.delete(item.key);
    f.disk.set(item.key, raw); // force normal record to enumerate first
  }
  assert.equal(f.factory('reader').list().records[0].record.id, 'normal');
  assert.equal((await f.drain(async () => { sends++; })).error, 'migration-staged');
  assert.equal(sends, 0, 'pre-scan must run before ANY remote write');
  assert.equal(f.disk.has(live.key), true);

  // Older one-batch staging uses a different reserved ID: also blocked.
  const old = fixture();
  old.disk.set(old.sourceKey, JSON.stringify([old.edit('old')]));
  const legacyStage = qaJournalStageLegacy(old.storage, old.factory,
    old.uid, old.session, old.locks, () => true);
  assert.equal((await legacyStage.stage()).ok, true);
  let oldSends = 0;
  assert.equal((await old.drain(async () => { oldSends++; })).error, 'migration-staged');
  assert.equal(oldSends, 0);
  assert.equal(old.factory('reader').acknowledge(old.factory('reader').list().records[0]), false);
  assert.equal(old.disk.has(old.sourceKey), true);

  // Existing unsequenced non-migration journals remain backwards compatible.
  const ordinary = fixture();
  assert.equal(ordinary.factory('normal').appendBatch([ordinary.edit('a')]).ok, true);
  let ordinarySends = 0;
  assert.deepEqual(await ordinary.drain(async () => { ordinarySends++; }),
    {ok:true, sent:1, acknowledged:1});
  assert.equal(ordinarySends, 1);
  assert.equal(ordinary.factory('reader').list().records.length, 0);

  // Ordered appends remain deliverable; account/session isolation is preserved.
  const ordered = fixture();
  assert.equal((await ordered.factory('ordered').appendOrdered(
    ordered.edit('ordered'), ordered.locks, () => true)).ok, true);
  assert.equal((await ordered.drain(async () => {})).acknowledged, 1);
  const other = qaOutboxJournal(f.storage, 'bob', 's1', () => 'other');
  assert.equal(other.list().records.length, 0);
  assert.equal((await f.drain(async () => {}, () => false)).error, 'stale-session');
  assert.equal(f.disk.get(f.sourceKey), sourceRaw);

  console.log('QA JOURNAL STAGED DELIVERY FENCE TESTS PASSED');
})().catch(e => { console.error(e); process.exitCode = 1; });
