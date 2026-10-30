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
/* L7: view context reuses existing L3/L4 and logged data; no server calls. */
function l7WeekData(p,agg){
  const weeks=p.weeks,totalBySubject={};
  for(const day of Object.values(agg))for(const id in day.acts)
    if(isStudyId(id))totalBySubject[id]=(totalBySubject[id]||0)+day.acts[id];
  const subjects=ACTS.filter(a=>a.kind==='study'&&!a.archived).map(a=>({
    id:a.id,name:a.name,studiedMin:(totalBySubject[a.id]||0)/MIN,
    goalMin:(+a.goal||0)*weeks,factor:typeof l3Factor==='function'?l3Factor(a.id):1
  }));
  const configured=subjects.reduce((sum,a)=>sum+a.goalMin,0);
  const goal=configured>0?configured*MIN:(+CFG.dailyGoal||0)*7*weeks*MIN;
  return {subjects,goal,total:Object.values(totalBySubject).reduce((x,y)=>x+y,0)};
}
function l7Days(){
  const tk=todayKey(),start=addDaysKey(tk,-60),agg=aggregate(ENTRIES,Date.now(),start,tk),days={};
  for(let k=start;k<=tk;k=addDaysKey(k,1))days[k]=(agg[k]&&agg[k].study||0)/MIN;
  return days;
}
function l7Drift(from,to){
  let sum=0;
  for(const [k,d] of Object.entries(V.distractions||{})){
    if(k<from||k>to)continue;
    for(const x of Object.values(d&&d.items||{}))if(x&&x.type==='drift'&&!x.dismissed)
      sum+=Math.max(0,+x.driftMin||0);
  }
  return sum;
}
function l7Context(p,agg){
  const data=l7WeekData(p,agg),tk=todayKey(),wk=weekStartKey(tk),weekEnd=addDaysKey(wk,6);
  const hours=typeof l3HourStats==='function'?l3HourStats():{},keys=Object.keys(hours);
  const best=typeof energyWindows==='function'?energyWindows(hours)[0]:null;
  const most=keys.sort((a,b)=>(hours[b].min||0)-(hours[a].min||0))[0];
  const streak=flexibleStreak(l7Days(),CFG.minDay||25,+CFG.weekStart||0,tk).count;
  const fromPrev=addDaysKey(wk,-7),toPrev=addDaysKey(wk,-1);
  return {subjects:data.subjects,daysLeft:Math.max(0,Math.round((dateOfKey(weekEnd)-dateOfKey(tk))/DAY)),
    bestHour:Number.isInteger(best)?best:null,mostHour:most==null?null:+most,
    overdue:typeof l4DueTopics==='function'?l4DueTopics(tk).filter(t=>t.due<tk).length:0,
    driftThis:l7Drift(wk,weekEnd),driftLast:l7Drift(fromPrev,toPrev),todayMin:l7Days()[tk]||0,
    streak,minDay:CFG.minDay||25,nearPlanEnd:Date.now()>=hmOnDay(tk,CFG.planEnd)-2*HOUR,
    dismissed:store.get('advice:'+wk)||[]};
}
function l7GoalRing(total,goal){
  const pct=goal>0?clamp(total/goal,0,1):0,c=2*Math.PI*39;
  return '<div class="l7-goal"><svg viewBox="0 0 100 100" width="86" height="86" aria-hidden="true">'+
    '<circle cx="50" cy="50" r="39" class="l7-ring-track"></circle>'+
    '<circle cx="50" cy="50" r="39" class="l7-ring-value" stroke-dasharray="'+(c*pct).toFixed(2)+
      ' '+c.toFixed(2)+'"></circle></svg><strong>'+Math.round(pct*100)+'%</strong></div>';
}
function l7Suggestions(ctx,week){
  const suggestions=advise(ctx);
  return suggestions.length?kGroup('Suggestions',suggestions.map(x=>
    '<div class="l7-advice"><span>'+esc(x.text)+'</span>'+
    kBtn(x.action.label,'data-act="'+esc(x.action.act)+'" data-advice="'+esc(x.id)+'"'+
      (x.action.act==='l7-dismiss'?' data-id="'+esc(x.id)+'" data-week="'+esc(week)+'"':'')+
      (x.action.args.subject?' data-subject="'+esc(x.action.args.subject)+'"':'')+
      (Number.isInteger(x.action.args.hour)?' data-hour="'+x.action.args.hour+'"':''),{kind:'text'})+
    kIconBtn('close','Dismiss suggestion','data-act="l7-dismiss" data-id="'+esc(x.id)+'" data-week="'+esc(week)+'"')+
    '</div>').join('')):'';
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
  const overview=l7WeekData(p,agg);
  const summary='<div class="s1-summary l7-summary"><div><strong>'+esc(fmtDur(total))+'</strong>'+
    '<span>'+esc(fmtDur(total/elapsed))+' a day · '+esc(fmtDur(overview.goal))+' '+(p.month?'4-week':'weekly')+' goal</span></div>'+
    l7GoalRing(total,overview.goal)+'</div>';
  const chart=total?s1Bars(p,buckets):kEmpty(p.month?'No study logged':'No study logged this week');
  const subjects=s1SubjectRows(agg);
  const context=l7Context(p,agg);
  const suggestions=!p.offset&&!p.month?l7Suggestions(context,weekStartKey(p.tk)):'';
  const peek=typeof l3HourStats==='function'?energyWindows(l3HourStats())[0]:null;
  const estimateHistory=typeof l3History==='function'?ACTS.filter(a=>a.kind==='study').flatMap(a=>l3History(a.id)):[];
  const acc=l7Accuracy(estimateHistory);
  const links=kRow({icon:'subjects',label:'Subjects',value:overview.subjects.length+' active',open:true,
      attrs:'data-act="l7-subjects"'})+
    kRow({icon:'focus',label:'Focus',value:peek==null?'—':fmtHourS(peek),open:true,
      attrs:'data-act="l7-focus"'})+
    kRow({icon:'stats',label:'Estimates',value:acc==null?'—':acc+'% accuracy',open:true,
      attrs:'data-act="l7-estimates"'})+
    kRow({icon:'patterns',label:'Patterns',open:true,attrs:'data-act="s1-patterns"'})+
    kRow({icon:'note',label:'Study observations',open:true,attrs:'data-act="s1-insights"'})+
    kRow({icon:'today',label:'Streak',value:context.streak+' days',open:true,
      attrs:'data-act="l7-streak"'});
  const fromClaude=typeof l10FromClaude==='function'?l10FromClaude():'';
  return '<div class="s1-stats l7-insights">'+controls+summary+suggestions+chart+
    (subjects?kGroup('Subjects',subjects):'')+
    fromClaude+
    '<section class="s1-links">'+links+'</section></div>';
}

/* L7 fresh-start card and one-action weekly subject goal. */
function l7TopSubject(){
  return ACTS.filter(a=>a.kind==='study'&&!a.archived)
    .sort((a,b)=>(+b.goal||0)-(+a.goal||0))[0]||null;
}
function l7GoalSheet(sh){
  const a=ACTMAP[sh.subject];
  if(!a)return kSheetHead('Weekly goal')+kEmpty('Choose a study subject.');
  return kSheetHead('One goal for this week')+
    '<div class="k-sheet-body l7-goal-sheet">'+
    kField('Subject',kActPick({bind:'sheet.subject',id:sh.subject,study:true,life:false}))+
    kField('Weekly goal',kStepper({bind:'sheet.hours',value:sh.hours||1,min:1,max:80,step:1,
      fmt:h=>h+'h'}))+'</div>'+
    kSheetFoot(kBtn('Set goal','data-act="l7-goal-save"',{kind:'primary'}));
}
SHEETS.l7goal=l7GoalSheet;
Object.assign(ACT,{
  'l7-goal-open'(){
    const a=l7TopSubject();if(!a)return;
    openSheet({type:'l7goal',subject:a.id,hours:Math.max(1,Math.round((+a.goal||60)/60))});
  },
  'l7-goal-save'(){
    const sh=UI.sheet,subject=sh&&ACTMAP[sh.subject],h=+sh.hours;
    if(!sh||sh.type!=='l7goal'||!subject||subject.archived||subject.kind!=='study'||
      !Number.isInteger(h)||h<1||h>80)return;
    store.set('freshstart:'+todayKey(),true);
    closeSheet(true);
    saveAct(subject.id,{goal:h*60},'Weekly goal updated.');
  }
});
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{
  CARDS.freshstart={rank:ctx=>{
    if(store.get('freshstart:'+ctx.k)||!l7TopSubject())return 0;
    const first=Number.isInteger(+CFG.weekStart)?+CFG.weekStart:1;
    const day=dateOfKey(ctx.k);
    return day.getDate()===1||day.getDay()===first?85:0;
  },render:()=>'<div class="l7-freshstart"><span>New week. Set one goal?</span>'+
    kBtn('Set goal','data-act="l7-goal-open"',{kind:'primary'})+'</div>'};
});

/* Plan's existing week-target panel keeps its contract until P1 moves it. */
VIEWS.stats=vStats;
VIEWS.insights=vStats;
Object.assign(ACT,{
  'l7-subjects'(){UI.view='subjects';UI.pages=[];render();},
  'l7-focus'(){pushPage('stats.focus');},
  'l7-estimates'(){pushPage('stats.estimates');},
  'l7-streak'(){pushPage('stats.streak');},
  'l7-dismiss'(el){
    const id=el.getAttribute('data-id'),week=el.getAttribute('data-week');
    if(!['behind','peak','estimate','reviews','drift','streak'].includes(id)||week!==weekStartKey(todayKey()))return;
    const key='advice:'+week,list=store.get(key)||[];
    if(!list.includes(id))store.set(key,list.concat(id));
    render();
  },
  'l7-plan'(){if(typeof l2OpenMorning==='function'&&!V.rituals[todayKey()]?.morning)
      l2OpenMorning(todayKey());
    else if(typeof l3OpenAuto==='function')l3OpenAuto(todayKey());},
  'l7-peak'(el){
    const h=+el.getAttribute('data-hour');
    if(Number.isInteger(h)&&h>=0&&h<24)saveSetting({planStart:String(h).padStart(2,'0')+':00'},'Preferred time updated.');
  },
  'l7-review'(){
    const due=typeof l4DueTopics==='function'?l4DueTopics(todayKey()):[];
    const topic=due[0];if(!topic||!ACTMAP[topic.subject])return;
    const k=todayKey(),w=W();
    w.plan(k,{blocks:{[uid('b')]:blockDoc({activity:topic.subject,title:'Review '+topic.title,
      minutes:30,order:nextOrder(k),at:null,from:'review'})}});
    commit('Added 30m review.',w);
  },
  'l7-drift'(){if(typeof LABS!=='undefined'&&LABS.urgesurf)
      saveSetting({labs:{urgesurf:true}},'Urge-surf enabled.');
    else toast('Urge-surf is coming to Android.');},
  'l7-start'(){const last=typeof lastStudy==='function'?lastStudy():null;
    if(last&&ACTMAP[last.a]&&!ACTMAP[last.a].archived)startActivity(last.a);},
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
