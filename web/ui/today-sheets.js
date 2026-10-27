/* T2 — Today sheets: all writes delegate to existing timer/parking actions. */
function t2ActivityRows(kind,totals){
  const list=ACTS.filter(a=>!a.archived&&(kind==='study'?a.kind==='study':a.kind!=='study'));
  return list.map(a=>{
    const running=CUR&&CUR.activity===a.id;
    const duration=totals[a.id]||0;
    const right=running?'Now':duration?fmtDur(duration):'';
    return '<button type="button" class="t2-activity" data-act="t2-start" data-long="t2-start-opts" data-id="'+esc(a.id)+
      '" aria-label="'+esc('Start '+a.name)+'" aria-pressed="'+!!running+'">'+
      '<span class="t2-activity-left"><i class="t2-act-dot" style="--c:'+kSafeColour(a.color)+'"></i>'+
      '<span>'+esc(a.name)+'</span></span><span class="t2-activity-right">'+
      esc(right)+'</span></button>';
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
  return kSheetHead(name)+
    '<div class="k-sheet-body t2-sheet">'+
    kField('Start',modes)+
    kField('Pomodoro',kSwitch({act:'t2-pomo',on:pomp,label:'Pomodoro'}))+
    (pomp?kField('Length',kSeg({act:'t2-preset',value:sh.preset||'25/5',
      options:[{v:'25/5',label:'25/5'},{v:'50/10',label:'50/10'},{v:'90/20',label:'90/20'}]})):'')+
    '</div>'+kSheetFoot(kBtn('Start','data-act="t2-confirm-start"',{kind:'primary',icon:'start'}));
}
function sPark(){
  const value=UI.parkText||'';
  return kSheetHead('Park a thought')+
    '<div class="k-sheet-body t2-sheet">'+
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
  return kSheetHead('Parked')+'<div class="k-sheet-body t2-sheet">'+rows+'</div>';
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
Object.assign(SHEETS,{start:sStart,activities:sActivities,park:sPark,parked:sParked,fixstop:sFixStop});
Object.assign(ACT,{
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
  't2-confirm-start'(){
    const sh=UI.sheet;if(!sh||sh.type!=='start'||!ACTMAP[sh.act])return;
    const now=Date.now(),last=lastEntry();
    let at=now;
    if(sh.from==='last'&&last&&last.e>0&&now-last.e<=12*HOUR)at=last.e;
    else if(['5','15','30'].includes(sh.from))at=now-Number(sh.from)*MIN;
    const id=sh.act,opts={at};
    if(sh.pomo)opts.pomoPreset=PRESETS[sh.preset]?sh.preset:'25/5';
    else opts.pomoRaw=null;
    closeSheet(true);startActivity(id,opts);
  },
  't2-save-park'(){
    const text=String(UI.parkText||'').trim();
    if(!text)return;
    closeSheet(true);parkAdd(text);
  },
  't2-park-backlog'(el){
    const k=el.getAttribute('data-k'),id=el.getAttribute('data-id');
    parkToBacklog(k,id); // existing undoable dual-document transaction
    if(!parkedItems(k).length)closeSheet(true);
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
