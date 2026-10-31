/* L5: Flowtime break recommendation. Pure functions, no browser or clock dependencies. */
// Synced timer metadata is untrusted JSON. Number(object) can throw when a
// value shadows valueOf/toString, while arrays and booleans can masquerade as
// legitimate minutes. Preserve finite primitive numeric strings from v1.
function l5FiniteBreakNumber(value){
  if((typeof value!=='number'&&typeof value!=='string')||
     (typeof value==='string'&&!value.trim()))return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function suggestBreak(focusMin){
  const minutes=l5FiniteBreakNumber(focusMin);
  if(minutes===null||minutes<=0)return 5;
  return Math.min(20,Math.max(5,Math.round(minutes/5)));
}
function l5BreakRemaining(startMs,nowMs,targetMin){
  const start=l5FiniteBreakNumber(startMs),
    now=l5FiniteBreakNumber(nowMs),target=l5FiniteBreakNumber(targetMin);
  if(start===null||now===null||target===null||target<=0)return 0;
  const end=start+target*60000,remaining=(end-now)/60000;
  if(!Number.isFinite(end)||!Number.isFinite(remaining))return 0;
  return Math.max(0,Math.ceil(remaining));
}
if(typeof module!=='undefined'&&module.exports)module.exports={suggestBreak,l5BreakRemaining};
