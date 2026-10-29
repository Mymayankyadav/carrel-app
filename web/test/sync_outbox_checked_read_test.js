// Run: node web/test/sync_outbox_checked_read_test.js
// Corrupt/blocked device storage is NOT an empty offline queue.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sync = fs.readFileSync(path.join(__dirname, '../core/sync.js'), 'utf8');
const state = fs.readFileSync(path.join(__dirname, '../core/state.js'), 'utf8');
const storeDecl = state.match(/const store = \{[\s\S]*?\n\};/);
assert.ok(storeDecl, 'exercise the real checked localStorage adapter');
const key = 'pending:alice:session-12345678';
const rawKey = 'carrel.' + key;
const disk = new Map();
let denyRead = false, writes = 0;
const localStorage = {
  getItem(k) { if (denyRead) throw Error('SecurityError'); return disk.get(k) ?? null; },
  setItem(k,v) { writes++; disk.set(k,v); },
  removeItem(k) { writes++; disk.delete(k); }
};
const storageCtx = {localStorage};
vm.createContext(storageCtx);
vm.runInContext(storeDecl[0] + '\nthis.checkedStore=store;',storageCtx);
const store = storageCtx.checkedStore;
const edit = name => ({
  path:'days/'+name,kind:'set',data:{date:name,entries:{x:{note:name}}}
});
function tab() {
  const S = {
    uid:'alice',pendingSession:'session-12345678',db:null,conn:'live',
    owner:true,offline:false,pending:[],inflight:new Set(),fetched:new Set(),
    loaded:{},unsubs:[],resubT:0,windowFrom:'2026-10-01',
    base:{current:null,activities:null,settings:null,days:{},plans:{},
      planning:{},distractions:{},reviews:[],topics:{},rituals:{},coach:{},usage:{}}
  };
  const ctx = {
    S,store,console:{warn(){}},clone:structuredClone,
    deepMerge:Object.assign,changed(){},toast(){},
    clearTimeout(){},setTimeout(){throw Error('unexpected timer');}
  };
  vm.createContext(ctx);
  vm.runInContext(sync,ctx);
  return {S,ctx};
}

// A failed read after loading must never erase the last durable queue.
const a = tab();
a.ctx.restorePending();
assert.equal(a.ctx.enqueue(edit('2026-10-29')),true);
const saved = disk.get(rawKey);
denyRead = true;
const before = writes;
assert.equal(a.ctx.enqueue(edit('2026-10-30')),false);
assert.equal(writes,before,'no attempted overwrite when the outbox is unreadable');
assert.equal(disk.get(rawKey),saved);
assert.equal(a.S.pending.length,1,'failed new action is rolled back');
assert.equal(a.S.pendingConflictError,'alice');
denyRead = false;
assert.equal(a.ctx.enqueue(edit('2026-10-30')),true,'retry works once the same snapshot is readable');
assert.equal(JSON.parse(disk.get(rawKey)).length,2);

// Remote success cannot remove an acknowledged edit when the disk read fails.
a.S.pending[0].acked = true;
denyRead = true;
const ackBefore = disk.get(rawKey);
assert.equal(a.ctx.savePending(),false);
assert.equal(disk.get(rawKey),ackBefore);
assert.equal(a.S.pending.length,2,'acknowledged edit retained until durable cleanup');
denyRead = false;
assert.equal(a.ctx.savePending(),true);
assert.equal(a.S.pending.length,1);
assert.equal(JSON.parse(disk.get(rawKey)).length,1);

// A corrupt JSON outbox at startup must not be silently replaced by new edits.
disk.set(rawKey,'{broken-json');
const corrupt = tab();
corrupt.ctx.restorePending();
assert.equal(corrupt.S.pendingConflictError,'alice');
assert.equal(corrupt.ctx.enqueue(edit('2026-11-01')),false);
assert.equal(disk.get(rawKey),'{broken-json');
disk.delete(rawKey);
assert.equal(corrupt.ctx.enqueue(edit('2026-11-01')),false,
  'a formerly unreadable snapshot requires a fresh restore, not silent overwrite');
const recovered = tab();
recovered.ctx.restorePending();
assert.equal(recovered.ctx.enqueue(edit('2026-11-01')),true);

// A valid JSON object is also invalid: only null or an array is an outbox.
disk.set(rawKey,JSON.stringify({not:'an outbox'}));
const malformed = tab();
malformed.ctx.restorePending();
assert.equal(malformed.ctx.enqueue(edit('2026-11-02')),false);
assert.deepEqual(JSON.parse(disk.get(rawKey)),{not:'an outbox'});

// One malformed operation must not be silently dropped from a valid array.
disk.set(rawKey,JSON.stringify([edit('2026-11-02'),null]));
const partial = tab();
partial.ctx.restorePending();
assert.equal(partial.S.pending.length,0);
assert.equal(partial.ctx.enqueue(edit('2026-11-04')),false);
assert.equal(JSON.parse(disk.get(rawKey)).length,2,
  'the entire mixed-validity queue remains available for recovery');

// A permissions failure at startup must not authorize a later empty-queue write.
disk.delete(rawKey);
denyRead = true;
const blocked = tab();
blocked.ctx.restorePending();
assert.equal(blocked.S.pendingConflictError,'alice');
denyRead = false;
assert.equal(blocked.ctx.enqueue(edit('2026-11-03')),false);
assert.equal(disk.has(rawKey),false);
console.log('SYNC OUTBOX CHECKED READ TESTS PASSED');
