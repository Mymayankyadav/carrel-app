// QA #90: deterministic stale localStorage visibility reproduction.
'use strict';
const assert = require('node:assert/strict');
const { qaLegacyLockedWriter } = require('../logic/outbox-legacy-writer.js');
const { qaLegacyReceiptAudit } = require('../logic/outbox-legacy-receipts.js');
function locks() {
  const tails = new Map();
  return { request: async (name, opts, cb) => {
    assert.deepEqual(opts, {mode:'exclusive'});
    const prev = tails.get(name) || Promise.resolve();
    let release;
    const done = new Promise(r => { release = r; });
    tails.set(name, prev.then(() => done));
    await prev;
    try { return await cb({name}); } finally { release(); }
  }};
}
function fixture(stale) {
  const disk = new Map(), lock = locks();
  const key = 'carrel.pending:alice:s1';
  let quotaSource = false;
  function tab() {
    let cache = null;
    const storage = {
      get length() { return disk.size; },
      key(i) { return [...disk.keys()][i] ?? null; },
      getItem(k) {
        if (k === key && stale) return cache;
        return disk.get(k) ?? null;
      },
      setItem(k,v) {
        if (k === key && quotaSource) throw Error('QuotaExceededError');
        disk.set(k,v);
        if (k === key) cache = v;
      }
    };
    const writer = qaLegacyLockedWriter(storage,'alice','s1',lock,()=>true);
    return {writer,storage};
  }
  return {disk,key,tab,quotaSource:x=>quotaSource=x};
}
const op = n => ({path:'days/2026-10-30',kind:'update',data:{n}});
(async () => {
  // A Web Lock serializes callbacks but does not guarantee that a second
  // localStorage view sees the first callback's updated shared JSON array.
  const f = fixture(true), a=f.tab(), b=f.tab();
  const ga=qaLegacyReceiptAudit(a.storage,a.writer,'alice','s1',()=> 'receipt_a');
  const gb=qaLegacyReceiptAudit(b.storage,b.writer,'alice','s1',()=> 'receipt_b');
  const x=await ga.appendBatch([op(1)]);
  const y=await gb.appendBatch([op(2)]);
  assert.equal(x.ok,true); assert.equal(y.ok,true);
  assert.equal(x.crossTabVerified,false);
  assert.equal(y.crossTabVerified,false);
  assert.deepEqual(JSON.parse(f.disk.get(f.key)).map(o=>o.data.n),[2],
    'stale tab overwrites the shared array despite exclusive Web Locks');
  // Both actions remain recoverable as separate immutable receipts.
  assert.equal(f.disk.has(x.receiptKey),true);
  assert.equal(f.disk.has(y.receiptKey),true);
  // Audit using a fresh view of the actual durable source.
  const fresh=f.tab();
  const audit=qaLegacyReceiptAudit(fresh.storage,fresh.writer,'alice','s1',()=> 'fresh');
  assert.deepEqual(audit.audit(),{ok:false,error:'receipt-missing',
    missing:['receipt_a'],receiptCount:2,pendingCount:1});
  assert.deepEqual(JSON.parse(f.disk.get(x.receiptKey)).ops,[op(1)]);
  // With coherent storage, receipts are matched to their tagged queue ops.
  const good=fixture(false), c=good.tab(), d=good.tab();
  const gc=qaLegacyReceiptAudit(c.storage,c.writer,'alice','s1',()=> 'c');
  const gd=qaLegacyReceiptAudit(d.storage,d.writer,'alice','s1',()=> 'd');
  assert.equal((await gc.appendBatch([op(3),op(4)])).ok,true);
  assert.equal((await gd.appendBatch([op(5)])).ok,true);
  assert.deepEqual(gc.audit(),{ok:true,receiptCount:2,pendingCount:3});
  // Source quota failure leaves the receipt intact, never silently retries.
  good.quotaSource(true);
  const fail=qaLegacyReceiptAudit(c.storage,c.writer,'alice','s1',()=> 'quota');
  const rejected=await fail.appendBatch([op(6)]);
  assert.equal(rejected.ok,false); assert.equal(rejected.uncertain,true);
  assert.equal(good.disk.has(rejected.receiptKey),true);
  assert.deepEqual(gc.audit(),{ok:false,error:'receipt-missing',
    missing:['quota'],receiptCount:3,pendingCount:3});
  good.quotaSource(false);
  // A collision cannot overwrite an existing receipt or queue.
  const collide=qaLegacyReceiptAudit(c.storage,c.writer,'alice','s1',()=> 'c');
  assert.equal((await collide.appendBatch([op(7)])).error,'collision');
  assert.equal(gc.audit().error,'receipt-missing');
  // A corrupt receipt is unknown, not silently ignored.
  good.disk.set(gc.prefix+'bad','{broken');
  assert.equal(gc.audit().error,'receipt-corrupt');
  assert.throws(()=>qaLegacyReceiptAudit(c.storage,c.writer,'bob','s1'));
  console.log('QA LEGACY IMMUTABLE RECEIPT AUDIT TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1});
