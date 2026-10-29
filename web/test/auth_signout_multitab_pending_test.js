// Run: node web/test/auth_signout_multitab_pending_test.js
// Sign-out must not silently discard edits queued by another Carrel tab.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../auth.js'), 'utf8');
async function scenario({diskCount=0, memoryCount=0, approve=true, switchAccount=false}={}) {
  const key='pending:alice:session-12345678';
  const disk = new Map();
  if (diskCount) disk.set(key,Array.from({length:diskCount},(_,i)=>({path:'days/'+i,kind:'set',data:{}})));
  const prompts=[];
  let signouts=0, pumps=0;
  const db={id:'alice-db'};
  const S={
    uid:'alice', pendingSession:'session-12345678', db, conn:'live',
    pending:Array.from({length:memoryCount},(_,i)=>({path:'days/'+i})),
    inflight:new Set(), unsubs:[], fetched:new Set(), loaded:{}, base:{}
  };
  const client={auth:{async signOut(){signouts++;return {error:null};}}};
  const ctx={
    S, ACT:{}, UI:{}, UNDO:[], retryT:{}, authClient:client,
    store:{
      get(k){return disk.get(k)||null;},
      set(k,v){if(v==null)disk.delete(k);else disk.set(k,v);return true;}
    },
    window:{addEventListener(){}},document:{addEventListener(){}},
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},
    clearInterval(){},console,toast(){},
    pumpAll(){pumps++;S.pending=[];},
    async confirmDialog(options){
      prompts.push(options);
      if(switchAccount){S.uid='bob';S.db={id:'bob-db'};}
      return approve;
    }
  };
  vm.createContext(ctx);
  vm.runInContext(source+'\nsb = authClient;',ctx,{filename:'auth.js'});
  await ctx.ACT.signout();
  return {S,prompts,signouts,pumps};
}
(async()=>{
  const other=await scenario({diskCount:2,approve:false});
  assert.equal(other.signouts,0,'declining must preserve another tab\'s outbox');
  assert.equal(other.prompts.length,1,'disk-only edits require confirmation');
  assert.match(other.prompts[0].text,/2 waiting/);
  assert.match(other.prompts[0].text,/another tab/);
  assert.equal(other.prompts[0].danger,true);

  const accepted=await scenario({diskCount:2,approve:true});
  assert.equal(accepted.signouts,1,'explicit discard may sign out');

  const clean=await scenario();
  assert.equal(clean.signouts,1);
  assert.equal(clean.prompts.length,0,'no unnecessary confirmation');

  const drained=await scenario({diskCount:1,memoryCount:1,approve:false});
  assert.equal(drained.pumps,1,'attempt to sync this tab first');
  assert.equal(drained.S.pending.length,0,'test drain removed memory pending');
  assert.equal(drained.prompts.length,1,'disk still pending after memory drain');
  assert.equal(drained.signouts,0);

  const switched=await scenario({diskCount:1,switchAccount:true});
  assert.equal(switched.S.uid,'bob');
  assert.equal(switched.signouts,0,'old confirmation cannot sign out new account');

  console.log('AUTH SIGNOUT MULTITAB PENDING TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
