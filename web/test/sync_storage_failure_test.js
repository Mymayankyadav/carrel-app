// Run: node web/test/sync_storage_failure_test.js
// An offline user action is either durably queued in full or rejected in full.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const state = fs.readFileSync(path.join(__dirname, '../core/state.js'), 'utf8');
const storeDecl = state.match(/const store = \{[\s\S]*?\n\};/);
assert.ok(storeDecl, 'find the actual app storage adapter');
function realStore(localStorage) {
  const context = {localStorage};
  vm.createContext(context);
  vm.runInContext(storeDecl[0] + '\nthis.testStore = store;', context);
  return context.testStore;
}
{
  const values = new Map();
  const disk = {
    getItem(k) {return values.has(k) ? values.get(k) : null;},
    setItem(k,v) {values.set(k,v);},
    removeItem(k) {values.delete(k);}
  };
  const store = realStore(disk);
  assert.equal(store.set('pending:alice',[{id:1}]),true);
  assert.equal(store.get('pending:alice')[0].id,1);
  assert.equal(store.set('pending:alice',null),true);
  assert.equal(store.get('pending:alice'),null);

  disk.setItem = () => {throw Object.assign(new Error('Quota exceeded'),{name:'QuotaExceededError'});};
  assert.equal(store.set('pending:alice',[{id:2}]),false,'quota errors must not be hidden');
  disk.setItem = () => {};
  assert.equal(store.set('pending:alice',[{id:3}]),false,'silent write failure must be detected');
  disk.getItem = () => {throw new Error('SecurityError');};
  assert.equal(store.set('pending:alice',[{id:4}]),false,'unreadable storage is not durable');
  disk.removeItem = () => {throw new Error('SecurityError');};
  assert.equal(store.set('pending:alice',null),false,'failed deletion must be reported');
}

const disk = new Map();
let storageFails = true;
const writes = [];
const S = {
  uid:'alice', db:null, conn:'live', owner:true, offline:false,
  pending:[], inflight:new Set(), fetched:new Set(), loaded:{},
  unsubs:[], resubT:0, windowFrom:'2026-10-01',
  base:{current:null, activities:null, settings:null, days:{}, plans:{},
    planning:{}, distractions:{}, reviews:[], topics:{}, rituals:{}, coach:{}, usage:{}}
};
const ctx = {
  S, console:{warn(){}}, clone:x=>JSON.parse(JSON.stringify(x)),
  deepMerge:Object.assign, changed(){}, toast(){},
  store:{
    get(k){return disk.has(k) ? JSON.parse(JSON.stringify(disk.get(k))) : null;},
    set(k,v){
      if(storageFails) return false;
      if(v==null) disk.delete(k);
      else disk.set(k,JSON.parse(JSON.stringify(v)));
      return true;
    }
  },
  clearTimeout(){}, setTimeout(){throw Error('unexpected retry');}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../core/sync.js'),'utf8'),ctx);
const a = {path:'days/2026-10-29',kind:'set',data:{date:'2026-10-29',entries:{one:1}}};
const b = {path:'plans/2026-10-29',kind:'set',data:{date:'2026-10-29',blocks:{two:2}}};
const c = {path:'topics/x',kind:'set',data:{v:1,title:'X'}};
const settle = async()=>{for(let i=0;i<16;i++) await Promise.resolve();};

(async()=>{
  assert.equal(ctx.enqueueBatch([a,b]),false,'whole multi-document action must fail');
  assert.equal(S.pending.length,0,'no partial optimistic queue');
  assert.equal(disk.size,0,'no partial durable queue');
  assert.equal(S.pendingStorageError,'alice','visible warning tied to account');
  assert.equal(ctx.enqueue(c),false,'single-document actions also reject failure');

  storageFails=false;
  assert.equal(ctx.enqueueBatch([a,b]),true);
  assert.equal(S.pending.length,2);
  assert.equal(disk.get('pending:alice').length,2,'both writes persisted together');
  assert.equal(S.pendingStorageError,null,'warning clears after a successful new action');

  storageFails=true;
  assert.equal(ctx.enqueueBatch([c]),false);
  assert.equal(S.pending.length,2,'failed later action must preserve earlier queue');
  assert.equal(disk.get('pending:alice').length,2,'old durable queue remains intact');

  storageFails=false;
  S.db={doc(p){return {
    async set(data){writes.push({path:p,data});},
    async update(data){writes.push({path:p,data});},
    async delete(){writes.push({path:p,data:null});}
  };}};
  ctx.pumpAll();
  await settle();
  assert.deepEqual(writes.map(w=>w.path).sort(),[a.path,b.path].sort());
  assert.equal(S.pending.length,0);
  assert.equal(disk.has('pending:alice'),false,'acknowledged writes clear durable queue');
  assert.equal(writes.some(w=>w.path===c.path),false,'rejected edit never reaches server');
  console.log('SYNC STORAGE FAILURE TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
