function sBlock(sh) {
  const b = sh.b, tk = todayKey();
  const pm = planModelFor(sh.k);
  const r = pm && pm.rows.find(x => x.id === sh.id);
  const live = r && (r.st === 'open' || r.st === 'partial');
  const info = r ? `<p class="note-line">${fmtDur(Math.min(r.done, r.target))} of ${fmtDur(r.target)} done${r.pieces.length ? ' · next ' + fmtT(r.pieces[0][0]) + '–' + fmtT(r.pieces[r.pieces.length - 1][1]) : ''}${r.clash ? ' · overlaps something else' : ''}</p>` : '';
  return `<div class="sh-head"><h2 id="sh-title">Plan block</h2><button type="button" class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('x')}</button></div>
    ${info}
    ${actPick(b.activity, 'b.activity')}
    <label class="field"><span>What exactly</span><input class="inp" id="b-title" maxlength="80" data-bind="b.title" value="${esc(b.title)}" autocomplete="off" placeholder="e.g. Chapter 6 problems"></label>
    <div class="g2"><label class="field"><span>Day</span><input type="date" class="inp" id="b-day" data-bind="b.day" value="${esc(b.day)}" min="${tk}"></label>
    <label class="field"><span>Minutes</span><input type="number" class="inp" id="b-min" min="5" max="720" step="5" data-bind="b.minutes" value="${esc(b.minutes)}"></label></div>
    <div class="g2"><label class="field"><span>Pinned start (empty fits it in automatically)</span><input type="time" class="inp" id="b-at" data-bind="b.at" value="${esc(b.at || '')}"></label>
    <label class="field"><span>Pomodoro</span><select class="sel" id="b-pomo" data-bind="b.pomo" data-value="${esc(b.pomo || '')}"><option value=""${!b.pomo ? ' selected' : ''}>Use my switch</option>${Object.keys(PRESETS).map(p => `<option value="${p}"${b.pomo === p ? ' selected' : ''}>${p}</option>`).join('')}</select></label></div>
    <div class="row">${sh.k === tk && live ? `<button type="button" class="btn sm lamp" data-act="block-start">${icon('play')}Start now</button>` : ''}<button type="button" class="btn sm" data-act="block-dup">${icon('copy')}Duplicate</button><button type="button" class="btn sm" data-act="block-back">${icon('inbox')}Back to backlog</button><button type="button" class="btn sm danger ${sh.armed ? 'armed' : ''}" data-act="block-del">${icon('trash')}${sh.armed ? 'Tap again to delete' : 'Delete'}</button></div>
    ${sh.err ? `<p class="err" role="alert">${esc(sh.err)}</p>` : ''}
    <div class="sh-foot"><button type="button" class="btn ghost" data-act="sheet-close">Cancel</button><button type="button" class="btn lamp" data-act="block-save">Save block</button></div>`;
}
function sWrap(sh) {
  const pm = planModelFor(sh.k);
  const left = pm ? pm.rows.filter(r => r.remaining > 0) : [];
  const done = pm ? pm.done : 0, planned = pm ? pm.planned : 0;
  const agg = aggregate(ENTRIES, Date.now(), sh.k, sh.k)[sh.k] || { study: 0 };
  return `<div class="sh-head"><h2 id="sh-title">Wrap up the day</h2><button type="button" class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('x')}</button></div>
    <p class="note-line">You studied <b>${fmtDur(agg.study)}</b> today${planned ? ` and finished <b>${fmtDur(done)}</b> of <b>${fmtDur(planned)}</b> planned (${Math.round(done / planned * 100)}%)` : ''}.</p>
    ${left.length ? `<div class="field"><span>Carry to tomorrow</span>${left.map(r => `<label class="check"><input type="checkbox" data-act="wrap-pick" data-id="${r.id}" ${sh.pick[r.id] ? 'checked' : ''}> ${esc(act(r.activity).name)}${r.title ? ' · ' + esc(r.title) : ''} <span class="num">(${fmtDur(r.remaining)} left)</span></label>`).join('')}</div>` : '<p class="note-line">Nothing is left in the plan.</p>'}
    ${CUR ? `<label class="check"><input type="checkbox" data-act="wrap-stop" ${sh.stop ? 'checked' : ''}> Stop the ${esc(act(CUR.activity).name)} timer now</label>` : ''}
    <div class="sh-foot"><button type="button" class="btn ghost" data-act="sheet-close">Cancel</button><button type="button" class="btn lamp" data-act="wrap-save">Wrap up</button></div>`;
}

function wdChips(sel) {
  const ws = +CFG.weekStart || 0;
  return `<div class="wdays" role="group" aria-label="Repeat on">${[0, 1, 2, 3, 4, 5, 6].map(i => { const wd = (ws + i) % 7, on = sel.indexOf(wd) >= 0; return `<button type="button" class="${on ? 'on' : ''}" data-act="q-day" data-d="${wd}" aria-pressed="${on}">${esc(wdName(new Date(2026, 0, 4 + wd)).slice(0, 2))}</button>`; }).join('')}</div>`;
}
function actSelect(id, bind, val, none) {
  return `<select class="sel" id="${id}" data-bind="${bind}" data-value="${esc(val || '')}">${none ? `<option value=""${!val ? ' selected' : ''}>None</option>` : ''}${ACTS.filter(a => !a.archived || a.id === val).map(a => `<option value="${esc(a.id)}"${a.id === val ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`;
}
const errLine = sh => sh.err ? `<p class="err" role="alert">${esc(sh.err)}</p>` : '';
const closeBtn = `<button type="button" class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('x')}</button>`;
function openQnew(k, s, e, tab, days) {
  openSheet({ type: 'qnew', tab: tab || 'block', k, start: msToHm(s), end: msToHm(e), minutes: Math.max(5, Math.round((e - s) / MIN)), activity: ACTMAP[UI.ab.activity] ? UI.ab.activity : firstStudyId(), title: '', pin: true, pomo: '', btitle: '', days: days || [], bact: '', err: '' });
}

function sQnew(sh) {
  const tabs = `<div class="seg" role="tablist" aria-label="Kind"><button type="button" role="tab" aria-selected="${sh.tab === 'block'}" class="${sh.tab === 'block' ? 'on' : ''}" data-act="q-tab" data-v="block">Plan a block</button><button type="button" role="tab" aria-selected="${sh.tab === 'busy'}" class="${sh.tab === 'busy' ? 'on' : ''}" data-act="q-tab" data-v="busy">Busy time</button></div>`;
  let body;
  if (sh.tab === 'block') {
    body = `${actPick(sh.activity, 'sheet.activity')}
      <label class="field"><span>What exactly (optional)</span><input class="inp" id="q-title" maxlength="80" data-bind="sheet.title" value="${esc(sh.title)}" placeholder="e.g. Chapter 6 problems" autocomplete="off"></label>
      <div class="g3"><label class="field"><span>Start</span><input type="time" class="inp" id="q-start" data-bind="sheet.start" value="${esc(sh.start)}"></label><label class="field"><span>Minutes</span><input type="number" class="inp" id="q-min" min="5" max="720" step="5" data-bind="sheet.minutes" value="${esc(sh.minutes)}"></label>
      <label class="field"><span>Pomodoro</span><select class="sel" id="q-pomo" data-bind="sheet.pomo" data-value="${esc(sh.pomo)}"><option value=""${!sh.pomo ? ' selected' : ''}>Use my switch</option>${Object.keys(PRESETS).map(p => `<option value="${p}"${sh.pomo === p ? ' selected' : ''}>${p}</option>`).join('')}</select></label></div>
      <div class="chips">${[25, 50, 60, 90, 120].map(m => `<button type="button" class="chip-btn ${+sh.minutes === m ? 'on' : ''}" data-act="q-min" data-m="${m}">${fmtDur(m * MIN)}</button>`).join('')}</div>
      <label class="check"><input type="checkbox" id="q-pin" data-bind="sheet.pin" ${sh.pin ? 'checked' : ''}> Keep it at this time. Untick to let Carrel fit it into free time.</label>`;
  } else {
    body = `<label class="field"><span>What is it</span><input class="inp" id="q-btitle" maxlength="60" data-bind="sheet.btitle" value="${esc(sh.btitle)}" placeholder="e.g. Lecture, lab, tuition, doctor" autocomplete="off"></label>
      <div class="g2"><label class="field"><span>Start</span><input type="time" class="inp" id="q-bstart" data-bind="sheet.start" value="${esc(sh.start)}"></label><label class="field"><span>End</span><input type="time" class="inp" id="q-bend" data-bind="sheet.end" value="${esc(sh.end)}"></label></div>
      <div class="field"><span>Repeat every week on (leave empty for just this day)</span>${wdChips(sh.days)}</div>
      <label class="field"><span>Counts as (optional, used when you log it)</span>${actSelect('q-bact', 'sheet.bact', sh.bact, true)}</label>`;
  }
  return `<div class="sh-head"><h2 id="sh-title">${esc(longDay(sh.k))}</h2>${closeBtn}</div>${tabs}${body}${errLine(sh)}
    <div class="sh-foot"><button type="button" class="btn ghost" data-act="sheet-close">Cancel</button><button type="button" class="btn lamp" data-act="q-save">${sh.tab === 'block' ? 'Add to plan' : sh.days.length ? 'Add to timetable' : 'Add busy time'}</button></div>`;
}
const HM = /^\d{1,2}:\d{2}/;

function saveQnew() {
  const sh = UI.sheet, k = sh.k;
  sh.err = '';
  if (sh.tab === 'block') {
    const m = Math.round(+sh.minutes);
    if (!ACTMAP[sh.activity]) sh.err = 'Choose an activity.';
    else if (!(m >= 5 && m <= 720)) sh.err = 'Use between 5 and 720 minutes.';
    else if (sh.pin && !HM.test(sh.start || '')) sh.err = 'Enter a start time, or untick “Keep it at this time”.';
    if (sh.err) { renderSheet(); return; }
    const w = W();
    w.plan(k, { blocks: { [uid('b')]: blockDoc({ activity: sh.activity, title: (sh.title || '').trim(), minutes: m, order: nextOrder(k), at: sh.pin ? sh.start.slice(0, 5) : null, pomo: sh.pomo || null }) } });
    UI.ab.activity = sh.activity;
    closeSheet(true);
    commit('Planned ' + fmtDur(m * MIN) + ' of ' + act(sh.activity).name + (sh.pin ? ' at ' + fmtHM(sh.start) : '') + ' on ' + dayName(k) + '.', w);
    return;
  }
  const title = (sh.btitle || '').trim() || 'Busy';
  if (!HM.test(sh.start || '') || !HM.test(sh.end || '')) sh.err = 'Enter a start and an end time.';
  else if (sh.start.slice(0, 5) === sh.end.slice(0, 5)) sh.err = 'The end time needs to differ from the start.';
  if (sh.err) { renderSheet(); return; }
  const w = W();
  const doc = { title, start: sh.start.slice(0, 5), end: sh.end.slice(0, 5), activity: sh.bact || null };
  if (sh.days.length) w.update('planning/commitments', { items: { [uid('c')]: Object.assign(doc, { days: sh.days.slice().sort(), from: k, until: null, archived: false }) } }, { items: {} });
  else w.plan(k, { events: { [uid('v')]: doc } });
  closeSheet(true);
  commit(sh.days.length ? 'Added ' + title + ' to your weekly timetable.' : 'Added ' + title + ' on ' + dayName(k) + '.', w);
}

function openBlockSheet(k, id) {
  const b = blocksOf(k)[id];
  if (!b) return;
  openSheet({ type: 'block', k, id, armed: false, err: '', b: { activity: b.activity, title: b.title || '', minutes: b.minutes, at: b.at || '', pomo: b.pomo || '', day: k } });
}

function saveBlockSheet() {
  const sh = UI.sheet, b = sh.b, tk = todayKey(), m = Math.round(+b.minutes);
  sh.err = '';
  if (!ACTMAP[b.activity]) sh.err = 'Choose an activity.';
  else if (!(m >= 5 && m <= 720)) sh.err = 'Use between 5 and 720 minutes.';
  else if (b.at && !HM.test(b.at)) sh.err = 'Enter a start time, or leave it empty to fit it in automatically.';
  else if (b.day && !/^\d{4}-\d{2}-\d{2}$/.test(b.day)) sh.err = 'Choose a day.';
  else if (b.day && b.day !== sh.k && b.day < tk) sh.err = 'Pick today or a later day.';
  if (sh.err) { renderSheet(); return; }
  const patch = { activity: b.activity, title: (b.title || '').trim(), minutes: m, at: b.at ? b.at.slice(0, 5) : null, pomo: b.pomo || null };
  const w = W();
  if (b.day && b.day !== sh.k) {
    const r = (planModelFor(sh.k) || { rows: [] }).rows.find(x => x.id === sh.id);
    const done = r ? Math.round(r.done / MIN) : 0;
    w.plan(sh.k, { blocks: { [sh.id]: done >= 1 ? { minutes: done, status: 'done' } : null } });
    w.plan(b.day, { blocks: { [uid('b')]: blockDoc(Object.assign({}, patch, { minutes: Math.max(5, m - done), order: nextOrder(b.day) })) } });
    closeSheet(true);
    commit('Moved the block to ' + dayName(b.day) + '.', w);
    return;
  }
  w.plan(sh.k, { blocks: { [sh.id]: patch } });
  closeSheet(true);
  commit('Saved the block.', w);
}


SHEETS.block = sBlock;
SHEETS.wrap = sWrap;

SHEETS.qnew = sQnew;
