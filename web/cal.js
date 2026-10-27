/* ===== Carrel calendar and planning tools ===== */
const HPX = 52;            // pixels per hour in the calendar grid
const SNAP = 15 * MIN;     // drag and tap snapping
let suppressClickUntil = 0;

/* ---------- planning data ---------- */
function plItems(name) { const d = V.planning && V.planning[name]; return (d && d.items) || {}; }
function commitmentsMap() { return plItems('commitments'); }
function backlogMap() { return plItems('backlog'); }
function deadlinesMap() { return plItems('deadlines'); }
function busyOf(k) {
  const g = gcFor(k).map(x => ({ id: 'g_' + x.id, rec: false, gcal: true, title: x.title, activity: null, s: x.s, e: x.e, link: x.link }));
  return busyFor(k, commitmentsMap(), V.plans[k]).concat(g).sort((a, b) => a.s - b.s);
}
function busyIv(k) { return busyOf(k).map(b => [b.s, b.e]); }
function firstStudyId() { const a = ACTS.find(x => x.kind === 'study' && !x.archived) || ACTS.find(x => !x.archived); return a ? a.id : 'study'; }
function dayName(k) { const tk = todayKey(); return k === tk ? 'today' : k === addDaysKey(tk, 1) ? 'tomorrow' : shortDay(k); }
function deadlineList() {
  return Object.entries(deadlinesMap())
    .filter(([, d]) => d && d.title && /^\d{4}-\d{2}-\d{2}$/.test(d.date || ''))
    .map(([id, d]) => ({ id, title: String(d.title), date: d.date, time: d.time || null, activity: d.activity || null, kind: d.kind || 'exam', done: !!d.done }))
    .sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')));
}
function daysUntil(k) { return Math.round((dateOfKey(k) - dateOfKey(todayKey())) / DAY); }
function countdown(k) { const n = daysUntil(k); return n < -1 ? -n + ' days ago' : n === -1 ? 'yesterday' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; }
function backlogList() {
  return Object.entries(backlogMap())
    .filter(([, t]) => t && t.title)
    .map(([id, t]) => ({ id, title: String(t.title), activity: t.activity || null, minutes: Math.max(5, Math.round(+t.minutes || 60)), due: t.due || null, prio: +t.prio || 2, order: +t.order || 0 }))
    .sort((a, b) => (a.due || '9999-12-31').localeCompare(b.due || '9999-12-31') || a.prio - b.prio || a.order - b.order);
}
function nextBacklogOrder() { let m = 0; const b = backlogMap(); for (const id in b) if (b[id]) m = Math.max(m, +b[id].order || 0); return m + 1; }

/* ---------- calendar range ---------- */
function calView() {
  // An explicit choice is persisted by cal-view and restored in UI.cal.view.
  // Only the first visit gets a responsive default.
  if (!UI.cal.view) {
    const width = window.innerWidth;
    UI.cal.view = width < 480 ? 'day' : width >= 860 ? 'week' : '3day';
  }
  return UI.cal.view;
}
function calDays() {
  const a = UI.cal.anchor || todayKey(), v = calView();
  if (v === 'day') return [a];
  if (v === '3day') return [a, addDaysKey(a, 1), addDaysKey(a, 2)];
  const ws = weekStartKey(a);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(ws, i));
}
function calTitle(days) {
  const a = dateOfKey(days[0]), b = dateOfKey(days[days.length - 1]);
  if (days.length === 1) return DF({ weekday: 'long', day: 'numeric', month: 'long' }).format(a);
  if (a.getMonth() === b.getMonth()) return DF({ month: 'long', year: 'numeric' }).format(a);
  if (a.getFullYear() === b.getFullYear()) return DF({ month: 'short' }).format(a) + ' – ' + DF({ month: 'short', year: 'numeric' }).format(b);
  return DF({ month: 'short', year: 'numeric' }).format(a) + ' – ' + DF({ month: 'short', year: 'numeric' }).format(b);
}
function calScrollTarget() {
  const days = calDays(), tk = todayKey(), now = Date.now();
  let off;
  if (days.includes(tk)) off = now - dayStartMs(tk) - 100 * MIN;
  else off = hmOnDay(days[0], CFG.planStart) - dayStartMs(days[0]) - 50 * MIN;
  return Math.max(0, off / HOUR * HPX);
}
function calShift(dir) {
  const a = UI.cal.anchor || todayKey(), v = calView();
  UI.cal.anchor = addDaysKey(a, dir * (v === 'week' ? 7 : v === '3day' ? 3 : 1));
  UI.cal.mm = null;
  render();
}
function gutLabel(h) { h = ((h % 24) + 24) % 24; return H12 ? (h % 12 || 12) + (h < 12 ? ' am' : ' pm') : pad(h) + ':00'; }
let PEAK = null;
function peakHours() {
  const key = todayKey() + '|' + ENTRIES.length;
  if (PEAK && PEAK.key === key) return PEAK.v;
  let v = null;
  try {
    const pm = patternsModel(ENTRIES, Date.now(), 4);
    if (pm.studyDays >= 5) { const mx = Math.max(...pm.colTotals); if (mx > 0) v = pm.colTotals.map(x => x / mx); }
  } catch (e) { v = null; }
  PEAK = { key, v };
  return v;
}

/* ---------- calendar view ---------- */
function vCalendar() {
  const now = Date.now(), tk = todayKey();
  calView();
  const days = calDays();
  ensureRange(addDaysKey(days[0], -1), days[days.length - 1]);
  const models = {};
  days.forEach(k => { models[k] = { pm: planModelFor(k, now), busy: busyOf(k) }; });
  const views = [['day', 'Day'], ['3day', '3 days'], ['week', 'Week']];
  const shows = [['both', 'Plan + log'], ['plan', 'Plan'], ['log', 'Log']];
  const bar = `<section class="cv-bar">
    <div class="cv-nav"><button type="button" class="icon-btn" data-act="cal-prev" aria-label="Earlier">${icon('left')}</button><button type="button" class="icon-btn" data-act="cal-next" aria-label="Later">${icon('right')}</button>${days.includes(tk) ? '' : `<button type="button" class="chip-btn" data-act="cal-today">Today</button>`}</div>
    <label class="pickwrap" title="Go to a date"><h1>${esc(calTitle(days))}</h1><input type="date" id="cal-pick" data-change="cal-pick" value="${days[0]}" aria-label="Go to a date"></label>
    <span class="grow"></span>
    <div class="seg" role="group" aria-label="Days shown">${views.map(([v, t]) => `<button type="button" class="${UI.cal.view === v ? 'on' : ''}" data-act="cal-view" data-v="${v}" aria-pressed="${UI.cal.view === v}">${t}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="What to show">${shows.map(([v, t]) => `<button type="button" class="${UI.cal.show === v ? 'on' : ''}" data-act="cal-show" data-v="${v}" aria-pressed="${UI.cal.show === v}">${t}</button>`).join('')}</div>
    <button type="button" class="btn sm lamp cv-new" data-act="cal-new">${icon('plus')}New</button>
  </section>`;
  const peak = peakHours();
  const legend = `<div class="legend cv-legend"><span><i class="lg lg-auto"></i>fits in automatically</span><span><i class="lg lg-pin"></i>pinned</span><span><i class="lg lg-busy"></i>busy</span><span><i class="lg lg-log"></i>logged</span>${GC.events.length ? '<span><i class="lg lg-busy"></i>Google Calendar (opens the event)</span>' : ''}${peak ? '<span><i class="lg lg-peak"></i>hours you usually study</span>' : ''}</div>
    <p class="cap cv-hint">Drag blocks to move or resize them (press and hold on a touch screen). Tap empty time to plan ahead, or to log something earlier.</p>`;
  return bar + `<div class="cv-layout"><div class="cv-main">${vCalGrid(days, now, tk, models, peak)}${legend}</div><aside class="cv-side" aria-label="Planning tools">${vCalSide(days, now, tk)}</aside></div>
    <button type="button" class="fab" data-act="cal-new" aria-label="Plan something new">${icon('plus')}</button>`;
}
function vCalGrid(days, now, tk, models, peak) {
  const n = days.length, ds0 = dayStartMs(days[0]);
  const labels = Array.from({ length: 24 }, (_, i) => i === 0 ? '' : `<span style="top:${i * HPX}px">${gutLabel(new Date(ds0 + i * HOUR).getHours())}</span>`).join('');
  const pk = peak ? peak.map((f, i) => f >= 0.35 ? `<i class="pk" style="top:${i * HPX + 3}px;height:${HPX - 6}px;opacity:${(0.25 + f * 0.65).toFixed(2)}"></i>` : '').join('') : '';
  const heads = days.map(k => vCalHead(k, now, tk, models[k])).join('');
  const cols = days.map(k => vCalCol(k, now, tk, models[k])).join('');
  return `<div class="cv c${n}" style="--cols:${n};--hpx:${HPX}px"><div class="cv-scroll" id="cv-scroll"><div class="cv-head"><div class="cv-corner"></div>${heads}</div><div class="cv-body" style="height:${24 * HPX}px"><div class="cv-gutter" aria-hidden="true">${pk}${labels}</div>${cols}</div></div></div>`;
}
function vCalHead(k, now, tk, m) {
  const d = dateOfKey(k), past = k < tk, today = k === tk;
  let load = '';
  if (!past) {
    const cap = dayCapacity(k, V.plans[k], m.pm, busyIv(k), now);
    if (cap && cap.need > 0) {
      const over = cap.need > cap.free;
      const pct = cap.free > 0 ? Math.min(100, cap.need / cap.free * 100) : 100;
      load = `<div class="cv-load ${over ? 'over' : ''}" title="${over ? 'Planned ' + fmtDur(cap.need - cap.free) + ' more than the free time today' : fmtDur(cap.need) + ' planned, ' + fmtDur(cap.free) + ' free in your planning hours'}"><span>${over ? fmtDur(cap.need - cap.free) + ' over' : fmtDur(cap.free - cap.need) + ' spare'}</span><span class="tr"><i style="width:${pct.toFixed(1)}%"></i></span></div>`;
    } else if (cap && cap.free > 0) load = `<div class="cv-load"><span>${fmtDur(cap.free)} free</span><span class="tr"><i style="width:0"></i></span></div>`;
  } else {
    const a = aggregate(ENTRIES, now, k, k)[k];
    load = `<div class="cv-load"><span>${a && a.study ? fmtDur(a.study) + ' studied' : 'no study'}</span></div>`;
  }
  const dls = deadlineList().filter(x => x.date === k && !x.done).map(x => `<button type="button" class="cv-dl" data-act="dl-edit" data-id="${esc(x.id)}" title="${esc(x.title)}">${icon('flag')}<span>${esc(x.title)}</span></button>`).join('');
  const gd = gcAllDay(k).map(x => `<span class="cv-gd" title="${esc(x.title)}">${icon('cal')}<span>${esc(x.title)}</span></span>`).join('');
  return `<div class="cv-dh ${today ? 'today' : ''} ${past ? 'past' : ''}" data-key="h-${k}"><button type="button" class="cv-date" data-act="goto-day" data-k="${k}" aria-label="Open ${esc(longDay(k))} in Today"><span>${esc(wdName(d))}</span><b>${d.getDate()}</b></button>${load}${dls}${gd}</div>`;
}
function vCalCol(k, now, tk, m) {
  const ds = dayStartMs(k), de = dayEndMs(k), past = k < tk, today = k === tk, show = UI.cal.show;
  const y = t => (t - ds) / HOUR * HPX;
  const planItems = [], logItems = [];
  if (show !== 'log') {
    m.busy.forEach(z => { const s = Math.max(z.s, ds), e = Math.min(z.e, de); if (e > s) planItems.push({ kind: 'busy', s, e, z }); });
    if (m.pm) m.pm.rows.forEach(r => {
      if (r.st === 'skipped' || r.st === 'moved') return;
      if (r.missed) { const a = hmOnDay(k, r.at); planItems.push({ kind: 'blk', s: a, e: a + Math.max(r.target, SNAP), r, flag: 'missed', piece: 0, last: true }); return; }
      if (past) { if (r.at) { const a = hmOnDay(k, r.at); planItems.push({ kind: 'blk', s: a, e: a + Math.max(r.target, SNAP), r, flag: 'past', piece: 0, last: true }); } return; }
      r.pieces.forEach((p, i) => { if (p[1] > p[0]) planItems.push({ kind: 'blk', s: p[0], e: p[1], r, piece: i, last: i === r.pieces.length - 1, over: p[1] > m.pm.endMs }); });
    });
  }
  if (show !== 'plan') dayEntries(k, now).forEach(en => { const s = Math.max(en.s, ds), e = Math.min(entryEnd(en, now), de); if (e > s) logItems.push({ kind: 'log', s, e, en }); });
  // plan and log share one lane: logged time sits in the past, plan pieces start from now, overlaps sit side by side
  const html = [];
  const items = layoutOverlaps(planItems.concat(logItems));
  items.forEach(it => { const w = 100 / it.ncol; html.push(calItem(it, k, y, it.col * w, w)); });
  if (today) html.push(`<div class="cv-now" style="top:${y(now).toFixed(1)}px" data-key="now"></div>`);
  return `<div class="cv-col ${past ? 'past' : ''} ${today ? 'today' : ''}" data-k="${k}" data-act="cal-slot" data-key="col-${k}">${html.join('')}</div>`;
}
function calItem(it, k, y, left, width) {
  const top = y(it.s), h = Math.max(15, y(it.e) - top - 2);
  const pos = `top:${top.toFixed(1)}px;height:${h.toFixed(1)}px;left:calc(${left.toFixed(2)}% + 2px);width:calc(${width.toFixed(2)}% - 4px)`;
  // Single-day columns can still have 3+ overlapping events; on a phone,
  // 3-day and week columns are narrow even without overlap.
  const narrow = it.ncol >= 3 || (window.innerWidth < 480 && (it.ncol >= 2 || UI.cal.view !== 'day'));
  const size = [h < 27 ? 'xs' : h < 46 ? 'sm' : '', narrow ? 'ce-narrow' : ''].filter(Boolean).join(' ');
  const span = `${fmtT(it.s)}–${fmtT(it.e)}`;
  if (it.kind === 'busy') {
    const z = it.z, c = z.activity && ACTMAP[z.activity] ? act(z.activity).color : 'var(--ink-3)';
    if (z.gcal) {
      const inner = `<span class="t">${icon('cal', 'pi')}${esc(z.title)}</span><span class="m">${span} · Google Calendar</span>`;
      return z.link ? `<a class="ce ce-busy gcal ${size}" style="${pos}" href="${esc(z.link)}" target="_blank" rel="noopener" data-key="${esc(z.id)}" aria-label="Google Calendar: ${esc(z.title)}, ${span}">${inner}</a>` : `<div class="ce ce-busy gcal ${size}" style="${pos}" data-key="${esc(z.id)}" role="img" aria-label="Google Calendar: ${esc(z.title)}, ${span}">${inner}</div>`;
    }
    return `<button type="button" class="ce ce-busy ${size}" style="${pos};--c:${c}" data-act="cal-busy" data-k="${k}" data-id="${esc(z.id)}" data-rec="${z.rec ? 1 : 0}" data-key="z-${esc(z.id)}" aria-label="Busy: ${esc(z.title)}, ${span}"><span class="t">${esc(z.title)}</span><span class="m">${span}${z.rec ? ' · weekly' : ''}</span></button>`;
  }
  if (it.kind === 'log') {
    const en = it.en, a = act(en.a), run = !!en.running;
    const attrs = run ? 'data-act="edit-running"' : `data-act="edit-entry" data-id="${esc(en.id)}" data-drag="entry" data-s="${en.s}" data-e="${en.e}"`;
    return `<button type="button" class="ce ce-log ${run ? 'run' : ''} ${size}" style="${pos};--c:${a.color}" ${attrs} data-key="l-${esc(en.id)}" aria-label="Logged ${esc(a.name)}, ${fmtT(en.s)} to ${run ? 'now' : fmtT(en.e)}"><span class="t">${esc(a.name)}</span><span class="m">${fmtT(en.s)}–${run ? 'now' : fmtT(en.e)}</span>${run ? '' : '<i class="rz" aria-hidden="true"></i>'}</button>`;
  }
  const r = it.r, a = act(r.activity);
  const pinned = !!r.at && !r.late && it.flag !== 'missed';
  const active = r.st === 'active';
  const drag = !active && it.flag !== 'past';
  const cls = ['ce', 'ce-blk', size, pinned ? 'pinned' : 'auto', active ? 'active' : '', it.flag || '', it.over ? 'over' : '', r.clash ? 'clash' : ''].join(' ');
  const meta = it.flag === 'missed' ? 'missed · drag to a new time' : it.flag === 'past' ? 'planned' : `${span} · ${active ? 'now' : pinned ? 'pinned' : 'fits in'}${it.over ? ' · past your end time' : ''}`;
  return `<button type="button" class="${cls}" style="${pos};--c:${a.color}" data-act="cal-blk" data-k="${k}" data-id="${esc(r.id)}" ${drag ? `data-drag="block" data-s="${it.s}" data-e="${it.e}"` : ''} data-key="b-${esc(r.id)}-${it.piece}" aria-label="Planned ${esc(a.name)}${r.title ? ': ' + esc(r.title) : ''}, ${span}"><span class="t">${pinned ? icon('pin', 'pi') : ''}${esc(a.name)}${it.piece > 0 ? ' (cont.)' : ''}</span>${r.title ? `<span class="s">${esc(r.title)}</span>` : ''}<span class="m">${meta}</span>${drag && it.last ? '<i class="rz" aria-hidden="true"></i>' : ''}</button>`;
}

/* ---------- side panels ---------- */
function vCalSide(days, now, tk) {
  return [vMiniMonth(days, now, tk), vGcalPanel(), vDeadlinesPanel(tk), vBacklogPanel(tk), vTargetsPanel(now, tk), vTimetablePanel()].join('');
}
function mmBase() { return UI.cal.mm || calDays()[0].slice(0, 7); }
function shiftMonth(ym, d) { const [y, m] = ym.split('-').map(Number); const x = new Date(y, m - 1 + d, 1); return x.getFullYear() + '-' + pad(x.getMonth() + 1); }
function vMiniMonth(days, now, tk) {
  const [y, m] = mmBase().split('-').map(Number);
  const first = new Date(y, m - 1, 1), fk = keyOfDate(first), lk = keyOfDate(new Date(y, m, 0));
  const start = weekStartKey(fk);
  const agg = aggregate(ENTRIES, now, start, addDaysKey(start, 41));
  const dl = new Set(deadlineList().filter(d => !d.done).map(d => d.date));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const k = addDaysKey(start, i);
    if (i >= 35 && k > lk) break;
    const has = (agg[k] && agg[k].study >= 15 * MIN) || (V.plans[k] && Object.values(V.plans[k].blocks || {}).some(Boolean));
    cells.push(`<button type="button" class="${k < fk || k > lk ? 'out' : ''} ${days.includes(k) ? 'sel' : ''} ${k === tk ? 'tdy' : ''} ${dl.has(k) ? 'dl' : ''}" data-act="mm-day" data-k="${k}" aria-label="${esc(longDay(k))}">${dateOfKey(k).getDate()}${has || dl.has(k) ? '<i></i>' : ''}</button>`);
  }
  const wds = Array.from({ length: 7 }, (_, i) => `<span>${esc(rowWeekday(i).slice(0, 2))}</span>`).join('');
  return `<section class="panel mm" aria-label="Month"><div class="mm-head"><b>${esc(DF({ month: 'long', year: 'numeric' }).format(first))}</b><span><button type="button" class="icon-btn" data-act="mm-prev" aria-label="Previous month">${icon('left')}</button><button type="button" class="icon-btn" data-act="mm-next" aria-label="Next month">${icon('right')}</button></span></div><div class="mm-grid">${wds}${cells.join('')}</div></section>`;
}
/* ---------- sheets: new item, busy time, deadline, task, block ---------- */
/* ---------- planning actions ---------- */
function moveBlock(k1, id, k2, s) {
  const now = Date.now(), tk = todayKey();
  if (k2 < tk || (k2 === tk && s < now - 5 * MIN)) { toast('Pick a time from now on.'); return; }
  const b = blocksOf(k1)[id];
  if (!b) return;
  const at = msToHm(s), w = W();
  if (k1 === k2) {
    w.plan(k1, { blocks: { [id]: { at } } });
    commit('Pinned ' + act(b.activity).name + ' at ' + fmtT(s) + '.', w);
    return;
  }
  const r = (planModelFor(k1) || { rows: [] }).rows.find(x => x.id === id);
  const done = r ? Math.round(r.done / MIN) : 0;
  const rem = r ? Math.ceil(r.remaining / MIN) : b.minutes;
  w.plan(k1, { blocks: { [id]: done >= 1 ? { minutes: done, status: 'done' } : null } });
  w.plan(k2, { blocks: { [uid('b')]: blockDoc({ activity: b.activity, title: b.title, minutes: Math.max(5, rem || b.minutes), order: nextOrder(k2), at, pomo: b.pomo }) } });
  commit('Moved ' + act(b.activity).name + ' to ' + dayName(k2) + ' at ' + fmtT(s) + '.', w);
}
function resizeBlock(k, id, deltaMin) {
  const b = blocksOf(k)[id];
  if (!b || !deltaMin) return;
  const m = clamp(Math.round((+b.minutes || 0) + deltaMin), 5, 720);
  const w = W();
  w.plan(k, { blocks: { [id]: { minutes: m } } });
  commit(act(b.activity).name + ' is now ' + fmtDur(m * MIN) + '.', w);
}
function putEntry(w, id, oldDay, doc, s, e) {
  const k = dayKeyOf(s), now = Date.now();
  if (oldDay && oldDay !== k) w.day(oldDay, { [id]: null });
  const others = ENTRIES.filter(x => x.id !== id && x.s < e && entryEnd(x, now) > s);
  if (others.length) trimOthers(others, s, e, w);
  w.day(k, { [id]: doc });
  return others.length;
}
function moveEntry(id, delta) {
  const en = ENTRIES.find(x => x.id === id && !x.running);
  if (!en || !delta) return;
  const s = en.s + delta, e = en.e + delta;
  if (e > Date.now() + MIN) { toast('Logged time can’t move into the future.'); return; }
  const w = W();
  const n = putEntry(w, en.id, en.day, Object.assign(entryDoc(en), { start: isoLocal(s), end: isoLocal(e) }), s, e);
  commit('Moved ' + act(en.a).name + ' to ' + fmtT(s) + '–' + fmtT(e) + (n ? '; trimmed what it now overlaps.' : '.'), w);
}
function resizeEntry(id, newEnd) {
  const en = ENTRIES.find(x => x.id === id && !x.running);
  if (!en) return;
  const e = Math.min(newEnd, Date.now());
  if (e - en.s < MIN || e === en.e) return;
  const w = W();
  const n = putEntry(w, en.id, en.day, Object.assign(entryDoc(en), { end: isoLocal(e) }), en.s, e);
  commit(act(en.a).name + ' now ends at ' + fmtT(e) + (n ? '; trimmed what it now overlaps.' : '.'), w);
}
function calCreateAt(k, s, e) {
  const now = Date.now(), ds = dayStartMs(k);
  if (e <= now + MIN) { openEntrySheet('add', { s, e: Math.min(e, now) }); return; }
  if (s < now) s = ds + Math.ceil((now - ds) / SNAP) * SNAP;
  openQnew(k, s, Math.max(e, s + SNAP));
}
function scheduleTask(id, k, at) {
  const t = backlogMap()[id];
  if (!t) return;
  if (k < todayKey()) { toast('Pick today or a later day.'); return; }
  const w = W();
  w.plan(k, { blocks: { [uid('b')]: blockDoc({ activity: ACTMAP[t.activity] ? t.activity : firstStudyId(), title: t.title, minutes: Math.max(5, +t.minutes || 60), order: nextOrder(k), at: at || null, pomo: null }) } });
  w.update('planning/backlog', { items: { [id]: null } }, { items: {} });
  commit('Scheduled “' + t.title + '” for ' + dayName(k) + (at ? ' at ' + fmtHM(at) : '') + '.', w);
}
function findDayFor(minutes, due, extra) {
  const tk = todayKey(), now = Date.now();
  const last = due && due >= tk ? due : addDaysKey(tk, 13);
  let best = null, bestLeft = -Infinity;
  for (let k = tk; k <= last; k = addDaysKey(k, 1)) {
    const cap = dayCapacity(k, V.plans[k], planModelFor(k, now), busyIv(k), now);
    if (!cap) continue;
    const left = cap.free - cap.need - (extra[k] || 0);
    if (left >= (minutes + (+CFG.gap || 0)) * MIN) return { k, fits: true };
    if (left > bestLeft) { bestLeft = left; best = k; }
  }
  return { k: best || tk, fits: false };
}
function autoPlanAll() {
  const list = backlogList();
  if (!list.length) return;
  const extra = {}, orders = {}, used = new Set(), w = W();
  let tight = 0;
  for (const t of list) {
    const r = findDayFor(t.minutes, t.due, extra), k = r.k;
    if (orders[k] == null) orders[k] = nextOrder(k);
    w.plan(k, { blocks: { [uid('b')]: blockDoc({ activity: ACTMAP[t.activity] ? t.activity : firstStudyId(), title: t.title, minutes: t.minutes, order: orders[k]++, at: null, pomo: null }) } });
    w.update('planning/backlog', { items: { [t.id]: null } }, { items: {} });
    extra[k] = (extra[k] || 0) + (t.minutes + (+CFG.gap || 0)) * MIN;
    used.add(k);
    if (!r.fits) tight++;
  }
  commit('Planned ' + list.length + ' task' + (list.length > 1 ? 's' : '') + ' across ' + used.size + ' day' + (used.size > 1 ? 's' : '') + (tight ? '. ' + tight + ' didn’t fully fit and went to the roomiest day.' : '.'), w);
}
function unscheduleBlock(k, id) {
  const b = blocksOf(k)[id];
  if (!b) return;
  const r = (planModelFor(k) || { rows: [] }).rows.find(x => x.id === id);
  const done = r ? Math.round(r.done / MIN) : 0;
  const left = Math.max(5, (r ? Math.ceil(r.remaining / MIN) : 0) || (+b.minutes - done) || 30);
  const name = b.title || act(b.activity).name;
  const w = W();
  w.update('planning/backlog', { items: { [uid('t')]: { title: name, activity: b.activity, minutes: left, due: null, prio: 2, order: nextBacklogOrder(), created: isoLocal(Date.now()) } } }, { items: {} });
  w.plan(k, { blocks: { [id]: done >= 1 ? { minutes: done, status: 'done' } : null } });
  if (UI.sheet) closeSheet(true);
  commit('Moved “' + name + '” to the backlog.', w);
}
function copyPlan(k, k2) {
  const b = blocksOf(k);
  const ids = Object.keys(b).filter(id => b[id] && b[id].status !== 'skipped').sort((x, y) => (+b[x].order || 0) - (+b[y].order || 0));
  if (!ids.length) { toast('Nothing to copy.'); return; }
  let ord = nextOrder(k2);
  const blocks = {};
  ids.forEach(id => { const x = b[id]; blocks[uid('b')] = blockDoc({ activity: x.activity, title: x.title, minutes: +x.orig || +x.minutes, order: ord++, at: x.at || null, pomo: x.pomo || null }); });
  const w = W();
  w.plan(k2, { blocks });
  UI.planMenu = false;
  commit('Copied ' + ids.length + ' block' + (ids.length > 1 ? 's' : '') + ' to ' + dayName(k2) + '.', w);
}

/* ---------- dragging on the calendar (mouse drags; touch presses and holds) ---------- */
function timeAt(col, clientY, mode) {
  const k = col.getAttribute('data-k'), r = col.getBoundingClientRect(), ds = dayStartMs(k);
  const raw = (clientY - r.top) / HPX * HOUR;
  return ds + (mode === 'floor' ? Math.floor(raw / SNAP) : Math.round(raw / SNAP)) * SNAP;
}
function colAt(x, y) {
  for (const c of document.querySelectorAll('.cv-col')) { const r = c.getBoundingClientRect(); if (x >= r.left && x < r.right && y >= r.top - 4 && y <= r.bottom + 4) return c; }
  return null;
}
document.addEventListener('pointerdown', e => {
  if (DRAG || UI.view !== 'plan' || UI.sheet) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const t = e.target;
  if (!t || !t.closest) return;
  const card = t.closest('[data-drag]');
  const task = !card && t.closest('[data-bdrag]');
  const col = !card && !task && t.closest('.cv-col');
  if (!card && !task && !col) return;
  if ((task || col) && e.pointerType !== 'mouse') return;
  const host = (card || col) ? (card || col).closest('.cv-col') : null;
  DRAG = {
    pid: e.pointerId, ptype: e.pointerType, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, started: false,
    el: card || task || col, kind: card ? card.getAttribute('data-drag') : task ? 'task' : 'create',
    mode: card && t.closest('.rz') ? 'resize' : 'move', k: host ? host.getAttribute('data-k') : null,
    id: (card || task) ? (card || task).getAttribute('data-id') : null,
    s: card ? +card.getAttribute('data-s') : 0, e: card ? +card.getAttribute('data-e') : 0,
    grab: card ? e.clientY - card.getBoundingClientRect().top : 0, target: null, timer: 0, ghost: null, raf: 0, pending: false
  };
  if (DRAG.kind === 'create') DRAG.t0 = timeAt(col, e.clientY, 'floor');
  if (e.pointerType === 'mouse') e.preventDefault();
  else DRAG.timer = setTimeout(() => { if (DRAG && !DRAG.started) startDrag(); }, 380);
});
document.addEventListener('pointermove', e => {
  if (!DRAG || e.pointerId !== DRAG.pid) return;
  DRAG.lx = e.clientX; DRAG.ly = e.clientY;
  if (!DRAG.started) {
    const d = Math.hypot(e.clientX - DRAG.x0, e.clientY - DRAG.y0);
    if (DRAG.ptype === 'mouse') { if (d > 4) startDrag(); }
    else if (d > 10) { clearTimeout(DRAG.timer); DRAG = null; }
    return;
  }
  updateDrag();
});
document.addEventListener('pointerup', e => {
  if (!DRAG || e.pointerId !== DRAG.pid) return;
  clearTimeout(DRAG.timer);
  if (DRAG.started) finishDrag(); else DRAG = null;
});
document.addEventListener('pointercancel', e => {
  if (!DRAG || e.pointerId !== DRAG.pid) return;
  clearTimeout(DRAG.timer);
  if (DRAG.started) cancelDrag(); else DRAG = null;
});
document.addEventListener('touchmove', e => { if (DRAG && DRAG.started) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (DRAG) e.preventDefault(); });
function startDrag() {
  const D = DRAG;
  D.started = true;
  if (D.kind === 'block' || D.kind === 'entry') D.el.classList.add('dragging');
  D.ghost = document.createElement('div');
  D.ghost.className = 'cv-ghost';
  D.ghost.style.display = 'none';
  document.body.appendChild(D.ghost);
  document.documentElement.classList.add('is-dragging');
  try { if (D.el.setPointerCapture) D.el.setPointerCapture(D.pid); } catch (err) { /* not capturable */ }
  updateDrag();
  const loop = () => { if (DRAG !== D || !D.started) return; autoScroll(); D.raf = requestAnimationFrame(loop); };
  D.raf = requestAnimationFrame(loop);
}
function autoScroll() {
  const sc = document.getElementById('cv-scroll');
  if (!sc || !DRAG) return;
  const r = sc.getBoundingClientRect(), y = DRAG.ly;
  let dy = 0;
  if (y < r.top + 80 && y > r.top - 60) dy = -Math.max(3, (r.top + 80 - y) / 5);
  else if (y > r.bottom - 50 && y < r.bottom + 80) dy = Math.max(3, (y - (r.bottom - 50)) / 5);
  if (dy) { const before = sc.scrollTop; sc.scrollTop += dy; if (sc.scrollTop !== before) updateDrag(); }
}
function updateDrag() {
  const D = DRAG;
  if (!D) return;
  const now = Date.now(), tk = todayKey();
  let col = colAt(D.lx, D.ly);
  if (D.mode === 'resize' || D.kind === 'create') col = D.el.closest('.cv-col') || D.el;
  if (!col || !col.classList || !col.classList.contains('cv-col')) { paintGhost(null); D.target = null; return; }
  const k = col.getAttribute('data-k'), ds = dayStartMs(k), de = dayEndMs(k);
  let s, e;
  if (D.kind === 'create') { const t = timeAt(col, D.ly, 'round'); s = Math.min(D.t0, t); e = Math.max(D.t0 + SNAP, t); }
  else if (D.mode === 'resize') { s = D.s; e = Math.max(D.s + SNAP, timeAt(col, D.ly, 'round')); }
  else if (D.kind === 'task') { const tsk = backlogMap()[D.id]; s = timeAt(col, D.ly - 8, 'round'); e = s + (tsk ? (+tsk.minutes || 60) : 60) * MIN; }
  else { s = timeAt(col, D.ly - D.grab, 'round'); e = s + (D.e - D.s); }
  if (s < ds) { e += ds - s; s = ds; }
  if (e > de) { s -= e - de; e = de; }
  let ok = e > s;
  if (D.kind === 'entry') ok = ok && e <= now + MIN;
  else if (D.kind !== 'create') ok = ok && (k > tk || (k === tk && s >= now - 5 * MIN));
  D.target = { k, s, e, ok, col };
  paintGhost(D.target);
}
function paintGhost(t) {
  const g = DRAG && DRAG.ghost;
  if (!g) return;
  if (!t) { g.style.display = 'none'; return; }
  const r = t.col.getBoundingClientRect(), ds = dayStartMs(t.k);
  g.style.display = 'block';
  g.style.left = (r.left + 3) + 'px';
  g.style.width = Math.max(24, r.width - 6) + 'px';
  g.style.top = (r.top + (t.s - ds) / HOUR * HPX) + 'px';
  g.style.height = Math.max(16, (t.e - t.s) / HOUR * HPX) + 'px';
  g.className = 'cv-ghost' + (t.ok ? '' : ' bad');
  g.textContent = fmtT(t.s) + '–' + fmtT(t.e) + (t.ok ? '' : DRAG.kind === 'entry' ? ' · can’t log the future' : ' · already past');
}
function endDrag(D) {
  cancelAnimationFrame(D.raf);
  if (D.ghost) D.ghost.remove();
  if (D.el && D.el.classList) D.el.classList.remove('dragging');
  document.documentElement.classList.remove('is-dragging');
  try { if (D.el.releasePointerCapture) D.el.releasePointerCapture(D.pid); } catch (err) { /* already released */ }
  suppressClickUntil = Date.now() + 400;
}
function finishDrag() {
  const D = DRAG;
  DRAG = null;
  endDrag(D);
  const t = D.target;
  if (t && t.ok) {
    if (D.kind === 'block') { if (D.mode === 'resize') resizeBlock(t.k, D.id, Math.round((t.e - D.e) / MIN)); else if (t.k !== D.k || t.s !== D.s) moveBlock(D.k, D.id, t.k, t.s); }
    else if (D.kind === 'entry') { if (D.mode === 'resize') resizeEntry(D.id, t.e); else if (t.s !== D.s) moveEntry(D.id, t.s - D.s); }
    else if (D.kind === 'task') scheduleTask(D.id, t.k, msToHm(t.s));
    else if (D.kind === 'create') calCreateAt(t.k, t.s, t.e);
  } else if (t && !t.ok) toast(D.kind === 'entry' ? 'Logged time can’t move into the future.' : 'Pick a time from now on.');
  if (D.pending) render();
}
function cancelDrag() {
  const D = DRAG;
  DRAG = null;
  if (!D) return;
  endDrag(D);
  if (D.pending) render();
}

/* ---------- actions ---------- */
Object.assign(ACT, {
  'cal-view'(el) { UI.cal.view = el.getAttribute('data-v'); store.set('calView', UI.cal.view); UI.cal.mm = null; UI.cal.scrollTo = true; render(); },
  'cal-show'(el) { UI.cal.show = el.getAttribute('data-v'); store.set('calShow', UI.cal.show); render(); },
  'cal-prev'() { calShift(-1); },
  'cal-next'() { calShift(1); },
  'cal-today'() { UI.cal.anchor = null; UI.cal.mm = null; UI.cal.scrollTo = true; render(); },
  'cal-pick'(el) { if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) { UI.cal.anchor = el.value; UI.cal.mm = null; UI.cal.scrollTo = true; render(); } },
  'cal-open'(el) { UI.cal.anchor = el.getAttribute('data-k'); UI.view = 'plan'; UI.cal.mm = null; UI.cal.scrollTo = true; try { history.replaceState(null, '', '#plan'); } catch (e) { /* ignore */ } render(); window.scrollTo(0, 0); },
  'mm-day'(el) { UI.cal.anchor = el.getAttribute('data-k'); UI.cal.scrollTo = true; render(); },
  'mm-prev'() { UI.cal.mm = shiftMonth(mmBase(), -1); render(); },
  'mm-next'() { UI.cal.mm = shiftMonth(mmBase(), 1); render(); },
  'cal-slot'(el, e) {
    if (!e || e.target !== el) return;
    const k = el.getAttribute('data-k'), t = timeAt(el, e.clientY, 'floor'), now = Date.now();
    if (t < now) openEntrySheet('add', { s: t, e: Math.min(t + 30 * MIN, now) });
    else openQnew(k, t, t + 60 * MIN);
  },
  'cal-blk'(el) { openBlockSheet(el.getAttribute('data-k'), el.getAttribute('data-id')); },
  'cal-busy'(el) { openBusySheet(el.getAttribute('data-k'), el.getAttribute('data-id'), el.getAttribute('data-rec') === '1'); },
  'cal-new'() {
    const tk = todayKey(), now = Date.now();
    const days = UI.view === 'plan' ? calDays() : [tk];
    const k = days.includes(tk) || days[0] < tk ? tk : days[0];
    const ds = dayStartMs(k);
    const s = k === tk ? ds + Math.ceil((now - ds) / SNAP) * SNAP : hmOnDay(k, CFG.planStart);
    openQnew(k, s, s + 60 * MIN);
  },
  'q-tab'(el) { UI.sheet.tab = el.getAttribute('data-v'); UI.sheet.err = ''; renderSheet(); },
  'q-min'(el) { UI.sheet.minutes = +el.getAttribute('data-m'); renderSheet(); },
  'q-day'(el) { const d = +el.getAttribute('data-d'), arr = UI.sheet.days, i = arr.indexOf(d); if (i >= 0) arr.splice(i, 1); else arr.push(d); renderSheet(); },
  'q-save'() { saveQnew(); },
  'busy-save'() {
    const sh = UI.sheet;
    sh.err = '';
    if (!HM.test(sh.start || '') || !HM.test(sh.end || '')) sh.err = 'Enter a start and an end time.';
    else if (sh.start.slice(0, 5) === sh.end.slice(0, 5)) sh.err = 'The end time needs to differ from the start.';
    else if (sh.rec && !sh.days.length) sh.err = 'Pick at least one day, or remove it from the timetable.';
    if (sh.err) { renderSheet(); return; }
    const doc = { title: (sh.title || '').trim() || 'Busy', start: sh.start.slice(0, 5), end: sh.end.slice(0, 5), activity: sh.bact || null };
    const w = W();
    if (sh.rec) w.update('planning/commitments', { items: { [sh.id]: Object.assign(doc, { days: sh.days.slice().sort() }) } }, { items: {} });
    else w.plan(sh.k, { events: { [sh.id]: doc } });
    closeSheet(true);
    commit('Saved ' + doc.title + '.', w);
  },
  'busy-skip'() { const sh = UI.sheet, w = W(); w.plan(sh.k, { skip: { [sh.id]: true } }); closeSheet(true); commit('Skipped ' + (sh.title || 'it') + ' on ' + dayName(sh.k) + '. Plans there use the free time.', w); },
  'busy-del'() {
    const sh = UI.sheet;
    if (!sh.armed) { sh.armed = true; renderSheet(); return; }
    const w = W();
    if (sh.rec) w.update('planning/commitments', { items: { [sh.id]: null } }, { items: {} });
    else w.plan(sh.k, { events: { [sh.id]: null } });
    closeSheet(true);
    commit(sh.rec ? 'Removed ' + (sh.title || 'it') + ' from your timetable.' : 'Deleted ' + (sh.title || 'the busy time') + '.', w);
  },
  'tt-new'() { const tk = todayKey(); openQnew(tk, hmOnDay(tk, '10:00'), hmOnDay(tk, '11:00'), 'busy', [weekdayOfKey(tk)]); },
  'tt-edit'(el) { openBusySheet(null, el.getAttribute('data-id'), true); },
  'dl-new'() { openDeadlineSheet(null); },
  'dl-edit'(el) { openDeadlineSheet(el.getAttribute('data-id')); },
  'dl-kind'(el) { UI.sheet.kind = el.getAttribute('data-v'); renderSheet(); },
  'dl-save'() {
    const sh = UI.sheet;
    sh.err = '';
    if (!String(sh.title || '').trim()) sh.err = 'Give the deadline a title.';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(sh.date || '')) sh.err = 'Pick a date.';
    if (sh.err) { renderSheet(); return; }
    const w = W();
    w.update('planning/deadlines', { items: { [sh.id || uid('d')]: { title: String(sh.title).trim().slice(0, 60), date: sh.date, time: sh.time ? sh.time.slice(0, 5) : null, activity: sh.activity || null, kind: sh.kind || 'exam', done: !!sh.done } } }, { items: {} });
    closeSheet(true);
    commit('Saved ' + String(sh.title).trim() + ', ' + countdown(sh.date) + '.', w);
  },
  'dl-done'() { const sh = UI.sheet, w = W(); w.update('planning/deadlines', { items: { [sh.id]: { done: !sh.done } } }, { items: {} }); closeSheet(true); commit(sh.done ? 'Marked as not done.' : 'Marked ' + sh.title + ' done.', w); },
  'dl-del'() { const sh = UI.sheet; if (!sh.armed) { sh.armed = true; renderSheet(); return; } const w = W(); w.update('planning/deadlines', { items: { [sh.id]: null } }, { items: {} }); closeSheet(true); commit('Deleted ' + sh.title + '.', w); },
  'task-open'(el) { openTaskSheet(el.getAttribute('data-id')); },
  'task-min'(el) { UI.sheet.minutes = +el.getAttribute('data-m'); renderSheet(); },
  'task-prio'(el) { UI.sheet.prio = +el.getAttribute('data-v'); renderSheet(); },
  'task-save'() {
    const sh = UI.sheet, t = taskFromSheet();
    if (!t) return;
    const prev = sh.id ? backlogMap()[sh.id] : null;
    const w = W();
    w.update('planning/backlog', { items: { [sh.id || uid('t')]: Object.assign(t, { order: prev ? (+prev.order || 0) : nextBacklogOrder(), created: (prev && prev.created) || isoLocal(Date.now()) }) } }, { items: {} });
    closeSheet(true);
    commit(sh.id ? 'Saved the task.' : 'Added “' + t.title + '” to the backlog.', w);
  },
  'task-sched'(el) {
    const sh = UI.sheet, t = taskFromSheet();
    if (!t) return;
    const how = el.getAttribute('data-w'), tk = todayKey();
    let k = tk, fits = true;
    if (how === 'find') { const r = findDayFor(t.minutes, t.due, {}); k = r.k; fits = r.fits; }
    else if (how === 'tomorrow') k = addDaysKey(tk, 1);
    else if (how === 'day') { if (!/^\d{4}-\d{2}-\d{2}$/.test(sh.day || '') || sh.day < tk) { sh.err = 'Pick today or a later day.'; renderSheet(); return; } k = sh.day; }
    const w = W();
    w.plan(k, { blocks: { [uid('b')]: blockDoc({ activity: t.activity, title: t.title, minutes: t.minutes, order: nextOrder(k), at: null, pomo: null }) } });
    if (sh.id) w.update('planning/backlog', { items: { [sh.id]: null } }, { items: {} });
    closeSheet(true);
    commit('Scheduled “' + t.title + '” for ' + dayName(k) + (fits ? '.' : '. That day is already full, so check its plan.'), w);
  },
  'task-done'() { const sh = UI.sheet, w = W(); w.update('planning/backlog', { items: { [sh.id]: null } }, { items: {} }); closeSheet(true); commit('Done: ' + sh.title + '.', w); },
  'bl-auto'() { autoPlanAll(); },
  'plan-copy'(el) { const k = el.getAttribute('data-k'); copyPlan(k, addDaysKey(k, 1)); },
  'block-start'() { const sh = UI.sheet, b = blocksOf(sh.k)[sh.id]; if (!b) return; closeSheet(true); startActivity(b.activity, { block: sh.id, pomoPreset: b.pomo || undefined, force: true }); },
  'block-dup'() { const sh = UI.sheet, b = blocksOf(sh.k)[sh.id]; if (!b) return; const w = W(); w.plan(sh.k, { blocks: { [uid('b')]: blockDoc({ activity: b.activity, title: b.title, minutes: +b.orig || +b.minutes, order: nextOrder(sh.k), at: null, pomo: b.pomo || null }) } }); closeSheet(true); commit('Duplicated the block.', w); },
  'block-back'() { const sh = UI.sheet; unscheduleBlock(sh.k, sh.id); },
  'block-del'() { const sh = UI.sheet; if (!sh.armed) { sh.armed = true; renderSheet(); return; } const w = W(); w.plan(sh.k, { blocks: { [sh.id]: null } }); closeSheet(true); commit('Deleted the block.', w); }
});
Object.assign(SUBMIT, {
  'task-add'() {
    const title = String(UI.ta.title || '').trim();
    if (!title) return;
    const w = W();
    w.update('planning/backlog', { items: { [uid('t')]: { title: title.slice(0, 80), activity: ACTMAP[UI.ta.activity] ? UI.ta.activity : firstStudyId(), minutes: +UI.ta.minutes || 60, due: null, prio: 2, order: nextBacklogOrder(), created: isoLocal(Date.now()) } } }, { items: {} });
    UI.ta.title = '';
    const el = document.getElementById('ta-title');
    if (el) el.value = '';
    commit('Added “' + title + '” to the backlog.', w);
  }
});
