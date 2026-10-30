/* L3: pure, deterministic study scheduling. All times are epoch milliseconds. */
'use strict';
const L3_MIN = 60000;
const l3Round5 = n => Math.max(0, Math.round(n / 5) * 5);
const l3Ceil5 = n => Math.ceil(n / 5) * 5;
function estimateFactor(history) {
  const ratios = (Array.isArray(history) ? history : [])
    .filter(x => x && Number.isFinite(+x.planned) && Number.isFinite(+x.actual)
      && +x.planned >= 10 && +x.actual > 0)
    .slice(0, 30).map(x => +x.actual / +x.planned).sort((a,b) => a-b);
  if (ratios.length < 5) return 1;
  const m = ratios.length >> 1;
  const median = ratios.length % 2 ? ratios[m] : (ratios[m-1]+ratios[m])/2;
  return Math.max(0.8, Math.min(2, Math.round(median * 10) / 10));
}
function energyWindows(stats) {
  return Object.entries(stats || {}).map(([h,s]) => ({
    hour:+h, minutes:+(s && (s.min ?? s.minutes)) || 0,
    focus:s && s.focus == null ? 2 : +(s && s.focus) || 2
  })).filter(x => Number.isInteger(x.hour) && x.hour>=0 && x.hour<24 && x.minutes>=30)
    .map(x => ({hour:x.hour, score:x.focus * Math.sqrt(x.minutes)}))
    .sort((a,b) => b.score-a.score || a.hour-b.hour).map(x => x.hour);
}
function l3Interleave(items) {
  const sorted=items.slice().sort((a,b) => (+a.prio||2)-(+b.prio||2)
    || Number(!!b.hard)-Number(!!a.hard) || (+b.minutes||0)-(+a.minutes||0));
  const out=[];
  while(sorted.length){
    const prev=out.length ? out[out.length-1].activity : null;
    const idx=sorted.findIndex(x => x.activity!==prev);
    out.push(sorted.splice(idx<0?0:idx,1)[0]);
  }
  return out;
}
function l3LocalHm(t) {
  const d=new Date(t);
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function l3PeakStart(slot,hours) {
  let best=null;
  for(const h of hours){
    const d=new Date(slot.s);
    d.setHours(h,0,0,0);
    if(d.getTime()<slot.s)d.setDate(d.getDate()+1);
    const t=d.getTime();
    if(t>=slot.s && t+25*L3_MIN<=slot.e && (best==null || t<best))best=t;
  }
  return best;
}
function autoPlan(opts) {
  opts=opts || {};
  const now=Number.isFinite(+opts.now)?+opts.now:-Infinity;
  // Merge overlapping/touching free windows before budgeting and scheduling.
  // Duplicated availability must not double-book time or inflate the 10% buffer.
  const rawSlots=(opts.free||[]).filter(x => Array.isArray(x) && x.length>=2)
    .map(x => ({s:Math.max(+x[0],now),e:+x[1]}))
    .filter(x => Number.isFinite(x.s)&&Number.isFinite(x.e)&&x.e>x.s)
    .sort((a,b)=>a.s-b.s);
  const slots=[];
  for(const interval of rawSlots){
    const last=slots[slots.length-1];
    if(last&&interval.s<=last.e)last.e=Math.max(last.e,interval.e);
    else slots.push({...interval});
  }
  for(let i=slots.length-1;i>=0;i--)
    if(slots[i].e-slots[i].s<25*L3_MIN)slots.splice(i,1);
  const totalFree=slots.reduce((n,x)=>n+(x.e-x.s)/L3_MIN,0);
  const gap=Math.max(0,+opts.gapMin||0);
  let budget=Math.floor(totalFree*0.90);
  const factor=typeof opts.factor==='function'?opts.factor:()=>1;
  const highHours=(opts.windows||[]).slice(0,3);
  const blocks=[],unplaced=[];
  for(const item of l3Interleave((opts.items||[]).filter(x => x && x.id && x.activity && +x.minutes > 0))){
    const mult=Number.isFinite(+factor(item.activity)) ? Math.max(0.8,Math.min(2,+factor(item.activity))) : 1;
    let remaining=Math.max(25,l3Ceil5((+item.minutes||0)*mult));
    let safety=0;
    while(remaining>=25 && budget>=25 && safety++<100){
      const peak=!!item.hard || +item.prio===1;
      let target=null;
      if(peak){
        for(let i=0;i<slots.length;i++){
          const t=l3PeakStart(slots[i],highHours);
          if(t!=null && (!target || t<target.t))target={i,t};
        }
      }
      if(!target){
        for(let i=0;i<slots.length;i++)if(slots[i].e-slots[i].s>=25*L3_MIN){target={i,t:slots[i].s};break;}
      }
      if(!target)break;
      const slot=slots[target.i],room=Math.floor((slot.e-target.t)/L3_MIN);
      const m=Math.min(remaining,room,budget);
      if(m<25){
        // A narrow tail must not block other, potentially shorter, sessions.
        slot.s=slot.e;continue;
      }
      blocks.push({itemId:item.id,activity:item.activity,title:item.title||'',at:l3LocalHm(target.t),minutes:m});
      remaining-=m;budget-=m;
      // A peak-hour choice may begin well after the start of a free window.
      // Keep the earlier time available for other subjects, reserving the
      // configured gap immediately before the peak session.
      const prefixEnd=target.t-gap*L3_MIN;
      if(prefixEnd-slot.s>=25*L3_MIN)
        slots.splice(target.i,0,{s:slot.s,e:prefixEnd});
      slot.s=Math.min(slot.e,target.t+(m+gap)*L3_MIN);
      budget=Math.max(0,budget-gap);
    }
    if(remaining>0)unplaced.push(item.id);
  }
  // The preview and persisted Plan order must follow clock time, not the\n  // priority order in which candidate tasks were allocated.\n  blocks.sort((a,b)=>a.at.localeCompare(b.at));\n  return {blocks,unplaced};
}
function backwardPlan(opts) {
  opts=opts||{};
  const valid=k=>{
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(k||'')))return false;
    const d=new Date(k+'T00:00:00Z');
    return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===k;
  };
  if(!valid(opts.today)||!valid(opts.deadline)||opts.today>=opts.deadline)return [];
  const needed=opts.hoursNeeded==null?0:+opts.hoursNeeded;
  const done=opts.hoursDone==null?0:+opts.hoursDone;
  const perDay=opts.maxPerDay==null?3:+opts.maxPerDay;
  if(![needed,done,perDay].every(Number.isFinite)||perDay<=0)return [];
  const toUTC=k=>new Date(k+'T00:00:00Z').getTime();
  const fromUTC=t=>new Date(t).toISOString().slice(0,10);
  const days=[];
  for(let t=toUTC(opts.today),end=toUTC(opts.deadline);t<end;t+=86400000)days.push(fromUTC(t));
  if(!days.length)return [];
  const remaining=Math.max(0,(needed-done)*60);
  const maxPerDay=Math.min(24,perDay)*60;
  if(remaining<25||maxPerDay<25)return [];
  const weights=days.map((_,i)=>i===days.length-1&&days.length>1 ? 0.6 : 1+0.4*i/Math.max(1,days.length-2));
  const target=Math.min(l3Round5(remaining),Math.floor(maxPerDay/5)*5*days.length);
  const allocation=days.map(()=>0),cap=Math.floor(maxPerDay/5)*5;
  // Seed each active day with a useful >=25-minute session before distributing
  // the remainder, so filtering cannot silently discard sub-25-minute pieces.
  const count=Math.min(days.length,Math.floor(target/25));
  const chosenDays=weights.map((w,i)=>({i,w})).sort((a,b)=>b.w-a.w||a.i-b.i)
    .slice(0,count).map(x=>x.i);
  for(const i of chosenDays)allocation[i]=25;
  let left=target-25*count;
  while(left>=5){
    let chosen=-1,score=-Infinity;
    for(const i of chosenDays){
      if(allocation[i]+5>cap)continue;
      const priority=weights[i]/(allocation[i]+5);
      if(priority>score){chosen=i;score=priority;}
    }
    if(chosen<0)break;
    allocation[chosen]+=5;left-=5;
  }
  return days.map((date,i)=>({date,minutes:allocation[i]})).filter(x=>x.minutes>=25);
}
if(typeof module!=='undefined' && module.exports)
  module.exports={estimateFactor,energyWindows,autoPlan,backwardPlan};
