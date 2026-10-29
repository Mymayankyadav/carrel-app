// QA #90: non-authoritative large legacy outbox staging, no production sync.
'use strict';
const assert = require('node:assert/strict');
const { qaJournalStageLegacyChunks } = require('../logic/outbox-migration.js');
const { qaOutboxJournal } = require('../logic/outbox-journal.js');

const uid = 'alice', session = 'session_1';
const sourceKey = 'carrel.pending:' + uid + ':' + session;
const op = n => ({ path: 'days/2026-10-30', kind: 'update',
  data: { entries: { ['e' + n]: { note: String(n) } } },
  ensure: { date: '2026-10-30' }, cond: null });
function fixture(count = 300) {
  const disk = new Map();
  const original = Array.from({ length: count }, (_, i) => op(i));
  disk.set(sourceKey, JSON.stringify(original));
  let failWrite = () => false, failRead = () => false, onSet = () => {};
  const storage = {
    get length() { return disk.size; },
    key(i) { return [...disk.keys()][i] ?? null; },
    getItem(k) { if (failRead(k)) throw Error('SecurityError'); return disk.get(k) ?? null; },
    setItem(k, v) {
      if (failWrite(k)) throw Error('QuotaExceededError');
      disk.set(k, v);
      onSet(k);
    },
    removeItem(k) { disk.delete(k); }
  };
  let busy = false;
  const locks = {
    async request(name, opts, fn) {
      assert.equal(name, 'carrel-journal-delivery.v1:' + uid + ':' + session);
      assert.equal(opts.mode, 'exclusive');
      assert.equal(opts.ifAvailable, true);
      if (busy) return fn(null);
      busy = true;
      try { return await fn({ name }); }
      finally { busy = false; }
    }
  };
  const journal = () => qaOutboxJournal(storage, uid, session, () => 'not_used');
  const make = (fence = () => true, lock = locks) =>
    qaJournalStageLegacyChunks(storage, journal(), uid, session, lock, fence);
  return { disk, storage, locks, journal, make, original,
    failWrite: fn => { failWrite = fn; },
    failRead: fn => { failRead = fn; },
    onSet: fn => { onSet = fn; },
    setBusy: v => { busy = v; } };
}
async function run() {
  const d = fixture();
  const initialSource = d.disk.get(sourceKey);
  const migration = d.make();
  const first = await migration.stage();
  assert.equal(first.ok, true);
  assert.equal(first.count, 300);
  assert.equal(first.chunks, 3);
  assert.equal(first.recovered, false);
  assert.equal(d.disk.get(sourceKey), initialSource, 'source remains authoritative');
  const records = d.journal().list();
  assert.equal(records.ok, true);
  assert.deepEqual(records.records.map(x => x.record.seq), [1, 2, 3]);
  assert.deepEqual(records.records.map(x => x.record.ops.length), [128, 128, 44]);
  assert.deepEqual(records.records.flatMap(x => x.record.ops), d.original);
  assert.equal((await d.make().stage()).recovered, true, 'repeat is idempotent');
  assert.equal(d.journal().list().records.length, 3);

  const crashed = fixture(513);
  let failed = false;
  crashed.failWrite(k => {
    if (k.includes('legacy_chunk_v1_000002') && !failed) { failed = true; return true; }
    return false;
  });
  assert.equal((await crashed.make().stage()).error, 'journal-write');
  assert.equal(crashed.journal().list().records.length, 1);
  assert.ok(crashed.disk.has(crashed.make().markerKey), 'marker precedes first record');
  crashed.failWrite(() => false);
  const resumed = await crashed.make().stage();
  assert.equal(resumed.ok, true);
  assert.equal(resumed.recovered, true);
  assert.equal(resumed.chunks, 5);
  assert.deepEqual(crashed.journal().list().records.flatMap(x => x.record.ops),
    crashed.original, 'resume neither duplicates nor reorders operations');

  const changed = fixture(300);
  changed.failWrite(k => k.includes('legacy_chunk_v1_000002'));
  assert.equal((await changed.make().stage()).error, 'journal-write');
  changed.disk.set(sourceKey, JSON.stringify([op('edited')]));
  assert.equal((await changed.make().stage()).error, 'source-changed');
  assert.equal(changed.journal().list().records.length, 1,
    'source changes cannot authorize more writes');

  const raced = fixture(300);
  let mutated = false;
  raced.onSet(k => {
    if (!mutated && k.includes('legacy_chunk_v1_000001')) {
      mutated = true;
      raced.disk.set(sourceKey, JSON.stringify([op('new')]));
    }
  });
  assert.equal((await raced.make().stage()).error, 'source-changed');
  assert.equal(raced.journal().list().records.length, 1);

  const uncertain = fixture(300);
  let threw = false;
  uncertain.onSet(k => {
    if (!threw && k.includes('legacy_chunk_v1_000001')) {
      threw = true;
      throw Error('write succeeded but response failed');
    }
  });
  assert.equal((await uncertain.make().stage()).error, 'journal-write');
  uncertain.onSet(() => {});
  assert.equal((await uncertain.make().stage()).ok, true,
    'uncertain write must be inspected, never blindly overwritten');

  const other = fixture();
  assert.equal(other.journal().appendBatch([op(99)]).ok, true);
  assert.equal((await other.make().stage()).error, 'unmarked-journal');
  assert.equal((await fixture().make(() => false).stage()).error, 'stale-session');
  assert.equal((await fixture().make(() => true, null).stage()).error, 'locks-unavailable');
  const busy = fixture();
  busy.setBusy(true);
  assert.equal((await busy.make().stage()).error, 'busy');
  const unreadable = fixture();
  unreadable.failRead(k => k === sourceKey);
  assert.equal((await unreadable.make().stage()).error, 'source-unreadable');
  const markerFailure = fixture();
  markerFailure.failWrite(k => k.includes('pending-migration-chunks'));
  assert.equal((await markerFailure.make().stage()).error, 'marker-write');
  assert.equal(markerFailure.journal().list().records.length, 0);
  const corrupted = fixture();
  corrupted.disk.set(corrupted.make().markerKey, '{');
  assert.equal((await corrupted.make().stage()).error, 'marker-corrupt');
  const oversized = fixture(8193);
  assert.equal((await oversized.make().stage()).error, 'queue-too-large');
  assert.equal(oversized.journal().list().records.length, 0);
  const empty = fixture(0);
  assert.deepEqual(await empty.make().stage(), { ok: true, empty: true, staged: false });
  assert.equal(empty.disk.get(sourceKey), '[]');
  console.log('QA JOURNAL CHUNKED STAGING TESTS PASSED');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
