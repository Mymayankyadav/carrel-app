/* L7: pure study suggestions, estimate accuracy and flexible streak. */
'use strict';
function l7Clamp(x,a,b){return Math.max(a,Math.min(b,x));}
// Corrupt, absent and non-finite telemetry must never count as study time.
// Keep numeric-string compatibility with legacy documents.
function l7Nonnegative(v){
  if((typeof v!=='number'&&typeof v!=='string')||(typeof v==='string'&&!v.trim()))return null;
  const n=Number(v);
  return Number.isFinite(n)&&n>=0?n:null;
}
function l7Accuracy(history){
  // Missing legacy actuals are not zero-minute completed sessions. Numeric
  // strings remain compatible, but null, blanks and booleans are not evidence.
  const present=v=>(typeof v==='number'||(typeof v==='string'&&v.trim()!==''))
    &&Number.isFinite(Number(v));
  const valid=(Array.isArray(history)?history:[]).filter(x=>x&&
    present(x.planned)&&+x.planned>0&&present(x.actual)&&+x.actual>=0);
  if(!valid.length)return null;
  const err=valid.reduce((sum,x)=>sum+Math.abs(x.actual-x.planned)/x.planned,0)/valid.length;
  return Math.round(100*l7Clamp(1-err,0,1));
}
function l7WeekOf(k){
  // A freeze belongs to an ISO (Monday–Sunday) week regardless of the
  // separately configurable calendar/display week start.
  const d=new Date(k+'T12:00:00Z'),wd=d.getUTCDay();
  d.setUTCDate(d.getUTCDate()-(wd+6)%7);
  return d.toISOString().slice(0,10);
}
// A valid calendar day is essential: ISO-looking keys such as 2026-02-31
// otherwise create phantom streak days when offline history is sparse.
function l7ValidDay(k){
  if(typeof k!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(k))return false;
  const d=new Date(k+'T12:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===k;
}
function l7DayNumber(k){return Math.floor(Date.parse(k+'T12:00:00Z')/86400000);}
function flexibleStreak(days,minDay,weekStart,todayKey){
  // The optional todayKey distinguishes an unfinished current day from an
  // older missed day. Omitted todayKey preserves the original call contract.
  const current=l7ValidDay(todayKey)?todayKey:null;
  const keys=Object.keys(days||{}).filter(k=>l7ValidDay(k)&&(!current||k<=current)).sort();
  const threshold=l7Nonnegative(minDay);
  const min=l7Clamp(threshold==null||threshold===0?25:threshold,5,120),byWeek={},status={};
  for(const k of keys){
    const week=l7WeekOf(k),w=byWeek[week]||(byWeek[week]={met:0,used:false});
    const time=l7Nonnegative(days[k])??0;
    if(time>=min){status[k]='met';w.met++;}
    // Today is unfinished: do not spend the weekly freeze or extend the
    // streak before the minimum has actually been reached.
    else if(current&&k===current)status[k]='miss';
    else if(w.met>0&&!w.used){status[k]='freeze';w.used=true;}
    else status[k]='miss';
  }
  if(!keys.length)return {count:0,status};
  // With an explicit current date, a stale history must not claim an active
  // streak. Yesterday's completed study is still eligible.
  if(current&&l7DayNumber(current)-l7DayNumber(keys[keys.length-1])>1)
    return {count:0,status};
  let streak=0,previous=null;
  for(let i=keys.length-1;i>=0;i--){
    const day=l7DayNumber(keys[i]);
    // Missing days are real breaks, not invisible days that can be skipped.
    if(previous!=null&&previous-day!==1)break;
    const unfinished=(!current||keys[i]===current);
    if(i===keys.length-1&&status[keys[i]]==='miss'&&unfinished){
      previous=day;
      continue;
    }
    if(status[keys[i]]==='miss')break;
    streak++;
    previous=day;
  }
  return {count:streak,status};
}
function advise(ctx){
  ctx=ctx||{};
  const out=[];
  const emit=(id,text,label,act,args)=>out.push({id,text,action:{label,act,args:args||{}}});
  const subjects=Array.isArray(ctx.subjects)?ctx.subjects:[];
  const low=subjects.find(s=>s&&typeof s.name==='string'&&l7Nonnegative(s.goalMin)>0&&
    l7Nonnegative(s.studiedMin)!=null&&
    l7Nonnegative(s.studiedMin)/l7Nonnegative(s.goalMin)<.5);
  if(low&&l7Nonnegative(ctx.daysLeft)>=3){
    const pct=Math.round(100*(+low.studiedMin||0)/+low.goalMin);
    emit('behind',low.name+' is at '+pct+'% of goal. Plan 2 sessions?','Plan it','l7-plan',{subject:low.id});
  }
  if(Number.isInteger(ctx.bestHour)&&ctx.bestHour>=0&&ctx.bestHour<24&&
    Number.isInteger(ctx.mostHour)&&ctx.bestHour!==ctx.mostHour){
    const h=ctx.bestHour;
    emit('peak','You focus best at '+(h%12||12)+(h>=12?' pm':' am')+'. Start there tomorrow?',
      'Set','l7-peak',{hour:h});
  }
  const underestimated=subjects.find(s=>s&&typeof s.name==='string'&&l7Nonnegative(s.factor)>=1.3);
  if(underestimated)emit('estimate',underestimated.name+' takes '+l7Nonnegative(underestimated.factor).toFixed(1)+
    '× your estimate. Plans now adjust.','OK','l7-dismiss',{id:'estimate'});
  const overdue=l7Nonnegative(ctx.overdue);
  if(overdue!=null&&overdue>=5)emit('reviews',overdue+' reviews overdue. Add a 30m review block?',
    'Add','l7-review',{});
  const driftThis=l7Nonnegative(ctx.driftThis),driftLast=l7Nonnegative(ctx.driftLast);
  if(driftThis!=null&&driftThis>30&&driftThis>1.5*(driftLast??0))
    emit('drift','Drift is up to '+Math.round(driftThis)+'m. Try urge-surf?',
      'Turn on','l7-drift',{});
  const todayMin=l7Nonnegative(ctx.todayMin),minDay=l7Nonnegative(ctx.minDay);
  const minimum=l7Clamp(minDay==null||minDay===0?25:minDay,5,120);
  const streak=l7Nonnegative(ctx.streak);
  if(todayMin!=null&&todayMin<minimum&&ctx.nearPlanEnd&&streak>=1)
    emit('streak',minimum+' min keeps your '+streak+
      '-day streak.','Start','l7-start',{});
  const dismissed=new Set(Array.isArray(ctx.dismissed)?ctx.dismissed:[]);
  return out.filter(x=>!dismissed.has(x.id)).slice(0,3);
}
if(typeof module!=='undefined'&&module.exports)module.exports={advise,l7Accuracy,flexibleStreak,l7WeekOf};
