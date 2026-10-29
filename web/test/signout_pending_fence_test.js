// Run: node web/test/signout_pending_fence_test.js
// A failed localStorage deletion must never replay discarded writes on login.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const disk = new Map(), failDeletes = new Set(), adapters = [], pumps = [];
const edit = {path:'days/2026-10-29',kind:'set',data:{date:'2026-10-29',entries:{x:{note:'offline'}}}};
const jwt = sid => 'header.' + Buffer.from(JSON.stringify({session_id:sid})).toString('base64url') + '.signature';
const session = (id,sid) => ({user:{id},access_token:jwt(sid)});
function harness() {
  const S = {uid:null,db:null,conn:'none',owner:false,pending:[],inflight:new Set(),
    unsubs:[],resubT:0,base:{},loaded:{},fetched:new Set()};
  const ctx = {S,ACT:{},VIEWS:{},UI:{view:'today',pages:[],sheet:null},UNDO:[],DL:null,console,
    atob: s=>Buffer.from(s,'base64').toString('utf8'),
    store:{
      get(k){return disk.has(k)?structuredClone(disk.get(k)):null;},
      keys(prefix){return [...disk.keys()].filter(k=>k.startsWith(prefix));},
      set(k,v){
        if (v===null && failDeletes.has(k)) return false; // read-back detected no-op
        if (v==null) disk.delete(k); else disk.set(k,structuredClone(v));
        return true;
      }
    },
    window:{addEventListener(){}},document:{addEventListener(){}},
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},
    clone:structuredClone,deepMerge:Object.assign,
    recompute(){},render(){},changed(){},nativeBoot(){},nativeClear(){},
    makeDb(_sb,uid,opts){
      const db={uid,opts,close(){},clear(){return Promise.resolve(true);}};
      adapters.push(db);return db;
    },
    toast(){},confirmDialog:async()=>true
  };
  vm.createContext(ctx);
  for(const f of ['core/sync.js','auth.js','ui/welcome.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx,{filename:f});
  }
  ctx.subscribe=()=>{};
  ctx.pumpAll=()=>{pumps.push(S.uid);};
  ctx.kBtn=(label,attrs)=>'<button '+attrs+'>'+label+'</button>';
  ctx.icon=()=>'';ctx.esc=s=>String(s);
  return {S,ctx};
}
(async()=>{
  const h=harness();
  h.ctx.openDb(session('alice','session-old-123'));
  assert.equal(h.ctx.pendingStoreKey(),'pending:alice:session-old-123');
  h.S.pending=[Object.assign({oid:1,tries:0},edit)];
  assert.equal(h.ctx.savePending(),true);
  assert.equal(disk.get('pending:alice:session-old-123').length,1);
  disk.set('pending:bob:session-bob-123',[edit]);
  disk.set('pending:alice',[edit]); // older account-scoped queue
  failDeletes.add('pending:alice:session-old-123');
  failDeletes.add('pending:alice');
  await h.ctx.teardownDb(true);
  h.ctx.showSignedOut();
  assert.equal(h.S.uid,null);
  assert.equal(h.S.pending.length,0);
  assert.match(h.ctx.VIEWS.welcome(),/Offline edits not cleared/);
  assert.ok(disk.get('pendingClearFailed').includes('pending:alice:session-old-123'));
  assert.equal(disk.get('pending:bob:session-bob-123').length,1);

  h.ctx.openDb(session('alice','session-new-123'));
  assert.equal(h.S.pending.length,0,'new session must not replay discarded outbox');
  assert.equal(h.ctx.pendingStoreKey(),'pending:alice:session-new-123');
  assert.equal(disk.get('pending:alice:session-old-123').length,1);

  // Reload with persisted stale outbox and cleanup marker. A new auth session
  // must not restore old writes even if the failed deletion was never retried.
  const reloaded=harness();
  reloaded.ctx.openDb(session('alice','session-after-reload-123'));
  assert.equal(reloaded.S.pending.length,0,'reload must not resurrect old queue');
  assert.equal(reloaded.ctx.pendingStoreKey(),'pending:alice:session-after-reload-123');

  await reloaded.ctx.teardownDb(true);reloaded.ctx.showSignedOut();
  assert.match(reloaded.ctx.VIEWS.welcome(),/Offline edits not cleared/);
  failDeletes.clear();
  reloaded.ctx.ACT['a1-retry-pending-clear']();
  assert.equal(disk.has('pending:alice:session-old-123'),false);
  assert.equal(disk.has('pending:alice'),false);
  assert.equal(disk.has('pendingClearFailed'),false);
  assert.doesNotMatch(reloaded.ctx.VIEWS.welcome(),/Offline edits not cleared/);
  assert.equal(disk.get('pending:bob:session-bob-123').length,1);

  // Pre-upgrade account queues remain recoverable only by explicit consent.
  disk.set('pending:alice',[edit]);
  const legacy=harness();
  legacy.ctx.openDb(session('alice','session-legacy-123'));
  assert.equal(legacy.S.pending.length,0);
  assert.equal(legacy.ctx.importLegacyPending(),1);
  assert.equal(legacy.S.pending.length,1);
  assert.equal(disk.has('pending:alice'),false);
  assert.equal(disk.get('pending:alice:session-legacy-123').length,1);

  // Switching accounts without signing out preserves prior-session edits,
  // but requires explicit recovery under the new session.
  disk.delete('pending:alice:session-legacy-123');
  disk.set('pending:alice:session-orphan-123',[edit]);
  const orphan=harness();
  orphan.ctx.openDb(session('alice','session-current-123'));
  assert.equal(orphan.S.pending.length,0);
  assert.equal(orphan.ctx.importLegacyPending(),1);
  assert.equal(orphan.S.pending.length,1);
  assert.equal(disk.has('pending:alice:session-orphan-123'),false);
  assert.equal(disk.get('pending:alice:session-current-123').length,1);
  console.log('SIGN-OUT PENDING SESSION FENCE TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
