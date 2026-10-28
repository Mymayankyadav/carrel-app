/* T2 Focus mode — always-black low-distraction desk with wake lock and drift. */
function vDesk(){
  const now=Date.now(),c=CUR;
  const a=c?act(c.activity):null;
  const started=c?parseT(c.start):0;
  const ps=c?pomoState(now):null;
  const isBreak=!!(a&&a.role==='break');
  const left=ps?ps.left:null,late=ps&&left<=0;
  const label=a?a.name:'Not tracking';
  const time=c?(ps?
      '<div class="desk-time'+(late?' over':'')+'" data-tk="cd" data-to="'+ps.end+'">'+fmtClock(left)+'</div>':
      '<div class="desk-time" data-tk="elh" data-s="'+started+'">'+fmtClock(now-started,true)+'</div>'):
      '<div class="desk-time">0:00</div>';
  const phase=ps?(ps.phase==='focus'?
    (late?'Break time':'Focus '+ps.cycle+(ps.every?' of '+ps.every:'')):
    (late?"Break's over":'Break')):'';
  const bar=ps?'<div class="desk-ring" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+
    Math.round(clamp((now-ps.ps)/ps.len,0,1)*100)+'">'+
    '<i data-tk="bar" data-s="'+ps.ps+'" data-len="'+ps.len+'" style="width:'+
    (clamp((now-ps.ps)/ps.len,0,1)*100).toFixed(1)+'%"></i></div>':'';
  const controls=c?(
    isBreak&&c.ret?
      '<button type="button" data-act="back" aria-label="Resume" title="Resume">'+icon('start')+'</button>'+
      '<button type="button" data-act="stop" aria-label="Stop" title="Stop">'+icon('stop')+'</button>':
      (isBreak?'':'<button type="button" data-act="break" aria-label="Take a break" title="Break">'+icon('break')+'</button>')+
      '<button type="button" data-act="stop" aria-label="Stop" title="Stop">'+icon('stop')+'</button>'
    ):(
      lastEntry()?'<button type="button" data-act="resume" aria-label="Resume last" title="Resume">'+icon('start')+'</button>':''
    );
  const hidden=now>UI.deskCtl;
  return '<div class="desk" data-act="desk-tap" role="dialog" aria-modal="true" aria-label="Focus mode">'+
    '<div class="desk-in" style="transform:translate('+UI.deskShift[0]+'px,'+UI.deskShift[1]+'px)">'+
    '<div class="desk-act">'+esc(label)+'</div>'+time+bar+
    (phase?'<div class="desk-sub">'+esc(phase)+'</div>':'')+
    (c&&c.intent?'<div class="desk-sub">'+esc(c.intent)+'</div>':'')+
    (typeof l5BreakCountdown==='function'?'<div class="desk-sub">'+l5BreakCountdown(c,now,ps)+'</div>':'')+
    '<div class="desk-ctl'+(hidden?' hid':'')+'">'+controls+
    '<button type="button" data-act="desk-exit" aria-label="Exit focus" title="Exit focus">'+icon('unfocus')+'</button>'+
    '</div></div></div>';
}

/* ---------- desk view helpers ---------- */
let wake = null, driftT = 0;
async function wakeOn() { try { if ('wakeLock' in navigator && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
function wakeOff() { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; }
function enterDesk() {
  // Focus is a temporary navigation layer: Android/browser Back dismisses it.
  if (!UI.desk) kHistoryPush('desk');
  UI.desk = true; UI.deskCtl = Date.now() + 4000; UI.deskShift = [0, 0];
  wakeOn();
  clearInterval(driftT);
  driftT = setInterval(() => {
    if (!UI.desk) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    UI.deskShift = reduce ? [0, 0] : [Math.round((Math.random() - 0.5) * 36), Math.round((Math.random() - 0.5) * 28)];
    const el = document.querySelector('.desk-in');
    if (el) el.style.transform = `translate(${UI.deskShift[0]}px,${UI.deskShift[1]}px)`;
  }, 45000);
  render();
}
function exitDesk(fromHistory) {
  const wasOpen = UI.desk;
  UI.desk = false; clearInterval(driftT); wakeOff();
  if (wasOpen && !fromHistory) kHistoryConsume('desk');
  render();
}
// The shell's generic Escape handler can otherwise pop a page before dismissing Focus.
// Intercept while focused, ahead of the later shell listener.
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('keydown', event => {
    if (!UI.desk || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exitDesk();
  }, true);
}
// Runs before shell popstate handling, avoiding a second navigation on Back.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('popstate', event => {
    if (!UI.desk) return;
    exitDesk(true);
    if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
  }, true);
}


/* L5 — unobtrusive flowtime and reflective-break controls. */
function l5FlowBreakChip(c,now,ps){
  if(!c||ps||!isStudyId(c.activity)||!lab('flowtime'))return '';
  const minutes=Math.max(0,(now-parseT(c.start))/MIN);
  if(minutes<25)return '';
  const target=suggestBreak(minutes);
  return '<div class="l5-flow-chip">'+kBtn('Break '+target+'m','data-act="l5-flow-break"',
    {kind:'text',icon:'break'})+'</div>';
}
function l5BreakCountdown(c,now,ps){
  if(!c||ps||!c.flowBreakMin||act(c.activity).role!=='break')return '';
  const target=+c.flowBreakMin,start=parseT(c.start);
  if(!Number.isFinite(start)||target<5||target>20)return '';
  const end=start+target*MIN;
  return '<span class="l5-break-remaining">Suggested break · <span data-tk="cd" data-to="'+end+'">'+
    fmtClock(end-now)+'</span> remaining</span>';
}
function l5BreakChoices(c,now){
  if(!c||act(c.activity).role!=='break'||!UI.breakChoicesUntil||now>=UI.breakChoicesUntil)return '';
  return '<div class="l5-break-choices"><span>Take a real break</span>'+
    kChips({act:'l5-break-note',value:'',
      options:[{v:'Walk',label:'Walk'},{v:'Water',label:'Water'},{v:'Stretch',label:'Stretch'}]})+'</div>';
}
function l5BreakStarted(){
  UI.breakChoicesUntil=Date.now()+10000;
  if(typeof setTimeout==='function')setTimeout(()=>{
    if(UI.breakChoicesUntil && Date.now()>=UI.breakChoicesUntil){
      UI.breakChoicesUntil=0;render();
    }
  },10050);
  render();
}
Object.assign(ACT,{
  'l5-flow-break'(){
    if(!CUR||!isStudyId(CUR.activity)||CUR.pomo||!lab('flowtime')||!canWrite())return;
    const minutes=(Date.now()-parseT(CUR.start))/MIN;
    if(minutes<25)return;
    UI.breakTarget=suggestBreak(minutes);
    takeBreak({flowBreakMin:UI.breakTarget});
  },
  'l5-break-note'(el){
    if(!CUR||act(CUR.activity).role!=='break'||!canWrite())return;
    const value=el.getAttribute('data-v');
    if(!['Walk','Water','Stretch'].includes(value))return;
    UI.breakChoicesUntil=0;
    commit('Break: '+value+'.',W().update('state/current',{note:value}),{undo:true});
  }
});
