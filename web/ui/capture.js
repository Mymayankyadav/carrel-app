/* L9 — Quick capture. Pure parser is in logic/parse.js. */
function l9OpenCapture(text, type) {
  openSheet({type:'capture',text:String(text||'').slice(0,500),manualType:['task','deadline','block','ask'].includes(type)?type:null,edit:'',override:{},err:''});
}
function l9CaptureResult(sh) {
  const base=l9Parse(sh.text,{now:Date.now(),acts:ACTS.filter(a=>!a.archived&&a.kind==='study'),weekStart:CFG.weekStart,type:sh.manualType});
  const fields=sh.override||{};
  return Object.assign({},base,fields,sh.manualType?{type:sh.manualType}:{});
}
function l9CapturePreview(sh,p){
  const a=p.activity&&ACTMAP[p.activity];
  const chips=[];
  if(a)chips.push({key:'activity',label:a.name,dot:a.color});
  else chips.push({key:'activity',label:'Subject'});
  if(p.minutes!=null)chips.push({key:'minutes',label:fmtDur(p.minutes*MIN)});
  else chips.push({key:'minutes',label:'Length'});
  if(p.date)chips.push({key:'date',label:shortDay(p.date)});
  else chips.push({key:'date',label:'Date'});
  if(p.time)chips.push({key:'time',label:fmtHM(p.time)});
  if(p.prio===1)chips.push({key:'prio',label:'High priority'});
  return '<div class="l9-chips" role="group" aria-label="Recognized details">'+
    chips.map(c=>'<button type="button" class="l9-chip" data-act="l9-edit" data-field="'+esc(c.key)+'" aria-label="Edit '+esc(c.key)+'" aria-pressed="'+(sh.edit===c.key)+'">'+
    (c.dot?'<i class="k-dot" style="--c:'+kSafeColour(c.dot)+'" aria-hidden="true"></i>':'')+
    esc(c.label)+'</button>').join('')+'</div>';
}
function l9CaptureEditor(sh,p){
  const f=sh.edit;
  if(f==='activity')return kField('Subject',kActPick({bind:'sheet.override.activity',id:p.activity||'',study:true,life:false,none:true}));
  if(f==='minutes')return kField('Minutes',kDur({bind:'sheet.override.minutes',minutes:p.minutes||60,presets:[25,45,60,90]}));
  if(f==='date')return kField('Date',kDate({bind:'sheet.override.date',key:p.date||todayKey()}));
  if(f==='time')return kField('Time',kTime({bind:'sheet.override.time',hm:p.time||'09:00'}));
  if(f==='prio')return kField('Priority',kSeg({act:'l9-prio',value:String(p.prio||2),options:[{v:'1',label:'High'},{v:'2',label:'Normal'},{v:'3',label:'Low'}]}));
  return '';
}
function l9CaptureSheet(sh){
  const p=l9CaptureResult(sh);
  const tabs=kSeg({act:'l9-type',value:p.type,options:[
    {v:'task',label:'Task'},{v:'deadline',label:'Deadline'},{v:'block',label:'Block'},{v:'ask',label:'Ask Claude'}]});
  const required=p.type==='block' && (!p.date||!p.time)?'<p class="l9-help">Choose a date and time</p>':
    p.type==='deadline' && !p.date?'<p class="l9-help">Choose a date</p>':
    p.type==='ask'?'<p class="l9-help">For your next Claude chat</p>':'';
  return kSheetHead('Quick add')+
    '<div class="k-sheet-body l9-sheet">'+
    kText({bind:'sheet.text',value:sh.text,placeholder:'What needs doing?',attrs:'id="l9-text" maxlength="500" autocomplete="off" aria-label="Quick capture text"'})+
    l9CapturePreview(sh,p)+l9CaptureEditor(sh,p)+
    '<div class="l9-type">'+tabs+'</div>'+
    required+(sh.err?'<div class="l9-error" role="alert">'+esc(sh.err)+'</div>':'')+
    '</div>'+kSheetFoot(kBtn('Add','data-act="l9-save"',{kind:'primary'}));
}
function l9CaptureSave(){
  const sh=UI.sheet;if(!sh||sh.type!=='capture')return;
  const p=l9CaptureResult(sh);
  sh.err='';
  const title=String(p.title||'').trim().slice(0,80);
  if(!String(sh.text||'').trim()||!title){sh.err='Enter a title.';renderSheet();return;}
  const date=p.date;
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)){sh.err='Choose a valid date.';renderSheet();return;}
  if(p.type==='deadline'&&!date){sh.err='Choose a date.';renderSheet();return;}
  if(p.type==='block'&&(!date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time||''))){sh.err='Choose a date and time.';renderSheet();return;}
  const minutes=p.minutes==null?60:Math.round(+p.minutes);
  if((p.type==='task'||p.type==='block')&&(!Number.isFinite(minutes)||minutes<5||minutes>720)){sh.err='Use 5 to 720 minutes.';renderSheet();return;}
  const activity=p.activity&&ACTMAP[p.activity]&&!ACTMAP[p.activity].archived?p.activity:(p.type==='deadline'?null:firstStudyId());
  if((p.type==='task'||p.type==='block')&&!ACTMAP[activity]){sh.err='Add a study subject first.';renderSheet();return;}
  const w=W();
  let message='';
  if(p.type==='task'){
    w.update('planning/backlog',{items:{[uid('t')]:{
      title,activity,minutes,due:date||null,prio:p.prio===1?1:p.prio===3?3:2,
      order:nextBacklogOrder(),created:isoLocal(Date.now())
    }}},{items:{}});
    message='Added to backlog.';
  }else if(p.type==='deadline'){
    w.update('planning/deadlines',{items:{[uid('dl')]:{
      title,date,time:p.time||null,activity,kind:p.kind||'other',done:false
    }}},{items:{}});
    message='Added deadline.';
  }else if(p.type==='block'){
    w.plan(date,{blocks:{[uid('b')]:blockDoc({
      activity,title,minutes,order:nextOrder(date),at:p.time,pomo:null,from:'capture'
    })}});
    message='Added to Plan.';
  }else{
    w.set('coach/'+uid('ask'),{v:1,at:isoLocal(Date.now()),kind:'ask',from:'me',
      title:String(sh.text).trim().slice(0,200),body:'',status:'new'});
    message='Saved for Claude.';
  }
  closeSheet(true);commit(message,w,{undo:true});
}
SHEETS.capture=l9CaptureSheet;
Object.assign(ACT,{
  'l9-open'(){l9OpenCapture();},
  'l9-type'(el){const sh=UI.sheet; if(!sh||sh.type!=='capture')return;const v=el.getAttribute('data-v');
    if(['task','deadline','block','ask'].includes(v)){sh.manualType=v;sh.err='';renderSheet();}},
  'l9-edit'(el){const sh=UI.sheet;if(!sh||sh.type!=='capture')return;
    const v=el.getAttribute('data-field');if(!['activity','minutes','date','time','prio'].includes(v))return;
    sh.edit=sh.edit===v?'':v;renderSheet();},
  'l9-prio'(el){const sh=UI.sheet;if(!sh||sh.type!=='capture')return;
    sh.override.prio=+el.getAttribute('data-v');renderSheet();},
  'l9-save'(){l9CaptureSave();}
});
