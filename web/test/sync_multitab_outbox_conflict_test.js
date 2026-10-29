// Run: node web/test/sync_multitab_outbox_conflict_test.js
// Sequential cross-tab outbox changes must not be silently overwritten.
// This is optimistic conflict detection, not a guarantee for simultaneous
// writes; a future per-tab queue/locking design is still necessary.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../core/sync.js'), 'utf8');
const disk = new Map();
const key = 'pending:alice:session-12345678';
const edit = (name) => ({
  path:'days/'+name, kind:'set', data:{date:name,entries:{x:{note:name}}}
});
function tab(uid='alice', session='session-12345678', failed=new Set()) {
  const S = {
    uid, pendingSession:session, db:null, conn:'live', owner:true, offline:false,
    pending:[], inflight:new Set(), fetched:new Set(), loaded:{},
    unsubs:[], resubT:0, windowFrom:'2026-10-01',
    base:{current:null,activities:null,settings:null,days:{},plans:{},
      planning:{},distractions:{},reviews:[],topics:{},rituals:{},coach:{},usage:{}}
  };
  const toasts = [];
  const ctx = {
    S, console:{warn(){}}, clone:structuredClone, deepMerge:Object.assign,
    changed(){}, toast:msg=>toasts.push(msg),
    a1PendingClearFailed:failed,
    store:{
      get(k){return disk.has(k) ? structuredClone(disk.get(k)) : null;},
      set(k,v){
        if(v==null) disk.delete(k);
        else disk.set(k,structuredClone(v));
        return true;
      }
    },
    clearTimeout(){}, setTimeout(){throw Error('unexpected timer');}
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  return {S,ctx,toasts};
}
{
  const a=tab(), b=tab();
  a.ctx.restorePending(); b.ctx.restorePending(); // both saw empty disk
  assert.equal(a.ctx.enqueue(edit('2026-10-29')),true);
  assert.equal(disk.get(key).length,1);
  assert.equal(b.ctx.enqueue(edit('2026-10-30')),false,
    'stale tab must reject an edit rather than replace first tab outbox');
  assert.equal(b.S.pending.length,0);
  assert.equal(b.S.pendingConflictError,'alice');
  assert.equal(disk.get(key)[0].path,'days/2026-10-29');
  assert.equal(a.S.pending.length,1);
  // A newly opened tab can explicitly load the current durable queue.
  const c=tab();
  c.ctx.restorePending();
  assert.equal(c.S.pending.length,1);
  assert.equal(c.ctx.enqueue(edit('2026-10-30')),true);
  assert.equal(disk.get(key).length,2);
  // A remote ack from the older tab must not delete the newer tab's edit.
  a.S.pending[0].acked=true;
  assert.equal(a.ctx.savePending(),false);
  assert.equal(a.S.pending.length,1,'failed cleanup retains acknowledged op');
  assert.equal(disk.get(key).length,2,'newer disk queue survives stale ack');
  assert.equal(a.S.pendingConflictError,'alice');
  assert.equal(c.ctx.enqueue(edit('2026-10-31')),true);
  assert.equal(disk.get(key).length,3);
}
{
  // Do not silently replace an existing queue if a fixture or old code path
  // never called restorePending before its first write.
  const d=tab();
  assert.equal(d.ctx.enqueue(edit('2026-11-01')),false);
  assert.equal(disk.get(key).length,3);
}
{
  // A sign-out cleanup marker fences writes even if the same session ID is
  // reused and the old queue is missing from disk.
  const blockedKey='pending:bob:session-12345678';
  const x=tab('bob','session-12345678',new Set([blockedKey]));
  x.ctx.restorePending();
  assert.equal(x.ctx.enqueue(edit('2026-11-02')),false);
  assert.equal(disk.has(blockedKey),false);
  assert.equal(x.S.pending.length,0);
}
{
  // Other accounts have independent outboxes.
  const bob=tab('bob');
  bob.ctx.restorePending();
  assert.equal(bob.ctx.enqueue(edit('2026-11-03')),true);
  assert.equal(disk.get('pending:bob:session-12345678').length,1);
  assert.equal(disk.get(key).length,3);
}
console.log('SYNC MULTITAB OUTBOX CONFLICT TESTS PASSED');
