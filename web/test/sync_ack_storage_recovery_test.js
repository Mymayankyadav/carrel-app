// Run: node web/test/sync_ack_storage_recovery_test.js
// Remote acknowledgements must not silently disappear from an outbox whose
// durable deletion failed; retry without replaying them in the same session.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../core/sync.js'), 'utf8');
const settle = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
function harness() {
  const disk = new Map(), timers = new Map(), writes = [], toasts = [];
  let nextTimer = 0, failStorage = false, release = null, changes = 0;
  const S = {
    uid:'alice', conn:'live', owner:true, offline:false,
    pending:[], inflight:new Set(), fetched:new Set(), loaded:{},
    unsubs:[], resubT:0, windowFrom:'2026-10-01',
    base:{current:null,activities:null,settings:null,days:{},plans:{},
      planning:{},distractions:{},reviews:[],topics:{},rituals:{},coach:{},usage:{}}
  };
  function adapter() {
    return {doc(p){return {
      set(data){writes.push({path:p,data});return new Promise(resolve => {release=resolve;});},
      update(data){return this.set(data);},
      delete(){return this.set(null);}
    };}};
  }
  S.db = adapter();
  const ctx = {
    S, console:{warn(){}}, clone:x=>JSON.parse(JSON.stringify(x)),
    deepMerge:Object.assign, changed(){changes++;}, toast:msg=>toasts.push(msg),
    store:{
      get(k){return disk.has(k) ? JSON.parse(JSON.stringify(disk.get(k))) : null;},
      set(k,v){
        if (failStorage) return false;
        if (v==null) disk.delete(k);
        else disk.set(k,JSON.parse(JSON.stringify(v)));
        return true;
      }
    },
    setTimeout(fn,ms){assert.equal(ms,5000);const id=++nextTimer;timers.set(id,fn);return id;},
    clearTimeout(id){timers.delete(id);}
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  return {S,ctx,disk,timers,writes,toasts,adapter,
    fail(v){failStorage=v;}, resolve(){assert.ok(release);const fn=release;release=null;fn();},
    async retry(){assert.ok(timers.size);const [id,fn]=timers.entries().next().value;timers.delete(id);fn();await settle();},
    get changes(){return changes;}
  };
}
const edit=(id)=>({path:'days/'+id,kind:'set',data:{date:id,entries:{x:{minutes:25}}}});
(async()=>{
  const h=harness();
  assert.equal(h.ctx.enqueue(edit('2026-10-29')),true);
  assert.equal(h.disk.get('pending:alice').length,1);
  assert.equal(h.writes.length,1);
  h.fail(true);
  h.resolve();
  await settle();
  assert.equal(h.S.pending.length,1,'ack stays in memory until durable cleanup');
  assert.equal(h.S.pending[0].acked,true,'ack must never replay in this session');
  assert.equal(h.disk.get('pending:alice').length,1,'old durable queue not falsely cleared');
  assert.equal(h.S.pendingAckStorageError,'alice');
  assert.equal(h.timers.size,1,'schedule bounded cleanup retry');
  assert.match(h.toasts.join(' '),/cleanup failed/i);
  h.ctx.pumpAll();
  await settle();
  assert.equal(h.writes.length,1,'reconnect cannot resend an acknowledged operation');

  assert.equal(h.ctx.enqueue(edit('2026-10-30')),false,
    'new edit must be refused while storage cannot persist the new outbox');
  assert.equal(h.writes.length,1);
  assert.equal(h.disk.get('pending:alice').length,1);
  assert.equal(h.S.pending.length,1);

  await h.retry();
  assert.equal(h.S.pending.length,1,'failed cleanup stays recoverable');
  assert.equal(h.timers.size,1,'failed cleanup reschedules');
  h.fail(false);
  await h.retry();
  assert.equal(h.S.pending.length,0);
  assert.equal(h.disk.has('pending:alice'),false);
  assert.equal(h.S.pendingAckStorageError,null);
  assert.equal(h.timers.size,0);
  assert.equal(h.writes.length,1,'recovery must not replay remote success');

  // A successful new enqueue can also clean the old ack and preserve only
  // the new operation. No stale acknowledgement is serialized.
  const x=harness();
  x.ctx.enqueue(edit('2026-10-29'));
  x.fail(true);x.resolve();await settle();
  x.fail(false);
  assert.equal(x.ctx.enqueue(edit('2026-10-30')),true);
  assert.equal(x.S.pending.length,1);
  assert.equal(x.S.pending[0].path,'days/2026-10-30');
  assert.equal(x.disk.get('pending:alice').length,1);
  assert.equal(x.disk.get('pending:alice')[0].path,'days/2026-10-30');
  assert.equal(x.S.pendingAckStorageError,null);
  assert.equal(x.timers.size,0);
  x.resolve();await settle();
  assert.equal(x.disk.has('pending:alice'),false);

  // An old account's scheduled cleanup cannot rewrite a new account's queue.
  const switched=harness();
  switched.ctx.enqueue(edit('2026-10-29'));
  switched.fail(true);switched.resolve();await settle();
  const oldTimer=switched.timers.values().next().value;
  switched.S.uid='bob';switched.S.db=switched.adapter();
  switched.S.pending=[];switched.S.pendingAckStorageError=null;
  switched.fail(false);
  switched.disk.set('pending:bob',[{path:'days/bob',kind:'set',data:{owner:'bob'}}]);
  oldTimer();
  await settle();
  assert.equal(switched.disk.get('pending:alice').length,1);
  assert.equal(switched.disk.get('pending:bob')[0].data.owner,'bob');
  assert.equal(switched.S.pending.length,0);
  assert.equal(switched.S.pendingAckStorageError,null);

  console.log('SYNC ACK STORAGE RECOVERY TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
