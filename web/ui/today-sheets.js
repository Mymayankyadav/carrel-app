/* T2 — Today sheets: all writes delegate to existing timer/parking actions. */
function t2ActivityRows(kind,totals){
  const list=ACTS.filter(a=>!a.archived&&(kind==='study'?a.kind==='study':a.kind!=='study'));
  return list.map(a=>{
    const running=CUR&&CUR.activity===a.id;
    const duration=totals[a.id]||0;
    const right=running?'Now':duration?fmtDur(duration):'';
    return '<div class="t2-activity-row">'+
      '<button type="button" class="t2-activity" data-act="t2-start" data-long="t2-start-opts" data-id="'+esc(a.id)+
      '" aria-label="'+esc('Start '+a.name)+'" aria-pressed="'+!!running+'">'+
      '<span class="t2-activity-left"><i class="t2-act-dot" style="--c:'+kSafeColour(a.color)+'"></i>'+
      '<span>'+esc(a.name)+'</span></span><span class="t2-activity-right">'+
      esc(right)+'</span></button>'+
      '<button type="button" class="k-icon t2-activity-edit" data-act="t2-edit-one" data-id="'+esc(a.id)+
      '" aria-label="'+esc('Edit '+a.name)+'" title="'+esc('Edit '+a.name)+'">'+icon('edit')+'</button></div>';
  }).join('');
}
function sActivities(){
  const now=Date.now(),k=todayKey();
  const summary=aggregate(ENTRIES,now,k,k)[k];
  const totals=summary&&summary.acts||{};
  const edit=kIconBtn('edit','Edit activities','data-act="t2-edit-activities"');
  return kSheetHead('Activities',edit)+
    '<div class="k-sheet-body t2-sheet">'+
    '<div class="t2-section">Study</div>'+t2ActivityRows('study',totals)+
    '<div class="t2-section">Other</div>'+t2ActivityRows('life',totals)+'</div>';
}
function t2StartOffsets(){
  const last=lastEntry(),now=Date.now();
  const values=[{v:'now',label:'Now'},{v:'5',label:'5m ago'},{v:'15',label:'15m ago'},{v:'30',label:'30m ago'}];
  if(last&&last.e>0&&last.e<now&&now-last.e<=12*HOUR)values.push({v:'last',label:'After last'});
  return values;
}
function sStart(sh){
  const a=ACTMAP[sh.act],name=a?a.name:'Activity';
  const modes=kChips({act:'t2-from',value:sh.from||'now',options:t2StartOffsets()});
  const pomp=!!sh.pomo;
  const intention=a&&a.kind==='study'?kCollapse('l5-intention','Intention (optional)',
    kField('What will you finish?',kText({bind:'sheet.intent',value:sh.intent||'',
      placeholder:'One clear outcome',attrs:'maxlength="80" aria-label="Session intention"'}))+
    kField('If…',kText({bind:'sheet.ifText',value:sh.ifText||'',attrs:'maxlength="80" aria-label="If condition"'}))+
    kField('Then…',kText({bind:'sheet.thenText',value:sh.thenText||'',attrs:'maxlength="80" aria-label="Then action"'})))
      .replace('<summary>','<summary data-act="l5-intention-toggle">'):'';
  const energy=a&&a.kind==='study'&&typeof lab==='function'&&lab('energy')?
    kField('Energy',kSeg({act:'l5-energy',value:String(sh.energy||0),
      options:[{v:'1',label:'Low'},{v:'2',label:'Okay'},{v:'3',label:'High'}]})):'';
  return kSheetHead(name)+
    '<div class="k-sheet-body t2-sheet">'+
    kField('Start',modes)+
    kField('Pomodoro',kSwitch({act:'t2-pomo',on:pomp,label:'Pomodoro'}))+
    (pomp?kField('Length',kSeg({act:'t2-preset',value:sh.preset||'25/5',
      options:[{v:'25/5',label:'25/5'},{v:'50/10',label:'50/10'},{v:'90/20',label:'90/20'}]})):'')+
    intention+energy+
    '</div>'+kSheetFoot(kBtn('Start','data-act="t2-confirm-start"',{kind:'primary',icon:'start'}));
}
function t2ParkError(sh){return sh&&sh.err?'<div class="t2-save-error" role="alert">'+esc(sh.err)+'</div>':'';}
function t2ParkFailed(sh){
  if(sh){sh.err='Could not save offline. Check storage and retry.';renderSheet();}
}
function sPark(){
  const value=UI.parkText||'';
  return kSheetHead('Park a thought')+
    '<div class="k-sheet-body t2-sheet">'+t2ParkError(UI.sheet)+
    '<textarea class="k-textarea t2-park-input" data-bind="parkText" maxlength="140" rows="3" '+
      'placeholder="What should you remember?" aria-label="Park a thought" autofocus>'+esc(value)+'</textarea>'+
    (value.length>120?'<div class="t2-counter">'+value.length+'/140</div>':'')+
    '</div>'+kSheetFoot(kBtn('Park','data-act="t2-save-park"'+(!value.trim()?' disabled':''),{kind:'primary'}));
}
function sParked(sh){
  const k=sh.k||todayKey(),list=parkedItems(k);
  if(!list.length){ if(typeof setTimeout==='function')setTimeout(()=>{
    if(UI.sheet&&UI.sheet.type==='parked')closeSheet(true);
  },0);return kSheetHead('Parked')+'<div class="k-sheet-body t2-sheet">'+kEmpty('Nothing parked')+'</div>'; }
  const rows=list.map(item=>
    '<div class="t2-parked-row"><span>'+esc(item.text)+'</span>'+
    kIconBtn('backlog','Move to backlog','data-act="t2-park-backlog" data-k="'+esc(k)+'" data-id="'+esc(item.id)+'"')+
    kIconBtn('delete','Delete','data-act="t2-park-drop" data-k="'+esc(k)+'" data-id="'+esc(item.id)+'"')+
    '</div>').join('');
  return kSheetHead('Parked')+'<div class="k-sheet-body t2-sheet">'+t2ParkError(sh)+rows+'</div>';
}
function sFixStop(){
  const seen=+store.get('seen')||0,now=Date.now();
  const start=CUR?parseT(CUR.start):0;
  const valid=seen>start+MIN&&seen<now-5*MIN;
  return kSheetHead('When did you stop?')+
    '<div class="k-sheet-body t2-sheet">'+
    kField('Time',kTime({bind:'guardTime',hm:UI.guardTime||msToHm(now)}))+
    (valid?kChips({act:'t2-seen',value:'',options:[{v:String(seen),label:'Last open '+fmtT(seen)}]}):'')+
    '</div>'+kSheetFoot(kBtn('Save','data-act="t2-stop-save"',{kind:'primary'}));
}
/* L5 — post-session recall; all writes use W()/commit so they queue offline. */
function l5ReviewTopics(subject){
  return Object.entries(V.topics||{}).filter(([,t])=>t&&!t.archived&&t.subject===subject&&t.title)
    .map(([id,t])=>({id,title:String(t.title)})).slice(0,40);
}
function l5SessionPayload(sh){
  const focus=+sh.focus;
  if(![1,2,3].includes(focus))return null;
  const valid=new Set(l5ReviewTopics(sh.subject).map(t=>t.id));
  const topics=Array.isArray(sh.topics)?[...new Set(sh.topics)].filter(id=>valid.has(id)).slice(0,20):[];
  return {focus,topics,recall:String(sh.recall||'').trim().slice(0,280)};
}
function l5SessionEndSheet(sh){
  const choices=kSeg({act:'l5-recall-focus',value:String(sh.focus||0),
    options:[{v:'1',label:'Scattered'},{v:'2',label:'Okay'},{v:'3',label:'Deep'}]});
  const topics=l5ReviewTopics(sh.subject),selected=Array.isArray(sh.topics)?sh.topics:[];
  return kSheetHead('Session reflection')+
    '<div class="k-sheet-body t2-sheet l5-session-sheet">'+
    kField('How focused were you?',choices)+
    (topics.length?kField('Topics studied',kChips({act:'l5-recall-topic',multi:true,value:selected,
      options:topics.map(t=>({v:t.id,label:t.title}))})):'')+
    kField('What did you learn? (optional)',
      '<textarea class="k-textarea" data-bind="sheet.recall" maxlength="280" rows="3" '+
        'aria-label="Recall note" placeholder="Recall from memory, in your own words">'+esc(sh.recall||'')+'</textarea>')+
    '</div>'+kSheetFoot(kBtn('Skip','data-act="l5-recall-skip"',{kind:'text'})+
    kBtn('Save','data-act="l5-recall-save"'+(!l5SessionPayload(sh)?' disabled':''),{kind:'primary'}));
}
Object.assign(SHEETS,{start:sStart,activities:sActivities,park:sPark,parked:sParked,fixstop:sFixStop});
SHEETS.sessionEnd=l5SessionEndSheet;
Object.assign(ACT,{
  // Keep the disclosure state synchronously before editable fields trigger morphing.
  'l5-intention-toggle'(el){
    const d=el.closest&&el.closest('details');
    UI.open=UI.open||{};UI.open['l5-intention']=d?!d.open:true;
  },
  't2-start-opts'(el){
    const id=el.getAttribute('data-id'),a=ACTMAP[id];
    if(!a||a.archived)return;
    openSheet({type:'start',act:id,from:'now',pomo:!!(UI.pomoOn&&a.kind==='study'),
      preset:UI.pomoPreset||presetLabel(CFG.pomodoro)});
  },
  't2-start'(el){
    const id=el.getAttribute('data-id');
    if(!ACTMAP[id]||ACTMAP[id].archived)return;
    closeSheet(true);startActivity(id);
  },
  't2-edit-activities'(){closeSheet(true);openPage('settings','settings.activities');},
  't2-edit-one'(el){
    const id=el.getAttribute('data-id'),a=ACTMAP[id];
    if(!a||a.archived)return;
    closeSheet(true);
    openPage('settings','settings.activity',{id});
  },
  't2-from'(el){
    const sh=UI.sheet;if(!sh||sh.type!=='start')return;
    const v=el.getAttribute('data-v');
    if(t2StartOffsets().some(o=>o.v===v)){sh.from=v;renderSheet();}
  },
  't2-pomo'(){
    const sh=UI.sheet;if(!sh||sh.type!=='start')return;
    sh.pomo=!sh.pomo;renderSheet();
  },
  't2-preset'(el){
    const sh=UI.sheet,v=el.getAttribute('data-v');
    if(sh&&sh.type==='start'&&PRESETS[v]){sh.preset=v;renderSheet();}
  },
  'l5-energy'(el){
    const sh=UI.sheet,n=+el.getAttribute('data-v');
    if(sh&&sh.type==='start'&&[1,2,3].includes(n)){sh.energy=n;renderSheet();}
  },
  'l5-recall-focus'(el){
    const sh=UI.sheet,n=+el.getAttribute('data-v');
    if(sh&&sh.type==='sessionEnd'&&[1,2,3].includes(n)){sh.focus=n;renderSheet();}
  },
  'l5-recall-topic'(el){
    const sh=UI.sheet,id=el.getAttribute('data-v');
    if(!sh||sh.type!=='sessionEnd'||!l5ReviewTopics(sh.subject).some(t=>t.id===id))return;
    const selected=new Set(sh.topics||[]);
    if(selected.has(id))selected.delete(id);else selected.add(id);
    sh.topics=[...selected];renderSheet();
  },
  'l5-recall-skip'(){if(UI.sheet&&UI.sheet.type==='sessionEnd')closeSheet();},
  'l5-recall-save'(){
    const sh=UI.sheet;if(!sh||sh.type!=='sessionEnd')return;
    const entry=V.days[sh.day]&&V.days[sh.day].entries&&V.days[sh.day].entries[sh.id];
    if(!entry||entry.activity!==sh.subject){closeSheet();toast('Session no longer available.');return;}
    const payload=l5SessionPayload(sh);if(!payload)return;
    const w=W().day(sh.day,{[sh.id]:payload});
    for(const id of payload.topics)w.update('topics/'+id,{last:sh.day});
    if(commit('Reflection saved.',w,{undo:true}))closeSheet();
  },
  't2-confirm-start'(){
    const sh=UI.sheet;if(!sh||sh.type!=='start'||!ACTMAP[sh.act])return;
    const now=Date.now(),last=lastEntry();
    let at=now;
    if(sh.from==='last'&&last&&last.e>0&&now-last.e<=12*HOUR)at=last.e;
    else if(['5','15','30'].includes(sh.from))at=now-Number(sh.from)*MIN;
    const id=sh.act,opts={at};
    if(sh.pomo)opts.pomoPreset=PRESETS[sh.preset]?sh.preset:'25/5';
    else opts.pomoRaw=null;
    if(ACTMAP[id].kind==='study'){
      opts.intent=String(sh.intent||'').trim().slice(0,80);
      const condition=String(sh.ifText||'').trim().slice(0,80),
        then=String(sh.thenText||'').trim().slice(0,80);
      if(condition&&then)opts.ifThen={if:condition,then};
      if(typeof lab==='function'&&lab('energy')&&[1,2,3].includes(+sh.energy))opts.energy=+sh.energy;
    }
    closeSheet(true);startActivity(id,opts);
  },
  't2-save-park'(){
    const sh=UI.sheet,text=String(UI.parkText||'').trim();
    if(!sh||sh.type!=='park'||!text)return;
    if(parkAdd(text))closeSheet(true);
    else t2ParkFailed(sh);
  },
  't2-park-backlog'(el){
    const sh=UI.sheet;if(!sh||sh.type!=='parked')return;
    const k=el.getAttribute('data-k'),id=el.getAttribute('data-id');
    if(!parkToBacklog(k,id)){t2ParkFailed(sh);return;}
    sh.err='';
    if(!parkedItems(k).length)closeSheet(true);
    else renderSheet();
  },
  't2-park-drop'(el){
    const k=el.getAttribute('data-k'),id=el.getAttribute('data-id');
    ACT['park-drop'](el);
    if(!parkedItems(k).length)closeSheet(true);
  },
  't2-stop-save'(){
    const c=CUR,now=Date.now(),hm=UI.guardTime||'';
    if(!c||!/^\d{1,2}:\d{2}$/.test(hm))return;
    const [h,m]=hm.split(':').map(Number);
    if(h>23||m>59)return;
    const d=new Date(now);d.setHours(h,m,0,0);
    let at=d.getTime();while(at>now)at-=DAY;
    // Let the existing action report invalid starts without losing the editor.
    if(at<=parseT(c.start)){ACT['guard-save']();return;}
    closeSheet(true);ACT['guard-save']();
  },
  't2-seen'(el){
    const c=CUR,now=Date.now(),at=Number(el.getAttribute('data-v'));
    if(!c||at!==Number(store.get('seen'))||!(at>parseT(c.start)+MIN&&at<now-5*MIN))return;
    closeSheet(true);
    ACT['guard-seen']({getAttribute:k=>k==='data-t'?String(at):null});
  }
});
