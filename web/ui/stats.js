/* S1 — clean real-data weekly and four-week statistics. No example data. */
function s1Period() {
  const tk=todayKey(),month=UI.s1Range==='month';
  const offset=month?(UI.s1MonthOff||0):(UI.weekOff||0);
  const weeks=month?4:1;
  const ws=addDaysKey(weekStartKey(tk),-7*(offset*weeks+weeks-1));
  const we=addDaysKey(ws,weeks*7-1);
  return {tk,ws,we,weeks,month,offset};
}
function s1Buckets(p,agg) {
  const groups=[];
  for(let i=0;i<(p.month?4:7);i++){
    const start=addDaysKey(p.ws,p.month?i*7:i);
    const count=p.month?7:1;
    const acts={},days=[];
    for(let j=0;j<count;j++){
      const k=addDaysKey(start,j),day=agg[k];days.push(k);
      if(!day)continue;
      for(const id in day.acts)if(isStudyId(id))acts[id]=(acts[id]||0)+day.acts[id];
    }
    groups.push({start,days,acts,total:Object.values(acts).reduce((sum,v)=>sum+v,0)});
  }
  return groups;
}
function s1Bars(p,buckets){
  const goal=(+CFG.dailyGoal||0)*MIN*(p.month?7:1);
  const highest=Math.max(goal,...buckets.map(b=>b.total),MIN);
  const max=Math.max(highest*1.05,MIN);
  const cols=buckets.map(b=>{
    const ids=Object.keys(b.acts).sort((a,b)=>(act(a).order||0)-(act(b).order||0));
    const stack=ids.map(id=>'<i class="s1-segment" style="height:'+(b.acts[id]/max*100).toFixed(1)+
      '%;--c:'+kSafeColour(act(id).color)+'" title="'+esc(act(id).name+' '+fmtDur(b.acts[id]))+'"></i>').join('');
    const date=dateOfKey(b.start);
    const label=p.month?date.getDate()+' '+DF({month:'short'}).format(date):rowWeekday(b.days.length===1?((weekdayOfKey(b.start)-(+CFG.weekStart||0)+7)%7):0).slice(0,1);
    const current=p.month?b.start<=p.tk&&addDaysKey(b.start,6)>=p.tk:b.start===p.tk;
    return '<button type="button" class="s1-bar-col'+(current?' current':'')+'" data-act="s1-day" data-k="'+esc(b.start)+
      '" aria-label="'+esc(longDay(b.start)+' · '+fmtDur(b.total))+'">'+
      '<span class="s1-bar-stack">'+stack+'</span><span class="s1-bar-label">'+esc(label)+'</span></button>';
  }).join('');
  const line=goal?'<i class="s1-goal-line" style="bottom:'+Math.min(100,goal/max*100).toFixed(1)+'%">'+
    '<span>'+esc(fmtDur(goal))+'</span></i>':'';
  return '<div class="s1-chart" role="group" aria-label="Study by '+(p.month?'week':'day')+'">'+
    '<div class="s1-chart-area">'+line+'<div class="s1-bar-grid">'+cols+'</div></div></div>';
}
function s1SubjectRows(agg) {
  const totals={};
  for(const day of Object.values(agg))
    for(const id in day.acts)if(isStudyId(id))totals[id]=(totals[id]||0)+day.acts[id];
  const ids=new Set(Object.keys(totals));
  ACTS.forEach(a=>{if(a.kind==='study'&&!a.archived&&a.goal)ids.add(a.id);});
  return [...ids].sort((a,b)=>(totals[b]||0)-(totals[a]||0))
    .map(id=>{
      const a=act(id),total=totals[id]||0,goal=(a.goal||0)*MIN;
      const pct=goal?Math.min(100,Math.round(total/goal*100)):0;
      return '<button type="button" class="s1-subject" data-act="s1-subject" data-id="'+esc(id)+'">'+
        '<span class="s1-subject-top"><span class="s1-subject-name"><i class="s1-dot" style="--c:'+kSafeColour(a.color)+'"></i>'+
        esc(a.name)+'</span><span>'+esc(fmtDur(total))+icon('open')+'</span></span>'+
        (goal?'<span class="s1-subject-progress"><i style="width:'+pct+'%"></i></span>'+
        '<span class="s1-subject-goal">of '+esc(fmtDur(goal))+'</span>':'')+
        '</button>';
    }).join('');
}
function vStats(){
  const p=s1Period(),now=Date.now();
  ensureRange(p.ws,p.we);
  const agg=aggregate(ENTRIES,now,p.ws,p.we),buckets=s1Buckets(p,agg);
  const total=buckets.reduce((sum,b)=>sum+b.total,0);
  const elapsed=p.we<p.tk?p.weeks*7:Math.max(1,buckets.flatMap(b=>b.days).filter(k=>k<=p.tk).length);
  const dailyGoal=(+CFG.dailyGoal||0)*MIN;
  const label=p.offset?(p.month?'Previous 4 weeks':p.offset===1?'Last week':'Week of '+esc(shortDay(p.ws))):(p.month?'Last 4 weeks':'This week');
  const controls='<header class="s1-header">'+
    kIconBtn('prev','Previous period','data-act="s1-prev"')+
    '<button type="button" class="s1-period-title" data-act="s1-this">'+label+'</button>'+
    kIconBtn('next','Next period','data-act="s1-next"'+(!p.offset?' disabled':''))+
    kSeg({act:'s1-range',value:p.month?'month':'week',options:[{v:'week',label:'Week'},{v:'month',label:'Month'}]})+
    '</header>';
  const summary='<div class="s1-summary"><strong>'+esc(fmtDur(total))+'</strong>'+
    '<span>'+esc(fmtDur(total/elapsed))+' a day'+(dailyGoal?' · goal '+esc(fmtDur(dailyGoal)):'')+'</span></div>';
  const chart=total?s1Bars(p,buckets):kEmpty(p.month?'No study logged':'No study logged this week');
  const subjects=s1SubjectRows(agg);
  const links=kRow({icon:'insights',label:'Insights',open:true,attrs:'data-act="s1-insights"'})+
    kRow({icon:'patterns',label:'Patterns',open:true,attrs:'data-act="s1-patterns"'});
  return '<div class="s1-stats">'+controls+summary+chart+
    (subjects?kGroup('Subjects',subjects):'')+
    '<section class="s1-links">'+links+'</section></div>';
}
/* Plan's existing week-target panel keeps its contract until P1 moves it. */
VIEWS.stats=vStats;
Object.assign(ACT,{
  's1-prev'(){
    if(UI.s1Range==='month')UI.s1MonthOff=(UI.s1MonthOff||0)+1;
    else UI.weekOff=(UI.weekOff||0)+1;
    render();
  },
  's1-next'(){
    if(UI.s1Range==='month')UI.s1MonthOff=Math.max(0,(UI.s1MonthOff||0)-1);
    else UI.weekOff=Math.max(0,(UI.weekOff||0)-1);
    render();
  },
  's1-this'(){
    if(UI.s1Range==='month')UI.s1MonthOff=0;
    else UI.weekOff=0;
    render();
  },
  's1-range'(el){UI.s1Range=el.getAttribute('data-v')==='month'?'month':'week';render();},
  's1-day'(el){
    const k=el.getAttribute('data-k');
    if(typeof planFocus==='function')planFocus(k,null);
    else if(ACT['cal-open'])ACT['cal-open']({getAttribute:()=>k});
  },
  's1-subject'(el){const id=el.getAttribute('data-id');if(PAGES['stats.subject'])pushPage('stats.subject',{id});},
  's1-patterns'(){if(PAGES['stats.patterns'])pushPage('stats.patterns');},
  's1-insights'(){if(PAGES['stats.insights'])pushPage('stats.insights');}
});
