/* L2 — Morning and shutdown rituals. All writes use the existing undoable queue. */
function l2Error(sh){return sh.err?'<div class="l2-error" role="alert">'+esc(sh.err)+'</div>':'';}
function l2SaveFailure(sh){
  sh.err='Could not save offline. Check storage and retry.';
  renderSheet();return false;
}
function l2HasMorning(k){return !!(V.rituals&&V.rituals[k]&&V.rituals[k].morning);}
function l2ShutdownDone(k){return !!(V.rituals&&V.rituals[k]&&V.rituals[k].shutdown);}
function l2Minutes(items,picks){
  return items.reduce((n,x)=>n+(picks[x.id]?Math.max(0,+x.minutes||0):0),0);
}
function l2Candidates(k){
  const items=[],previous=addDaysKey(k,-1),pm=planModelFor(previous,Date.now());
  for(const r of pm&&pm.rows||[]){
    if(!r||r.remaining<=0||['skipped','moved'].includes(r.st))continue;
    items.push({id:'carry:'+r.id,source:'carry',sourceId:r.id,sourceDay:previous,
      activity:r.activity,title:r.title||act(r.activity).name,minutes:Math.ceil(r.remaining/MIN),
      prio:1,pick:true,pomo:r.pomo||null});
  }
  if(typeof l4DueTopics==='function'){
    for(const t of l4DueTopics(k)||[])if(ACTMAP[t.subject]&&!ACTMAP[t.subject].archived)
      items.push({id:'review:'+t.id,source:'review',sourceId:t.id,
        activity:t.subject,title:'Review '+t.title,minutes:30,prio:1,pick:true});
  }
  const backlog=backlogList().slice().sort((a,b)=>a.prio-b.prio||
    (a.due||'9999-12-31').localeCompare(b.due||'9999-12-31')||a.order-b.order);
  for(const t of backlog){
    const deadline=t.due&&t.due<=addDaysKey(k,2);
    items.push({id:'backlog:'+t.id,source:'backlog',sourceId:t.id,
      activity:ACTMAP[t.activity]&&!ACTMAP[t.activity].archived?t.activity:firstStudyId(),
      title:t.title,minutes:t.minutes,prio:t.prio,pick:t.prio===1||!!deadline});
  }
  if(typeof backwardPlan==='function'){
    for(const d of deadlineList().filter(d=>!d.done&&d.kind==='exam'&&d.date>k).slice(0,3)){
      const raw=V.planning&&V.planning.deadlines&&V.planning.deadlines.items&&V.planning.deadlines.items[d.id]||{};
      const hours=+(raw.estimate||raw.hours||raw.hoursNeeded)||0;
      if(!hours||!d.activity||!ACTMAP[d.activity])continue;
      const sessions=backwardPlan({today:k,deadline:d.date,hoursNeeded:hours,maxPerDay:3});
      const session=sessions.find(x=>x.date===k);
      if(session)items.push({id:'exam:'+d.id,source:'exam',sourceId:d.id,
        activity:d.activity,title:'Prepare '+d.title,minutes:session.minutes,prio:1,pick:true});
    }
  }
  return items;
}
function l2FreeMinutes(k){
  if(typeof l3FreeIntervals!=='function')return 0;
  return (l3FreeIntervals(k)||[]).reduce((sum,[s,e])=>sum+Math.max(0,e-s)/MIN,0);
}
function l2MorningProposal(sh){
  const items=sh.candidates.filter(x=>sh.picks[x.id]);
  const factors={};
  for(const t of items)factors[t.activity]=typeof l3Factor==='function'?l3Factor(t.activity):1;
  const opts={items,free:typeof l3FreeIntervals==='function'?l3FreeIntervals(sh.k):[],
    now:sh.k===todayKey()?Date.now():undefined,gapMin:+CFG.gap||0,
    windows:typeof l3HourStats==='function'?energyWindows(l3HourStats()):[],
    factor:id=>factors[id]||1};
  return {proposal:autoPlan(opts),factors};
}
function l2MorningPick(sh){
  const rows=sh.candidates.map(x=>'<label class="l2-candidate">'+
    '<input type="checkbox" data-act="l2-pick" data-id="'+esc(x.id)+'"'+(sh.picks[x.id]?' checked':'')+'>'+
    '<span><strong>'+esc(x.title)+'</strong><small>'+esc(act(x.activity).name)+
    ' · '+esc(x.source==='carry'?'From yesterday':x.source==='review'?'Review':
      x.source==='exam'?'Exam preparation':'Backlog')+'</small></span>'+
    '<time>'+esc(fmtDur(x.minutes*MIN))+'</time></label>').join('');
  const chosen=l2Minutes(sh.candidates,sh.picks),free=l2FreeMinutes(sh.k);
  return '<div class="l2-flow"><div class="l2-summary">'+esc(fmtDur(chosen*MIN))+
    ' picked · '+esc(fmtDur(free*MIN))+' free</div>'+
    (rows||kEmpty('Nothing to plan yet. Add a backlog task or a topic to review.'))+'</div>';
}
function l2PreviewRibbon(k,blocks){
  const start=dayStartMs(k),end=dayEndMs(k);
  const bars=blocks.map(b=>{
    const at=hmOnDay(k,b.at),left=Math.max(0,Math.min(100,100*(at-start)/(end-start)));
    const width=Math.max(0,Math.min(100-left,100*b.minutes*MIN/(end-start)));
    return '<i style="left:'+left.toFixed(2)+'%;width:'+width.toFixed(2)+
      '%;--c:'+kSafeColour(act(b.activity).color)+'"></i>';
  }).join('');
  return '<div class="l2-preview-ribbon" aria-label="Proposed plan timeline">'+bars+'</div>';
}
function l2MorningPreview(sh){
  const blocks=sh.proposal&&sh.proposal.blocks||[];
  return '<div class="l2-flow">'+l2Error(sh)+l2PreviewRibbon(sh.k,blocks)+
    '<div class="l2-summary">'+blocks.length+' proposed block(s)'+
    (sh.proposal.unplaced.length?' · '+sh.proposal.unplaced.length+' not fully placed':'')+'</div>'+
    (blocks.length?blocks.map(b=>kRow({dot:act(b.activity).color,
      label:b.title||act(b.activity).name,sub:act(b.activity).name,
      value:fmtHM(b.at)+' · '+b.minutes+'m'})).join(''):kEmpty('Nothing fits. Free up time in Plan.'))+
    '</div>';
}
function l2AcceptMorning(sh){
  if(sh.accepted)return true;
  sh.err='';
  const proposal=sh.proposal||l2MorningProposal(sh).proposal;
  if(!proposal.blocks.length)return false;
  const w=W(),blocks={},used={},byId=Object.fromEntries(sh.candidates.map(x=>[x.id,x]));
  const base=nextOrder(sh.k);
  proposal.blocks.forEach((b,i)=>{
    blocks[uid('b')]=blockDoc({activity:b.activity,title:b.title,
      minutes:b.minutes,orig:b.minutes,order:base+i,at:b.at,from:'auto'});
    used[b.itemId]=(used[b.itemId]||0)+b.minutes;
  });
  w.plan(sh.k,{blocks});
  const backlog={},previous={};
  for(const [id,mins] of Object.entries(used)){
    const t=byId[id];if(!t)continue;
    if(t.source==='backlog'){
      const factor=sh.factors&&sh.factors[t.activity]||1;
      const total=Math.max(25,Math.ceil(t.minutes*factor/5)*5);
      backlog[t.sourceId]=mins>=total?null:{minutes:Math.max(25,Math.ceil((total-mins)/factor/5)*5)};
    }
    if(t.source==='carry'&&mins>=t.minutes){
      previous[t.sourceId]={status:'moved'};
    }
  }
  if(Object.keys(backlog).length)w.update('planning/backlog',{items:backlog},{items:{}});
  if(Object.keys(previous).length)w.plan(addDaysKey(sh.k,-1),{blocks:previous});
  if(!commit('Day planned.',w))return l2SaveFailure(sh);
  sh.accepted=true;sh.acceptedIds=Object.keys(used);return true;
}
function l2MorningIntent(sh){
  return '<div class="l2-flow">'+l2Error(sh)+
    kField('One thing that matters today',kText({bind:'sheet.intent',value:sh.intent||'',
      placeholder:'What matters most?',attrs:'maxlength="120" aria-label="Today intention"'}))+
    kField('If… (optional)',kText({bind:'sheet.ifText',value:sh.ifText||'',
      attrs:'maxlength="80" aria-label="If condition"'}))+
    kField('Then… (optional)',kText({bind:'sheet.thenText',value:sh.thenText||'',
      attrs:'maxlength="80" aria-label="Then action"'}))+'</div>';
}
function l2SaveMorning(sh){
  if(!sh.accepted||l2HasMorning(sh.k))return false;
  sh.err='';
  const cond=String(sh.ifText||'').trim().slice(0,80),then=String(sh.thenText||'').trim().slice(0,80);
  const morning={at:isoLocal(Date.now()),picks:sh.candidates.filter(x=>sh.picks[x.id]).map(x=>x.id),
    intent:String(sh.intent||'').trim().slice(0,120)};
  if(cond&&then)morning.ifThen={if:cond,then};
  const w=W().update('rituals/'+sh.k,{v:1,date:sh.k,morning},{v:1,date:sh.k});
  if(!commit('Morning plan saved.',w))return l2SaveFailure(sh);
  closeSheet();return true;
}
function l2MorningSheet(sh){
  // kFlow calls canNext before body, so compute before step validity is evaluated.
  if(sh.step===1&&!sh.accepted){
    const next=l2MorningProposal(sh);
    sh.proposal=next.proposal;sh.factors=next.factors;
  }
  const steps=[
    {title:'Pick today’s work',body:()=>l2MorningPick(sh),
      canNext:()=>sh.candidates.some(t=>sh.picks[t.id])},
    {title:'Plan your day',body:()=>l2MorningPreview(sh),next:'Accept plan',
      canNext:()=>!!(sh.proposal&&sh.proposal.blocks.length),onNext:()=>l2AcceptMorning(sh)},
    {title:'Today’s intention',body:()=>l2MorningIntent(sh),next:'Done'}
  ];
  sh.done=()=>l2SaveMorning(sh);
  return kFlow(sh,steps);
}
function l2OpenMorning(k){
  k=k||todayKey();
  if(l2HasMorning(k)){toast('Morning plan already saved.');return;}
  const candidates=l2Candidates(k),picks={};
  candidates.forEach(t=>{picks[t.id]=!!t.pick;});
  openSheet({type:'morning',k,step:0,candidates,picks,accepted:false,proposal:null,
    intent:'',ifText:'',thenText:''});
}
/* Shutdown: choose how unfinished work is disposed of without deleting history. */
function l2ShutdownRows(sh){
  const pm=planModelFor(sh.k,Date.now());
  return pm&&pm.rows||[];
}
function l2ShutdownOverview(sh){
  const pm=planModelFor(sh.k,Date.now()),rows=pm&&pm.rows||[];
  const a=aggregate(ENTRIES,Date.now(),sh.k,sh.k)[sh.k]||{study:0};
  const ratio=pm&&pm.planned?Math.round(100*(pm.done||0)/pm.planned):0;
  const completed=rows.filter(x=>x.st==='done'||x.remaining<=0);
  return '<div class="l2-flow"><div class="l2-totals"><strong>'+esc(fmtDur(a.study))+
    '</strong><span>Studied</span><strong>'+ratio+'%</strong><span>Plan complete</span></div>'+
    (completed.length?completed.map(r=>kRow({icon:'done',label:r.title||act(r.activity).name,
      sub:act(r.activity).name})).join(''):kEmpty('No blocks completed yet.'))+'</div>';
}
function l2ShutdownLeftovers(sh){
  const rows=l2ShutdownRows(sh).filter(r=>r.remaining>0&&!['skipped','moved'].includes(r.st));
  return '<div class="l2-flow">'+(rows.length?rows.map(r=>
    '<div class="l2-leftover"><div><strong>'+esc(r.title||act(r.activity).name)+'</strong>'+
    '<span>'+esc(fmtDur(r.remaining))+' left</span></div>'+
    kSeg({act:'l2-disposition',value:sh.decisions[r.id]||'tomorrow',
      options:[{v:'tomorrow',label:'Tomorrow'},{v:'backlog',label:'Backlog'},{v:'drop',label:'Drop'}]})
      .replace(/data-v="/g,'data-id="'+esc(r.id)+'" data-v="')+'</div>').join(''):
    kEmpty('Nothing unfinished.'))+'</div>';
}
function l2ShutdownTomorrow(sh){
  const tomorrow=l2ShutdownRows(sh).filter(r=>r.remaining>0&&sh.decisions[r.id]==='tomorrow');
  const backlog=backlogList();
  const opts=tomorrow.map(r=>({v:r.id,label:r.title||act(r.activity).name}))
    .concat(backlog.slice(0,6).map(t=>({v:'backlog:'+t.id,label:t.title})));
  return '<div class="l2-flow">'+l2Error(sh)+
    (opts.length?kField('First thing tomorrow',kChips({act:'l2-first',value:sh.first||'',options:opts})):
      kEmpty('Tomorrow starts with a clean slate.'))+'</div>';
}
function l2ShutdownSave(sh){
  if(l2ShutdownDone(sh.k))return false;
  sh.err='';
  const rows=l2ShutdownRows(sh),w=W(),patch={},carry=[],backlog={},ids=[];
  const next=addDaysKey(sh.k,1);
  let order=nextBacklogOrder();
  for(const r of rows.filter(r=>r.remaining>0&&!['skipped','moved'].includes(r.st))){
    const choice=['tomorrow','backlog','drop'].includes(sh.decisions[r.id])?sh.decisions[r.id]:'tomorrow';
    const remaining=Math.max(5,Math.ceil(r.remaining/MIN));
    patch[r.id]=choice==='drop'?{status:'skipped'}:
      r.done>MIN?{minutes:Math.max(5,Math.round(r.done/MIN)),status:'done'}:{status:'moved'};
    if(choice==='tomorrow'){
      carry.push({activity:r.activity,title:r.title,minutes:remaining,pomo:r.pomo});ids.push(r.id);
    }else if(choice==='backlog'){
      backlog[uid('t')]={title:r.title||act(r.activity).name,activity:r.activity,
        minutes:remaining,prio:2,due:null,order:order++,created:isoLocal(Date.now())};
    }
  }
  w.plan(sh.k,{blocks:patch,closed:true});
  if(carry.length)carryTo(w,sh.k,carry);
  if(Object.keys(backlog).length)w.update('planning/backlog',{items:backlog},{items:{}});
  const study=(aggregate(ENTRIES,Date.now(),sh.k,sh.k)[sh.k]||{study:0}).study;
  w.update('rituals/'+sh.k,{v:1,date:sh.k,shutdown:{at:isoLocal(Date.now()),done:Math.round(study/MIN),
    carry:ids,first:sh.first||null}},{v:1,date:sh.k});
  if(!commit('Day shut down.',w))return l2SaveFailure(sh);
  closeSheet();
  if(CUR)toast('Day saved. Stop timer?',{action:{label:'Stop',act:'stop'}});
  return true;
}
function l2ShutdownSheet(sh){
  const steps=[
    {title:'Today',body:()=>l2ShutdownOverview(sh)},
    {title:'Leftovers',body:()=>l2ShutdownLeftovers(sh)},
    {title:'Tomorrow',body:()=>l2ShutdownTomorrow(sh),next:'Shut down'}
  ];
  sh.done=()=>l2ShutdownSave(sh);
  return kFlow(sh,steps);
}
function l2OpenShutdown(k){
  k=k||todayKey();
  if(l2ShutdownDone(k)){toast('Day already shut down.');return;}
  const decisions={};l2ShutdownRows({k}).forEach(r=>{if(r.remaining>0)decisions[r.id]='tomorrow';});
  openSheet({type:'shutdown',k,step:0,decisions,first:''});
}
SHEETS.morning=l2MorningSheet;
SHEETS.shutdown=l2ShutdownSheet;
Object.assign(ACT,{
  'l2-open-morning'(){l2OpenMorning(todayKey());},
  'l2-open-shutdown'(){l2OpenShutdown(todayKey());},
  'l2-pick'(el){
    const sh=UI.sheet,id=el.getAttribute('data-id');
    if(!sh||sh.type!=='morning'||sh.step!==0||!sh.candidates.some(x=>x.id===id))return;
    sh.picks[id]=!sh.picks[id];renderSheet();
  },
  'l2-disposition'(el){
    const sh=UI.sheet,id=el.getAttribute('data-id'),value=el.getAttribute('data-v');
    if(!sh||sh.type!=='shutdown'||sh.step!==1||!['tomorrow','backlog','drop'].includes(value))return;
    if(!l2ShutdownRows(sh).some(x=>x.id===id&&x.remaining>0))return;
    sh.decisions[id]=value;renderSheet();
  },
  'l2-first'(el){
    const sh=UI.sheet;
    if(!sh||sh.type!=='shutdown'||sh.step!==2)return;
    sh.first=el.getAttribute('data-v');renderSheet();
  }
});
/* cards.js is loaded after rituals.js. Register at DOM ready as in L4. */
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{
  CARDS.morning={rank:ctx=>{
    if(l2HasMorning(ctx.k))return 0;
    if(ctx.now<dayStartMs(ctx.k)||ctx.now>=dayStartMs(ctx.k)+4*HOUR)return 0;
    const pm=planModelFor(ctx.k,ctx.now);
    return pm&&pm.rows.some(r=>r.remaining>0)?0:95;
  },render:()=>'<div class="l2-card"><span>Start with a realistic plan.</span>'+
    kBtn('Plan my day','data-act="l2-open-morning"',{kind:'primary'})+'</div>'};
  CARDS.shutdown={rank:ctx=>{
    if(l2ShutdownDone(ctx.k))return 0;
    const p=V.plans[ctx.k]||{},end=hmOnDay(ctx.k,p.end||CFG.planEnd||'22:30');
    if(ctx.now<end-30*MIN)return 0;
    const a=aggregate(ENTRIES,ctx.now,ctx.k,ctx.k)[ctx.k];
    return a&&a.all>0?95:0;
  },render:()=>'<div class="l2-card"><span>Close today and clear tomorrow.</span>'+
    kBtn('Shut down','data-act="l2-open-shutdown"',{kind:'primary'})+'</div>'};
});
