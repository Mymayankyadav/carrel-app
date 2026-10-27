/* ---------- views: log ---------- */
function dayEntries(k, now) { const ds = dayStartMs(k), de = dayEndMs(k); return ENTRIES.filter(en => en.s < de && entryEnd(en, now) > ds); }
function gapsOf(ents, now, ds, de, isToday) {
  const out = [];
  let prevEnd = null;
  for (const en of ents) {
    const s = Math.max(en.s, ds);
    if (prevEnd != null && s - prevEnd >= 3 * MIN) out.push([prevEnd, s]);
    prevEnd = Math.max(prevEnd || 0, Math.min(entryEnd(en, now), de));
  }
  if (isToday && prevEnd != null && !CUR && now - prevEnd >= 3 * MIN && now < de) out.push([prevEnd, now]);
  return out;
}
function t3LogDate(){
  const stack=UI.pages||[],top=stack[stack.length-1];
  return top&&top.id==='log'&&top.params&&top.params.k||todayKey();
}
function t3LogPage(params){
  const k=params&&params.k||todayKey(),now=Date.now();
  ensureRange(k,k);
  const ds=dayStartMs(k),de=dayEndMs(k);
  const list=dayEntries(k,now).slice().sort((a,b)=>b.s-a.s);
  const gaps=gapsOf(list.slice().sort((a,b)=>a.s-b.s),now,ds,de,k===todayKey())
    .filter(([a,b])=>b-a>=5*MIN);
  const all=list.map(en=>({s:Math.max(ds,en.s),en})).concat(gaps.map(([s,e])=>({s,gap:[s,e]})))
    .sort((a,b)=>b.s-a.s);
  const agg=aggregate(ENTRIES,now,k,k)[k]||{study:0,all:0};
  const summary=fmtDur(agg.study)+' studied · '+fmtDur(agg.all)+' logged';
  const rows=all.map(item=>{
    if(item.gap){
      const [s,e]=item.gap;
      return '<button type="button" class="t3-log-row t3-gap" data-act="t3-gap" data-s="'+s+'" data-e="'+e+
        '" aria-label="Add untracked time '+esc(fmtT(s))+' to '+esc(fmtT(e))+'">'+
        '<span class="t3-time">'+esc(fmtT(s))+'</span>'+
        '<span class="t3-entry-label">Untracked</span>'+
        '<span class="t3-duration">'+esc(fmtDur(e-s))+icon('add')+'</span></button>';
    }
    const en=item.en,a=act(en.a);
    const end=Math.min(de,entryEnd(en,now)),start=Math.max(ds,en.s);
    return '<button type="button" class="t3-log-row" data-act="t3-entry" data-id="'+esc(en.id)+
      '" aria-label="Edit '+esc(a.name)+'">'+
      '<span class="t3-time">'+esc(fmtT(start))+'</span>'+
      '<span class="t3-entry-main"><span class="t3-entry-label"><i class="t3-dot" style="--c:'+kSafeColour(a.color)+
      '"></i><span>'+esc(a.name)+'</span></span>'+
      (en.note?'<span class="t3-entry-note">'+esc(en.note)+'</span>':'')+'</span>'+
      '<span class="t3-duration"'+(en.running?' data-tk="dur" data-s="'+en.s+'"':'')+'>'+
      (en.running?'Now':esc(fmtDur(Math.max(0,end-start))))+'</span></button>';
  }).join('');
  return '<div class="t3-log">'+
    '<div class="t3-log-summary">'+esc(summary)+'</div>'+
    (rows||kEmpty('Nothing logged'))+'</div>';
}
PAGES.log={
  title:params=>shortDay(params&&params.k||todayKey()),
  render:t3LogPage,
  actions:()=>kIconBtn('prev','Previous day','data-act="t3-prev"')+
    kIconBtn('next','Next day','data-act="t3-next"')+
    kIconBtn('add','Add entry','data-act="t3-add"')
};
function t3EntryNudge(bind,hm,name){
  return '<div class="t3-time-field">'+
    kIconBtn('minus',name+' earlier','data-act="t3-nudge" data-f="'+name.toLowerCase()+'" data-d="-5"')+
    '<input class="k-input" type="time" aria-label="'+name+' time" data-bind="'+esc(bind)+'" value="'+esc(hm||'')+'">'+
    kIconBtn('add',name+' later','data-act="t3-nudge" data-f="'+name.toLowerCase()+'" data-d="5"')+
    '</div>';
}
function sEntry(sh){
  const d=sh.d||{},running=sh.mode==='running',t=sheetTimes(sh);
  const title=running?'Running':sh.mode==='edit'?'Edit entry':'New entry';
  const actions=(sh.mode==='edit'?kIconBtn('split','Split','data-act="split-open"'):'')+
    (sh.mode!=='add'?kIconBtn('delete',running?'Discard':'Delete','data-act="t3-delete"'):'');
  const ov=t?overlapsFor(sh,t.s,t.e):[];
  const overlap=ov.length?(()=>{
    const first=ov[0],start=Math.max(first.s,t.s),end=Math.min(entryEnd(first,Date.now()),t.e);
    return kField('Overlaps '+act(first.a).name+' by '+fmtDur(Math.max(0,end-start)),
      kSwitch({bind:'sheet.trim',on:!!sh.trim,label:'Trim overlapping time'}));
  })():'';
  const focus=!running&&isStudyId(d.activity)?'<div class="t3-focus" role="group" aria-label="Focus">'+
    [[1,'Scattered'],[2,'Okay'],[3,'Deep']].map(([n,label])=>
      '<button type="button" class="t3-focus-choice" data-act="e-focus" data-v="'+n+'" aria-label="'+label+
      '" title="'+label+'" aria-pressed="'+(d.focus===n)+'">'+icon('rate'+n)+'</button>').join('')+
    '</div>':'';
  const more=kCollapse('t3-entry-more','More',
    kField('Note',kArea({bind:'sheet.d.note',value:d.note||'',rows:2,placeholder:'Note'}))+
    (focus?kField('Focus',focus):''));
  const dur=t?'<div class="t3-entry-duration">'+esc(fmtDur(Math.max(0,t.e-t.s)))+'</div>':'';
  return kSheetHead(title,actions)+
    '<div class="k-sheet-body t3-sheet">'+
    kField('Activity',kActPick({bind:'sheet.d.activity',id:d.activity,study:true,life:true,none:false}))+
    kField('Start',t3EntryNudge('sheet.d.start',d.start,'Start'))+
    kField('End',running?'<span class="t3-now">Now</span>':t3EntryNudge('sheet.d.end',d.end,'End'))+
    (sh.mode==='add'?kField('Date',kDate({bind:'sheet.d.date',key:d.date})):'')+
    dur+overlap+more+(sh.err?'<div class="t3-error" role="alert">'+esc(sh.err)+'</div>':'')+
    '</div>'+kSheetFoot(kBtn('Save','data-act="entry-save"',{kind:'primary'}));
}
function sSplit(sh){
  const en=ENTRIES.find(e=>e.id===sh.id),desc=en?
    act(en.a).name+' · '+fmtT(en.s)+'–'+fmtT(en.e):'';
  return kSheetHead('Split')+
    '<div class="k-sheet-body t3-sheet">'+
    (desc?'<div class="t3-split-summary">'+esc(desc)+'</div>':'')+
    kField('Split at',t3EntryNudge('sheet.at',sh.at,'Split'))+
    kField('Second part',kActPick({bind:'sheet.activity',id:sh.activity,study:true,life:true,none:false}))+
    (sh.err?'<div class="t3-error" role="alert">'+esc(sh.err)+'</div>':'')+
    '</div>'+kSheetFoot(kBtn('Split','data-act="split-save"',{kind:'primary'}));
}
SHEETS.entry=sEntry;
SHEETS.split=sSplit;
Object.assign(ACT,{
  't3-prev'(){
    const stack=UI.pages||[],top=stack[stack.length-1];
    if(top&&top.id==='log'){top.params={...(top.params||{}),k:addDaysKey(t3LogDate(),-1)};render();}
  },
  't3-next'(){
    const stack=UI.pages||[],top=stack[stack.length-1];
    if(top&&top.id==='log'){top.params={...(top.params||{}),k:addDaysKey(t3LogDate(),1)};render();}
  },
  't3-add'(){
    const k=t3LogDate();
    if(k===todayKey()){openEntrySheet('add');return;}
    const s=hmOnDay(k,'09:00');
    openEntrySheet('add',{s,e:s+60*MIN});
  },
  't3-entry'(el){
    const id=el.getAttribute('data-id'),en=ENTRIES.find(e=>e.id===id);
    if(!en)return;
    openEntrySheet(en.running?'running':'edit',en.running?undefined:{id});
  },
  't3-gap'(el){
    const s=Number(el.getAttribute('data-s')),e=Number(el.getAttribute('data-e'));
    if(Number.isFinite(s)&&Number.isFinite(e)&&e>s)openEntrySheet('add',{s,e});
  },
  't3-nudge'(el){
    const sh=UI.sheet;
    if(!sh)return;
    const key=el.getAttribute('data-f'),delta=Number(el.getAttribute('data-d'));
    if(!Number.isFinite(delta)||!['start','end','split'].includes(key))return;
    const d=key==='split'?sh:sh.d,field=key==='split'?'at':key;
    if(!d||!/^\d{1,2}:\d{2}/.test(d[field]||''))return;
    const date=key==='split'?(ENTRIES.find(e=>e.id===sh.id)||{}).s:hmOnDay(d.date,d[field]);
    const base=key==='split'?date!=null?hmOnDay(dayKeyOf(date),d.at):null:date;
    if(base==null)return;
    const shifted=base+delta*MIN;
    d[field]=msToHm(shifted);
    if(key==='start'&&dayKeyOf(shifted)!==d.date)d.date=dayKeyOf(shifted);
    renderSheet();
  },
  't3-delete'(){
    const sh=UI.sheet;
    if(!sh||sh.type!=='entry'||sh.mode==='add')return;
    sh.armed=true;
    deleteEntrySheet(); // preserves existing one-transaction, Undo-capable delete
  }
});
