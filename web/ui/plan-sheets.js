/* P2 — Plan sheets. Keep existing plan/save contracts; only rework presentation. */
const p2Error = sh => sh.err ? '<div class="p2-error" role="alert">'+esc(sh.err)+'</div>' : '';
const errLine = p2Error; // Task editors still use this shared helper.
const HM = /^\d{1,2}:\d{2}/;

function p2Presets(bind, minutes) {
  return kChips({bind,value:String(minutes),options:[25,50,60,90,120].map(m=>({v:String(m),label:fmtDur(m*MIN)}))});
}
function p2Pomo(bind,pomo){
  return kSeg({bind,value:String(pomo||''),options:[
    {v:'',label:'Default'},{v:'off',label:'Off'},
    {v:'25/5',label:'25/5'},{v:'50/10',label:'50/10'},{v:'90/20',label:'90/20'}
  ]});
}
function p2DayButtons(days,actName){
  const picked=Array.isArray(days)?days:[];
  const start=+CFG.weekStart||0;
  return '<div class="p2-days" role="group" aria-label="Repeat days">'+
    Array.from({length:7},(_,i)=>{
      const d=(start+i)%7,checked=picked.includes(d);
      const name=wdName(new Date(2026,0,4+d));
      return '<button type="button" class="p2-weekday'+(checked?' active':'')+'" aria-label="'+esc(name)+
        '" title="'+esc(name)+'" aria-pressed="'+checked+'" data-act="'+actName+'" data-d="'+d+'">'+
        esc(name.slice(0,1))+'</button>';
    }).join('')+'</div>';
}
function p2Input(label,bind,value,placeholder,id,max){
  return '<div class="p2-input-group"><label for="'+esc(id)+'">'+esc(label)+'</label>'+
    kText({bind,value:value||'',placeholder:placeholder||'',attrs:'id="'+esc(id)+'" maxlength="'+(max||80)+'" aria-label="'+esc(label)+'"'})+'</div>';
}
function p2Duration(bind,value){
  return '<div class="p2-duration">'+p2Presets(bind,value)+
    kStepper({bind,value,min:5,max:720,step:5,fmt:n=>fmtDur(n*MIN)})+'</div>';
}
function p2PomoSelect(bind,current){
  return kField('Pomodoro',p2Pomo(bind,current));
}

function openQnew(k,s,e,tab,days){
  openSheet({type:'qnew',tab:tab||'block',k,
    start:msToHm(s),end:msToHm(e),
    minutes:Math.max(5,Math.round((e-s)/MIN)),
    activity:ACTMAP[UI.ab.activity]?UI.ab.activity:firstStudyId(),
    title:'',pin:false,pomo:'',btitle:'',days:days||[],weekly:!!(days&&days.length),bact:'',err:''});
}
function sQnew(sh){
  const kind=sh.tab==='busy'?'busy':'block';
  const tabs=kSeg({act:'q-tab',value:kind,options:[
    {v:'block',label:'Block',icon:'plan'},{v:'busy',label:'Busy',icon:'busy'}]});
  let body;
  if(kind==='block'){
    const more=kCollapse('p2-new-more','More',
      p2PomoSelect('sheet.pomo',sh.pomo)+
      kField('Custom length',kStepper({bind:'sheet.minutes',value:sh.minutes||60,min:5,max:720,step:5,fmt:n=>fmtDur(n*MIN)})));
    body=kField('Activity',kActPick({bind:'sheet.activity',id:sh.activity,study:true,life:true,none:false}))+
      p2Input('Title','sheet.title',sh.title,'Title (optional)','q-title',80)+
      kField('Start',kTime({bind:'sheet.start',hm:sh.start,nudge:true}))+
      kField('Length',p2Presets('sheet.minutes',sh.minutes))+
      kField('Fixed time',kSwitch({bind:'sheet.pin',on:!!sh.pin,label:'Fixed time'}))+
      more;
  }else{
    const weekly=!!sh.weekly;
    body=p2Input('Title','sheet.btitle',sh.btitle,'What is it?','q-btitle',60)+
      kField('Start',kTime({bind:'sheet.start',hm:sh.start,nudge:true}))+
      kField('End',kTime({bind:'sheet.end',hm:sh.end,nudge:true}))+
      kField('Weekly',kSwitch({act:'p2-weekly',on:weekly,label:'Repeat weekly'}))+
      (weekly?kField('Days',p2DayButtons(sh.days,'q-day')):'')+
      kCollapse('p2-busy-more','More',kField('Counts as',kActPick({
        bind:'sheet.bact',id:sh.bact,study:true,life:true,none:true})));
  }
  return kSheetHead('New')+
    '<div class="k-sheet-body p2-sheet">'+
    '<div class="p2-tabs">'+tabs+'</div>'+body+p2Error(sh)+'</div>'+
    kSheetFoot(kBtn('Add','data-act="q-save"',{kind:'primary'}));
}

function saveQnew(){
  const sh=UI.sheet,k=sh.k;
  sh.err='';
  if(sh.tab!=='busy'){
    const m=Math.round(+sh.minutes);
    if(!ACTMAP[sh.activity])sh.err='Choose an activity.';
    else if(!(m>=5&&m<=720))sh.err='Use between 5 and 720 minutes.';
    else if(sh.pin&&!HM.test(sh.start||''))sh.err='Enter a start time.';
    if(sh.err){renderSheet();return;}
    const w=W();
    w.plan(k,{blocks:{[uid('b')]:blockDoc({
      activity:sh.activity,title:String(sh.title||'').trim(),
      minutes:m,order:nextOrder(k),at:sh.pin?sh.start.slice(0,5):null,
      pomo:sh.pomo==='off'?'off':sh.pomo||null
    })}});
    UI.ab.activity=sh.activity;
    closeSheet(true);
    commit('Planned '+fmtDur(m*MIN)+' of '+act(sh.activity).name+'.',w);
    return;
  }
  const title=String(sh.btitle||'').trim();
  if(!title)sh.err='Enter a title.';
  else if(!HM.test(sh.start||'')||!HM.test(sh.end||''))sh.err='Choose a start and end time.';
  else if(sh.start.slice(0,5)===sh.end.slice(0,5))sh.err='Start and end must differ.';
  else if(sh.weekly&&(!Array.isArray(sh.days)||!sh.days.length))sh.err='Choose at least one day.';
  if(sh.err){renderSheet();return;}
  const w=W(),doc={title:title.slice(0,60),start:sh.start.slice(0,5),
    end:sh.end.slice(0,5),activity:sh.bact||null};
  if(sh.weekly)w.update('planning/commitments',{items:{[uid('c')]:
    Object.assign(doc,{days:sh.days.slice().sort(),from:k,until:null,archived:false})}},{items:{}});
  else w.plan(k,{events:{[uid('v')]:doc}});
  closeSheet(true);
  commit(sh.weekly?'Added weekly item.':'Added busy time.',w);
}
function p2BlockProgress(r){
  if(!r||r.done<=0)return '';
  const target=Math.max(r.target,1);
  const percent=Math.max(0,Math.min(100,r.done/target*100));
  return '<div class="p2-progress" aria-label="'+esc(fmtDur(r.done)+' of '+fmtDur(r.target))+'">'+
    '<span>'+esc(fmtDur(r.done)+' of '+fmtDur(r.target))+'</span>'+
    '<div class="p2-track"><i style="width:'+percent.toFixed(1)+'%"></i></div></div>';
}
function sBlock(sh){
  const b=sh.b||{},k=sh.k,pm=planModelFor(k);
  const r=pm&&pm.rows.find(x=>x.id===sh.id);
  const available=k===todayKey()&&r&&r.remaining>0&&!['skipped','done','moved'].includes(r.st);
  const title=(b.title||act(b.activity).name||'Block').trim();
  const actions=kIconBtn('dup','Duplicate','data-act="block-dup"')+
    kIconBtn('backlog','Back to backlog','data-act="block-back"')+
    kIconBtn('delete','Delete','data-act="p2-block-del"');
  const more=kCollapse('p2-block-more','More',
    p2PomoSelect('sheet.b.pomo',b.pomo)+
    kField('Day',kDate({bind:'sheet.b.day',key:b.day||k})));
  const timeRow='<div class="p2-start">'+
    (b.at?kTime({bind:'sheet.b.at',hm:b.at,nudge:true}):
      '<span class="p2-auto">Auto</span>')+
    (b.at?kIconBtn('close','Clear start time','data-act="p2-block-auto"'):
      kIconBtn('pin','Fix start time','data-act="p2-block-fix"'))+
    '</div>';
  const body=p2BlockProgress(r)+
    kField('Activity',kActPick({bind:'sheet.b.activity',id:b.activity,study:true,life:true,none:false}))+
    p2Input('Title','sheet.b.title',b.title,'Title (optional)','b-title',80)+
    kField('Start',timeRow)+
    kField('Length',p2Duration('sheet.b.minutes',b.minutes||60))+
    l3EstimateNote(b.activity)+more+p2Error(sh);
  const foot='<div class="p2-two">'+
    (available?kBtn('Start now','data-act="block-start"',{kind:'tonal',icon:'start'}):'')+
    kBtn('Save','data-act="block-save"',{kind:'primary'})+'</div>';
  return kSheetHead(title,actions)+'<div class="k-sheet-body p2-sheet">'+body+'</div>'+
    kSheetFoot(foot);
}
function openBlockSheet(k,id){
  const b=blocksOf(k)[id];
  if(!b)return;
  openSheet({type:'block',k,id,err:'',
    b:{activity:b.activity,title:b.title||'',minutes:b.minutes,
      at:b.at||'',pomo:b.pomo||'',day:k}});
}
function saveBlockSheet(){
  const sh=UI.sheet,b=sh.b||{},tk=todayKey(),m=Math.round(+b.minutes);
  sh.err='';
  if(!ACTMAP[b.activity])sh.err='Choose an activity.';
  else if(!(m>=5&&m<=720))sh.err='Use between 5 and 720 minutes.';
  else if(b.at&&!HM.test(b.at))sh.err='Enter a valid start.';
  else if(b.day&&!/^\d{4}-\d{2}-\d{2}$/.test(b.day))sh.err='Choose a day.';
  else if(b.day&&b.day!==sh.k&&b.day<tk)sh.err='Choose today or later.';
  if(sh.err){renderSheet();return;}
  const patch={activity:b.activity,title:String(b.title||'').trim(),minutes:m,
    at:b.at?b.at.slice(0,5):null,pomo:b.pomo||null};
  const w=W();
  if(b.day&&b.day!==sh.k){
    const r=(planModelFor(sh.k)||{rows:[]}).rows.find(x=>x.id===sh.id);
    const done=r?Math.round(r.done/MIN):0;
    w.plan(sh.k,{blocks:{[sh.id]:done>=1?{minutes:done,status:'done'}:null}});
    w.plan(b.day,{blocks:{[uid('b')]:blockDoc(Object.assign({},patch,
      {minutes:Math.max(5,m-done),order:nextOrder(b.day)}))}});
    closeSheet(true);
    commit('Moved block to '+dayName(b.day)+'.',w);
    return;
  }
  w.plan(sh.k,{blocks:{[sh.id]:patch}});
  closeSheet(true);
  commit('Saved block.',w);
}
function sWrap(sh){
  const pm=planModelFor(sh.k),left=pm?pm.rows.filter(r=>r.remaining>0):[];
  const a=aggregate(ENTRIES,Date.now(),sh.k,sh.k)[sh.k]||{study:0};
  const ratio=pm&&pm.planned?Math.round(100*pm.done/pm.planned):null;
  const summary=fmtDur(a.study)+' studied'+(ratio!==null?' · '+ratio+'% of plan':'');
  const choices=left.length?
    left.map(r=>'<label class="p2-wrap-item"><input type="checkbox" data-act="wrap-pick" data-id="'+esc(r.id)+
      '"'+(sh.pick&&sh.pick[r.id]?' checked':'')+'><span class="p2-wrap-title">'+
      esc(act(r.activity).name+(r.title?' · '+r.title:''))+'</span><span>'+
      esc(fmtDur(r.remaining))+'</span></label>').join(''):
    kEmpty('Nothing to move');
  const stop=CUR?'<label class="p2-wrap-item"><span>Stop timer</span>'+
    '<input type="checkbox" data-act="wrap-stop"'+(sh.stop?' checked':'')+'></label>':'';
  return kSheetHead('Wrap up')+
    '<div class="k-sheet-body p2-sheet"><div class="p2-wrap-summary">'+esc(summary)+'</div>'+
    '<div class="p2-section-title">Move to tomorrow</div>'+choices+stop+p2Error(sh)+'</div>'+
    kSheetFoot(kBtn('Wrap up','data-act="wrap-save"',{kind:'primary'}));
}
function p2FitModel(k){return planModelFor(k);}
function sFit(sh){
  const pm=p2FitModel(sh.k);
  if(!pm||!pm.over)return kSheetHead("Doesn't fit")+
    '<div class="k-sheet-body p2-sheet">'+kEmpty('Everything fits')+'</div>';
  const ext=roundUpMs(pm.finish,15*MIN);
  const summary=fmtDur(pm.over)+' over · ends '+fmtT(pm.finish);
  return kSheetHead("Doesn't fit")+
    '<div class="k-sheet-body p2-sheet"><div class="p2-muted">'+esc(summary)+'</div>'+
    kRow({icon:'fit',label:'Shrink blocks',attrs:'data-act="p2-fit-shrink" data-k="'+esc(sh.k)+'"'})+
    kRow({icon:'tomorrow',label:'Move the rest to tomorrow',attrs:'data-act="p2-fit-overflow" data-k="'+esc(sh.k)+'"'})+
    kRow({icon:'later',label:'Work until '+fmtT(ext),attrs:'data-act="p2-fit-extend" data-k="'+esc(sh.k)+'" data-t="'+esc(msToHm(ext))+'"'})+
    '</div>';
}
function sPlanEnd(sh){
  return kSheetHead('Plan ends at')+
    '<div class="k-sheet-body p2-sheet">'+
    kField('End',kTime({bind:'sheet.end',hm:sh.end||CFG.planEnd,nudge:true}))+
    p2Error(sh)+'</div>'+
    kSheetFoot(kBtn('Save','data-act="p2-planend-save"',{kind:'primary'}));
}
function p2OpenWrap(k){
  const pm=planModelFor(k),pick={};
  if(pm)pm.rows.forEach(r=>{if(r.remaining>0)pick[r.id]=true;});
  openSheet({type:'wrap',k,pick,stop:false});
}
function p2OpenPlanMenu(el,k){
  if(!el)return;
  const day=k||UI.cal.anchor||todayKey(),hasPlan=!!(V.plans&&V.plans[day]);
  const items=[
    {icon:'autoplan',label:'Auto-plan',act:'l3-auto-open',attrs:'data-k="'+esc(day)+'"'},
    {icon:'copy',label:'Copy to tomorrow',act:'p2-menu-copy',attrs:'data-k="'+esc(day)+'"'},
    {icon:'wrap',label:'Wrap up',act:'p2-menu-wrap',attrs:'data-k="'+esc(day)+'"'},
    {icon:'later',label:'Plan ends at…',act:'p2-menu-end',attrs:'data-k="'+esc(day)+'"'}
  ];
  if(hasPlan)items.push({icon:'delete',label:'Clear plan',act:'p2-menu-clear',
    attrs:'data-k="'+esc(day)+'"',danger:true});
  openMenu(el,items);
}
/* L3: estimate correction from completed plan-linked sessions. */
function l3History(activity) {
  return (ENTRIES||[]).filter(e=>e && e.a===activity && e.e!=null && e.e>e.s && e.block)
    .sort((a,b)=>b.e-a.e).map(e=>{
      const b=V.plans&&V.plans[e.day]&&V.plans[e.day].blocks&&V.plans[e.day].blocks[e.block];
      return b?{planned:+b.orig||+b.minutes,actual:(e.e-e.s)/MIN}:null;
    }).filter(Boolean).slice(0,30);
}
function l3Factor(activity) {
  return typeof estimateFactor==='function'?estimateFactor(l3History(activity)):1;
}
function l3EstimateNote(activity) {
  const f=l3Factor(activity);
  return f===1?'':'<div class="p2-muted">Usually takes ×'+f.toFixed(1)+' from your history</div>';
}
function l3HourStats() {
  const h={};
  for(const e of ENTRIES||[]){
    if(!e||e.e==null||e.e<=e.s)continue;
    const hour=new Date(e.s).getHours(),mins=(e.e-e.s)/MIN;
    if(!h[hour])h[hour]={min:0,sum:0};
    h[hour].min+=mins;h[hour].sum+=mins*(+e.focus||2);
  }
  return Object.fromEntries(Object.entries(h).map(([hour,v])=>[hour,{min:v.min,focus:v.sum/v.min}]));
}
/* Subtract commitments, calendar busy time and existing projected plan blocks. */
function l3FreeIntervals(k){
  const p=V.plans[k]||{},start=hmOnDay(k,p.start||CFG.planStart||'08:00'),
    end=hmOnDay(k,p.end||CFG.planEnd||'22:30'),now=Date.now();
  const begin=k===todayKey()?Math.max(start,now+5*MIN):start;
  if(!(end>begin))return [];
  const pm=planModelFor(k,now),all=(busyIv(k)||[]).slice();
  if(pm&&pm.rows)pm.rows.forEach(row=>(row.pieces||[]).forEach(pair=>all.push(pair)));
  const blocks=mergeIntervals(all.map(([s,e])=>[Math.max(begin,s),Math.min(end,e)]).filter(([s,e])=>e>s));
  const out=[];let cursor=begin;
  for(const [s,e] of blocks){if(s>cursor)out.push([cursor,s]);cursor=Math.max(cursor,e);}
  if(cursor<end)out.push([cursor,end]);
  return out;
}
function l3OpenAuto(k){
  k=k||UI.cal.anchor||todayKey();
  if(k<todayKey()){toast('Choose today or later.');return;}
  const items=backlogList().map(t=>({
    id:t.id,activity:ACTMAP[t.activity]?t.activity:firstStudyId(),
    title:t.title,minutes:t.minutes,prio:t.prio,hard:t.prio===1
  }));
  if(!items.length){toast('Backlog is empty.');return;}
  const factors={};items.forEach(item=>{factors[item.activity]=l3Factor(item.activity);});
  const free=l3FreeIntervals(k);
  const proposal=autoPlan({k,items,free,now:k===todayKey()?Date.now():undefined,
    gapMin:+CFG.gap||0,windows:energyWindows(l3HourStats()),
    factor:id=>factors[id]||1});
  if(!proposal.blocks.length){toast('Nothing fits in this day.');return;}
  openSheet({type:'autoplan',k,items,proposal,factors});
}
function l3AutoSheet(sh){
  const rows=sh.proposal.blocks.map(b=>kRow({dot:act(b.activity).color,
    label:b.title||act(b.activity).name,
    sub:act(b.activity).name,value:fmtHM(b.at)+' · '+b.minutes+'m'})).join('');
  const left=sh.proposal.unplaced.length?'<div class="p2-muted">'+
    sh.proposal.unplaced.length+' task(s) have remaining work</div>':'';
  return kSheetHead('Auto-plan')+
    '<div class="k-sheet-body p2-sheet">'+
    '<div class="p2-muted">Preview · '+sh.proposal.blocks.length+' block(s)</div>'+
    rows+left+'</div>'+
    kSheetFoot(kBtn('Accept plan','data-act="l3-auto-accept"',{kind:'primary'}));
}
SHEETS.autoplan=l3AutoSheet;
ACT['l3-auto-open']=el=>l3OpenAuto(el&&el.getAttribute('data-k'));
ACT['l3-auto-accept']=()=>{
  const sh=UI.sheet;
  if(!sh||sh.type!=='autoplan'||!sh.proposal.blocks.length)return;
  const blocks={},done={},w=W(),base=nextOrder(sh.k);
  sh.proposal.blocks.forEach((b,i)=>{
    blocks[uid('b')]=blockDoc({activity:b.activity,title:b.title,minutes:b.minutes,
      orig:b.minutes,order:base+i,at:b.at,from:'auto'});
    done[b.itemId]=(done[b.itemId]||0)+b.minutes;
  });
  w.plan(sh.k,{blocks});
  const items={};
  for(const t of sh.items){
    const used=done[t.id]||0;if(!used)continue;
    const factor=sh.factors[t.activity]||1;
    const total=Math.max(25,Math.ceil(t.minutes*factor/5)*5);
    if(used>=total)items[t.id]=null;
    else items[t.id]={minutes:Math.max(25,Math.ceil((total-used)/factor/5)*5)};
  }
  if(Object.keys(items).length)w.update('planning/backlog',{items},{items:{}});
  closeSheet(true);
  commit('Auto-planned '+sh.proposal.blocks.length+' block(s).',w);
};
SHEETS.qnew=sQnew;
SHEETS.block=sBlock;
SHEETS.wrap=sWrap;
SHEETS.fit=sFit;
SHEETS.planend=sPlanEnd;

Object.assign(ACT,{
  'p2-weekly'(){
    const sh=UI.sheet;
    if(!sh||sh.type!=='qnew'||sh.tab!=='busy')return;
    sh.weekly=!sh.weekly;
    if(sh.weekly&&!sh.days.length)sh.days=[weekdayOfKey(sh.k)];
    if(!sh.weekly)sh.days=[];
    renderSheet();
  },
  'p2-block-auto'(){if(UI.sheet&&UI.sheet.type==='block'){UI.sheet.b.at='';renderSheet();}},
  'p2-block-fix'(){
    const sh=UI.sheet;
    if(!sh||sh.type!=='block')return;
    sh.b.at=sh.b.at||CFG.planStart||'09:00';
    renderSheet();
  },
  'p2-block-del'(){
    const sh=UI.sheet;
    if(!sh||sh.type!=='block')return;
    const w=W();w.plan(sh.k,{blocks:{[sh.id]:null}});
    closeSheet(true);commit('Deleted block.',w);
  },
  'p2-open-fit'(el){
    const k=el&&el.getAttribute('data-k')||UI.cal.anchor||todayKey();
    openSheet({type:'fit',k});
  },
  'p2-fit-shrink'(el){
    const k=el.getAttribute('data-k')||UI.sheet&&UI.sheet.k;
    if(!k)return;
    closeSheet(true);planShrink(k);
  },
  'p2-fit-overflow'(el){
    const k=el.getAttribute('data-k')||UI.sheet&&UI.sheet.k;
    if(!k)return;
    closeSheet(true);planOverflow(k);
  },
  'p2-fit-extend'(el){
    const k=el.getAttribute('data-k')||UI.sheet&&UI.sheet.k,
      t=el.getAttribute('data-t');
    if(!k||!HM.test(t||''))return;
    const w=W();w.plan(k,{end:t.slice(0,5)});
    closeSheet(true);
    commit('Plan now runs until '+fmtHM(t)+'.',w);
  },
  'p2-planend-save'(){
    const sh=UI.sheet;
    if(!sh||sh.type!=='planend')return;
    sh.err='';
    if(!HM.test(sh.end||'')){sh.err='Choose an end time.';renderSheet();return;}
    const w=W();w.plan(sh.k,{end:sh.end.slice(0,5)});
    closeSheet(true);commit('Plan ends at '+fmtHM(sh.end)+'.',w);
  },
  'p2-plan-menu'(el){
    p2OpenPlanMenu(el,el&&el.getAttribute('data-k'));
  },
  'p2-menu-copy'(el){
    const k=el.getAttribute('data-k')||UI.cal.anchor||todayKey();
    copyPlan(k,addDaysKey(k,1));
  },
  'p2-menu-wrap'(el){
    const k=el.getAttribute('data-k')||UI.cal.anchor||todayKey();
    p2OpenWrap(k);
  },
  'p2-menu-end'(el){
    const k=el.getAttribute('data-k')||UI.cal.anchor||todayKey();
    const plan=V.plans&&V.plans[k];
    openSheet({type:'planend',k,end:plan&&plan.end||CFG.planEnd,err:''});
  },
  'p2-menu-clear'(el){
    const k=el.getAttribute('data-k')||UI.cal.anchor||todayKey();
    const w=W();w.set('plans/'+k,{date:k,source:'me',blocks:{}});
    commit('Cleared plan.',w);
  }
});
