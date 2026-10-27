/* ---------- desk view ---------- */
function vDesk() {
  const now = Date.now(), c = CUR;
  let big, sub = '', bar = '', label = 'Not tracking', color = 'var(--ink-3)', over = false, due = false;
  if (c) {
    const a = act(c.activity), s = parseT(c.start), ps = pomoState(now);
    label = a.name; color = a.color;
    if (ps) {
      due = ps.left <= 0; over = due;
      big = `<div class="desk-time ${over ? 'over' : ''}" data-tk="cd" data-to="${ps.end}">${fmtClock(ps.left)}</div>`;
      sub = ps.phase === 'focus' ? (due ? 'Break due · ' : 'Focus ' + ps.cycle + ' · ') + '<span data-tk="elx" data-s="' + s + '">' + fmtEl(now - s) + '</span> logged' : (due ? 'Break over' : 'Break');
      bar = `<div class="desk-ring ${due ? 'due' : ''}"><i data-tk="bar" data-s="${ps.ps}" data-len="${ps.len}" style="width:${(clamp((now - ps.ps) / ps.len, 0, 1) * 100).toFixed(2)}%"></i></div>`;
    } else {
      big = `<div class="desk-time" data-tk="elh" data-s="${s}">${fmtClock(now - s, true)}</div>`;
      sub = 'since ' + fmtT(s);
    }
  } else {
    const l = lastEntry();
    big = `<div class="desk-time">${l ? `<span data-tk="elh" data-s="${l.e}">${fmtClock(now - l.e, true)}</span>` : '0:00:00'}</div>`;
    sub = l ? 'untracked since ' + fmtT(l.e) : '';
  }
  const ctlHidden = Date.now() > UI.deskCtl;
  const isBreak = c && act(c.activity).role === 'break';
  const ctl = c ? `${isBreak && c.ret ? `<button type="button" data-act="back">Back to ${esc(act(c.ret.activity).name)}</button>` : !isBreak ? `<button type="button" data-act="break">Take a break</button>` : ''}<button type="button" data-act="stop">Stop</button>` : (lastEntry() ? `<button type="button" data-act="resume">Resume ${esc(act(lastEntry().a).name)}</button>` : '');
  return `<div class="desk" data-act="desk-tap" role="dialog" aria-modal="true" aria-label="Desk view"><div class="desk-in" style="transform:translate(${UI.deskShift[0]}px,${UI.deskShift[1]}px)">
    <div class="desk-act" style="--c:${color}"><i></i>${esc(label)}</div>${big}<div class="desk-sub">${sub}</div>${bar}
    <div class="desk-ctl ${ctlHidden ? 'hid' : ''}">${ctl}<button type="button" data-act="desk-exit">Exit</button></div></div>
    <div class="desk-hint">${ctlHidden ? 'Tap for controls · stays silent' : ''}</div></div>`;
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

