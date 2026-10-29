// Run: node web/test/auth_event_isolation_test.js
// Auth metadata/refresh events from another account must not activate or
// replay the current account's offline queue.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const storage = new Map(), scheduled = [], adapters = [], nativeTokens = [], pumps = [];
let authListener, nativeClears = 0, changes = 0;
const S = {
  uid: null, db: null, user: null, conn: 'none', owner: false, offline: false,
  pending: [], inflight: new Set(), unsubs: [], resubT: 0,
  base: {}, loaded: {}, fetched: new Set()
};
const sb = {
  auth: {
    onAuthStateChange(cb) { authListener = cb; },
    async refreshSession() { throw new Error('refresh should not be called'); }
  }
};
const ctx = {
  S, ACT: {}, UI: {view:'today',pages:[],sheet:null}, UNDO: [],
  retryT: {}, DL: null, console,
  store: {
    get: key => storage.get(key) || null,
    set: (key, value) => { if (value == null) storage.delete(key); else storage.set(key,value); }
  },
  window: {addEventListener(){}}, document: {addEventListener(){}},
  setTimeout(fn, ms) { if (ms === 0) scheduled.push(fn); return scheduled.length; },
  clearTimeout(){}, setInterval(){return 1;}, clearInterval(){},
  supabase: {createClient() { return sb; }},
  SUPABASE_URL: 'unused', SUPABASE_KEY: 'unused', NATIVE: false,
  async adoptNativeSession(){},
  nativeSession(session) { nativeTokens.push(session.user.id); },
  nativeClear() { nativeClears++; }, nativeBoot(){},
  makeDb(_sb, uid) {
    const db = {
      uid, closed: false, close(){this.closed = true;},
      clear(){ return Promise.resolve(true); }
    };
    adapters.push(db);
    return db;
  },
  savePending(){}, restorePending(){},
  subscribe(){}, pumpAll(){pumps.push(S.uid);},
  recompute(){}, render(){}, changed(){changes++;},
  toast(){}, confirmDialog:async()=>true
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../auth.js'),'utf8'),ctx,{filename:'auth.js'});
const session = id => ({user:{id}});
function emit(event, id) {
  assert.equal(typeof authListener,'function');
  authListener(event,id ? session(id) : null);
}
function flush() {
  while (scheduled.length) scheduled.shift()();
}

(async () => {
  await ctx.startSession();
  emit('INITIAL_SESSION','alice'); flush();
  assert.equal(S.uid,'alice');
  assert.equal(S.conn,'live');
  assert.deepEqual(nativeTokens,['alice']);
  assert.deepEqual(pumps,['alice']);

  S.conn='readonly';
  const before = pumps.length;
  emit('USER_UPDATED','bob');
  emit('TOKEN_REFRESHED','bob');
  flush();
  assert.equal(S.uid,'alice','unrelated metadata cannot switch accounts');
  assert.equal(S.conn,'readonly','unrelated token cannot restore write access');
  assert.equal(pumps.length,before,'no pending writes replayed under mismatched auth');
  assert.deepEqual(nativeTokens,['alice'],'unrelated token must not reach native storage');

  emit('USER_UPDATED','alice'); flush();
  assert.equal(S.conn,'readonly','profile update does not prove auth recovery');
  emit('TOKEN_REFRESHED','alice'); flush();
  assert.equal(S.conn,'live','matching token refresh can recover');
  assert.deepEqual(pumps,['alice','alice']);
  assert.deepEqual(nativeTokens,['alice','alice','alice']);

  S.conn='readonly';
  emit('SIGNED_IN','bob');
  emit('TOKEN_REFRESHED','alice'); // delayed refresh for the outgoing account
  flush();
  assert.equal(S.uid,'bob');
  assert.equal(S.conn,'live');
  assert.equal(adapters[0].closed,true);
  assert.deepEqual(nativeTokens,['alice','alice','alice','bob']);
  assert.equal(pumps.at(-1),'bob');
  assert.equal(pumps.filter(uid => uid === 'alice').length,2);

  // INITIAL_SESSION is a bootstrap snapshot, not an account-switch event.
  // Supabase may deliver a delayed snapshot after a newer explicit sign-in.
  const beforeInitialPumps = pumps.length;
  const beforeInitialTokens = nativeTokens.length;
  emit('INITIAL_SESSION','alice');
  emit('INITIAL_SESSION'); // stale empty bootstrap must not hide Bob's session
  flush();
  assert.equal(S.uid,'bob','late initial session cannot resurrect Alice');
  assert.equal(S.conn,'live','late empty initial session cannot sign out Bob');
  assert.equal(pumps.length,beforeInitialPumps,'stale bootstrap cannot replay writes');
  assert.equal(nativeTokens.length,beforeInitialTokens,'stale bootstrap cannot replace native credentials');

  // Even if explicit sign-in and a stale bootstrap arrive before the timer
  // queue is drained, the explicit event must win.
  emit('SIGNED_IN','bob');
  emit('INITIAL_SESSION','alice');
  flush();
  assert.equal(S.uid,'bob');
  assert.equal(S.conn,'live');

  emit('SIGNED_OUT');
  emit('TOKEN_REFRESHED','bob'); // stale event after logout
  flush();
  assert.equal(S.uid,null);
  assert.equal(S.db,null);
  assert.equal(S.conn,'none');
  assert.equal(nativeClears,1);
  assert.equal(nativeTokens.at(-1),'bob','stale refresh cannot repopulate native auth');
  assert.equal(pumps.at(-1),'bob','stale refresh cannot replay signed-out queue');

  emit('SIGNED_IN',null); flush();
  assert.equal(S.uid,null,'malformed identity event ignored');
  emit('INITIAL_SESSION','bob'); flush();
  assert.equal(S.uid,null,'bootstrap cannot restore a signed-out account');
  assert.equal(S.db,null);
  emit('SIGNED_IN','alice'); flush();
  assert.equal(S.uid,'alice','explicit new sign-in still works');
  assert.equal(S.conn,'live');
  assert.equal(changes,1,'only matching refresh of readonly session calls changed');

  // A real sign-out followed immediately by a new sign-in still tears down
  // the old account first and opens only the new account.
  const oldAdapter = S.db;
  emit('SIGNED_OUT');
  emit('SIGNED_IN','charlie');
  flush();
  assert.equal(oldAdapter.closed,true,'sign-out closes the outgoing adapter');
  assert.equal(S.uid,'charlie');
  assert.equal(S.conn,'live');
  assert.equal(pumps.at(-1),'charlie');
  emit('INITIAL_SESSION','alice'); flush();
  assert.equal(S.uid,'charlie','stale bootstrap cannot undo rapid sign-in');
  console.log('AUTH EVENT ACCOUNT ISOLATION TESTS PASSED');
})().catch(e => { console.error(e); process.exitCode=1; });
