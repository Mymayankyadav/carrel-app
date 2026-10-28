/* L6 — urge-surf and weekly drift. Uses existing notice/drift write paths. */
function l6DriftWeek(docs, start) {
  const days=[];
  for(let i=0;i<7;i++){
    const key=addDaysKey(start,i),items=(docs[key]&&docs[key].items)||{};
    let minutes=0;
    for(const item of Object.values(items)){
      if(item&&item.type==='drift'&&!item.dismissed)
        minutes+=Math.max(0,Math.min(24*60,+item.driftMin||0));
    }
    days.push(Math.round(minutes));
  }
  return {days,total:days.reduce((a,b)=>a+b,0)};
}
function l6WeekStats(now) {
  const today=todayKey(),weekday=new Date(dayStartMs(today)+12*60*MIN).getDay();
  const monday=addDaysKey(today,-((weekday+6)%7));
  const current=l6DriftWeek(V.distractions||{},monday);
  const prev=l6DriftWeek(V.distractions||{},addDaysKey(monday,-7));
  return {current,prev,monday,sunday:weekday===0};
}
function l6DriftRank(stats) {
  if(!stats)return 0;
  const total=stats.current.total,previous=stats.prev.total;
  if(total<=0)return 0;
  if(stats.sunday)return 24;
  return total>30 && total>2*previous ? 42 : 0;
}
function l6DriftSpark(days){
  const max=Math.max(1,...days);
  return '<svg class="l6-spark" viewBox="0 0 56 16" width="56" height="16" role="img" aria-label="Drift over seven days">'+
    days.map((n,i)=>'<rect x="'+(i*8+1)+'" y="'+(16-Math.max(1,Math.round(14*n/max)))+
      '" width="5" height="'+Math.max(1,Math.round(14*n/max))+'" rx="1"></rect>').join('')+'</svg>';
}
function l6OnNoticed(){
  if(!CUR||!canWrite())return;
  noticeNow(); // existing single durable urge record; never double-log on Back.
  if(!UI.notice)return;
  openSheet({type:'urge',until:Date.now()+60000,entry:CUR.id});
  if(typeof setTimeout==='function')setTimeout(()=>{
    if(UI.sheet&&UI.sheet.type==='urge')renderSheet();
  },60050);
}
function l6UrgeSheet(sh){
  const now=Date.now(),left=Math.max(0,sh.until-now),seconds=Math.ceil(left/1000);
  const started=sh.until-60000,elapsed=Math.max(0,Math.min(60000,now-started));
  const arc=(157*(1-elapsed/60000)).toFixed(1);
  return kSheetHead('Wait it out')+
    '<div class="k-sheet-body l6-urge-body">'+
      '<div class="l6-urge-ring" role="timer" aria-label="Sixty-second urge-surf timer" aria-live="off">'+
        '<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="l6-track" cx="32" cy="32" r="25"></circle>'+
          '<circle class="l6-progress" cx="32" cy="32" r="25" stroke-dasharray="157" stroke-dashoffset="'+arc+'" style="--l6-elapsed:'+(elapsed/1000).toFixed(2)+'s"></circle></svg>'+
        '<span data-tk="cd" data-to="'+sh.until+'">'+fmtClock(left)+'</span>'+
      '</div>'+
      '<div class="l6-urge-label">'+(seconds?'Notice the urge. You can let it pass.':'Ready when you are.')+'</div>'+
    '</div>'+
    kSheetFoot(kBtn('Log drift','data-act="l6-urge-log"',{kind:'text'})+
      kBtn('Back to work','data-act="l6-urge-back"',{kind:'primary'}));
}
SHEETS.urge=l6UrgeSheet;
Object.assign(ACT,{
  'l6-urge-back'(){
    if(!UI.sheet||UI.sheet.type!=='urge')return;
    UI.notice=null;closeSheet();
  },
  'l6-urge-log'(){
    if(!UI.sheet||UI.sheet.type!=='urge')return;
    if(UI.notice)UI.notice.until=Date.now()+10000;
    closeSheet();
    if(typeof setTimeout==='function')setTimeout(()=>{if(!UI.sheet)render();},10100);
  }
});
CARDS.distraction={
  rank(){return l6DriftRank(l6WeekStats(Date.now()));},
  render(){
    const s=l6WeekStats(Date.now()),total=s.current.total;
    const change=s.prev.total?Math.round(10*total/s.prev.total)/10:null;
    return '<div class="l6-drift-card"><div class="l6-drift-main"><strong>Drift '+fmtDur(total*MIN)+'</strong>'+
      '<span> this week'+(change&&change>1?' · ↑'+change+'×':'')+'</span></div>'+
      l6DriftSpark(s.current.days)+'</div>';
  }
};

/* L6 Usage Access: disabled until BOTH the native toggle and OS special
 * permission are granted. The selected allowlist is editable on device. */
const l6UsageApps=[
  ['com.instagram.android','Instagram'],['com.google.android.youtube','YouTube'],
  ['com.whatsapp','WhatsApp'],['com.twitter.android','X'],
  ['com.zhiliaoapp.musically','TikTok'],['com.reddit.frontpage','Reddit'],
  ['com.snapchat.android','Snapchat'],['com.facebook.katana','Facebook'],
  ['in.startv.hotstar','Hotstar'],['com.netflix.mediaclient','Netflix']
];
function l6DriftRow(){
  if(typeof CL==='undefined'||!CL||!CL.sessionUsage)return '';
  const enabled=!!NP.detectDrift;
  const selected=Array.isArray(NP.usagePackages)?NP.usagePackages:[];
  const switcher=kRow({label:'Detect drift',
    sub:'Only selected app names and foreground minutes sync to Carrel. No screen or message content.',
    right:kSwitch({act:'l6-drift-toggle',on:enabled,label:'Detect drift'})});
  const access=enabled&&!NP.usageAccess?kRow({label:'Usage access required',
    right:kBtn('Allow','data-act="l6-usage-access"',{kind:'text'})}):'';
  const options=enabled?kCollapse('l6-drift-apps','Apps to count',
    kChips({act:'l6-use-app',value:selected,multi:true,
      options:l6UsageApps.map(([v,label])=>({v,label}))})):'';
  return switcher+access+options;
}
function l6SummariseUsage(apps,minutes){
  const allowed=new Map(l6UsageApps),out=Object.create(null);
  let total=0,leader=null;
  for(const row of Array.isArray(apps)?apps:[]){
    if(!row||!allowed.has(row.pkg))continue;
    const min=Math.max(0,Math.min(24*60,Math.round(+row.min||0)));
    const opens=Math.max(0,Math.min(999,Math.round(+row.opens||0)));
    if(!min)continue;
    const label=allowed.get(row.pkg);
    out[label]={min,opens};
    total+=min;
    if(!leader||min>leader.min)leader={label,min};
  }
  return {apps:out,total:Math.min(Math.max(0,minutes),total),leader};
}
async function l6AfterStudyStop(id,start,end,activity){
  if(typeof CL==='undefined'||!CL||!CL.sessionUsage||!NP.detectDrift||
    !NP.usageAccess||!canWrite()||end-start<10*MIN||end<=start)return;
  try{
    const reply=await CL.sessionUsage({startMs:start,endMs:end});
    if(!NP.detectDrift||!NP.usageAccess||!canWrite())return; // consent can be revoked during query
    const safe=l6SummariseUsage(reply&&reply.apps,Math.floor((end-start)/MIN));
    if(safe.total<2||!safe.leader)return;
    const day=dayKeyOf(start);
    const data={v:1,date:day,sessions:{[id]:{apps:safe.apps}}};
    const w=W().update('usage/'+day,data,{v:1,date:day,sessions:{}});
    if(!commit(null,w,{undo:true}))return;
    UI.l6Detected={id,day,activity,at:end,min:safe.total,until:Date.now()+120000};
    const name=typeof ACTMAP!=='undefined'&&ACTMAP[activity]?ACTMAP[activity].name:'study';
    toast(safe.leader.label+' '+safe.leader.min+'m during '+name,
      {action:{label:'Log',act:'l6-usage-log'},persist:true});
  }catch(e){ /* Never interrupt saving the study entry if usage access changed. */ }
}
ACT['l6-drift-toggle']=async ()=>{
  if(!CL||!CL.setPrefs)return;
  const next=!NP.detectDrift;
  try{
    const r=await CL.setPrefs({detectDrift:next});
    Object.assign(NP,r);
    changed();
    if(next&&CL.openUsageAccess){
      await CL.openUsageAccess();
      if(CL.hasUsageAccess){
        const access=await CL.hasUsageAccess();NP.usageAccess=!!access.allowed;changed();
      }
    }
  }catch(e){toast('Could not change usage detection.');}
};
ACT['l6-usage-access']=async ()=>{
  if(!CL||!CL.openUsageAccess)return;
  await CL.openUsageAccess().catch(()=>{});
  if(CL.hasUsageAccess){
    const state=await CL.hasUsageAccess().catch(()=>({allowed:false}));
    NP.usageAccess=!!state.allowed;changed();
  }
};
ACT['l6-use-app']=async el=>{
  if(!CL||!CL.setPrefs)return;
  const pkg=el.getAttribute('data-v');
  if(!l6UsageApps.some(([id])=>id===pkg))return;
  const values=new Set(Array.isArray(NP.usagePackages)?NP.usagePackages:[]);
  if(values.has(pkg))values.delete(pkg);else values.add(pkg);
  try{
    const p=await CL.setPrefs({usagePackages:[...values]});
    Object.assign(NP,p);changed();
  }catch(e){toast('Could not update app list.');}
};
/** Never edit stale/overlapping sessions based on an approximate app-usage
 * total. The native API reports aggregate minutes, not an exact time trace. */
function l6UsageTrimPlan(found, days, entries, now) {
  if(!found||!found.id||!Number.isFinite(found.at)||!Number.isFinite(found.min))return null;
  const raw=days&&days[found.day]&&days[found.day].entries&&days[found.day].entries[found.id];
  if(!raw||raw.activity!==found.activity)return null;
  const s=parseT(raw.start),e=parseT(raw.end);
  if(!Number.isFinite(s)||!Number.isFinite(e)||e<=s||Math.abs(e-found.at)>2000)return null;
  const minutes=Math.floor(found.min);
  if(minutes<1||minutes>=Math.floor((e-s)/MIN))return null;
  const begin=e-minutes*MIN;
  // Only trim an exact, still-present logged entry. A new overlapping session
  // or a modified end time must be handled via the regular Log editor instead.
  if((entries||[]).some(x=>x.id!==found.id&&x.s<e&&entryEnd(x,now)>begin))return null;
  return {from:begin,to:e,min:minutes};
}
ACT['l6-usage-log']=()=>{
  const found=UI.l6Detected;
  if(!found||Date.now()>found.until||!canWrite())return;
  const drift=ACTS.find(a=>a.role==='drift'&&!a.archived);
  if(!drift){toast('Add a Drift activity in Settings first.');return;}
  const plan=l6UsageTrimPlan(found,V.days,ENTRIES,Date.now());
  if(!plan){UI.l6Detected=null;toast('Session changed. Review it in Log to mark drift.');return;}
  const w=W();
  w.day(found.day,{[found.id]:{end:isoLocal(plan.from)}});
  w.day(dayKeyOf(plan.from),{[uid('e')]:{
    activity:drift.id,start:isoLocal(plan.from),end:isoLocal(plan.to),
    note:'detected app use (approximate)',focus:null,block:null,pomo:null
  }});
  w.dis(dayKeyOf(plan.to),uid('d'),{
    type:'drift',at:isoLocal(plan.to),driftMin:plan.min,text:null,activity:found.activity,
    entry:found.id,src:'usage',applied:true
  });
  if(commit('Logged '+plan.min+'m of drift.',w,{undo:true}))UI.l6Detected=null;
};


if(typeof module!=='undefined'&&module.exports)
  module.exports={l6DriftWeek,l6DriftRank,l6SummariseUsage,l6UsageTrimPlan};
