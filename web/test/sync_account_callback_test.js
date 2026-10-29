// Run: node web/test/sync_account_callback_test.js
// Closed adapters must not deliver documents or errors into a new account.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const blank = () => ({
  current: null, activities: null, settings: null, days: {}, plans: {},
  distractions: {}, planning: {}, reviews: [], topics: {}, rituals: {},
  coach: {}, usage: {}
});
const S = {
  db: null, uid: 'alice', conn: 'live', owner: true,
  base: blank(), loaded: {}, pending: [], inflight: new Set(),
  fetched: new Set(), unsubs: [], resubT: 0, windowFrom: '2026-10-01'
};
let changes = 0, timers = 0;
const ctx = {
  S, console: {warn(){}}, clone: x => x, deepMerge: Object.assign,
  store: {set(){}, get(){return null;}}, toast(){},
  changed(){changes++;}, recoverAuth(){throw Error('stale auth error');},
  addDaysKey(){return '2026-09-30';},
  clearTimeout(){}, setTimeout(){timers++; return timers;}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../core/sync.js'), 'utf8'), ctx);

function adapter() {
  const handlers = new Map(), reads = [];
  function query(key) {
    const q = {
      where(){return q;}, orderBy(){return q;}, limit(){return q;},
      onSnapshot(next, err) { handlers.set(key, {next,err}); return () => {}; },
      get() { return new Promise((resolve, reject) => reads.push({key,resolve,reject})); }
    };
    return q;
  }
  return {
    handlers, reads,
    doc(p){return query(p);},
    collection(c){return query(c);}
  };
}
const row = (id, data) => ({id, exists:true, data:() => data});
const collection = (...docs) => ({docs});
const tick = async () => {for (let i=0;i<8;i++) await Promise.resolve();};

(async () => {
  const alice = adapter(), bob = adapter();
  S.db = alice;
  ctx.subscribe();
  assert.ok(alice.handlers.has('topics'));
  assert.ok(alice.handlers.has('state/current'));

  alice.handlers.get('state/current').next({exists:true,data:()=>({secret:'alice'})});
  assert.equal(S.base.current.secret,'alice');
  const aliceChangeCount = changes;

  // Start two historical reads; their completion belongs to Alice, even
  // if Bob opens a new adapter before the remote requests settle.
  ctx.ensureRange('2026-09-01','2026-09-02');
  ctx.ensureRange('2026-08-01','2026-08-02');
  assert.equal(alice.reads.length,6);

  S.uid = 'bob'; S.db = bob; S.conn = 'live';
  S.base = blank(); S.loaded = {}; S.fetched = new Set();
  ctx.subscribe();
  const before = changes, beforeTimers = timers;

  alice.handlers.get('state/current').next({exists:true,data:()=>({secret:'stale'})});
  alice.handlers.get('days').next(collection(row('2026-10-29',{secret:'stale'})));
  alice.handlers.get('topics').next(collection(row('topic1',{secret:'stale'})));
  alice.handlers.get('planning').next(collection(row('backlog',{secret:'stale'})));
  alice.handlers.get('reviews').next(collection(row('week1',{secret:'stale'})));
  alice.handlers.get('coach').err({code:'revoked'});
  alice.handlers.get('days').err({code:'unavailable'});
  assert.equal(S.base.current,null);
  assert.deepEqual(Object.keys(S.base.days),[]);
  assert.deepEqual(Object.keys(S.base.topics),[]);
  assert.deepEqual(Object.keys(S.base.planning),[]);
  assert.equal(S.base.reviews.length,0);
  assert.equal(S.conn,'live','stale auth errors cannot downgrade Bob');
  assert.equal(timers,beforeTimers,'stale network errors cannot schedule resubscribe');
  assert.equal(changes,before,'stale callbacks cannot redraw Bob with Alice data');

  // Bob's subscription still works after the stale callbacks were ignored.
  bob.handlers.get('topics').next(collection(row('bob-topic',{owner:'bob'})));
  assert.equal(S.base.topics['bob-topic'].owner,'bob');
  bob.handlers.get('state/current').next({exists:true,data:()=>({owner:'bob'})});
  assert.equal(S.base.current.owner,'bob');

  // Start Bob's fetch using the same tag as one of Alice's requests.
  ctx.ensureRange('2026-08-01','2026-08-02');
  assert.equal(bob.reads.length,3);
  const tag = '2026-08-01>2026-08-02';
  assert.equal(S.fetched.has(tag),true);

  for (const read of alice.reads.slice(0,3)) {
    read.resolve(collection(row('2026-09-01',{secret:'alice'})));
  }
  for (const read of alice.reads.slice(3)) read.reject(Error('Alice disconnected'));
  await tick();
  assert.equal(S.fetched.has(tag),true,'old failure must not clear Bob retry marker');
  assert.deepEqual(Object.keys(S.base.days),[],'old fetch cannot leak into Bob');
  assert.deepEqual(Object.keys(S.base.plans),[]);
  assert.deepEqual(Object.keys(S.base.distractions),[]);

  for (const read of bob.reads) read.resolve(collection(row('2026-08-01',{owner:'bob'})));
  await tick();
  assert.equal(S.base.days['2026-08-01'].owner,'bob');
  assert.equal(S.base.plans['2026-08-01'].owner,'bob');
  assert.equal(S.base.distractions['2026-08-01'].owner,'bob');
  assert.ok(changes > aliceChangeCount);
  console.log('SYNC ACCOUNT CALLBACK ISOLATION TESTS PASSED');
})().catch(e => { console.error(e); process.exitCode=1; });
