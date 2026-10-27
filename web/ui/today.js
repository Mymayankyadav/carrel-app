/* ---------- views: Today ---------- */
function todayFold(name, body) {
  const preference = store.get('fold:' + name);
  const open = preference == null ? name === 'log' : !!preference;
  const title = name === 'log' ? 'Log' : 'Where the day went';
  return `<details class="fold" data-key="today-fold:${name}" data-fold="${name}"${open ? ' open' : ''}><summary><span class="fold-title">${title}</span><span class="fold-cue">Expand or collapse</span><span class="fold-chevron" aria-hidden="true"></span></summary><div class="fold-body">${body}</div></details>`;
}
// Persist manually toggled sections across renders and tab switches.
document.addEventListener('toggle', e => {
  const el = e.target;
  if (el && el.matches && el.matches('details.fold') && el.dataset.fold)
    store.set('fold:' + el.dataset.fold, el.open ? 1 : 0);
}, true);
function vToday() {
  const now = Date.now(), tk = todayKey(), k = UI.date || tk;
  const isToday = k === tk, isPast = k < tk, isFuture = k > tk;
  if (isPast) ensureRange(addDaysKey(k, -1), k);
  const ready = S.loaded.activities;
  const agg = aggregate(ENTRIES, now, k, k)[k] || { acts: {}, study: 0, all: 0 };
  const pm = planModelFor(k, now);
  const pomos = pomodoroByDay(ENTRIES, now)[k] || 0;
  const sum = [];
  if (!isFuture) sum.push(`<span><b class="num">${fmtDur(agg.study)}</b> studied</span>`);
  if (pomos) sum.push(`<span><b class="num">${pomos}</b> pomodoro${pomos > 1 ? 's' : ''}</span>`);
  if (pm && pm.planned) sum.push(`<span>plan <b class="num">${Math.round(pm.done / pm.planned * 100)}%</b> done</span>`);
  if (isFuture) sum.push(`<span>${esc(longDay(k))}</span>`);
  const head = `<section class="dayhead">
    <div class="dh-nav">
      <button type="button" class="icon-btn" data-act="day-prev" aria-label="Previous day">${icon('left')}</button>
      <label class="stamp-wrap" title="Choose a day"><span class="stamp ${isPast ? 'past' : isFuture ? 'future' : ''}">${esc(stampText(k))}</span><input type="date" id="day-pick" data-change="day-pick" value="${k}" aria-label="Choose a day"></label>
      <button type="button" class="icon-btn" data-act="day-next" aria-label="Next day">${icon('right')}</button>
      ${!isToday ? `<button type="button" class="chip-btn" data-act="day-today">Back to today</button>` : ''}
    </div>
    <p class="dh-sum">${sum.join('')}</p>
  </section>`;
  if (!ready) return head + `<div class="empty"><p>Opening your log…</p></div>`;
  if (!ACTS.length) return head + vNoActs();
  const colA = [], colB = [];
  if (isToday) {
    colA.push(vOnboard());
    colA.push(vTimer(now, pm));
    colA.push(vParking(k));
    colA.push(vSwitcher(now, agg));
    colA.push(vPlan(k, pm, now));
    colB.push(todayFold('log', vLog(k, now, pm)));
    colB.push(todayFold('breakdown', vBreakdown(k, now, agg, pomos)));
  } else if (isFuture) {
    colA.push(vPlan(k, pm, now));
    colB.push(vFutureNote(k));
  } else {
    colA.push(vBreakdown(k, now, agg, pomos));
    colA.push(vPlan(k, pm, now));
    colB.push(vLog(k, now, pm));
  }
  return head + (isToday ? vDeadlineChips(tk) : '') + `<div class="tgrid"><div class="col">${colA.join('')}</div><div class="col">${colB.join('')}</div></div>`;
}
function vFutureNote(k) {
  return `<section class="sec"><div class="sec-head"><h2>Ahead</h2></div><div class="empty"><p>Nothing is logged for ${esc(longDay(k))} yet. Blocks you add here are waiting when the day starts, and anything you carry over from today lands here.</p><div class="ask"><code>Plan ${k === addDaysKey(todayKey(), 1) ? 'tomorrow' : esc(shortDay(k))} in Carrel</code><button type="button" class="btn sm" data-act="copy" data-text="Plan ${k === addDaysKey(todayKey(), 1) ? 'tomorrow' : esc(shortDay(k))} in Carrel">${icon('copy')}Copy</button></div></div></section>`;
}
function vRing(p, color) {
  const f = clamp((Date.now() - p.ps) / p.len, 0, 1);
  return `<svg class="ring ${p.left <= 0 ? 'due' : ''}" viewBox="0 0 64 64" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(f * 100)}" aria-label="Pomodoro progress" style="--c:${color}"><circle class="rb" cx="32" cy="32" r="27"/><circle class="rf" cx="32" cy="32" r="27" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="${Math.round(1000 * (1 - f))}" data-tk="ring" data-s="${p.ps}" data-len="${p.len}"/></svg>`;
}
function vTimer(now, pm) {
  if (S.db && !S.loaded.current) return `<section class="timer idle"><div class="t-time dim">0:00</div><p class="t-meta">Opening your timer…</p></section>`;
  const c = CUR;
  if (!c) return vTimerIdle(now);
  const a = act(c.activity), s = parseT(c.start), el = now - s;
  const ps = pomoState(now), g = guardInfo(now);
  const isBreak = a.role === 'break';
  const ret = c.ret && c.ret.activity && ACTMAP[c.ret.activity] ? act(c.ret.activity) : null;
  let big, phase = '', ring = '', due = false;
  const meta = [];
  if (ps && ps.phase === 'focus') {
    due = ps.left <= 0;
    big = `<div class="t-time ${due ? 'over' : ''}" data-tk="cd" data-to="${ps.end}">${fmtClock(ps.left)}</div>`;
    phase = `<span class="t-phase">${due ? 'Break due' : 'Focus ' + ps.cycle + (ps.every ? ' of ' + ps.every : '')}</span>`;
    ring = vRing(ps, a.color);
    meta.push(`<span><span class="num" data-tk="elx" data-s="${s}">${fmtEl(el)}</span> logged</span>`);
  } else if (ps && ps.phase === 'break') {
    due = ps.left <= 0;
    big = `<div class="t-time ${due ? 'over' : ''}" data-tk="cd" data-to="${ps.end}">${fmtClock(ps.left)}</div>`;
    phase = `<span class="t-phase">${due ? 'Break over' : (ps.len >= 15 * MIN ? 'Long break' : 'Break')}</span>`;
    ring = vRing(ps, a.color);
  } else {
    big = `<div class="t-time" data-tk="elh" data-s="${s}">${fmtClock(el, true)}</div>`;
  }
  meta.push(`<span>since <span class="num">${fmtT(s)}</span>${dayKeyOf(s) !== todayKey() ? ' ' + esc(shortDay(dayKeyOf(s))) : ''}</span>`);
  const bid = c.block || (pm && pm.activeId);
  const br = pm && bid ? pm.rows.find(r => r.id === bid) : null;
  if (br) meta.push(`<span>${esc(br.title || 'Plan block')} · <span class="num">${fmtDur(br.done)}</span> of <span class="num">${fmtDur(br.target)}</span></span>`);
  const noteRepeatsBlock = !!(br && br.title && c.note && c.note.trim() === br.title.trim());
  const noteField = noteRepeatsBlock ? '' : `<input class="t-note" id="cur-note" data-change="cur-note" value="${esc(c.note || '')}" placeholder="This session I will… (optional)" maxlength="200" autocomplete="off" aria-label="What I will do this session">`;
  let buttons;
  if (isBreak && ret) buttons = `<button type="button" class="btn ${due || !ps ? 'lamp' : ''}" data-act="back">${icon('play')} Back to ${esc(ret.name)}</button><button type="button" class="btn" data-act="stop">${icon('stop')} Stop</button>`;
  else if (isBreak) buttons = `<button type="button" class="btn primary" data-act="stop">${icon('stop')} Stop</button>`;
  else if (ps && ps.phase === 'focus' && due) buttons = `<button type="button" class="btn brass" data-act="break">${icon('cup')} Take a ${ps.nextBreak}-minute break</button><button type="button" class="btn" data-act="stop">${icon('stop')} Stop</button>`;
  else buttons = `<button type="button" class="btn primary" data-act="stop">${icon('stop')} Stop</button><button type="button" class="btn" data-act="break">${icon('cup')} ${ps ? 'Break' : 'Take a break'}</button>`;
  const guard = g ? `<div class="guard"><p><b>${esc(a.name)} has been running for ${fmtDur(g.ran)}.</b> Still going?</p>
      <div class="row"><button type="button" class="btn sm" data-act="guard-keep">Yes, keep it</button><button type="button" class="btn sm" data-act="guard-fix">I stopped earlier</button></div>
      ${UI.guardOpen ? vGuardFix(s, now) : ''}</div>` : '';
  return `<section class="timer ${isBreak ? 'brk' : ''} ${due ? 'due' : ''}" style="--c:${a.color}" aria-label="Current timer">
    <div class="t-top"><span class="t-act"><i class="dot"></i><span>${esc(a.name)}</span></span>${phase}<span class="tools"><button type="button" class="icon-btn" data-act="edit-running" aria-label="Edit the running timer" title="Edit">${icon('edit')}</button><button type="button" class="icon-btn" data-act="desk" aria-label="Open desk view" title="Desk view">${icon('moon')}</button></span></div>
    <div class="t-main">${big}${ring}</div>
    <p class="t-meta">${meta.join('')}</p>
    ${noteField}
    ${vNoticeBar()}
    ${guard}
    <div class="t-actions">${buttons}</div>
  </section>`;
}
/* ---------- distractions: noticed, drifted, parked ---------- */
function noticeOpen() { return UI.notice && UI.notice.until > Date.now() && CUR; }
function vNoticeBar() {
  if (!CUR) return '';
  const back = UI.back && UI.back.until > Date.now() ? `<p class="reentry" role="status" aria-live="polite">Back to: <b>${esc(UI.back.text)}</b></p>` : '';
  const chips = noticeOpen() ? `<span class="chips" role="group" aria-label="Did you drift?"><span class="lbl">Drifted</span>${[1, 5, 15].map(m => `<button type="button" class="chip-btn" data-act="notice-drift" data-m="${m}">${m} min</button>`).join('')}</span>` : '';
  return `${back}<div class="row notice-row"><button type="button" class="btn sm" data-act="notice" title="Press X" aria-label="Noticed an urge (shortcut X)">Noticed <kbd class="kbd">X</kbd></button>${chips}
    <form class="row" data-submit="park-add" style="flex:1 1 150px"><input class="inp" id="park-text" style="flex:1 1 100px;width:auto" maxlength="140" placeholder="Park a thought" data-bind="parkText" value="${esc(UI.parkText || '')}" autocomplete="off" aria-label="Park a thought for later"></form></div>`;
}
function backText() {
  const c = CUR;
  if (!c) return '';
  if (c.note) return c.note;
  const p = V.plans[dayKeyOf(parseT(c.start))], b = c.block && p && p.blocks && p.blocks[c.block];
  return (b && b.title) || act(c.activity).name;
}
function showBack(ms) { UI.back = { text: backText(), until: Date.now() + (ms || 8000) }; setTimeout(render, (ms || 8000) + 100); }
function noticeNow() {
  const c = CUR;
  if (!c || !canWrite()) return;
  const now = Date.now(), k = dayKeyOf(now), id = uid('d');
  const w = W().dis(k, id, { type: 'urge', at: isoLocal(now), driftMin: null, text: null, activity: c.activity, entry: c.id, src: 'page', applied: true });
  commit(null, w, { undo: false });
  UI.notice = { k, id, until: now + 6000 };
  showBack(8000);
  setTimeout(render, 6100);
  render();
}
/* Cuts the drifted minutes out of whatever was logged and records them as drift, so the log stays honest. */
function driftWrites(w, at, min, note) {
  const dr = ACTS.find(a => a.role === 'drift' && !a.archived);
  if (!dr || !(min > 0)) return;
  const now = Date.now(), e = Math.min(at, now), s = e - min * MIN;
  trimOthers(ENTRIES.filter(x => x.s < e && entryEnd(x, now) > s), s, e, w);
  w.day(dayKeyOf(s), { [uid('e')]: { activity: dr.id, start: isoLocal(s), end: isoLocal(e), note: note || 'drift', focus: null, block: null, pomo: null } });
}
function noticeDrift(m) {
  const n = UI.notice;
  if (!n || !canWrite()) return;
  const at = parseT(V.distractions[n.k] && V.distractions[n.k].items && V.distractions[n.k].items[n.id] && V.distractions[n.k].items[n.id].at) || Date.now();
  const w = W().dis(n.k, n.id, { type: 'drift', driftMin: m, applied: true });
  driftWrites(w, at, m, 'drift');
  UI.notice = null;
  commit(`Noted ${m} minute${m > 1 ? 's' : ''} of drift.`, w, { undo: true });
  showBack(8000);
}
/* Drifts tapped on the phone arrive with applied:false. The first device that sees them cuts the time out, and flips the flag in the same commit. */
const APPLYING = new Set();
function applyPhoneDrifts() {
  if (!S.db || !canWrite() || !S.loaded.days || !S.loaded.distractions || !S.loaded.current || !S.loaded.activities) return;
  const w = W();
  let n = 0;
  for (const k in V.distractions) {
    const items = (V.distractions[k] && V.distractions[k].items) || {};
    for (const id in items) {
      const it = items[id];
      if (!it || it.type !== 'drift' || it.applied !== false || APPLYING.has(id)) continue;
      APPLYING.add(id);
      driftWrites(w, parseT(it.at), +it.driftMin || 0, 'drift (from phone)');
      w.dis(k, id, { applied: true });
      n++;
    }
  }
  if (n) commit(`From your phone: ${n} drift${n > 1 ? 's' : ''} logged.`, w, { undo: false });
}
function parkAdd(text) {
  const t = String(text || '').trim().slice(0, 140);
  if (!t || !canWrite()) return;
  const now = Date.now(), k = dayKeyOf(now);
  commit('Parked.', W().dis(k, uid('d'), { type: 'park', at: isoLocal(now), driftMin: null, text: t, activity: CUR ? CUR.activity : null, entry: CUR ? CUR.id : null, src: 'page', applied: true }), { undo: true });
  UI.parkText = '';
  render();
}
function parkedItems(k) {
  const items = (V.distractions[k] && V.distractions[k].items) || {};
  return Object.keys(items).filter(id => items[id].type === 'park' && !items[id].moved && !items[id].dismissed).map(id => Object.assign({ id }, items[id])).sort((a, b) => (a.at < b.at ? -1 : 1));
}
function vParking(k) {
  const list = parkedItems(k);
  if (!list.length) return '';
  const onBreak = CUR && act(CUR.activity).role === 'break';
  return `<section class="panel parking" aria-labelledby="pk-h"><div class="sec-head"><h2 id="pk-h">${onBreak ? 'Parked while you worked' : 'Parked thoughts'}</h2></div>
    <ul class="plist">${list.map(x => `<li><span>${esc(x.text)}</span><span class="row-btns"><button type="button" class="btn sm" data-act="park-backlog" data-k="${k}" data-id="${esc(x.id)}">→ backlog</button><button type="button" class="btn sm ghost" data-act="park-drop" data-k="${k}" data-id="${esc(x.id)}">Drop</button></span></li>`).join('')}</ul></section>`;
}
function parkToBacklog(k, id) {
  const it = V.distractions[k] && V.distractions[k].items && V.distractions[k].items[id];
  if (!it || !canWrite()) return;
  const cur = (V.planning.backlog && V.planning.backlog.items) || {};
  const order = Object.keys(cur).reduce((m, x) => Math.max(m, +cur[x].order || 0), 0) + 1;
  const first = ACTS.find(a => a.kind === 'study' && !a.archived);
  const w = W();
  w.update('planning/backlog', { items: { [uid('t')]: { title: it.text, activity: (it.activity && isStudyId(it.activity) ? it.activity : first && first.id) || null, minutes: 30, due: null, prio: 2, order, created: isoLocal(Date.now()) } } }, { items: {} });
  w.dis(k, id, { moved: true });
  commit('Moved to your backlog.', w, { undo: true });
}
function vDistractionPatterns(now, weeks) {
  const fromMs = dayStartMs(addDaysKey(todayKey(), -(weeks * 7) + 1));
  const items = [];
  for (const k in V.distractions) { const d = V.distractions[k]; for (const id in ((d && d.items) || {})) { const x = d.items[id]; items.push({ type: x.type, at: parseT(x.at), driftMin: x.driftMin }); } }
  const st = distractionStats(ENTRIES, items, now, fromMs);
  const body = !st.enough ? `<div class="empty"><p>Not enough data yet. This needs at least three study sessions of five minutes or more. Press X when you notice your mind wandering.</p></div>`
    : `<div class="stats4"><div><span class="lbl">Catch rate</span><b class="num">${st.catchRate == null ? '–' : Math.round(st.catchRate * 100) + '%'}</b><small>noticed before drifting</small></div>
      <div><span class="lbl">Per focused hour</span><b class="num">${st.perHour.toFixed(1)}</b><small>${st.urges} noticed · ${st.drifts} drifted</small></div>
      <div><span class="lbl">Lost to drift</span><b class="num">${fmtDur(st.lostMin * MIN)}</b><small>in ${weeks} weeks</small></div>
      <div><span class="lbl">Longest focus</span><b class="num">${fmtDur(st.longestStretch)}</b><small>${st.firstAtMin == null ? '' : 'first slip around minute ' + Math.round(st.firstAtMin)}</small></div></div>
      <p class="cap">Counts often rise at first, because you start noticing more. The catch rate is the number to watch.</p>`;
  return `<section class="panel span2" aria-labelledby="dp-h"><div class="sec-head"><h2 id="dp-h">Distractions</h2></div>${body}</section>`;
}
function vGuardFix(s, now) {
  const seen = +store.get('seen') || 0;
  const seenOk = seen > s + MIN && seen < now - 5 * MIN;
  return `<div class="row"><label class="field" style="flex:0 0 auto"><span>Stopped at</span><input type="time" class="inp" id="guard-time" data-bind="guardTime" value="${esc(UI.guardTime)}"></label><button type="button" class="btn sm lamp" data-act="guard-save" style="align-self:flex-end">Save stop time</button></div>
    ${seenOk ? `<button type="button" class="btn sm ghost" data-act="guard-seen" data-t="${seen}">Use ${fmtT(seen)}, when this page was last open here</button>` : ''}`;
}
function vTimerIdle(now) {
  const l = lastEntry();
  if (!l) return `<section class="timer idle" aria-label="Current timer"><div class="t-top"><span class="t-act"><span class="muted">Not tracking</span></span></div><div class="t-time dim">0:00:00</div><p class="t-meta">Tap an activity below to start. Timers keep running when you close this page, on any device.</p></section>`;
  const a = act(l.a), gap = now - l.e;
  return `<section class="timer idle" aria-label="Current timer">
    <div class="t-top"><span class="t-act"><span class="muted">Not tracking</span></span><span class="tools"><button type="button" class="icon-btn" data-act="desk" aria-label="Open desk view" title="Desk view">${icon('moon')}</button></span></div>
    <div class="t-time dim" data-tk="elh" data-s="${l.e}">${fmtClock(gap, true)}</div>
    <p class="t-meta"><span>Untracked since <span class="num">${fmtT(l.e)}</span>${dayKeyOf(l.e) !== todayKey() ? ' ' + esc(shortDay(dayKeyOf(l.e))) : ''}</span><span>last: ${esc(a.name)}</span></p>
    <div class="t-actions"><button type="button" class="btn lamp" data-act="resume">${icon('play')} Resume ${esc(a.name)}</button>${gap > 2 * MIN && gap < 18 * HOUR ? `<button type="button" class="btn" data-act="fill" data-s="${l.e}" data-e="now">Log the gap</button>` : ''}</div>
  </section>`;
}
function vSwitcher(now, agg) {
  const list = ACTS.filter(a => !a.archived);
  const study = list.filter(a => a.kind === 'study'), life = list.filter(a => a.kind !== 'study');
  const order = study.concat(life);
  const keyOf = id => { const i = order.findIndex(a => a.id === id); return i >= 0 && i < 9 ? String(i + 1) : ''; };
  const tot = id => agg.acts[id] || 0;
  const runId = CUR && CUR.activity;
  const l = lastEntry();
  const fromOpts = [['now', 'Starting now'], ['5', '5 min ago'], ['10', '10 min ago'], ['15', '15 min ago'], ['30', '30 min ago']];
  if (!CUR && l && now - l.e > MIN && now - l.e < 12 * HOUR) fromOpts.push(['gap', 'From ' + fmtT(l.e) + ' (last stop)']);
  if (!fromOpts.some(o => o[0] === UI.from)) UI.from = 'now';
  const presets = Object.keys(PRESETS).map(p => [p, p]);
  const cp = presetLabel(CFG.pomodoro);
  if (!PRESETS[cp]) presets.push(['custom', cp]);
  const studyBtns = study.map(a => {
    const k = keyOf(a.id), t = tot(a.id);
    return `<button type="button" class="act ${a.id === runId ? 'on' : ''}" style="--c:${a.color}" data-act="start" data-id="${esc(a.id)}" aria-pressed="${a.id === runId ? 'true' : 'false'}"><span class="act-name">${esc(a.name)}</span><span class="act-meta"><span class="num">${t ? fmtDur(t) + ' today' : ''}</span>${k ? `<span class="kbd">${k}</span>` : ''}</span></button>`;
  }).join('');
  const lifeBtns = life.map(a => {
    const k = keyOf(a.id), t = tot(a.id);
    return `<button type="button" class="pill ${a.id === runId ? 'on' : ''}" style="--c:${a.color}" data-act="start" data-id="${esc(a.id)}" aria-pressed="${a.id === runId ? 'true' : 'false'}"><i class="dot"></i>${esc(a.name)}${t ? `<span class="num">${fmtDur(t)}</span>` : ''}${k ? `<span class="kbd">${k}</span>` : ''}</button>`;
  }).join('');
  return `<section class="sec" aria-labelledby="sw-h">
    <div class="sec-head"><h2 id="sw-h">${CUR ? 'Switch to' : 'Start'}</h2>
      <div class="sw-opts">
        <button type="button" class="toggle ${pomoShown() ? 'on' : ''}" data-act="pomo-toggle" aria-pressed="${pomoShown()}"><span class="sw"></span>Pomodoro</button>
        <select class="sel sm" id="pomo-preset" data-change="pomo-preset" data-value="${esc(UI.pomoPreset)}" aria-label="Pomodoro focus and break minutes">${presets.map(([v, t]) => `<option value="${v}"${v === UI.pomoPreset ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <select class="sel sm" id="start-from" data-change="start-from" data-value="${esc(UI.from)}" aria-label="When the next activity started">${fromOpts.map(([v, t]) => `<option value="${v}"${v === UI.from ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </div></div>
    ${study.length ? `<div class="sw-study">${studyBtns}</div>` : ''}
    ${life.length ? `<div class="sw-life">${lifeBtns}</div>` : ''}
  </section>`;
}



/* T1 — minimalist Today view; dedicated actions retain existing write contracts. */
function t1Picks(){
  const visible=ACTS.filter(a=>!a.archived);
  return visible.filter(a=>a.today===true||((a.today===undefined)&&(a.kind==='study'||a.role==='break'||a.role==='sleep')));
}
function t1ActivityButton(a,klass){
  const running=!!(CUR&&CUR.activity===a.id);
  return '<button type="button" class="'+klass+'" data-act="t2-start" data-long="t2-start-opts" data-id="'+esc(a.id)+
    '" aria-pressed="'+running+'" aria-label="Start '+esc(a.name)+'">'+
    '<i class="t1-dot" style="--c:'+kSafeColour(a.color)+'" aria-hidden="true"></i><span>'+esc(a.name)+'</span></button>';
}
function t1Timer(now,pm){
  const c=CUR;
  if(!c){
    const last=lastEntry(),recent=last&&last.e&&last.e<=now&&now-last.e<3*HOUR&&isStudyId(last.a);
    const pending=UI.lastRate&&UI.lastRate.id&&UI.lastRate.day;
    if(pending&&(!UI.t1RateShown||UI.t1RateShown.id!==UI.lastRate.id)){
      UI.t1RateShown={id:UI.lastRate.id,until:now+60*1000};
      if(typeof setTimeout==='function')setTimeout(()=>{if(UI.t1RateShown&&Date.now()>=UI.t1RateShown.until){UI.lastRate=null;UI.t1RateShown=null;render();}},60050);
    }
    const asking=pending&&UI.t1RateShown&&UI.t1RateShown.until>now;
    const rating=asking?'<div class="t1-rating"><span>Focus?</span>'+[
      [1,'Scattered'],[2,'Okay'],[3,'Deep']].map(([value,label])=>
      kIconBtn('rate'+value,label,'data-act="t1-rate" data-v="'+value+'"')).join('')+'</div>':'';
    const done=UI.t1RateDoneUntil>now?'<div class="t1-rated" role="status">'+icon('check')+'</div>':'';
    return '<section class="t1-timer t1-idle" aria-label="Timer">'+
      (rating||done||'<div class="t1-idle-label">Not tracking</div>')+
      (!rating&&recent?kBtn('Resume '+act(last.a).name,'data-act="resume"',{kind:'primary',icon:'start'}):'')+'</section>';
  }
  const a=act(c.activity),start=parseT(c.start),ps=pomoState(now),g=guardInfo(now);
  const isBreak=a.role==='break',isDue=!!(ps&&ps.left<=0),focusDue=!!(ps&&ps.phase==='focus'&&isDue);
  const time=ps?'<div class="t1-clock'+(isDue?' t1-clock-due':'')+'" data-tk="cd" data-to="'+ps.end+'">'+fmtClock(ps.left)+'</div>':
    '<div class="t1-clock" data-tk="elh" data-s="'+start+'">'+fmtClock(now-start,true)+'</div>';
  const progress=ps?'<div class="t1-progress" role="progressbar" aria-label="Pomodoro progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+
    Math.round(clamp((now-ps.ps)/ps.len,0,1)*100)+'"><span data-tk="bar" data-s="'+ps.ps+'" data-len="'+ps.len+'" style="width:'+
    (100*clamp((now-ps.ps)/ps.len,0,1))+'%"></span></div>':'';
  let status='';
  if(g)status='<span class="t1-warning">'+icon('warn')+' Running '+fmtDur(g.ran)+'</span>';
  else if(focusDue)status='<span class="t1-accent">'+icon('pomodoro')+' Break time</span>';
  else if(ps&&ps.phase==='break')status=isDue?"Break's over":'Back to '+esc(c.ret&&c.ret.activity?act(c.ret.activity).name:'study');
  else if(ps)status='Focus '+ps.cycle+(ps.every?' of '+ps.every:'')+' · '+fmtDur(Math.max(0,ps.left))+' left';
  const block=pm&&c.block&&pm.rows?pm.rows.find(r=>r.id===c.block):null;
  const note=(c.note||'').trim()||(block&&block.title)||'';
  const extra=note?'<div class="t1-note">'+esc(note)+'</div>':'';
  let buttons='';
  if(g)buttons=kBtn('Still going','data-act="guard-keep"',{kind:'primary'})+kBtn('Fix stop','data-act="t1-fixstop"',{kind:'tonal'});
  else if(isBreak){
    buttons=kBtn('Resume','data-act="back"',{kind:'primary',icon:'start'})+kBtn('Stop','data-act="stop"',{kind:'tonal',icon:'stop'});
  }else if(focusDue)buttons=kBtn('Break','data-act="break"',{kind:'primary',icon:'break'})+kBtn('Stop','data-act="stop"',{kind:'tonal',icon:'stop'});
  else buttons=kBtn('Stop','data-act="stop"',{kind:'primary',icon:'stop'})+kBtn('Break','data-act="break"',{kind:'tonal',icon:'break'});
  return '<section class="t1-timer" aria-label="Timer">'+
    '<header class="t1-timer-head"><span class="t1-current"><i class="t1-dot" style="--c:'+kSafeColour(a.color)+'"></i>'+esc(a.name)+'</span>'+
    '<span class="t1-timer-tools">'+kIconBtn('edit','Edit running entry','data-act="edit-running"')+
    kIconBtn('focus','Focus mode','data-act="desk"')+'</span></header>'+
    extra+time+(status?'<p class="t1-status">'+status+'</p>':'')+progress+
    '<div class="t1-actions">'+buttons+'</div></section>';
}
function t1Notice(){
  if(!CUR||act(CUR.activity).kind!=='study')return '';
  const active=noticeOpen(),returning=UI.back&&UI.back.until>Date.now();
  const chips=active?'<div class="t1-drift">'+[1,5,15].map(m=>
    '<button type="button" class="t1-drift-btn" data-act="notice-drift" data-m="'+m+'">'+m+'m</button>').join('')+
    kIconBtn('bookmark','Park a thought','data-act="t1-park"')+'</div>':'';
  return '<div class="t1-notice">'+kBtn('Noticed','data-act="notice"',{kind:'text',icon:'urge'})+chips+
    (returning?'<span class="t1-back">Back to: '+esc(UI.back.text)+'</span>':'')+'</div>';
}
function t1Next(pm,k,now){
  const rows=pm&&pm.rows?pm.rows.filter(r=>r.remaining>0&&!['done','skipped','moved'].includes(r.st)):[];
  rows.sort((a,b)=>(a.pieces&&a.pieces.length?a.pieces[0][0]:Infinity)-
    (b.pieces&&b.pieces.length?b.pieces[0][0]:Infinity));
  const next=rows.slice(0,3).map(r=>{
    const a=act(r.activity),at=r.pieces&&r.pieces.length?r.pieces[0][0]:null;
    return '<button type="button" class="t1-next-row" data-act="t1-plan-focus" data-k="'+esc(k)+'" data-id="'+esc(r.id)+'">'+
      '<span class="t1-next-main"><i class="t1-dot" style="--c:'+kSafeColour(a.color)+'"></i><span>'+
      esc(a.name)+(r.title?' · '+esc(r.title):'')+'</span></span>'+
      (r.at?icon('pin'):'')+'<time>'+esc(at!=null?fmtT(at):'')+'</time></button>';
  }).join('');
  const over=pm&&pm.over>0?'<div class="t1-over"><span>'+icon('warn')+' '+fmtDur(pm.over)+" won't fit"+'</span>'+
    kBtn('Fix','data-act="t1-fit"',{kind:'text'})+'</div>':'';
  return next||over?'<section class="t1-next">'+(next?'<h2 class="t1-label">Next</h2>'+next:'')+over+'</section>':'';
}
function t1Today(){
  const now=Date.now(),k=todayKey();
  const agg=aggregate(ENTRIES,now,k,k)[k]||{study:0,acts:{}};
  const head='<header class="t1-day-head"><span>'+esc(stampText(k))+'</span>'+
    '<button type="button" class="t1-log-link" data-act="t1-log" aria-label="Open today log">'+
    esc(fmtDur(agg.study))+icon('open')+'</button></header>';
  if(!S.loaded.activities)return '<div class="t1-today">'+head+kEmpty('Opening…')+'</div>';
  if(w1NeedsSetup())return w1FirstRun();
  const pm=planModelFor(k,now);
  const picks=t1Picks(),grid=!CUR?ACTS.filter(a=>!a.archived&&a.kind==='study').map(a=>t1ActivityButton(a,'t1-tile')).join(''):'';
  const chips=picks.filter(a=>!CUR||a.id!==CUR.activity).map(a=>t1ActivityButton(a,'t1-chip')).join('');
  const more=kIconBtn('more','All activities','data-act="t1-activities"');
  const parked=CUR&&act(CUR.activity).role==='break'?parkedItems(k):[];
  return '<div class="t1-today">'+head+vSyncLine()+t1Timer(now,pm)+
    (CUR?t1Notice():'')+
    (grid?'<div class="t1-tiles">'+grid+'</div>':'')+
    t1Next(pm,k,now)+
    (parked.length?'<button type="button" class="t1-parked" data-act="t1-parked">'+icon('bookmark')+
      parked.length+' parked '+icon('open')+'</button>':'')+
    '<div class="t1-switch">'+chips+more+'</div></div>';
}
Object.assign(ACT,{
  't1-log'(){pushPage('log',{k:todayKey()});},
  't1-rate'(el){
    const rate=UI.lastRate,value=Number(el.getAttribute('data-v'));
    if(!rate||![1,2,3].includes(value)||!rate.day||!rate.id)return;
    const w=W();w.day(rate.day,{[rate.id]:{focus:value}});
    UI.lastRate=null;UI.t1RateShown=null;UI.t1RateDoneUntil=Date.now()+1000;
    commit(null,w,{undo:false});
    if(typeof setTimeout==='function')setTimeout(()=>{UI.t1RateDoneUntil=0;render();},1050);
  },
  't1-plan-focus'(el){planFocus(el.getAttribute('data-k'),el.getAttribute('data-id'));},
  't1-fit'(){openSheet({type:'fit',k:todayKey()});},
  't1-activities'(){openSheet({type:'activities'});},
  't1-park'(){openSheet({type:'park'});},
  't1-parked'(){openSheet({type:'parked',k:todayKey()});},
  't1-fixstop'(){
    if(!CUR)return;
    const start=parseT(CUR.start),now=Date.now();
    UI.guardTime=msToHm(Math.min(now,start+60*MIN));
    openSheet({type:'fixstop'});
  }
});

VIEWS.today = t1Today;
