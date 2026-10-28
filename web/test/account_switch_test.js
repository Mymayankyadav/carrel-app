// Run: node web/test/account_switch_test.js
// A SIGNED_IN account switch must not replay another user's queued writes or
// render their cached documents, even when an old RPC finishes afterward.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const storage = new Map();
const requests = [];
const clients = [];
const blankBase = () => ({
  current: undefined, activities: undefined, settings: undefined,
  days: {}, plans: {}, reviews: [], planning: {}, distractions: {},
  topics: {}, rituals: {}, coach: {}, usage: {}
});
const blankLoaded = () => Object.fromEntries(Object.keys(blankBase()).map(k => [k, false]));
const S = {
  uid: null, db: null, conn: 'none', owner: false, offline: false,
  pending: [], inflight: new Set(), unsubs: [], resubT: 0,
  base: blankBase(), loaded: blankLoaded(), fetched: new Set(), windowFrom: '2026-10-01'
};
let seq = 0;
const ctx = {
  S, ACT: {}, UI: {view:'today', pages:[], sheet:null}, UNDO: [],
  store: {
    get(k) { return storage.has(k) ? JSON.parse(JSON.stringify(storage.get(k))) : null; },
    set(k, v) { if (v == null) storage.delete(k); else storage.set(k, JSON.parse(JSON.stringify(v))); }
  },
  window: {addEventListener(){}}, document: {addEventListener(){}},
  console, DL: null,
  setTimeout() { return ++seq; }, clearTimeout(){},
  setInterval() { return ++seq; }, clearInterval(){},
  clone: v => v == null ? v : JSON.parse(JSON.stringify(v)),
  deepMerge: (a,b) => Object.assign({},a,b),
  toast(){}, changed(){}, recompute(){}, render(){}, subscribe(){},
  nativeBoot(){}, nativeClear(){}, addDaysKey(){return '2026-10-01';}, todayKey(){return '2026-10-29';},
  makeDb(_sb, uid) {
    const client = { uid, closed: false, close() {this.closed=true;}, clear(){},
      doc(p) {
        return {
          set(data) { return new Promise((resolve,reject) => requests.push({uid,path:p,data,resolve,reject})); },
          update(data) { return new Promise((resolve,reject) => requests.push({uid,path:p,data,resolve,reject})); },
          delete() { return Promise.resolve(); },
          get() { return Promise.resolve({exists:false,data:()=>null}); }
        };
      }
    };
    clients.push(client);
    return client;
  }
};
vm.createContext(ctx);
for (const file of ['core/sync.js', 'auth.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ctx, {filename:file});
}
// This unit test controls adapter completions; subscribing to the full app
// requires a larger UI/data harness and is covered by existing integration CI.
vm.runInContext('subscribe = () => {}', ctx);
const flush = async () => { for (let i=0;i<5;i++) await Promise.resolve(); };
const session = id => ({user:{id}});

(async () => {
  // Legacy unowned queues must remain recoverable but NEVER auto-replayed.
  storage.set('pending', [{path:'days/old',kind:'set',data:{secret:'unknown'}}]);
  ctx.UI.view = 'plan';
  ctx.openDb(session('alice'));
  assert.equal(ctx.UI.view, 'plan', 'first sign-in preserves requested tab');
  assert.equal(S.pending.length, 0);
  assert.equal(storage.has('pending'), true);

  S.base.days['2026-10-28'] = {secret:'alice'};
  S.loaded.activities = true;
  ctx.UI.pages.push({id:'subject',params:{secret:'alice'}});
  ctx.enqueue({path:'days/2026-10-28',kind:'set',data:{secret:'alice'}});
  assert.equal(requests.length, 1);
  assert.equal(requests[0].uid, 'alice');
  assert.equal(S.inflight.size, 1);

  // Switch without SIGNED_OUT: archive Alice's work, clear all user-visible state.
  ctx.openDb(session('bob'));
  assert.equal(clients[0].closed, true);
  assert.equal(S.uid, 'bob');
  assert.equal(S.pending.length, 0);
  assert.equal(S.inflight.size, 0);
  assert.equal(Object.keys(S.base.days).length, 0);
  assert.equal(S.loaded.activities, false);
  assert.equal(ctx.UI.pages.length, 0);
  assert.equal(ctx.UI.view, 'today');
  assert.equal(storage.get('pending:alice')[0].data.secret, 'alice');
  assert.equal(requests.length, 1, 'Alice queue never replayed as Bob');

  // An old auth error must not put Bob into read-only mode.
  requests[0].reject({code:'not_granted'});
  await flush();
  assert.equal(S.conn, 'live');
  assert.equal(S.pending.length, 0);

  ctx.enqueue({path:'days/2026-10-29',kind:'set',data:{secret:'bob'}});
  assert.equal(requests.at(-1).uid, 'bob');
  ctx.openDb(session('alice'));
  assert.equal(storage.get('pending:bob')[0].data.secret, 'bob');
  assert.equal(S.pending.length, 1, 'Alice pending restored only to Alice');
  assert.equal(S.pending[0].data.secret, 'alice');
  assert.equal(requests.at(-1).uid, 'alice');
  assert.equal(requests.at(-1).data.secret, 'alice');
  requests.find(r => r.uid === 'bob').resolve();
  await flush();
  assert.equal(S.uid, 'alice');
  assert.equal(S.pending.length, 1, 'late Bob success cannot remove Alice queue');

  // Explicit sign-out discards only the current account's unsaved queue.
  ctx.teardownDb(true);
  assert.equal(storage.has('pending:alice'), false);
  assert.equal(storage.get('pending:bob')[0].data.secret, 'bob');
  assert.equal(storage.has('pending'), true, 'unowned legacy queue not silently destroyed');
  assert.equal(S.pending.length, 0);

  ctx.openDb(session('bob'));
  assert.equal(S.pending.length, 1);
  assert.equal(S.pending[0].data.secret, 'bob');
  assert.equal(requests.at(-1).uid, 'bob');

  // The old unowned queue is importable only after explicit confirmation.
  let prompts = 0;
  ctx.confirmDialog = async opts => {
    prompts++;
    assert.equal(opts.danger, true);
    assert.match(opts.text, /no account label/);
    return false;
  };
  await ctx.ACT['a1-recover-legacy-pending']();
  assert.equal(storage.has('pending'), true, 'cancel preserves legacy edits');
  assert.equal(S.pending.length, 1);

  ctx.confirmDialog = async () => { prompts++; return true; };
  await ctx.ACT['a1-recover-legacy-pending']();
  assert.equal(prompts, 2);
  assert.equal(storage.has('pending'), false);
  assert.equal(S.pending.length, 2);
  assert.equal(storage.get('pending:bob').length, 2);
  assert.equal(requests.at(-1).uid, 'bob', 'import is queued only on confirmed account');
  console.log('ACCOUNT SWITCH ISOLATION TESTS PASSED');
})().catch(e => { console.error(e); process.exitCode = 1; });
