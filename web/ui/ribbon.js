/* L1: compact 24-hour day ribbon. Presentation only: never writes plan/log data. */
function l1RibbonGeometry(start,end,lo,hi){
  const span=Math.max(1,hi-lo),s=Math.max(lo,Math.min(hi,start)),e=Math.max(lo,Math.min(hi,end));
  if(!Number.isFinite(start)||!Number.isFinite(end)||e<=s)return null;
  return {left:100*(s-lo)/span,width:100*(e-s)/span};
}
function l1RibbonItems(k,opts){
  opts=opts||{};
  const now=opts.now==null?Date.now():opts.now,lo=dayStartMs(k),hi=dayEndMs(k);
  const pm=opts.pm||planModelFor(k,now),items=[];
  const add=(s,e,type,color,label)=>{
    const g=l1RibbonGeometry(s,e,lo,hi);
    if(g)items.push({left:g.left,width:g.width,type,color,label:label||type});
  };
  for(const b of busyOf(k)||[])add(b.s,b.e,'busy',null,b.title||'Busy');
  for(const row of pm&&pm.rows||[]){
    if(row.st==='done'||row.st==='skipped'||row.st==='moved'||!row.remaining)continue;
    for(const piece of row.pieces||[])if(Array.isArray(piece))add(piece[0],piece[1],'plan',
      act(row.activity).color,row.title||act(row.activity).name);
  }
  for(const e of ENTRIES||[]){
    if(e.e!=null&&e.e<=e.s)continue;
    add(e.s,e.e==null?now:e.e,'entry',act(e.a).color,act(e.a).name);
  }
  return {items,lo,hi,now};
}
function ribbon(k,opts){
  const data=l1RibbonItems(k,opts),{lo,hi,now}=data;
  const segments=data.items.map(it=>'<i class="l1-ribbon-segment l1-ribbon-'+it.type+'" '+
    'style="left:'+it.left.toFixed(3)+'%;width:'+it.width.toFixed(3)+'%;'+
    (it.color?'--c:'+kSafeColour(it.color)+';':'')+'" title="'+esc(it.label)+'"></i>').join('');
  const pos=l1RibbonGeometry(now,now+1,lo,hi);
  const marker=pos?'<i class="l1-ribbon-now" style="left:'+pos.left.toFixed(3)+'%"></i>':'';
  const labels='<span>'+esc(fmtT(lo))+'</span><span>'+esc(fmtT(hmOnDay(k,'12:00')))+'</span><span>'+esc(fmtT(hi))+'</span>';
  return '<button type="button" class="l1-ribbon-button" data-act="l1-ribbon" aria-label="Open today plan timeline">'+
    '<span class="l1-ribbon-track" aria-hidden="true">'+segments+marker+'</span>'+
    '<span class="l1-ribbon-labels">'+labels+'</span></button>';
}
function l1NearestDeadline(k){
  return deadlineList().find(d=>!d.done&&d.date>=k&&d.date<=addDaysKey(k,14))||null;
}
function l1DeadlineRank(k){
  const d=l1NearestDeadline(k);
  if(!d)return 0;
  const days=Math.round((dateOfKey(d.date)-dateOfKey(k))/DAY);
  return days<=2?90:days<=7?70:40;
}
function l1DeadlineCard(ctx){
  const d=l1NearestDeadline(ctx.k);
  if(!d)return '';
  const raw=V.planning&&V.planning.deadlines&&V.planning.deadlines.items&&V.planning.deadlines.items[d.id]||{};
  const from=parseT(raw.created)||dayStartMs(addDaysKey(ctx.k,-30));
  const studied=d.activity?ENTRIES.filter(e=>e.a===d.activity&&e.s>=from)
    .reduce((m,e)=>m+Math.max(0,(e.e==null?ctx.now:e.e)-e.s),0):0;
  const estimated=Math.max(1,+raw.estimate||+raw.hours||10)*HOUR;
  const percent=d.activity?Math.min(100,100*studied/estimated):0;
  const days=Math.round((dateOfKey(d.date)-dateOfKey(ctx.k))/DAY);
  const where=days===0?'Today':days===1?'Tomorrow':'In '+days+' days';
  return '<button type="button" class="l1-card-link" data-act="l1-deadline" data-id="'+esc(d.id)+'" data-subject="'+esc(d.activity||'')+'">'+
    '<span class="l1-card-heading">'+icon('flag')+'<strong>'+esc(d.title)+'</strong>'+
    '<small'+(days<=2?' class="l1-urgent"':'')+'>'+where+'</small></span>'+
    (d.activity?'<span class="l1-card-progress" role="progressbar" aria-label="'+esc(d.title)+' progress" '+
    'aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(percent)+'"><i style="width:'+percent.toFixed(1)+'%"></i></span>':'')+
    '</button>';
}
function l1InsightSentence(){
  if(typeof patternsModel!=='function'||typeof insights!=='function')return '';
  const pm=patternsModel(ENTRIES,Date.now(),4);
  const items=insights(pm,h=>fmtHourL(h),
    {weekday:i=>rowWeekday(i,true),minuteOfDay:m=>fmtMinOfDay(m)},null);
  return items.length?String(items[0].text||'').split(/[.!?](?:\s|$)/)[0]+'.':'';
}
function l1InsightCard(){
  const sentence=l1InsightSentence();
  return sentence?'<button type="button" class="l1-card-link" data-act="l1-insights">'+
    '<span class="l1-card-heading">'+icon('insights')+'<span>'+esc(sentence)+'</span></span></button>':'';
}
Object.assign(ACT,{
  'l1-deadline'(el){
    const id=el.getAttribute('data-id'),subject=el.getAttribute('data-subject');
    if(subject&&ACTMAP[subject]&&PAGES.subject)pushPage('subject',{id:subject});
    else if(typeof openDeadlineSheet==='function')openDeadlineSheet(id);
  }
});
/* cards.js initializes after this file. Use the same registration point as L4. */
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{
  CARDS.deadline={rank:ctx=>l1DeadlineRank(ctx.k),render:l1DeadlineCard};
  CARDS.insight={rank:()=>l1InsightSentence()?20:0,render:l1InsightCard};
});
