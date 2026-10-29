// Run: node web/test/sync_pending_retention_test.js
// Failed remote writes must stay account-scoped and recoverable, even after
// the old ten-attempt limit or a server-side validation/quota rejection.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../core/sync.js'), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function harness(storage = new Map(), errorCode = 'unavailable', failCount = 0) {
  const S = {
    uid: 'alice', db: null, conn: 'live', owner: true, offline: false,
    base: { current: null, activities: null, settings: null, days: {}, plans: {},
      planning: {}, distractions: {}, reviews: [], topics: {}, rituals: {}, coach: {}, usage: {} },
    pending: [], inflight: new Set(), fetched: new Set(), loaded: {},
    unsubs: [], resubT: 0, windowFrom: '2026-10-01'
  };
  let attempt = 0, timerId = 0, authRecoveries = 0;
  const timers = new Map(), toasts = [], writes = [];
  const ctx = {
    S, console: {warn(){}}, clone: x => JSON.parse(JSON.stringify(x)),
    deepMerge: Object.assign, changed(){}, toast: msg => toasts.push(msg),
    recoverAuth(){authRecoveries++;},
    store: {
      get(k) { return storage.has(k) ? JSON.parse(JSON.stringify(storage.get(k))) : null; },
      set(k, v) { if (v == null) storage.delete(k); else storage.set(k, JSON.parse(JSON.stringify(v))); }
    },
    setTimeout(fn, ms) { assert.ok(ms > 0 && ms <= 75000); const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  S.db = {
    doc(p) {
      return {
        async set(data) {
          writes.push({path:p, data});
          if (++attempt <= failCount) throw {code:errorCode};
        },
        async update(data) { return this.set(data); },
        async delete() { return this.set(null); },
        async get() { return {exists:true,data:()=>({running:false})}; }
      };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  async function nextRetry() {
    assert.ok(timers.size, 'a retry should be scheduled');
    const [id, fn] = timers.entries().next().value;
    timers.delete(id);
    fn();
    await settle();
  }
  return {S, ctx, storage, timers, toasts, writes, nextRetry,
    get attempts(){return attempt;},
    get authRecoveries(){return authRecoveries;}};
}

(async () => {
  const h = harness(new Map(), 'unavailable', 12);
  h.ctx.enqueue({path:'days/2026-10-29',kind:'set',data:{date:'2026-10-29',entries:{x:{minutes:25}}}});
  await settle();
  for (let i = 0; i < 11; i++) await h.nextRetry();
  assert.equal(h.attempts,12);
  assert.equal(h.S.pending.length,1,'retry exhaustion must not drop the write');
  assert.equal(h.S.offline,true);
  assert.equal(h.storage.get('pending:alice').length,1,'unsent data must remain durable');
  assert.equal(h.toasts.filter(t => /still on this device/.test(t)).length,1,
    'notify only once at the former retry limit');
  await h.nextRetry(); // thirteenth attempt succeeds
  assert.equal(h.S.pending.length,0);
  assert.equal(h.storage.has('pending:alice'),false);
  assert.equal(h.S.offline,false);
  assert.equal(h.timers.size,0);

  // A reload after repeated failures must recover the exact unsent document.
  const shared = new Map();
  const failed = harness(shared, 'unavailable', 20);
  failed.ctx.enqueue({path:'plans/2026-10-30',kind:'set',data:{date:'2026-10-30',blocks:{a:1}}});
  await settle();
  for (let i = 0; i < 11; i++) await failed.nextRetry();
  const recovered = harness(shared);
  recovered.ctx.restorePending();
  assert.equal(recovered.S.pending.length,1);
  assert.equal(recovered.S.pending[0].data.blocks.a,1);
  recovered.ctx.pumpAll();
  await settle();
  assert.equal(recovered.S.pending.length,0);
  assert.equal(shared.has('pending:alice'),false);

  for (const code of ['quota_exceeded','invalid_argument','transform_error']) {
    const x = harness(new Map(), code, 1);
    x.ctx.enqueue({path:'topics/one',kind:'set',data:{v:1,title:'Unsent'}});
    await settle();
    assert.equal(x.S.pending.length,1,code+' must retain rejected edits');
    assert.equal(x.storage.get('pending:alice').length,1);
    assert.match(x.toasts.join(' '),/kept on this device/i);
    await x.nextRetry();
    assert.equal(x.S.pending.length,0,code+' must recover when the server accepts it');
  }

  // Auth errors pause rather than delete edits, then a confirmed reconnect
  // can retry them. No timer should spin while the adapter is read-only.
  const auth = harness(new Map(), 'not_granted', 1);
  auth.ctx.enqueue({path:'days/2026-10-29',kind:'set',data:{v:1}});
  await settle();
  assert.equal(auth.S.conn,'readonly');
  assert.equal(auth.authRecoveries,1);
  assert.equal(auth.S.pending.length,1);
  assert.equal(auth.timers.size,0);
  auth.S.conn = 'live';
  auth.ctx.pumpAll();
  await settle();
  assert.equal(auth.S.pending.length,0);

  // FIFO per path: a second edit must not overtake the failed first edit.
  const fifo = harness(new Map(), 'unavailable', 1);
  fifo.ctx.enqueue({path:'days/2026-10-29',kind:'set',data:{order:1}});
  fifo.ctx.enqueue({path:'days/2026-10-29',kind:'set',data:{order:2}});
  await settle();
  assert.deepEqual(fifo.writes.map(w=>w.data.order),[1]);
  await fifo.nextRetry();
  await settle();
  assert.deepEqual(fifo.writes.map(w=>w.data.order),[1,1,2]);
  assert.equal(fifo.S.pending.length,0);

  console.log('SYNC PENDING RETENTION TESTS PASSED');
})().catch(e => {console.error(e); process.exitCode = 1;});
