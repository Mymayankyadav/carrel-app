/* R0a: task UI will be moved here by P3. */

function vDeadlineChips(tk) {
  const list = deadlineList().filter(d => !d.done && d.date >= tk && daysUntil(d.date) <= 21).slice(0, 4);
  if (!list.length) return '';
  return `<div class="dlc" aria-label="Coming up">${list.map(d => `<button type="button" data-act="dl-edit" data-id="${esc(d.id)}">${icon('flag')}<span>${esc(d.title)}</span><b>${countdown(d.date)}</b></button>`).join('')}</div>`;
}

function vDeadlinesPanel(tk) {
  const list = deadlineList().filter(d => !d.done && d.date >= addDaysKey(tk, -3)).slice(0, 8);
  const rows = list.map(d => {
    const c = d.activity && ACTMAP[d.activity] ? act(d.activity).color : 'var(--rust)';
    const n = daysUntil(d.date);
    return `<button type="button" class="pitem" style="--c:${c}" data-act="dl-edit" data-id="${esc(d.id)}"><i class="dot"></i><span class="pb"><span class="nm">${esc(d.title)}</span><span class="sub">${esc(shortDay(d.date))}${d.time ? ' · ' + fmtHM(d.time) : ''}${d.activity && ACTMAP[d.activity] ? ' · ' + esc(act(d.activity).name) : ''}</span></span><span class="rt ${n <= 2 && n >= 0 ? 'soon' : n < 0 ? 'gone' : ''}">${countdown(d.date)}</span></button>`;
  }).join('');
  return `<section class="panel" aria-labelledby="dl-h"><div class="sec-head"><h2 id="dl-h">Deadlines</h2><button type="button" class="icon-btn" data-act="dl-new" aria-label="Add a deadline">${icon('plus')}</button></div>
    ${rows ? `<div class="plist">${rows}</div>` : `<p class="cap">Add exams and due dates. They get a countdown here, on the calendar and on Today.</p>`}</section>`;
}

function vBacklogPanel(tk) {
  const list = backlogList();
  const rows = list.map(t => {
    const a = t.activity && ACTMAP[t.activity] ? act(t.activity) : null;
    const n = t.due ? daysUntil(t.due) : null;
    return `<button type="button" class="pitem drag" style="--c:${a ? a.color : 'var(--ink-3)'}" data-act="task-open" data-id="${esc(t.id)}" data-bdrag="1"><i class="dot"></i><span class="pb"><span class="nm">${t.prio === 1 ? '<b class="hi">!</b> ' : ''}${esc(t.title)}</span><span class="sub">${a ? esc(a.name) + ' · ' : ''}${fmtDur(t.minutes * MIN)}</span></span><span class="rt ${n != null && n < 0 ? 'gone' : n != null && n <= 2 ? 'soon' : ''}">${t.due ? (n < 0 ? 'overdue' : 'due ' + countdown(t.due).replace(/^in /, 'in ')) : ''}</span></button>`;
  }).join('');
  const tot = list.reduce((s, t) => s + t.minutes, 0) * MIN;
  const opts = [30, 45, 60, 90, 120, 180].map(m => `<option value="${m}"${+UI.ta.minutes === m ? ' selected' : ''}>${fmtDur(m * MIN)}</option>`).join('');
  if (!ACTMAP[UI.ta.activity]) UI.ta.activity = firstStudyId();
  return `<section class="panel" aria-labelledby="bl-h"><div class="sec-head"><h2 id="bl-h">Backlog${list.length ? ` <small>${list.length} · ${fmtDur(tot)}</small>` : ''}</h2>${list.length ? `<button type="button" class="btn sm" data-act="bl-auto" title="Place every task on the earliest day with room, before its due date">${icon('wand')}Find time for all</button>` : ''}</div>
    ${rows ? `<div class="plist">${rows}</div><p class="cap">Drag a task onto the calendar, or tap it to schedule.</p>` : `<p class="cap">Collect study tasks here before they have a time. Find time places them on the first day with room, around your timetable and deadlines.</p>`}
    <form class="qadd" data-submit="task-add"><input class="inp" id="ta-title" maxlength="80" data-bind="ta.title" value="${esc(UI.ta.title)}" placeholder="Add a task, e.g. Chapter 7 problems" autocomplete="off" aria-label="New task">
      <div class="row"><select class="sel sm" id="ta-act" data-bind="ta.activity" data-value="${esc(UI.ta.activity)}" aria-label="Subject">${ACTS.filter(a => !a.archived).map(a => `<option value="${esc(a.id)}"${a.id === UI.ta.activity ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select><select class="sel sm" id="ta-min" data-bind="ta.minutes" data-value="${esc(UI.ta.minutes)}" aria-label="Time needed">${opts}</select><button type="submit" class="btn sm lamp">${icon('plus')}Add</button></div></form>
  </section>`;
}

function vTimetablePanel() {
  const ws = +CFG.weekStart || 0;
  const items = Object.entries(commitmentsMap()).filter(([, c]) => c && !c.archived && Array.isArray(c.days) && c.days.length)
    .map(([id, c]) => ({ id, ...c, first: Math.min(...c.days.map(d => (d - ws + 7) % 7)) }))
    .sort((a, b) => a.first - b.first || String(a.start).localeCompare(String(b.start)));
  const dn = d => wdName(new Date(2026, 0, 4 + d));
  const rows = items.map(c => {
    const col = c.activity && ACTMAP[c.activity] ? act(c.activity).color : 'var(--ink-3)';
    const ds = c.days.slice().sort((x, y) => ((x - ws + 7) % 7) - ((y - ws + 7) % 7)).map(dn).join(', ');
    return `<button type="button" class="pitem" style="--c:${col}" data-act="tt-edit" data-id="${esc(c.id)}"><i class="dot"></i><span class="pb"><span class="nm">${esc(c.title || 'Busy')}</span><span class="sub">${esc(ds)}</span></span><span class="rt">${fmtHM(c.start)}–${fmtHM(c.end)}</span></button>`;
  }).join('');
  return `<section class="panel" aria-labelledby="tt-h"><div class="sec-head"><h2 id="tt-h">Weekly timetable</h2><button type="button" class="icon-btn" data-act="tt-new" aria-label="Add to timetable">${icon('plus')}</button></div>
    ${rows ? `<div class="plist">${rows}</div>` : `<p class="cap">Add classes, coaching, shifts or anything fixed each week. Plans flow around them automatically.</p>`}</section>`;
}


function openBusySheet(k, id, rec) {
  if (rec) {
    const c = commitmentsMap()[id];
    if (!c) return;
    openSheet({ type: 'busy', rec: true, id, k, title: c.title || '', start: c.start || '', end: c.end || '', days: Array.isArray(c.days) ? c.days.slice() : [], bact: c.activity || '', armed: false, err: '' });
  } else {
    const ev = ((V.plans[k] && V.plans[k].events) || {})[id];
    if (!ev) return;
    openSheet({ type: 'busy', rec: false, id, k, title: ev.title || '', start: ev.start || '', end: ev.end || '', days: [], bact: ev.activity || '', armed: false, err: '' });
  }
}

function sBusy(sh) {
  return `<div class="sh-head"><h2 id="sh-title">${sh.rec ? 'Timetable item' : 'Busy time'}</h2>${closeBtn}</div>
    ${sh.k ? `<p class="note-line">${sh.rec ? 'Repeats every week' : esc(longDay(sh.k))}</p>` : ''}
    <label class="field"><span>What is it</span><input class="inp" id="bz-title" maxlength="60" data-bind="sheet.title" value="${esc(sh.title)}" autocomplete="off"></label>
    <div class="g2"><label class="field"><span>Start</span><input type="time" class="inp" id="bz-start" data-bind="sheet.start" value="${esc(sh.start)}"></label><label class="field"><span>End</span><input type="time" class="inp" id="bz-end" data-bind="sheet.end" value="${esc(sh.end)}"></label></div>
    ${sh.rec ? `<div class="field"><span>Days</span>${wdChips(sh.days)}</div>` : ''}
    <label class="field"><span>Counts as (optional)</span>${actSelect('bz-act', 'sheet.bact', sh.bact, true)}</label>
    <div class="row">${sh.rec && sh.k ? `<button type="button" class="btn sm" data-act="busy-skip">${icon('skip')}Skip on ${esc(dayName(sh.k))} only</button>` : ''}<button type="button" class="btn sm danger ${sh.armed ? 'armed' : ''}" data-act="busy-del">${icon('trash')}${sh.armed ? 'Tap again to remove' : sh.rec ? 'Remove from timetable' : 'Delete'}</button></div>
    ${errLine(sh)}
    <div class="sh-foot"><button type="button" class="btn ghost" data-act="sheet-close">Cancel</button><button type="button" class="btn lamp" data-act="busy-save">Save</button></div>`;
}

function openDeadlineSheet(id) {
  if (id) {
    const d = deadlinesMap()[id];
    if (!d) return;
    openSheet({ type: 'deadline', id, title: d.title || '', date: d.date || todayKey(), time: d.time || '', activity: d.activity || '', kind: d.kind || 'exam', done: !!d.done, armed: false, err: '' });
  } else openSheet({ type: 'deadline', id: null, title: '', date: addDaysKey(todayKey(), 7), time: '', activity: '', kind: 'exam', done: false, armed: false, err: '' });
}

function sDeadline(sh) {
  const kinds = [['exam', 'Exam or test'], ['due', 'Assignment due'], ['other', 'Other']];
  return `<div class="sh-head"><h2 id="sh-title">${sh.id ? 'Deadline' : 'New deadline'}</h2>${closeBtn}</div>
    <label class="field"><span>Title</span><input class="inp" id="dl-title" maxlength="60" data-bind="sheet.title" value="${esc(sh.title)}" placeholder="e.g. Physics unit test" autocomplete="off"></label>
    <div class="seg" role="group" aria-label="Kind">${kinds.map(([v, t]) => `<button type="button" class="${sh.kind === v ? 'on' : ''}" data-act="dl-kind" data-v="${v}" aria-pressed="${sh.kind === v}">${t}</button>`).join('')}</div>
    <div class="g2"><label class="field"><span>Date</span><input type="date" class="inp" id="dl-date" data-bind="sheet.date" value="${esc(sh.date)}"></label><label class="field"><span>Time (optional)</span><input type="time" class="inp" id="dl-time" data-bind="sheet.time" value="${esc(sh.time)}"></label></div>
    <label class="field"><span>Subject (optional)</span>${actSelect('dl-act', 'sheet.activity', sh.activity, true)}</label>
    ${/^\d{4}-\d{2}-\d{2}$/.test(sh.date || '') ? `<p class="note-line">${esc(longDay(sh.date))}, ${countdown(sh.date)}.</p>` : ''}
    ${errLine(sh)}
    <div class="sh-foot"><div class="left">${sh.id ? `<button type="button" class="btn sm danger ${sh.armed ? 'armed' : ''}" data-act="dl-del">${icon('trash')}${sh.armed ? 'Tap again to delete' : 'Delete'}</button><button type="button" class="btn sm ghost" data-act="dl-done">${icon('check')}${sh.done ? 'Not done' : 'Done'}</button>` : ''}</div><button type="button" class="btn ghost" data-act="sheet-close">Cancel</button><button type="button" class="btn lamp" data-act="dl-save">Save</button></div>`;
}

function openTaskSheet(id) {
  const t = id ? backlogMap()[id] : null;
  if (id && !t) return;
  openSheet({ type: 'task', id: id || null, title: t ? t.title : '', activity: t && ACTMAP[t.activity] ? t.activity : (ACTMAP[UI.ta.activity] ? UI.ta.activity : firstStudyId()), minutes: t ? (+t.minutes || 60) : 60, due: (t && t.due) || '', prio: t ? (+t.prio || 2) : 2, day: addDaysKey(todayKey(), 1), err: '' });
}

function sTask(sh) {
  const tk = todayKey();
  return `<div class="sh-head"><h2 id="sh-title">${sh.id ? 'Task' : 'New task'}</h2>${closeBtn}</div>
    <label class="field"><span>Task</span><input class="inp" id="tk-title" maxlength="80" data-bind="sheet.title" value="${esc(sh.title)}" placeholder="e.g. Chapter 7 problems 1–30" autocomplete="off"></label>
    ${actPick(sh.activity, 'sheet.activity')}
    <div class="g2"><label class="field"><span>Minutes needed</span><input type="number" class="inp" id="tk-min" min="5" max="720" step="5" data-bind="sheet.minutes" value="${esc(sh.minutes)}"></label><label class="field"><span>Due (optional)</span><input type="date" class="inp" id="tk-due" data-bind="sheet.due" value="${esc(sh.due)}"></label></div>
    <div class="chips">${[30, 60, 90, 120, 180].map(m => `<button type="button" class="chip-btn ${+sh.minutes === m ? 'on' : ''}" data-act="task-min" data-m="${m}">${fmtDur(m * MIN)}</button>`).join('')}</div>
    <div class="field"><span>Priority</span><div class="seg" role="group" aria-label="Priority">${[[1, 'High'], [2, 'Normal'], [3, 'Low']].map(([v, t]) => `<button type="button" class="${+sh.prio === v ? 'on' : ''}" data-act="task-prio" data-v="${v}" aria-pressed="${+sh.prio === v}">${t}</button>`).join('')}</div></div>
    <div class="field"><span>Schedule it</span>
      <div class="row"><button type="button" class="btn sm lamp" data-act="task-sched" data-w="find">${icon('wand')}Find time</button><button type="button" class="btn sm" data-act="task-sched" data-w="today">Today</button><button type="button" class="btn sm" data-act="task-sched" data-w="tomorrow">Tomorrow</button></div>
      <div class="row"><input type="date" class="inp sm" id="tk-day" data-bind="sheet.day" value="${esc(sh.day)}" min="${tk}" aria-label="Pick a day"><button type="button" class="btn sm" data-act="task-sched" data-w="day">Add to that day</button></div>
      <span class="muted" style="font-weight:400;font-size:12px">Find time picks the first day${sh.due ? ' up to the due date' : ''} with enough free time around your timetable.</span></div>
    ${errLine(sh)}
    <div class="sh-foot"><div class="left">${sh.id ? `<button type="button" class="btn sm ghost" data-act="task-done">${icon('check')}Done, remove it</button>` : ''}</div><button type="button" class="btn ghost" data-act="sheet-close">Cancel</button><button type="button" class="btn lamp" data-act="task-save">Save to backlog</button></div>`;
}

function taskFromSheet() {
  const sh = UI.sheet, m = Math.round(+sh.minutes);
  sh.err = '';
  if (!String(sh.title || '').trim()) sh.err = 'Give the task a name.';
  else if (!ACTMAP[sh.activity]) sh.err = 'Choose a subject or activity.';
  else if (!(m >= 5 && m <= 720)) sh.err = 'Use between 5 and 720 minutes.';
  else if (sh.due && !/^\d{4}-\d{2}-\d{2}$/.test(sh.due)) sh.err = 'Pick a valid due date.';
  if (sh.err) { renderSheet(); return null; }
  return { title: String(sh.title).trim().slice(0, 80), activity: sh.activity, minutes: m, due: sh.due || null, prio: +sh.prio || 2 };
}

SHEETS.busy = sBusy; SHEETS.deadline = sDeadline; SHEETS.task = sTask;
