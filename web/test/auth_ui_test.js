// Pending writes must survive cancelling the app's sign-out dialog.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../auth.js'),'utf8');
async function scenario({pending=1,approve=false,flush=false}) {
  let clock=0,signouts=0,dialogs=0;
  const S={pending:Array.from({length:pending},()=>({id:'pending'}))};
  const ctx={S,ACT:{},store:{get:()=>null,set(){}},window:{addEventListener(){}},document:{addEventListener(){}},
    Date:{now:()=>clock+=1000},setTimeout:fn=>{fn();return 1;},clearTimeout(){},
    pumpAll:()=>{if(flush)S.pending=[];},toast:()=>{},
    confirmDialog:async o=>{dialogs++;assert.equal(o.danger,true);assert.equal(o.ok,'Sign out');return approve;}};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  ctx.signOut=async()=>{signouts++;return {};};
  vm.runInContext('sb={auth:{signOut}}',ctx);
  await ctx.ACT.signout();
  return {signouts,dialogs,pending:S.pending.length};
}
(async()=>{
  assert.deepEqual(await scenario({}),{signouts:0,dialogs:1,pending:1},'Cancel keeps session and pending writes');
  assert.deepEqual(await scenario({approve:true}),{signouts:1,dialogs:1,pending:1},'Explicit discard continues to existing auth sign-out');
  assert.deepEqual(await scenario({flush:true}),{signouts:1,dialogs:0,pending:0},'Successful flush needs no discard dialog');
  assert.deepEqual(await scenario({pending:0}),{signouts:1,dialogs:0,pending:0});
  console.log('AUTH UI TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
