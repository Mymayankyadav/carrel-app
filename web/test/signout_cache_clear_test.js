// Run: node web/test/signout_cache_clear_test.js
// A successful sign-out is not proof that its IndexedDB deletion committed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const storage = new Map(), adapters = [], clearCalls = [];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const S = {
  uid: null, db: null, conn: 'none', pending: [], inflight: new Set(),
  unsubs: [], resubT: 0, base: {}, loaded: {}, fetched: new Set()
};
const ctx = {
  S, ACT: {}, VIEWS: {}, UI: {view: 'today',pages:[],sheet:null}, UNDO: [],
  retryT: {}, DL: null, console,
  store: {
    get: key => storage.has(key) ? structuredClone(storage.get(key)) : null,
    set: (key,val) => { if (val == null) storage.delete(key); else storage.set(key,structuredClone(val)); }
  },
  window: {addEventListener(){}}, document: {addEventListener(){}},
  setTimeout: () => 1, clearTimeout(){}, setInterval:()=>1, clearInterval(){},
  recompute(){}, render(){}, changed(){}, subscribe(){}, pumpAll(){},
  savePending(){}, restorePending(){}, nativeBoot(){}, nativeClear(){},
  kBtn: (label,attrs) => '<button '+attrs+'>'+label+'</button>',
  icon:()=>'', esc:s=>String(s), ACTS:[], CFG:{}, SUGGEST:[],
  makeDb(_sb, uid, opts) {
    const adapter = {
      uid, opts, closed:false,
      close(){this.closed=true;},
      clear() {
        const task = opts.clearOnly ? Promise.resolve(ctx.retryResult.shift()) : deferred();
        clearCalls.push({uid, opts, task});
        return task.promise || task;
      }
    };
    adapters.push(adapter);
    return adapter;
  },
  retryResult: []
};
vm.createContext(ctx);
for (const file of ['auth.js','ui/welcome.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
}
const session = id => ({user:{id}});
(async () => {
  ctx.openDb(session('alice'));
  assert.equal(adapters[0].opts.idb,true);
  const first = ctx.teardownDb(true);
  ctx.showSignedOut();
  assert.equal(storage.get('cacheClearPending')[0],'alice',
    'deletion obligation is durable before its asynchronous completion');
  assert.match(ctx.VIEWS.welcome(),/Clearing device cache/);
  assert.match(ctx.VIEWS.welcome(),/disabled/);
  clearCalls[0].task.resolve(false);
  assert.equal(await first,false);
  assert.match(ctx.VIEWS.welcome(),/Device cache not cleared/);
  assert.match(ctx.VIEWS.welcome(),/Retry clearing/);
  assert.deepEqual(storage.get('cacheClearPending'),['alice']);

  // A new sign-in for the same account must not hydrate the failed cache.
  ctx.openDb(session('alice'));
  assert.equal(adapters[1].opts.idb,false);
  const callsBefore = clearCalls.length;
  await ctx.ACT['a1-retry-cache-clear']();
  assert.equal(clearCalls.length,callsBefore,'no retry may erase a signed-in cache');

  // Two rapid sign-outs for one UID: a late success from the first must not
  // acknowledge the second sign-out's still-failing deletion.
  const second = ctx.teardownDb(true); ctx.showSignedOut();
  ctx.openDb(session('alice'));
  const third = ctx.teardownDb(true); ctx.showSignedOut();
  clearCalls[1].task.resolve(true);
  assert.equal(await second,true);
  assert.deepEqual(storage.get('cacheClearPending'),['alice'],
    'older completion cannot remove a newer cleanup obligation');
  clearCalls[2].task.resolve(false);
  assert.equal(await third,false);
  assert.match(ctx.VIEWS.welcome(),/Device cache not cleared/);

  ctx.retryResult.push(false,true);
  await ctx.ACT['a1-retry-cache-clear']();
  assert.deepEqual(storage.get('cacheClearPending'),['alice'],
    'failed manual retry retains the warning');
  assert.equal(clearCalls[3].opts.clearOnly,true);
  assert.equal(clearCalls[3].uid,'alice');
  assert.equal(adapters[3].closed,true,'disk-only adapter is immediately closed');
  await ctx.ACT['a1-retry-cache-clear']();
  assert.equal(storage.has('cacheClearPending'),false);
  assert.doesNotMatch(ctx.VIEWS.welcome(),/Device cache not cleared/);
  assert.equal(clearCalls[4].opts.clearOnly,true);

  // Other accounts are not included in the cleanup obligation.
  ctx.openDb(session('bob'));
  assert.equal(adapters.at(-1).opts.idb,true);
  console.log('SIGN-OUT CACHE CLEAR RECOVERY TESTS PASSED');
})().catch(e => { console.error(e); process.exitCode = 1; });
