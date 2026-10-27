/* ---------- views: plan ---------- */
function planDisplayRows(pm) {
  const done = pm.rows.filter(r => !(r.remaining > 0));
  const live = pm.rows.filter(r => r.remaining > 0);
  const time = r => r.st === 'active' ? -Infinity : r.pieces.length ? r.pieces[0][0] : Infinity;
  live.sort((a, b) => (time(a) - time(b)) || (a.order - b.order) || a.id.localeCompare(b.id));
  return done.concat(live);
}
function vPlan(k, pm, now) {
  const plan = V.plans[k], tk = todayKey();
  const isToday = k === tk, isPast = k < tk, editable = !isPast;
  const tools = [];
  if (editable) {
    if (!isToday) tools.push(`<label class="lbl" for="plan-start">from</label><input type="time" class="inp sm" id="plan-start" data-change="plan-start" value="${esc((plan && plan.start) || CFG.planStart)}">`);
    tools.push(`<label class="lbl" for="plan-end">until</label><input type="time" class="inp sm" id="plan-end" data-change="plan-end" value="${esc((plan && plan.end) || CFG.planEnd)}">`);
    tools.push(`<button type="button" class="icon-btn" data-act="cal-open" data-k="${k}" aria-label="Open this day in the calendar" title="Open in calendar">${icon('cal')}</button>`);
    if (pm && pm.rows.length) tools.push(`<button type="button" class="icon-btn" data-act="plan-menu" aria-label="Plan options" aria-expanded="${UI.planMenu}">${icon('dots')}</button>`);
  }
  const parts = [];
  if (UI.planMenu && editable && pm && pm.rows.length) {
    parts.push(`<div class="p-menu">
      ${pm.over > 0 ? `<button type="button" class="btn sm" data-act="plan-shrink">${icon('shrink')}Shrink to fit</button><button type="button" class="btn sm" data-act="plan-overflow">${icon('next')}Move overflow to tomorrow</button>` : ''}
      ${isToday ? `<button type="button" class="btn sm" data-act="plan-wrap">Wrap up the day</button>` : ''}
      <button type="button" class="btn sm" data-act="plan-copy" data-k="${k}">${icon('copy')}Copy to the next day</button>
      <button type="button" class="btn sm danger ${UI.clearArmed ? 'armed' : ''}" data-act="plan-clear">${UI.clearArmed ? 'Tap again to clear' : 'Clear plan'}</button>
    </div>`);
  }
  if (plan && plan.note) parts.push(`<div class="p-note"><span class="lbl">${plan.source === 'claude' ? 'From Claude' : 'Note'}</span><p>${esc(plan.note)}</p></div>`);
  if (isToday) parts.push(vCarry(k));
  if (!isPast) { const bz = busyOf(k); if (bz.length) parts.push(`<p class="p-sum"><span>Busy: ${bz.map(b => `<span class="busy-it"><b>${esc(b.title)}</b> <span class="num">${fmtT(b.s)}–${fmtT(b.e)}</span></span>`).join(' · ')}</span></p>`); }
  if (pm && pm.rows.length) {
    const prog = pm.rows.filter(r => r.st !== 'skipped' && r.target > 0).map(r => {
      const a = act(r.activity);
      const dw = Math.min(r.done, r.target) / Math.max(pm.planned, 1) * 100, rw = Math.max(0, r.target - r.done) / Math.max(pm.planned, 1) * 100;
      return `<i style="width:${dw.toFixed(2)}%;background:${a.color}"></i><i style="width:${rw.toFixed(2)}%;background:transparent"></i>`;
    }).join('');
    const sum = [`<span>planned <b class="num">${fmtDur(pm.planned)}</b></span>`, `<span>done <b class="num">${fmtDur(pm.done)}</b></span>`];
    if (!isPast) sum.push(`<span>left <b class="num">${fmtDur(pm.remaining)}</b></span>`);
    if (!isPast && pm.finish) sum.push(`<span>finish ≈ <b class="num">${fmtT(pm.finish)}</b></span>`);
    if (pm.orig && Math.abs(pm.orig - pm.planned) >= 5 * MIN) sum.push(`<span class="muted">first planned ${fmtDur(pm.orig)}</span>`);
    parts.push(`<div class="p-prog" role="img" aria-label="${Math.round(pm.done / Math.max(pm.planned, 1) * 100)}% of planned time done">${prog}</div><p class="p-sum">${sum.join('')}</p>`);
    parts.push(`<ol class="blocks">${planDisplayRows(pm).map(r => vBlk(r, k, pm, editable)).join('')}</ol>`);
    if (editable && pm.over > 0) {
      const ext = roundUpMs(pm.finish, 15 * MIN);
      parts.push(`<div class="banner warn"><p><b>${fmtDur(pm.over)} won’t fit before ${fmtT(pm.endMs)}.</b> At this pace you finish around ${fmtT(pm.finish)}.</p><div class="row"><button type="button" class="btn sm" data-act="plan-shrink">${icon('shrink')}Shrink to fit</button><button type="button" class="btn sm" data-act="plan-overflow">${icon('next')}Move overflow to ${k === tk ? 'tomorrow' : 'the next day'}</button><button type="button" class="btn sm ghost" data-act="plan-extend" data-t="${msToHm(ext)}">Work until ${fmtT(ext)}</button></div></div>`);
    }
  } else if (editable) {
    parts.push(`<div class="empty"><p>${isToday ? 'No plan for today yet.' : 'Nothing planned for this day yet.'} Add blocks below, or ask Claude in chat. It reads this log first, so the plan fits what you actually did.</p><div class="ask"><code>${isToday ? 'Plan my day in Carrel' : 'Plan ' + (k === addDaysKey(tk, 1) ? 'tomorrow' : esc(shortDay(k))) + ' in Carrel'}</code><button type="button" class="btn sm" data-act="copy" data-text="${isToday ? 'Plan my day in Carrel' : 'Plan ' + (k === addDaysKey(tk, 1) ? 'tomorrow' : esc(shortDay(k))) + ' in Carrel'}">${icon('copy')}Copy</button></div></div>`);
  } else {
    parts.push(`<p class="muted" style="font-size:14px">No plan was made for this day.</p>`);
  }
  if (pm) {
    const un = Object.entries(pm.unplanned).filter(([id, ms]) => isStudyId(id) && ms >= 5 * MIN).sort((a, b) => b[1] - a[1]);
    if (un.length && pm.rows.length) parts.push(`<p class="p-sum"><span>Unplanned study: ${un.map(([id, ms]) => `${esc(act(id).name)} <b class="num">${fmtDur(ms)}</b>`).join(', ')}</span></p>`);
  }
  if (editable) parts.push(UI.addBlk ? vAddBlock(k) : `<div class="row"><button type="button" class="btn sm" data-act="addblk-open">${icon('plus')}Add a block</button>${isToday && pm && pm.rows.length && !(plan && plan.closed) ? `<button type="button" class="btn sm ghost" data-act="plan-wrap">Wrap up the day</button>` : ''}</div>`);
  return `<section class="sec" aria-labelledby="plan-h"><div class="sec-head"><h2 id="plan-h">Plan${!isToday ? ` <small>${isPast ? 'as it ended' : 'ahead'}</small>` : ''}</h2>${tools.length ? `<div class="sec-tools">${tools.join('')}</div>` : ''}</div>${parts.join('')}</section>`;
}
function vCarry(tk) {
  const yk = addDaysKey(tk, -1), yp = V.plans[yk];
  if (!yp || yp.closed) return '';
  const ym = planModelFor(yk);
  if (!ym) return '';
  const left = ym.rows.filter(r => (r.st === 'open' || r.st === 'partial') && r.remaining >= 10 * MIN);
  const tot = left.reduce((s, r) => s + r.remaining, 0);
  if (!left.length || tot < 15 * MIN) return '';
  return `<div class="banner warn"><p><b>Yesterday’s plan left ${fmtDur(tot)} unfinished</b> (${left.map(r => esc(act(r.activity).name)).join(', ')}).</p><div class="row"><button type="button" class="btn sm lamp" data-act="carry-y">Add it to today</button><button type="button" class="btn sm ghost" data-act="carry-n">Let it go</button></div></div>`;
}
function vBlk(r, k, pm, editable) {
  const a = act(r.activity), open = editable && UI.openBlk === r.id;
  let time = '–';
  if (r.st === 'done') time = icon('check');
  else if (r.st === 'skipped') time = '<small>skipped</small>';
  else if (r.st === 'moved') time = '<small>moved</small>';
  else if (r.missed) time = `${fmtHM(r.at)}<small>missed</small>`;
  else if (r.pieces.length) time = `${fmtT(r.pieces[0][0])}<small>${r.st === 'active' ? 'now' : r.at && !r.late ? 'fixed' : r.late ? 'late' : '→ ' + fmtT(r.pieces[r.pieces.length - 1][1])}</small>`;
  else if (r.st === 'active') time = '<small>now</small>';
  else if (r.at) time = fmtHM(r.at);
  const pct = r.target ? Math.min(100, r.done / r.target * 100) : 0;
  const tags = [];
  if (r.st === 'active') tags.push('<span class="tag live">now</span>');
  if (r.over > 0) tags.push(`<span class="tag warn">${fmtDur(r.over)} over</span>`);
  if (r.clash) {
    const overlap = busyOf(k).find(b => r.pieces.some(([s, e]) => b.s < e && b.e > s));
    const explanation = overlap ? 'Clashes with ' + overlap.title : 'Clashes with busy time';
    tags.push(`<span class="tag warn" title="${esc(explanation)}">${esc(explanation)}</span>`);
  }
  if (r.from) tags.push('<span class="tag brass">carried</span>');
  if (r.pomo) {
    const preset = parsePreset(r.pomo);
    const label = preset ? preset.focus + '-minute focus, ' + preset.short + '-minute breaks' : 'Pomodoro preset';
    tags.push(`<span class="tag" title="${esc(label)}" aria-label="${esc(label)}">${esc(r.pomo)} pomo</span>`);
  }
  const live = r.st === 'open' || r.st === 'partial';
  const go = editable && live && pm.isToday ? `<button type="button" class="icon-btn blk-go" data-act="blk-start" data-id="${r.id}" aria-label="Start ${esc(a.name)} now">${icon('play')}</button>` : '';
  let acts = '';
  if (open) {
    const b = [];
    if (pm.isToday && (live || r.st === 'done')) b.push(`<button type="button" class="btn sm lamp" data-act="blk-start" data-id="${r.id}">${icon('play')}Start</button>`);
    b.push(`<button type="button" class="btn sm" data-act="blk-min" data-id="${r.id}" data-d="-15">−15m</button><button type="button" class="btn sm" data-act="blk-min" data-id="${r.id}" data-d="15">+15m</button>`);
    if (!r.at && r.remaining > 0) b.push(`<button type="button" class="btn sm" data-act="blk-move" data-id="${r.id}" data-d="-1" aria-label="Move up">${icon('up')}</button><button type="button" class="btn sm" data-act="blk-move" data-id="${r.id}" data-d="1" aria-label="Move down">${icon('down')}</button>`);
    if (live) b.push(`<button type="button" class="btn sm" data-act="blk-status" data-id="${r.id}" data-s="done">${icon('check')}Done</button><button type="button" class="btn sm" data-act="blk-status" data-id="${r.id}" data-s="skipped">${icon('skip')}Skip</button><button type="button" class="btn sm" data-act="blk-tomorrow" data-id="${r.id}">${icon('next')}Next day</button>`);
    else b.push(`<button type="button" class="btn sm" data-act="blk-status" data-id="${r.id}" data-s="open">Reopen</button>`);
    if (r.missed) b.push(`<button type="button" class="btn sm" data-act="blk-unfix" data-id="${r.id}">Do it later today</button>`);
    b.push(`<button type="button" class="btn sm ghost" data-act="blk-edit" data-id="${r.id}">${icon('edit')}Edit</button><button type="button" class="btn sm ghost" data-act="blk-del" data-id="${r.id}" aria-label="Delete block">${icon('trash')}</button>`);
    acts = `<div class="blk-acts">${b.join('')}</div>`;
  }
  return `<li class="blk st-${r.st} ${r.over > 0 ? 'over' : ''} ${r.missed ? 'missed' : ''}" style="--c:${a.color}" data-key="${r.id}">
    <div class="blk-row"><button type="button" class="blk-main" ${editable ? `data-act="blk-toggle" data-id="${r.id}" aria-expanded="${open}"` : 'disabled'}>
      <span class="blk-time">${time}</span>
      <span class="blk-body"><span class="blk-name"><i class="dot"></i><span class="nm">${esc(a.name)}</span>${tags.length ? `<span class="blk-tags">${tags.join('')}</span>` : ''}</span>${r.title ? `<span class="blk-title">${esc(r.title)}</span>` : ''}<span class="blk-bar"><i style="width:${pct.toFixed(1)}%"></i></span></span>
      <span class="blk-dur">${fmtDur(Math.min(r.done, r.target))}<small>of ${fmtDur(r.target)}</small></span>
    </button>${go}</div>${acts}</li>`;
}
function vAddBlock(k) {
  const ab = UI.ab;
  const opts = ACTS.filter(a => !a.archived);
  if (!ACTMAP[ab.activity]) { const s = opts.find(a => a.kind === 'study') || opts[0]; ab.activity = s ? s.id : ''; }
  return `<form class="addblk" data-submit="blk-add" data-k="${k}">
    <div class="g2"><label class="field"><span>Activity</span><select class="sel" id="ab-act" data-bind="ab.activity" data-value="${esc(ab.activity)}">${opts.map(a => `<option value="${esc(a.id)}"${a.id === ab.activity ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Minutes</span><input type="number" class="inp" id="ab-min" min="5" max="720" step="5" data-bind="ab.minutes" value="${esc(ab.minutes)}"></label></div>
    <div class="chips">${[25, 45, 50, 60, 90, 120].map(m => `<button type="button" class="chip-btn ${+ab.minutes === m ? 'on' : ''}" data-act="ab-min" data-m="${m}">${fmtDur(m * MIN)}</button>`).join('')}</div>
    <label class="field"><span>What exactly (optional)</span><input class="inp" id="ab-title" maxlength="80" data-bind="ab.title" value="${esc(ab.title)}" placeholder="e.g. Chapter 6 problems" autocomplete="off"></label>
    <div class="g2"><label class="field"><span>Fixed start (optional)</span><input type="time" class="inp" id="ab-at" data-bind="ab.at" value="${esc(ab.at)}"></label>
    <label class="field"><span>Pomodoro</span><select class="sel" id="ab-pomo" data-bind="ab.pomo" data-value="${esc(ab.pomo)}"><option value=""${!ab.pomo ? ' selected' : ''}>Use my switch</option>${Object.keys(PRESETS).map(p => `<option value="${p}"${ab.pomo === p ? ' selected' : ''}>${p}</option>`).join('')}</select></label></div>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn sm ghost" data-act="addblk-close">Cancel</button><button type="submit" class="btn sm lamp">${icon('plus')}Add block</button></div>
  </form>`;
}


VIEWS.plan = () => vCalendar();
