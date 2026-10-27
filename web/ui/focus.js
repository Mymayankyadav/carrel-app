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
      '<button type="button" data-act="'+(late&&ps&&ps.phase==='focus'?'break':'break')+
      '" aria-label="Take a break" title="Break">'+icon('break')+'</button>'+
      '<button type="button" data-act="stop" aria-label="Stop" title="Stop">'+icon('stop')+'</button>'
    ):(
      lastEntry()?'<button type="button" data-act="resume" aria-label="Resume last" title="Resume">'+icon('start')+'</button>':''
    );
  const hidden=now>UI.deskCtl;
  return '<div class="desk" data-act="desk-tap" role="dialog" aria-modal="true" aria-label="Focus mode">'+
    '<div class="desk-in" style="transform:translate('+UI.deskShift[0]+'px,'+UI.deskShift[1]+'px)">'+
    '<div class="desk-act">'+esc(label)+'</div>'+time+bar+
    (phase?'<div class="desk-sub">'+esc(phase)+'</div>':'')+
    '<div class="desk-ctl'+(hidden?' hid':'')+'">'+controls+
    '<button type="button" data-act="desk-exit" aria-label="Exit focus" title="Exit focus">'+icon('unfocus')+'</button>'+
    '</div></div></div>';
}

/* ---------- desk view helpers ---------- */
let wake = null, driftT = 0;
async function wakeOn() { try { if ('wakeLock' in navigator && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
function wakeOff() { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; }
function enterDesk() {
  UI.desk = true; UI.deskCtl = Date.now() + 5000; UI.deskShift = [0, 0];
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
function exitDesk() { UI.desk = false; clearInterval(driftT); wakeOff(); render(); }

