/* L4 — pure spaced-repetition rules. Dates are local YYYY-MM-DD keys. */
'use strict';
function l4KeyValid(k) {
  if(typeof k!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(k))return false;
  const [y,m,d]=k.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}
function l4DayNumber(k) {
  if(!l4KeyValid(k))return NaN;
  const [y,m,d]=k.split('-').map(Number);
  return Math.floor(Date.UTC(y,m-1,d)/86400000);
}
function l4PlusDays(k,n) {
  if(!l4KeyValid(k)||!Number.isFinite(n))return null;
  const [y,m,d]=k.split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,d+Math.trunc(n)));
  const year=dt.getUTCFullYear();
  if(!Number.isFinite(year)||year<100||year>9999)return null;
  return year+'-'+String(dt.getUTCMonth()+1).padStart(2,'0')+'-'+String(dt.getUTCDate()).padStart(2,'0');
}
// Synced topic metadata is untrusted: JSON objects can shadow valueOf/toString.
function l4SafeNumber(v) {
  return typeof v==='number'||typeof v==='string'?Number(v):NaN;
}
function nextReview(topic,rating,todayKey,examKey) {
  if(!l4KeyValid(todayKey))return null;
  if(![1,2,3].includes(rating))return null;
  const old=l4SafeNumber(topic&&topic.interval);
  const base=Number.isFinite(old)&&old>=1&&old<=3650?Math.round(old):1;
  const mult={1:0.5,2:1.8,3:2.5}[rating];
  const interval=rating===1?1:Math.min(3650,Math.max(1,Math.round(base*mult)));
  let due=l4PlusDays(todayKey,interval);
  if(!due)return null;
  if(l4KeyValid(examKey)&&l4DayNumber(examKey)>l4DayNumber(todayKey)&&due>=examKey){
    const days=l4DayNumber(examKey)-l4DayNumber(todayKey);
    const pre=l4PlusDays(examKey,-Math.max(1,Math.round(days*0.15)));
    due=pre<l4PlusDays(todayKey,1)?l4PlusDays(todayKey,1):pre;
  }
  const previous=l4SafeNumber(topic&&topic.reps);
  const reps=Number.isSafeInteger(previous)&&previous>=0&&previous<Number.MAX_SAFE_INTEGER?previous:0;
  return {interval,due,reps:reps+1,last:todayKey};
}
function dueTopics(topics,dayKey) {
  if(!l4KeyValid(dayKey))return [];
  const rows=Array.isArray(topics)?topics.map((v,i)=>[String(v&&v.id||i),v]):Object.entries(topics||{});
  return rows.filter(([id,x])=>x&&x.archived!==true&&l4KeyValid(x.due)&&x.due<=dayKey)
    .map(([id,x])=>({id,subject:typeof x.subject==='string'?x.subject:null,title:typeof x.title==='string'?x.title.slice(0,120):'',due:x.due}))
    .sort((a,b)=>a.due.localeCompare(b.due)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
}
if(typeof module!=='undefined'&&module.exports)module.exports={nextReview,dueTopics,l4PlusDays,l4KeyValid};
