/* S2 — read-only Stats detail pages, using existing real-data models. */
function s2WeekKeys() {
  const start=addDaysKey(weekStartKey(todayKey()),-7*(UI.weekOff||0));
  return Array.from({length:7},(_,i)=>addDaysKey(start,i));
}
function s2Subject(params) {
  const id=params&&params.id;
  const a=ACTMAP[id];
  if(!a || a.kind!=='study')return kEmpty('Subject not found');
  const now=Date.now(),keys=s2WeekKeys();
  const agg=aggregate(ENTRIES,now,keys[0],keys[6]);
  const daily=keys.map(k=>(agg[k]&&agg[k].acts[id])||0);
  const total=daily.reduce((s,v)=>s+v,0),goal=(a.goal||0)*MIN;
  const max=Math.max(...daily,goal/7,MIN);
  const bars=keys.map((k,i)=>
    '<div class="s2-subday"><span class="s2-bar-wrap"><i class="s2-subbar" style="height:'+
      Math.max(0,Math.round(daily[i]/max*100))+'%;--c:var(--accent)"></i></span>'+
      '<span class="s2-day-label">'+esc(rowWeekday(i).slice(0,1))+'</span></div>').join('');
  const sessions=ENTRIES.filter(e=>e.a===id).slice().sort((x,y)=>y.s-x.s).slice(0,8);
  const recent=sessions.length?sessions.map(en=>
    '<div class="s2-session"><div><span>'+esc(shortDay(dayKeyOf(en.s)))+' · '+esc(fmtT(en.s))+'</span>'+
      (en.note?'<span class="s2-note">'+esc(en.note)+'</span>':'')+'</div>'+
      '<span>'+esc(fmtDur(Math.max(0,entryEnd(en,now)-en.s)))+'</span></div>').join(''):kEmpty('No sessions yet');
  return '<div class="s2-page"><div class="s2-hero">'+esc(fmtDur(total))+'</div>'+
    (goal?'<div class="s2-muted">of '+esc(fmtDur(goal))+' goal</div>':'')+
    '<div class="s2-subject-bars" role="img" aria-label="'+esc('Study per day, '+keys.map((k,i)=>shortDay(k)+' '+fmtDur(daily[i])).join(', '))+'">'+bars+'</div>'+
    '<h2 class="k-h2 s2-heading">Recent</h2>'+recent+'</div>';
}
function s2Model() {
  const now=Date.now();
  const weeks=UI.s2Weeks===12?12:4;
  ensureRange(addDaysKey(todayKey(),-weeks*7),todayKey());
  return patternsModel(ENTRIES,now,weeks);
}
function s2Noticed(pm) {
  let count=0;
  for(const [k,doc] of Object.entries(V.distractions||{})){
    if(k<pm.fromK||k>pm.tk)continue;
    for(const item of Object.values(doc&&doc.items||{}))
      if(item&&!item.dismissed&&['urge','drift'].includes(item.type))count++;
  }
  return count;
}
function s2Heat(pm) {
  const rows=pm.heat,counts=pm.wdCount;
  const averages=rows.map((row,i)=>row.map(ms=>counts[i]?ms/counts[i]:0));
  const mx=Math.max(0,...averages.flat());
  const draw=averages.map((row,i)=>'<div class="s2-heat-row"><span class="s2-weekday">'+
    esc(rowWeekday(i).slice(0,1))+'</span>'+
    row.map((ms,h)=>{
      const pct=ms&&mx?Math.max(15,Math.round(ms/mx*100)):0;
      return '<i class="s2-heat-cell" style="--intensity:'+pct+'%" title="'+
        esc(rowWeekday(i)+' · '+fmtHourL(pm.dsh+h)+' · '+fmtDur(ms))+'"></i>';
    }).join('')+'</div>').join('');
  const labels='<div class="s2-heat-row s2-heat-labels"><span></span>'+
    Array.from({length:24},(_,h)=>'<span>'+(h%6===0?esc(fmtHourS(pm.dsh+h)):'')+'</span>').join('')+'</div>';
  return '<div class="s2-heat" role="img" aria-label="'+esc('Study intensity by weekday and hour')+'">'+draw+labels+'</div>';
}
function s2Patterns() {
  const pm=s2Model(),weeks=UI.s2Weeks===12?'12':'4';
  const chooser=kSeg({act:'s2-weeks',value:weeks,options:[{v:'4',label:'4 weeks'},{v:'12',label:'12 weeks'}]});
  const stats='<div class="s2-metrics">'+
    '<div><strong>'+esc(pm.lens.length?fmtDur(pm.median*MIN):'—')+'</strong><span>Typical session</span></div>'+
    '<div><strong>'+pm.streak+'</strong><span>Day streak</span></div>'+
    '<div><strong>'+s2Noticed(pm)+'</strong><span>Noticed</span></div></div>';
  return '<div class="s2-page"><div class="s2-controls">'+chooser+'</div>'+
    '<h2 class="k-h2 s2-heading">When you study</h2>'+
    (pm.studyDays?s2Heat(pm):kEmpty('No study logged yet'))+
    '<div class="s2-scale"><span>less</span><i></i><i></i><i></i><i></i><span>more</span></div>'+
    stats+'</div>';
}
function s2Insights() {
  const pm=s2Model();
  const ins=insights(pm,h=>fmtHourL(h),{weekday:i=>rowWeekday(i,true),minuteOfDay:m=>fmtMinOfDay(m)},null).slice(0,5);
  if(!ins.length)return '<div class="s2-page">'+kEmpty('Not enough data yet')+'</div>';
  return '<div class="s2-page"><div class="s2-insights">'+ins.map(x=>
    '<div class="s2-insight">'+esc(x.text)+'</div>').join('')+'</div></div>';
}
/* L7: dedicated focus, estimate-accuracy and flexible-streak detail pages. */
function l7FocusStats(){
  const hours={},subjects={};
  for(const e of ENTRIES){
    if(!e||e.e==null||e.e<=e.s||![1,2,3].includes(+e.focus)||!isStudyId(e.a))continue;
    const minutes=(e.e-e.s)/MIN;
    const h=new Date(e.s).getHours();
    for(const [map,key] of [[hours,h],[subjects,e.a]]){
      const rec=map[key]||(map[key]={sum:0,min:0,n:0});
      rec.sum+=+e.focus*minutes;rec.min+=minutes;rec.n++;
    }
  }
  return {hours,subjects};
}
function l7FocusPage(){
  const stats=l7FocusStats(),hours=Object.keys(stats.hours).map(Number).sort((a,b)=>a-b);
  const rows=hours.map(h=>{
    const x=stats.hours[h],avg=x.sum/x.min,pct=Math.max(0,Math.min(100,Math.round(avg/3*100)));
    return '<div class="l7-focus-hour" role="group" aria-label="'+
      esc(fmtHourS(h)+' average focus '+avg.toFixed(1)+' out of 3')+'">'+
      '<span class="l7-focus-label">'+esc(fmtHourS(h))+'</span>'+
      '<span class="l7-focus-track"><i style="width:'+pct+'%"></i></span>'+
      '<span class="l7-focus-value">'+avg.toFixed(1)+'</span></div>';
  }).join('');
  const subjects=Object.entries(stats.subjects).sort((a,b)=>b[1].min-a[1].min)
    .map(([id,x])=>kRow({dot:act(id).color,label:act(id).name,
      value:(x.sum/x.min).toFixed(1)+' / 3'})).join('');
  return '<div class="s2-page l7-detail">'+
    (rows?kGroup('Focus by hour',rows):kEmpty('Rate a few study sessions to see your focus patterns.'))+
    (subjects?kGroup('By subject',subjects):'')+'</div>';
}
function l7EstimatePage(){
  const reports=ACTS.filter(a=>a.kind==='study'&&!a.archived).map(a=>{
    const hist=typeof l3History==='function'?l3History(a.id):[];
    return {a,hist,factor:estimateFactor(hist),accuracy:l7Accuracy(hist)};
  }).filter(x=>x.hist.length);
  if(!reports.length)return kEmpty('Complete planned study blocks to measure estimate accuracy.');
  const overall=l7Accuracy(reports.flatMap(x=>x.hist));
  return '<div class="s2-page l7-detail"><div class="l7-metric">'+
    (overall==null?'—':overall+'%')+'<span>Overall estimate accuracy</span></div>'+
    kGroup('By subject',reports.map(x=>kRow({dot:x.a.color,label:x.a.name,
      sub:x.hist.length+' tracked session(s)',value:'×'+x.factor.toFixed(1)})).join(''))+
    '</div>';
}
function l7StreakPage(){
  const min=+CFG.minDay||25,st=flexibleStreak(l7Days(),min,+CFG.weekStart||0,todayKey());
  const tk=todayKey(),keys=Object.keys(st.status).filter(k=>k<=tk).sort().slice(-14);
  const label={met:'Study',freeze:'Freeze',miss:'Rest'};
  return '<div class="s2-page l7-detail"><div class="l7-metric">'+st.count+
    '<span>Consecutive study or frozen days · '+min+'m minimum</span></div>'+
    kGroup('Recent days',keys.reverse().map(k=>kRow({label:shortDay(k),
      value:label[st.status[k]]||'Rest'})).join(''))+'</div>';
}
PAGES['stats.focus']={title:'Focus',render:l7FocusPage};
PAGES['stats.estimates']={title:'Estimates',render:l7EstimatePage};
PAGES['stats.streak']={title:'Streak',render:l7StreakPage};

PAGES['stats.subject']={
  title:params=>(ACTMAP[params&&params.id]||{}).name||'Subject',
  render:s2Subject,
  actions:params=>kIconBtn('edit','Edit subject','data-act="s2-edit" data-id="'+esc(params&&params.id||'')+'"')
};
PAGES['stats.patterns']={title:'Patterns',render:s2Patterns};
PAGES['stats.insights']={title:'Study observations',render:s2Insights};
Object.assign(ACT,{
  's2-weeks'(el){UI.s2Weeks=el.getAttribute('data-v')==='12'?12:4;render();},
  's2-edit'(el){const id=el.getAttribute('data-id');if(ACTMAP[id])openPage('settings','settings.activity',{id});}
});
