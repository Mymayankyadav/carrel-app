// Run: node web/test/sync_resubscribe_generation_test.js
// A new subscription on the SAME adapter must invalidate old callbacks/timers.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const S = {
  db: null, uid: 'alice', conn: 'live', owner: true,
  base: {current:null, activities:null, settings:null, days:{}, plans:{},
    distractions:{}, planning:{}, reviews:[], topics:{}, rituals:{},
    coach:{}, usage:{}},
  loaded:{}, pending:[], inflight:new Set(), fetched:new Set(),
  unsubs:[], resubT:0, windowFrom:'2026-10-01'
};
const timers = new Map();
let nextTimer = 0, changes = 0, authRecoveries = 0, unsubEmits = false;
const ctx = {
  S, console:{warn(){}}, clone:x=>x, deepMerge:Object.assign,
  store:{set(){},get(){return null;}}, toast(){},
  changed(){changes++;}, recoverAuth(){authRecoveries++;},
  addDaysKey(){return '2026-09-30';},
  setTimeout(fn, ms) {
    assert.equal(ms,5000);
    const id = ++nextTimer;
    timers.set(id,{fn,canceled:false});
    return id;
  },
  clearTimeout(id) {if(timers.has(id)) timers.get(id).canceled = true;}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../core/sync.js'),'utf8'),ctx);

const handlers = new Map();
let unsubs = 0;
const query = key => {
  const q = {
    where(){return q;}, orderBy(){return q;}, limit(){return q;},
    onSnapshot(next,err) {
      if(!handlers.has(key)) handlers.set(key,[]);
      handlers.get(key).push({next,err});
      return () => {
        unsubs++;
        // Some adapters may deliver a callback while unsubscribe executes.
        if(unsubEmits && key === 'state/current')
          next({exists:true,data:()=>({owner:'old-unsubscribe'})});
      };
    }
  };
  return q;
};
S.db = {doc:query,collection:query};
const latest = key => handlers.get(key).at(-1);
const first = key => handlers.get(key)[0];
const row = (id,data) => ({id,exists:true,data:()=>data});
const docs = (...items) => ({docs:items});

ctx.subscribe();
assert.equal(handlers.get('state/current').length,1);
first('state/current').next({exists:true,data:()=>({owner:'alice'})});
assert.equal(S.base.current.owner,'alice');

// Multiple simultaneous errors should schedule only one reconnect.
first('days').err({code:'unavailable'});
first('topics').err({code:'unavailable'});
assert.equal(timers.size,1);
const obsoleteTimer = timers.get(1);
assert.equal(S.resubT,1);

// A manual resubscribe cancels the timer and invalidates old listeners,
// including callbacks synchronously delivered during unsubscribe.
unsubEmits = true;
ctx.subscribe();
unsubEmits = false;
assert.equal(obsoleteTimer.canceled,true);
assert.equal(S.resubT,0);
assert.equal(S.base.current.owner,'alice');
assert.ok(unsubs > 0);
const afterResub = changes;
const count = handlers.get('state/current').length;

first('state/current').next({exists:true,data:()=>({owner:'stale'})});
first('days').next(docs(row('2026-10-29',{owner:'stale'})));
first('topics').next(docs(row('topic1',{owner:'stale'})));
first('planning').next(docs(row('backlog',{owner:'stale'})));
first('reviews').next(docs(row('week',{owner:'stale'})));
first('coach').err({code:'revoked'});
first('days').err({code:'unavailable'});
assert.equal(changes,afterResub,'stale listeners cannot redraw');
assert.equal(S.conn,'live','stale revoked error cannot downgrade auth');
assert.equal(authRecoveries,0);
assert.equal(timers.size,1,'stale errors cannot schedule reconnect');
assert.deepEqual(Object.keys(S.base.days),[]);
assert.deepEqual(Object.keys(S.base.topics),[]);
assert.deepEqual(Object.keys(S.base.planning),[]);
assert.equal(S.base.reviews.length,0);

// Fresh callbacks work, and one current network error reconnects once.
latest('state/current').next({exists:true,data:()=>({owner:'fresh'})});
latest('topics').next(docs(row('topic1',{owner:'fresh'})));
assert.equal(S.base.current.owner,'fresh');
assert.equal(S.base.topics.topic1.owner,'fresh');
latest('days').err({code:'unavailable'});
assert.equal(timers.size,2);
const liveTimer = timers.get(2);
// A canceled older callback can run AFTER a newer retry was scheduled.
// It must neither reconnect nor erase that newer retry's handle.
obsoleteTimer.fn();
assert.equal(handlers.get('state/current').length,count);
assert.equal(S.resubT,2);
liveTimer.fn();
assert.equal(handlers.get('state/current').length,count+1);
assert.equal(S.resubT,0);
const afterRetry = changes;
handlers.get('state/current')[count-1].next({exists:true,data:()=>({owner:'old-retry'})});
assert.equal(changes,afterRetry,'retry invalidates previous generation');
latest('state/current').next({exists:true,data:()=>({owner:'recovered'})});
assert.equal(S.base.current.owner,'recovered');
console.log('SYNC RESUBSCRIBE GENERATION TESTS PASSED');
