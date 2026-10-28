/* L5: Flowtime break recommendation. Pure functions, no browser or clock dependencies. */
function suggestBreak(focusMin){
  const minutes=Number(focusMin);
  if(!Number.isFinite(minutes)||minutes<=0)return 5;
  return Math.min(20,Math.max(5,Math.round(minutes/5)));
}
function l5BreakRemaining(startMs,nowMs,targetMin){
  const start=Number(startMs),now=Number(nowMs),target=Number(targetMin);
  if(!Number.isFinite(start)||!Number.isFinite(now)||!Number.isFinite(target)||target<=0)return 0;
  return Math.max(0,Math.ceil((start+target*60000-now)/60000));
}
if(typeof module!=='undefined'&&module.exports)module.exports={suggestBreak,l5BreakRemaining};
