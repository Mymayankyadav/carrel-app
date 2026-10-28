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
  const today=todayKey(),weekday=new Date(now).getDay();
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
          '<circle class="l6-progress" cx="32" cy="32" r="25" stroke-dasharray="157" stroke-dashoffset="'+arc+'"></circle></svg>'+
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
if(typeof module!=='undefined'&&module.exports)
  module.exports={l6DriftWeek,l6DriftRank};
