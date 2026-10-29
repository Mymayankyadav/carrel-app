// QA #90: chunked, restartable COPY only; never a production authority switch.
'use strict';
const assert = require('node:assert/strict');
const { qaJournalChunkStage } = require('../logic/outbox-migration-chunks.js');
const { qaJournalLegacyPreflight } = require('../logic/outbox-migration.js');
const { qaOutboxJournal } = require('../logic/outbox-journal.js');

function fixture() {
  const disk = new Map();
  let blockedRead = null, blockedWrite = null, current = true, onWrite = null;
  const storage = {
    get length() { return disk.size; },
    key(i) { return [...disk.keys()][i] ?? null; },
    getItem(k) { if (blockedRead && k.includes(blockedRead)) throw Error('SecurityError'); return disk.get(k) ?? null; },
    setItem(k,v) {
      if (blockedWrite && k.includes(blockedWrite)) throw Error('QuotaExceededError');
      disk.set(k,v);
      if (onWrite) onWrite(k);
    },
    removeItem(k) { disk.delete(k); }
  };
  const uid = 'alice', session = 'session_1';
  const sourceKey = 'carrel.pending:' + uid + ':' + session;
  const factory = id => qaOutboxJournal(storage, uid, session, () => id);
  const pre = qaJournalLegacyPreflight(storage, factory('preflight'), uid, session);
  const locks = { request: async (name, options, fn) => {
    assert.equal(name, 'carrel-journal-delivery.v1:alice:session_1');
    assert.deepEqual(options, { mode:'exclusive', ifAvailable:true });
    return fn({name});
  }};
  const stage = (limit=2, l=locks, isCurrent=()=>current) =>
    qaJournalChunkStage(storage, factory, pre, uid, session, l, isCurrent, limit);
  const op = i => ({path:'days/2026-10-30',kind:'update',
    data:{entries:{e:{note:String(i)}}},ensure:{date:'2026-10-30'},cond:null});
  const put = n => {
    const ops = Array.from({length:n},(_,i)=>op(i));
    const raw = JSON.stringify(ops);
    disk.set(sourceKey,raw);
    return {ops,raw};
  };
  return {disk,storage,sourceKey,factory,pre,stage,op,put,
    readFail:v=>blockedRead=v,writeFail:v=>blockedWrite=v,
    onWrite:v=>onWrite=v,current:v=>current=v};
}

(async () => {
  const f = fixture(), {ops,raw} = f.put(600);
  f.disk.set('carrel.pending:alice', JSON.stringify([f.op('legacy')]));
  f.disk.set('carrel.pending:bob:session_1', JSON.stringify([f.op('private')]));
  const first = await f.stage().stage();
  assert.equal(first.ok,true);
  assert.equal(first.complete,false);
  assert.equal(first.copied,2);
  assert.equal(first.staged,2);
  assert.equal(first.totalChunks,3);
  assert.equal(f.disk.get(f.sourceKey),raw);
  assert.equal(f.factory('x').list().records.length,2);
  const second = await f.stage().stage();
  assert.equal(second.ok,true);
  assert.equal(second.complete,true);
  assert.equal(second.copied,1);
  assert.equal(second.recovered,2);
  const third = await f.stage().stage();
  assert.equal(third.ok,true);
  assert.equal(third.copied,0);
  assert.equal(third.recovered,3);
  const records = f.factory('x').list().records;
  assert.equal(records.length,3);
  assert.deepEqual(records.flatMap(r=>r.record.ops),ops,'all 600 ops retained in FIFO chunks');
  assert(records.every(r=>r.record.seq===undefined),'copies cannot be sent by ordered journal');
  assert.equal(f.disk.get(f.sourceKey),raw,'source stays authoritative');
  assert(f.disk.has('carrel.pending:alice') && f.disk.has('carrel.pending:bob:session_1'));
  f.disk.set(f.sourceKey,JSON.stringify([...ops,f.op('new')]));
  assert.equal((await f.stage().stage()).error,'source-changed');
  f.disk.set(f.sourceKey,raw);
  assert.equal((await f.stage().stage()).complete,true);

  // A failed second chunk leaves a recoverable first chunk and the marker.
  const interrupted = fixture(); interrupted.put(520);
  interrupted.writeFail('legacy_chunk_v1_000001');
  assert.equal((await interrupted.stage().stage()).error,'journal-write');
  assert.equal(interrupted.factory('x').list().records.length,1);
  assert(interrupted.disk.has(interrupted.stage().markerKey));
  interrupted.writeFail(null);
  assert.equal((await interrupted.stage().stage()).staged,3);
  assert.equal((await interrupted.stage().stage()).complete,true);
  assert.equal(interrupted.factory('x').list().records.length,3);

  // Crash after marker, before any record: restart copies all chunks.
  const markerOnly = fixture(); markerOnly.put(257);
  markerOnly.writeFail('legacy_chunk_v1_000000');
  assert.equal((await markerOnly.stage().stage()).error,'journal-write');
  assert.equal(markerOnly.factory('x').list().records.length,0);
  markerOnly.writeFail(null);
  assert.equal((await markerOnly.stage().stage()).complete,true);
  assert.equal(markerOnly.factory('x').list().records.length,2);

  // No source truncation on errors; malformed/ambiguous data fail closed.
  const bad = fixture(); bad.put(300);
  bad.writeFail('pending-migration-chunks');
  assert.equal((await bad.stage().stage()).error,'marker-write');
  assert.equal(bad.factory('x').list().records.length,0);
  bad.writeFail(null);
  bad.readFail('carrel.pending:alice:session_1');
  assert.equal((await bad.stage().stage()).error,'source-unreadable');
  bad.readFail(null);
  bad.disk.set(bad.stage().markerKey,'{bad');
  assert.equal((await bad.stage().stage()).error,'marker-corrupt');
  bad.disk.delete(bad.stage().markerKey);
  bad.factory('unrelated').appendBatch([bad.op('other')]);
  assert.equal((await bad.stage().stage()).error,'unmarked-journal');

  const gap = fixture(); gap.put(600);
  assert.equal((await gap.stage().stage()).ok,true);
  gap.disk.delete(gap.factory('x').prefix+'legacy_chunk_v1_000000');
  assert.equal((await gap.stage().stage()).error,'chunk-gap');
  assert.equal(gap.disk.has(gap.sourceKey),true);

  const conflict = fixture(); conflict.put(300);
  conflict.disk.set('carrel.pending-migration-stage.v1:alice:session_1','{}');
  assert.equal((await conflict.stage().stage()).error,'other-staging-protocol');
  conflict.disk.delete('carrel.pending-migration-stage.v1:alice:session_1');
  conflict.current(false);
  assert.equal((await conflict.stage().stage()).error,'stale-session');
  conflict.current(true);
  assert.equal((await conflict.stage(2,null).stage()).error,'locks-unavailable');
  const busy = {request:async (_name,_opts,fn)=>fn(null)};
  assert.equal((await conflict.stage(2,busy).stage()).error,'busy');
  assert.equal(conflict.disk.size,1);

  // Legacy producer races are detected but NOT claimed to be prevented.
  const race = fixture(); race.put(520);
  race.onWrite(k => {
    if (k.includes('legacy_chunk_v1_000000'))
      race.disk.set(race.sourceKey,JSON.stringify([race.op('changed')]));
  });
  assert.equal((await race.stage().stage()).error,'source-changed');
  assert.equal(race.disk.has(race.sourceKey),true);

  const empty = fixture();
  assert.deepEqual(await empty.stage().stage(),{ok:true,empty:true,complete:true,staged:0});
  assert.equal(empty.disk.size,0);
  assert.throws(()=>empty.stage(0));
  assert.throws(()=>empty.stage(33));
  console.log('QA JOURNAL CHUNKED STAGING TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
