// Run: node web/test/auth_signout_storage_race_test.js
// A storage error must not be mistaken for an empty outbox during sign-out.
// An approval cannot be reused after another tab changes the durable queue.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../auth.js'), 'utf8');

async function scenario(opts={}) {
  const key = 'pending:alice:session-12345678';
  const item = n => ({path:'days/'+n,kind:'set',data:{date:String(n)}});
  const disk = new Map();
  if (opts.diskCount) disk.set(key,Array.from({length:opts.diskCount},(_,i)=>item(i)));
  if (opts.corrupt) disk.set(key,{not:'an outbox'});
  const prompts=[], toasts=[];
  let signouts=0, reads=0;
  const db={id:'alice-db'};
  const S={
    uid:'alice',pendingSession:'session-12345678',db,conn:'live',
    pending:[],inflight:new Set(),unsubs:[],fetched:new Set(),loaded:{},base:{}
  };
  const ctx={
    S,ACT:{},UI:{},UNDO:[],retryT:{},
    authClient:{auth:{async signOut(){signouts++;return {error:null};}}},
    store:{
      get(k){return disk.get(k) ?? null;},
      getChecked(k){
        reads++;
        if (opts.failReads === 'all' ||
            (Array.isArray(opts.failReads) && opts.failReads.includes(reads)))
          return {ok:false,value:null};
        return {ok:true,value:disk.get(k) ?? null};
      },
      set(k,v){if(v==null)disk.delete(k);else disk.set(k,v);return true;}
    },
    window:{addEventListener(){}},document:{addEventListener(){}},
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},
    clearInterval(){},console,toast:msg=>toasts.push(msg),
    pumpAll(){S.pending=[];},
    async confirmDialog(options){
      prompts.push(options);
      if(opts.mutate === 'append') disk.set(key,[...(disk.get(key)||[]),item('new')]);
      if(opts.mutate === 'replace') disk.set(key,[item('replacement')]);
      if(opts.mutate === 'drain') disk.delete(key);
      if(opts.switchAccount){S.uid='bob';S.db={id:'bob-db'};}
      return opts.approve !== false;
    }
  };
  vm.createContext(ctx);
  vm.runInContext(source+'\nsb = authClient;',ctx,{filename:'auth.js'});
  await ctx.ACT.signout();
  return {prompts,toasts,signouts,reads,disk,S};
}
(async()=>{
  const clean=await scenario();
  assert.equal(clean.signouts,1);
  assert.equal(clean.prompts.length,0);

  const denied=await scenario({failReads:'all',approve:false});
  assert.equal(denied.signouts,0);
  assert.equal(denied.prompts.length,1);
  assert.match(denied.prompts[0].text,/Could not check saved offline edits/);
  assert.equal(denied.prompts[0].danger,true);

  const accepted=await scenario({failReads:'all'});
  assert.equal(accepted.signouts,1,'explicit consent can sign out despite unavailable storage');
  assert.equal(accepted.prompts.length,1);

  const corrupt=await scenario({corrupt:true,approve:false});
  assert.equal(corrupt.signouts,0);
  assert.match(corrupt.prompts[0].title,/Offline edits unavailable/);

  const newEdit=await scenario({diskCount:1,mutate:'append'});
  assert.equal(newEdit.signouts,0,'new edit after consent must abort sign-out');
  assert.match(newEdit.toasts[0],/Offline edits changed/);
  assert.equal(newEdit.disk.get('pending:alice:session-12345678').length,2);

  const replaced=await scenario({diskCount:1,mutate:'replace'});
  assert.equal(replaced.signouts,0,'same-count replacement must invalidate consent');

  const drained=await scenario({diskCount:1,mutate:'drain'});
  assert.equal(drained.signouts,1,'remote completion may safely empty the queue');

  const becameUnreadable=await scenario({diskCount:1,failReads:[3]});
  assert.equal(becameUnreadable.signouts,0,'new read failure must invalidate earlier consent');
  assert.match(becameUnreadable.toasts[0],/Offline edits changed/);

  const switched=await scenario({diskCount:1,switchAccount:true});
  assert.equal(switched.signouts,0,'confirmation cannot sign out a different account');

  console.log('AUTH SIGNOUT STORAGE RACE TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
