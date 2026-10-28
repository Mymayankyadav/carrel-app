'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

let logged=0,opened=[],rendered=0,closed=0;
const timers=[];
const ctx={
  console,Date,Math,
  module:{exports:{}},
  SHEETS:{},ACT:{},CARDS:{},
  CUR:{id:'session',activity:'physics'},
  UI:{notice:null,sheet:null},
  V:{distractions:{}},
  MIN:60000,
  canWrite:()=>true,
  noticeNow(){logged++;ctx.UI.notice={k:'2026-10-28',id:'urge1',until:Date.now()+6000};},
  openSheet(sh){opened.push(sh);ctx.UI.sheet=sh;},
  closeSheet(){ctx.UI.sheet=null;closed++;},
  render(){rendered++;},
  renderSheet(){rendered++;},
  setTimeout(callback,ms){timers.push({callback,ms});},
  kSheetHead:label=>label,
  kSheetFoot:body=>body,
  kBtn:(label,attrs)=>label+attrs,
  fmtClock:ms=>String(Math.ceil(ms/1000)),
  fmtDur:ms=>Math.round(ms/60000)+'m',
  parseT:iso=>Date.parse(iso),
  entryEnd:(en,now)=>en.e==null?now:en.e,
  addDaysKey:(day,n)=>{
    const d=new Date(day+'T12:00:00Z');
    d.setUTCDate(d.getUTCDate()+n);
    return d.toISOString().slice(0,10);
  },
  todayKey:()=> '2026-10-28'
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/distraction.js'),'utf8'),ctx);
const {l6DriftWeek,l6DriftRank}=ctx.module.exports;

const doc={
  '2026-10-26':{items:{
    urge:{type:'urge'},
    first:{type:'drift',driftMin:5},
    second:{type:'drift',driftMin:15},
    dismissed:{type:'drift',driftMin:30,dismissed:true}
  }},
  '2026-10-28':{items:{third:{type:'drift',driftMin:10}}}
};
const totals=l6DriftWeek(doc,'2026-10-26');
assert.equal(totals.total,30);
assert.equal(totals.days.length,7);
assert.deepEqual(Array.from(totals.days.slice(0,3)),[20,0,10]);
assert.equal(l6DriftRank({current:{total:0},prev:{total:4},sunday:true}),0);
assert.equal(l6DriftRank({current:{total:20},prev:{total:9},sunday:true}),24);
assert.equal(l6DriftRank({current:{total:60},prev:{total:20},sunday:false}),42);
assert.equal(l6DriftRank({current:{total:20},prev:{total:1},sunday:false}),0);
assert.equal(l6DriftRank({current:{total:40},prev:{total:25},sunday:false}),0);

ctx.l6OnNoticed();
assert.equal(logged,1,'only the existing durable notice should be written');
assert.equal(opened.length,1);
assert.equal(opened[0].type,'urge');
assert.ok(opened[0].until>Date.now()+59000);
assert.ok(ctx.UI.notice.until>=opened[0].until,'drift choices must remain available after the entire exercise');
const html=ctx.SHEETS.urge(opened[0]);
assert.match(html,/Wait it out/);
assert.match(html,/Back to work/);
assert.match(html,/Log drift/);
assert.match(html,/role="timer"/);
assert.match(html,/aria-live="off"/);
ctx.ACT['l6-urge-log']();
assert.equal(closed,1);
assert.ok(ctx.UI.notice.until>Date.now()+14000);
assert.equal(rendered,1,'drift chips appear immediately rather than after a timeout');
assert.equal(logged,1);
ctx.UI.sheet={type:'urge'};
ctx.ACT['l6-urge-back']();
assert.equal(closed,2);
assert.equal(ctx.UI.notice,null);
const {l6UsageTrimPlan}=ctx.module.exports;
const recorded={date:'2026-10-28',entries:{
  entry1:{activity:'physics',start:'2026-10-28T09:00:00Z',end:'2026-10-28T09:20:00Z',note:'proofs'}
}};
const detected={id:'entry1',day:'2026-10-28',activity:'physics',
  start:Date.parse('2026-10-28T09:00:00Z'),
  at:Date.parse('2026-10-28T09:20:00Z'),min:6};
let plan=l6UsageTrimPlan(detected,{'2026-10-28':recorded},[],Date.now());
assert.equal(plan.min,6);
assert.equal(plan.from,Date.parse('2026-10-28T09:14:00Z'));
assert.equal(l6UsageTrimPlan({...detected,min:21},{'2026-10-28':recorded},[],Date.now()),null,
  'never erase a full session');
assert.equal(l6UsageTrimPlan({...detected,at:detected.at-60000},{'2026-10-28':recorded},[],Date.now()),null,
  'stale session end requires manual review');
assert.equal(l6UsageTrimPlan({...detected,start:detected.start+60000},{'2026-10-28':recorded},[],Date.now()),null,
  'stale session start requires manual review');
assert.equal(l6UsageTrimPlan(detected,{'2026-10-28':recorded},
  [{id:'other',s:Date.parse('2026-10-28T09:16:00Z'),e:detected.at}],Date.now()),null,
  'overlapping later entries must not be overwritten');
assert.equal(l6UsageTrimPlan(detected,{'2026-10-28':{entries:{}}},[],Date.now()),null,
  'deleted session must not be reconstructed');

const {l6SummariseUsage}=ctx.module.exports;
const safe=l6SummariseUsage([
  {pkg:'com.instagram.android',min:6,opens:2},
  {pkg:'com.google.android.youtube',min:3,opens:1},
  {pkg:'malicious.app',min:500,opens:99}
],7);
assert.equal(safe.total,7,'reported minutes cannot exceed focus duration');
assert.equal(safe.leader.label,'Instagram');
assert.equal(safe.apps.Instagram.min,6);
assert.equal(Object.keys(safe.apps).length,2,'only allowlisted apps are stored');

const writes=[];
ctx.CL={sessionUsage:async()=>({apps:[
  {pkg:'com.instagram.android',min:6,opens:2}
]})};
ctx.NP={detectDrift:true,usageAccess:true};
ctx.ACTMAP={physics:{name:'Physics',kind:'study'}};
ctx.dayKeyOf=()=> '2026-10-28';
ctx.W=()=>({update(path,payload,ensure){
  writes.push({path,payload,ensure});return this;
}});
ctx.commit=(message,operations,options)=>{ctx.lastCommitOptions=options;return true;};
ctx.toast=(message,options)=>{
  ctx.toastResult={message,options};
  ctx.UI.toast={msg:message,action:options&&options.action};
};
ctx.l6AfterStudyStop('entry1',0,20*60000,'physics').then(async()=>{
  assert.equal(writes.length,1);
  assert.equal(ctx.lastCommitOptions.undo,false,'automatic metadata cannot occupy Undo');
  assert.equal(writes[0].path,'usage/2026-10-28');
  assert.equal(writes[0].payload.sessions.entry1.apps.Instagram.min,6);
  assert.equal(ctx.toastResult.options.action.act,'l6-usage-log');
  assert.equal(ctx.UI.l6Detected.min,6);
  const offer=ctx.UI.l6Detected;
  const expiry=timers.find(t=>t.ms===120050);
  assert.ok(expiry,'the persistent offer must have an expiration timer');
  expiry.callback();
  assert.equal(ctx.UI.l6Detected,null,'expired usage offer must be cleared');
  assert.equal(ctx.UI.toast,null,'expired usage offer cannot leave a permanent dead toast');

  // Revocation must also remove a stale Log action (without logging drift).
  ctx.UI.l6Detected=offer;
  ctx.UI.toast={action:{act:'l6-usage-log'}};
  ctx.NP.usageAccess=false;
  ctx.ACT['l6-usage-log']();
  assert.equal(ctx.UI.l6Detected,null);
  assert.equal(ctx.UI.toast,null);
  ctx.NP.usageAccess=true;

  // Native Capacitor proxies expose arbitrary JS method names: capability
  // must come from the new APK's explicit prefs, not CL.sessionUsage alone.
  ctx.NP.usageDetectionSupported=false;
  assert.equal(ctx.l6DriftRow(),'','old APK must not show a broken usage control');
  ctx.NP.usageDetectionSupported=true;
  ctx.NP.usagePackages=['com.instagram.android'];
  ctx.changed=()=>{};
  ctx.CL.setPrefs=async update=>({...ctx.NP,...update});
  ctx.CL.openUsageAccess=async()=>({allowed:true});
  ctx.CL.hasUsageAccess=async()=>({allowed:true});

  let completeQuery;
  ctx.CL.sessionUsage=()=>new Promise(resolve=>{completeQuery=resolve;});
  const pending=ctx.l6AfterStudyStop('entry2',0,20*60000,'physics');
  await ctx.ACT['l6-drift-toggle'](); // disable before the native response
  assert.equal(ctx.NP.detectDrift,false);
  completeQuery({apps:[{pkg:'com.instagram.android',min:6,opens:2}]});
  await pending;
  assert.equal(writes.length,1,'opting out must discard in-flight usage results');

  await ctx.ACT['l6-drift-toggle'](); // enable again
  assert.equal(ctx.NP.detectDrift,true);
  const pendingSelection=ctx.l6AfterStudyStop('entry3',0,20*60000,'physics');
  await ctx.ACT['l6-use-app']({getAttribute:()=> 'com.instagram.android'});
  assert.equal(ctx.NP.usagePackages.length,0);
  completeQuery({apps:[{pkg:'com.instagram.android',min:6,opens:2}]});
  await pendingSelection;
  assert.equal(writes.length,1,'a removed app cannot be persisted from an old query');

  await ctx.ACT['l6-use-app']({getAttribute:()=> 'com.instagram.android'});
  ctx.S={db:{identity:'old-login'}};
  const oldAccount=ctx.l6AfterStudyStop('entry4',0,20*60000,'physics');
  ctx.S.db={identity:'new-login'};
  completeQuery({apps:[{pkg:'com.instagram.android',min:6,opens:2}]});
  await oldAccount;
  assert.equal(writes.length,1,'data from a previous signed-in session must never sync');

  await ctx.ACT['l6-drift-toggle'](); // disable
  ctx.CL.openUsageAccess=async()=>{throw Error('settings unavailable');};
  await ctx.ACT['l6-drift-toggle'](); // native enable saved, but OS settings unavailable
  assert.equal(ctx.NP.detectDrift,true,'native opt-in must survive a permission-screen failure');
  assert.equal(ctx.NP.usageAccess,false,'failed permission prompt cannot be mistaken for access');

  console.log('distraction_test: L6 urge surf, offline write, old APK, account and consent isolation passed');
}).catch(e=>{console.error(e);process.exitCode=1;});
