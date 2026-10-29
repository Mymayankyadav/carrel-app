// QA #90: restartable, non-authoritative staging of a bounded legacy queue.
'use strict';
const assert = require('node:assert/strict');
const { qaJournalStageLegacy } = require('../logic/outbox-migration.js');
const { qaOutboxJournal } = require('../logic/outbox-journal.js');

function fixture() {
  const disk = new Map();
  let failSet = false, failGet = false, failDelete = false, current = true;
  const storage = {
    get length() { return disk.size; },
    key(i) { return [...disk.keys()][i] ?? null; },
    getItem(k) { if (failGet) throw Error('SecurityError'); return disk.get(k) ?? null; },
    setItem(k, v) { if (failSet) throw Error('QuotaExceededError'); disk.set(k, v); },
    removeItem(k) { if (failDelete) throw Error('SecurityError'); disk.delete(k); }
  };
  const uid = 'alice', session = 'session_1';
  const sourceKey = 'carrel.pending:' + uid + ':' + session;
  const op = n => ({path:'days/2026-10-30',kind:'update',
    data:{entries:{a:{note:n}}},ensure:{date:'2026-10-30'},cond:null});
  const locks = { request: async (name, options, callback) => {
    assert.equal(name, 'carrel-journal-delivery.v1:alice:session_1');
    assert.deepEqual(options, {mode:'exclusive',ifAvailable:true});
    return callback({name});
  }};
  const factory = id => qaOutboxJournal(storage, uid, session, () => id);
  const stage = () => qaJournalStageLegacy(storage, factory, uid, session, locks, () => current);
  const journal = () => factory('legacy_stage_v1');
  return {disk,storage,uid,session,sourceKey,op,locks,factory,stage,journal,
    failSet:v => failSet=v, failGet:v => failGet=v,
    failDelete:v => failDelete=v, current:v => current=v};
}

(async () => {
  const f = fixture(), original = [f.op('first'),f.op('second')];
  const raw = JSON.stringify(original);
  f.disk.set(f.sourceKey, raw);
  f.disk.set('carrel.pending:alice', JSON.stringify([f.op('old-session')]));
  f.disk.set('carrel.pending:bob:session_1', JSON.stringify([f.op('other-account')]));
  const staging = f.stage();
  const first = await staging.stage();
  assert.equal(first.ok, true);
  assert.equal(first.count, 2);
  assert.equal(first.recovered, false);
  assert.equal(f.disk.get(f.sourceKey), raw, 'source remains authoritative and intact');
  assert.equal(f.disk.has('carrel.pending:alice'), true);
  assert.equal(f.disk.has('carrel.pending:bob:session_1'), true);
  assert.deepEqual(f.journal().list().records[0].record.ops, original);
  assert.equal(f.journal().list().records[0].record.seq, undefined,
    'staged copy is not yet promoted to ordered production delivery');
  assert.equal(f.disk.size, 5, 'source, two unrelated queues, marker, journal copy');
  const restarted = await f.stage().stage();
  assert.equal(restarted.ok, true);
  assert.equal(restarted.recovered, true);
  assert.equal(f.journal().list().records.length, 1, 'restart never duplicates staged edits');
  assert.equal(f.disk.size, 5);
  f.disk.set(f.sourceKey, JSON.stringify([...original, f.op('new')]));
  assert.equal((await f.stage().stage()).error, 'source-changed');
  assert.equal(f.journal().list().records.length, 1, 'changed legacy source not overwritten');
  f.disk.set(f.sourceKey, raw);
  assert.equal((await f.stage().stage()).ok, true);

  // Crash after durable marker but before copy: retry completes exactly one copy.
  const crash = fixture();
  crash.disk.set(crash.sourceKey, raw);
  const markerKey = crash.stage().markerKey;
  crash.disk.set(markerKey, JSON.stringify({v:1,uid:crash.uid,
    session:crash.session,sourceKey:crash.sourceKey,sourceRaw:raw}));
  const recovered = await crash.stage().stage();
  assert.equal(recovered.ok, true);
  assert.equal(recovered.recovered, false);
  assert.equal(crash.journal().list().records.length, 1);
  assert.equal((await crash.stage().stage()).recovered, true);

  // Storage errors never permit an empty interpretation or a source deletion.
  const errors = fixture();
  errors.disk.set(errors.sourceKey, raw);
  errors.failSet(true);
  assert.equal((await errors.stage().stage()).error, 'marker-write');
  assert.equal(errors.journal().list().records.length, 0);
  errors.failSet(false);
  errors.failGet(true);
  assert.equal((await errors.stage().stage()).error, 'source-unreadable');
  errors.failGet(false);
  errors.disk.set(errors.stage().markerKey, '{broken');
  assert.equal((await errors.stage().stage()).error, 'marker-corrupt');
  errors.disk.delete(errors.stage().markerKey);
  errors.current(false);
  assert.equal((await errors.stage().stage()).error, 'stale-session');
  errors.current(true);
  assert.equal(errors.disk.get(errors.sourceKey), raw);

  // Unmarked or unrelated journal records cannot be silently coalesced.
  const ambiguous = fixture();
  ambiguous.disk.set(ambiguous.sourceKey, raw);
  ambiguous.journal().appendBatch(original);
  assert.equal((await ambiguous.stage().stage()).error, 'unmarked-journal');
  const other = fixture();
  other.disk.set(other.sourceKey, raw);
  other.factory('another_action').appendBatch([other.op('independent')]);
  assert.equal((await other.stage().stage()).error, 'journal-not-empty');

  // No-lock and busy paths fail closed without even writing a marker.
  const noLock = fixture();
  noLock.disk.set(noLock.sourceKey, raw);
  const noLockStage = qaJournalStageLegacy(noLock.storage, noLock.factory,
    noLock.uid, noLock.session, null, () => true);
  assert.equal((await noLockStage.stage()).error, 'locks-unavailable');
  const busyStage = qaJournalStageLegacy(noLock.storage, noLock.factory,
    noLock.uid, noLock.session, {request: async (_,__,fn) => fn(null)}, () => true);
  assert.equal((await busyStage.stage()).error, 'busy');
  assert.equal(noLock.disk.size, 1);

  // Never silently truncate an action larger than one journal batch.
  const large = fixture();
  const many = Array.from({length:257},(_,i) => large.op(String(i)));
  large.disk.set(large.sourceKey, JSON.stringify(many));
  assert.equal((await large.stage().stage()).error, 'batch-too-large');
  assert.equal(large.disk.size, 1);

  const empty = fixture();
  assert.deepEqual(await empty.stage().stage(), {ok:true,empty:true,staged:false});
  assert.equal(empty.disk.size, 0);
  console.log('QA JOURNAL LEGACY STAGING TESTS PASSED');
})().catch(err => { console.error(err); process.exitCode = 1; });
