/* L7: pure study suggestions, estimate accuracy and flexible streak. */
'use strict';
function l7Clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function l7Accuracy(history){
  const valid=(history||[]).filter(x=>x&&Number.isFinite(+x.planned)&&+x.planned>0&&Number.isFinite(+x.actual)&&+x.actual>=0);
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
function flexibleStreak(days,minDay,weekStart){
  const keys=Object.keys(days||{}).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const min=Math.max(5,+minDay||25),byWeek={},status={};
  for(const k of keys){
    const week=l7WeekOf(k),w=byWeek[week]||(byWeek[week]={met:0,used:false});
    const time=+days[k]||0;
    if(time>=min){status[k]='met';w.met++;}
    else if(w.met>0&&!w.used){status[k]='freeze';w.used=true;}
    else status[k]='miss';
  }
  let streak=0;
  for(let i=keys.length-1;i>=0;i--){
    // A not-yet-completed current day does not terminate yesterday's streak.
    if(i===keys.length-1&&status[keys[i]]==='miss')continue;
    if(status[keys[i]]==='miss')break;
    streak++;
  }
  return {count:streak,status};
}
function advise(ctx){
  ctx=ctx||{};
  const out=[];
  const emit=(id,text,label,act,args)=>out.push({id,text,action:{label,act,args:args||{}}});
  const subjects=ctx.subjects||[];
  const low=subjects.find(s=>+s.goalMin>0&&+s.studiedMin/+s.goalMin<.5);
  if(low&&ctx.daysLeft>=3){
    const pct=Math.round(100*(+low.studiedMin||0)/+low.goalMin);
    emit('behind',low.name+' is at '+pct+'% of goal. Plan 2 sessions?','Plan it','l7-plan',{subject:low.id});
  }
  if(Number.isInteger(ctx.bestHour)&&ctx.bestHour>=0&&ctx.bestHour<24&&
    Number.isInteger(ctx.mostHour)&&ctx.bestHour!==ctx.mostHour){
    const h=ctx.bestHour;
    emit('peak','You focus best at '+(h%12||12)+(h>=12?' pm':' am')+'. Start there tomorrow?',
      'Set','l7-peak',{hour:h});
  }
  const underestimated=subjects.find(s=>Number.isFinite(+s.factor)&&+s.factor>=1.3);
  if(underestimated)emit('estimate',underestimated.name+' takes '+(+underestimated.factor).toFixed(1)+
    '× your estimate. Plans now adjust.','OK','l7-dismiss',{id:'estimate'});
  if(+ctx.overdue>=5)emit('reviews',ctx.overdue+' reviews overdue. Add a 30m review block?',
    'Add','l7-review',{});
  if(+ctx.driftThis>30&&+ctx.driftThis>1.5*(+ctx.driftLast||0))
    emit('drift','Drift is up to '+Math.round(ctx.driftThis)+'m. Try urge-surf?',
      'Turn on','l7-drift',{});
  if(+ctx.todayMin<Math.max(5,+ctx.minDay||25)&&ctx.nearPlanEnd&&+ctx.streak>=1)
    emit('streak',Math.max(5,+ctx.minDay||25)+' min keeps your '+ctx.streak+
      '-day streak.','Start','l7-start',{});
  const dismissed=new Set(ctx.dismissed||[]);
  return out.filter(x=>!dismissed.has(x.id)).slice(0,3);
}
if(typeof module!=='undefined'&&module.exports)module.exports={advise,l7Accuracy,flexibleStreak,l7WeekOf};
