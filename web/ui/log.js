/* ---------- views: log ---------- */
function dayEntries(k, now) { const ds = dayStartMs(k), de = dayEndMs(k); return ENTRIES.filter(en => en.s < de && entryEnd(en, now) > ds); }
function gapsOf(ents, now, ds, de, isToday) {
  const out = [];
  let prevEnd = null;
  for (const en of ents) {
    const s = Math.max(en.s, ds);
    if (prevEnd != null && s - prevEnd >= 3 * MIN) out.push([prevEnd, s]);
    prevEnd = Math.max(prevEnd || 0, Math.min(entryEnd(en, now), de));
  }
  if (isToday && prevEnd != null && !CUR && now - prevEnd >= 3 * MIN && now < de) out.push([prevEnd, now]);
  return out;
}
function vLog(k, now, pm) {
  const isToday = k === todayKey();
  const ents = dayEntries(k, now);
  const ds = dayStartMs(k), de = dayEndMs(k);
  const head = `<div class="sec-head"><h2 id="log-h">Log</h2><div class="sec-tools"><div class="seg" role="group" aria-label="Log layout"><button type="button" class="${UI.logMode === 'timeline' ? 'on' : ''}" data-act="logmode" data-m="timeline" aria-pressed="${UI.logMode === 'timeline'}">Timeline</button><button type="button" class="${UI.logMode === 'list' ? 'on' : ''}" data-act="logmode" data-m="list" aria-pressed="${UI.logMode === 'list'}">List</button></div><button type="button" class="btn sm" data-act="add-entry">${icon('plus')}Add</button></div></div>`;
  let body;
  if (!ents.length && !(isToday && pm && pm.rows.some(r => r.pieces.length))) {
    body = `<div class="empty"><p>${isToday ? 'Nothing logged yet today. Start a timer above, or add anything you did before opening Carrel.' : 'Nothing was logged on this day. Add entries for anything you remember.'}</p></div>`;
  } else if (UI.logMode === 'list') body = vList(ents, now, ds, de, isToday);
  else body = vTimeline(k, ents, now, ds, de, isToday, pm);
  return `<section class="sec" aria-labelledby="log-h">${head}${body}</section>`;
}
function vTimeline(k, ents, now, ds, de, isToday, pm) {
  const PX = 1.1;
  // Overnight sleep gets a compact, editable summary instead of consuming
  // several screens of hour-grid space. Don't collapse a running sleep or
  // sleep that overlaps other logged activities.
  const first = ents.slice().sort((a, b) => a.s - b.s)[0];
  const sleepEnd = first ? entryEnd(first, now) : 0;
  const leadSleep = first && !first.running && act(first.a).role === 'sleep' &&
    sleepEnd > ds && !ents.some(en => en !== first && en.s < sleepEnd &&
      entryEnd(en, now) > Math.max(first.s, ds)) ? first : null;
  const sleepBand = leadSleep
    ? `<button type="button" class="tl-sleep-summary" style="--c:${act(leadSleep.a).color}" data-act="edit-entry" data-id="${esc(leadSleep.id)}" data-key="${esc(leadSleep.id)}" aria-label="Edit ${esc(act(leadSleep.a).name)}, ${fmtT(leadSleep.s)} to ${fmtT(sleepEnd)}"><span>${esc(act(leadSleep.a).name)}</span><span>${fmtT(leadSleep.s)}–${fmtT(sleepEnd)} · ${fmtDur(sleepEnd - leadSleep.s)}</span></button>`
    : '';
  let lo = Infinity, hi = -Infinity;
  for (const en of ents) { lo = Math.min(lo, Math.max(en.s, ds)); hi = Math.max(hi, Math.min(entryEnd(en, now), de)); }
  const pieces = [];
  if (pm && (pm.isToday || pm.isFuture)) pm.rows.forEach(r => r.pieces.forEach(p => pieces.push({ r, a: p[0], b: p[1] })));
  if (k >= todayKey()) busyOf(k).forEach(z => { if (!isToday || z.e > now) pieces.push({ busy: z, a: z.s, b: z.e }); });
  pieces.forEach(p => { lo = Math.min(lo, p.a); hi = Math.max(hi, p.b); });
  if (isToday) { lo = Math.min(lo, now - 30 * MIN); hi = Math.max(hi, now + 30 * MIN); }
  if (pm && (pm.isToday || pm.isFuture) && pm.rows.length) hi = Math.max(hi, Math.min(pm.endMs, de));
  if (leadSleep) lo = Math.max(lo, floorLocal(sleepEnd, HOUR));
  lo = Math.max(ds, floorLocal(lo, HOUR));
  hi = Math.min(de, ceilLocal(hi, HOUR));
  if (hi - lo < 5 * HOUR) hi = Math.min(de, lo + 5 * HOUR);
  if (hi - lo < 5 * HOUR) lo = Math.max(ds, hi - 5 * HOUR);
  const y = t => ((clamp(t, lo, hi) - lo) / MIN * PX);
  const H = Math.round(y(hi));
  const axis = [], grid = [];
  for (let t = ceilLocal(lo, HOUR); t <= hi; t += HOUR) {
    const d = new Date(t);
    axis.push(`<span style="top:${y(t).toFixed(1)}px">${fmtHourS(d.getHours())}${H12 ? '' : ':00'}</span>`);
    grid.push(`<i class="tl-grid" style="top:${y(t).toFixed(1)}px"></i>`);
  }
  const blocks = ents.map(en => {
    if (en === leadSleep) return '';
    const a = act(en.a), s = Math.max(en.s, lo), e = Math.min(entryEnd(en, now), hi);
    if (e <= s) return '';
    const top = y(s), h = Math.max(6, y(e) - top - 1);
    const cls = `${en.running ? 'run' : ''} ${h < 17 ? 'tiny' : ''}`;
    const attrs = en.running ? 'data-act="edit-running"' : `data-act="edit-entry" data-id="${esc(en.id)}"`;
    return `<button type="button" class="tl-e ${cls}" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px;--c:${a.color}" ${attrs} data-key="${esc(en.id)}" aria-label="${esc(a.name)}, ${fmtT(en.s)} to ${en.running ? 'now' : fmtT(en.e)}"><span class="n">${esc(a.name)}${en.note && h >= 34 ? ' · <span class="muted">' + esc(en.note) + '</span>' : ''}</span>${h >= 30 ? `<span class="d">${fmtT(en.s)}–${en.running ? 'now' : fmtT(en.e)} · ${fmtDur(entryEnd(en, now) - en.s)}</span>` : ''}</button>`;
  }).join('');
  const gaps = gapsOf(ents, now, ds, de, isToday).filter(([a, b]) => b > lo && a < hi).map(([a, b]) => {
    const top = y(Math.max(a, lo)), h = Math.max(10, y(Math.min(b, hi)) - top - 2);
    return `<button type="button" class="tl-gap" style="top:${(top + 1).toFixed(1)}px;height:${h.toFixed(1)}px" data-act="fill" data-s="${a}" data-e="${b === now ? 'now' : b}" aria-label="Untracked ${fmtDur(b - a)}, ${fmtT(a)} to ${fmtT(b)}">${h >= 16 ? `<span>+ ${fmtDur(b - a)}</span>` : ''}</button>`;
  }).join('');
  const plan = pieces.filter(p => p.b > lo && p.a < hi).map(p => {
    if (p.busy) { const top = y(p.a), h = Math.max(8, y(p.b) - top - 2); return `<div class="tl-p busy" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px">${h >= 16 ? esc(p.busy.title) : ''}</div>`; }
    const a = act(p.r.activity), top = y(p.a), h = Math.max(8, y(p.b) - top - 2);
    return `<div class="tl-p ${p.r.over > 0 && p.b > pm.endMs ? 'over' : ''}" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px;--c:${a.color}">${h >= 16 ? esc(a.name) : ''}</div>`;
  }).join('');
  const nowLine = isToday && now >= lo && now <= hi ? `<i class="tl-now" style="top:${y(now).toFixed(1)}px"></i>` : '';
  const endLine = pm && (pm.isToday || pm.isFuture) && pm.rows.length && pm.endMs > lo && pm.endMs < hi ? `<div class="tl-end" style="top:${y(pm.endMs).toFixed(1)}px"><span>plan ends</span></div>` : '';
  return sleepBand + `<div class="tl-heads"><span></span><span>Logged</span><span>Plan ahead</span></div>
    <div class="tl" style="height:${H}px">${grid.join('')}<div class="tl-axis">${axis.join('')}</div><div class="tl-lane">${gaps}${blocks}</div><div class="tl-lane plan">${plan}</div>${endLine}${nowLine}</div>`;
}
function vList(ents, now, ds, de, isToday) {
  const gaps = gapsOf(ents, now, ds, de, isToday);
  const items = [];
  ents.forEach(en => items.push({ t: en.s, en }));
  gaps.forEach(g => items.push({ t: g[0] + 1, g }));
  items.sort((a, b) => a.t - b.t);
  return `<ol class="ll">${items.map(it => {
    if (it.g) { const [a, b] = it.g; return `<li><button type="button" class="ll-gap" data-act="fill" data-s="${a}" data-e="${b === now ? 'now' : b}"><span>Untracked <span class="num">${fmtT(a)}–${fmtT(b)}</span></span><b>+ ${fmtDur(b - a)}</b></button></li>`; }
    const en = it.en, a = act(en.a);
    const attrs = en.running ? 'data-act="edit-running"' : `data-act="edit-entry" data-id="${esc(en.id)}"`;
    const fd = en.focus ? `<span class="focusdots" aria-label="Focus ${en.focus} of 3">${[1, 2, 3].map(n => `<i class="${n <= en.focus ? 'on' : ''}"></i>`).join('')}</span>` : '';
    return `<li data-key="${esc(en.id)}"><button type="button" class="ll-row" style="--c:${a.color}" ${attrs}><span class="ll-time">${fmtT(en.s)}–${en.running ? 'now' : fmtT(en.e)}</span><span class="ll-body"><span class="ll-name">${esc(a.name)}${fd}</span>${en.note ? `<span class="ll-note">${esc(en.note)}</span>` : ''}</span><span class="ll-dur" ${en.running ? `data-tk="dur" data-s="${en.s}"` : ''}>${fmtDur(entryEnd(en, now) - en.s)}</span></button></li>`;
  }).join('')}</ol>`;
}
function ribbonSegs(ents, now, ds, de) {
  const span = de - ds;
  return ents.map(en => {
    const s = Math.max(en.s, ds), e = Math.min(entryEnd(en, now), de);
    if (e <= s) return '';
    return `<i style="left:${((s - ds) / span * 100).toFixed(3)}%;width:${Math.max(0.25, (e - s) / span * 100).toFixed(3)}%;--c:${act(en.a).color}" title="${esc(act(en.a).name)} ${fmtT(en.s)}–${fmtT(entryEnd(en, now))}"></i>`;
  }).join('');
}
function futMask(ds, de, now) {
  if (now >= de) return '';
  const f = Math.max(0, (now - ds) / (de - ds) * 100);
  return `<i class="fut" style="left:${f.toFixed(3)}%;width:${(100 - f).toFixed(3)}%"></i>`;
}
function ribbonAxis(ds) {
  const ticks = [0, 6, 12, 18, 24];
  return ticks.map(h => `<span style="left:${(h / 24 * 100).toFixed(2)}%">${fmtHourS(new Date(ds + h * HOUR).getHours())}</span>`).join('');
}
function vBreakdown(k, now, agg, pomos) {
  const ents = dayEntries(k, now), ds = dayStartMs(k), de = dayEndMs(k);
  const sess = studySessions(ents, now, ds, de);
  const longest = sess.reduce((m, x) => Math.max(m, x.ms), 0);
  let sw = 0;
  for (let i = 1; i < ents.length; i++) if (ents[i].a !== ents[i - 1].a) sw++;
  const firstStudy = ents.find(en => isStudyId(en.a));
  const goal = (+CFG.dailyGoal || 0) * MIN;
  const rows = Object.entries(agg.acts).sort((a, b) => b[1] - a[1]);
  const max = rows.length ? rows[0][1] : 1;
  const span = Math.min(de, now) - ds;
  return `<section class="sec" aria-labelledby="brk-h"><div class="sec-head"><h2 id="brk-h">Where the day went</h2></div>
    <div><div class="ribbon" role="img" aria-label="Day from ${fmtT(ds)} to ${fmtT(de)}, logged time in color">${ribbonSegs(ents, now, ds, de)}${futMask(ds, de, now)}</div><div class="rib-ax">${ribbonAxis(ds)}</div></div>
    <dl class="kpis">
      <div><dt>Studied</dt><dd class="num">${fmtDur(agg.study)}${goal ? ` <small>/ ${fmtDur(goal)}</small>` : ''}</dd></div>
      <div><dt>Best stretch</dt><dd class="num">${longest ? fmtDur(longest) : '–'}</dd></div>
      <div><dt>Pomodoros</dt><dd class="num">${pomos || '–'}</dd></div>
      <div><dt>First study</dt><dd class="num">${firstStudy ? fmtT(Math.max(firstStudy.s, ds)) : '–'}</dd></div>
      <div><dt>Switches</dt><dd class="num">${sw || '–'}</dd></div>
      <div><dt>Untracked</dt><dd class="num">${span > 0 ? fmtDur(Math.max(0, span - agg.all)) : '–'}</dd></div>
    </dl>
    ${rows.length ? `<div class="abars">${rows.map(([id, ms]) => { const a = act(id); return `<div class="abar" style="--c:${a.color}"><span class="an"><i class="dot"></i><span>${esc(a.name)}</span></span><span class="tr"><i style="width:${(ms / max * 100).toFixed(1)}%"></i></span><span class="v">${fmtDur(ms)}</span></div>`; }).join('')}</div>` : ''}
  </section>`;
}

function sEntry(sh) {
  const d = sh.d, t = sheetTimes(sh), now = Date.now();
  const title = sh.mode === 'add' ? 'Add an entry' : sh.mode === 'running' ? 'Running timer' : 'Edit entry';
  let info = '';
  if (t) {
    const dur = t.e - t.s;
    const nextDay = sh.mode !== 'running' && dayKeyOf(t.e - 1) !== d.date;
    info = `<p class="note-line">${fmtDur(dur)}${nextDay ? ' · ends the next day' : ''}${sh.mode === 'running' ? ' so far' : ''}</p>`;
    const ov = overlapsFor(sh, t.s, t.e);
    if (ov.length && dur > 0) info += `<p class="note-line warn">Overlaps ${ov.slice(0, 3).map(o => esc(act(o.a).name) + ' ' + fmtT(o.s) + '–' + (o.running ? 'now' : fmtT(o.e))).join(', ')}${ov.length > 3 ? ' and more' : ''}.</p>
      <label class="check"><input type="checkbox" id="e-trim" data-bind="sheet.trim" ${sh.trim ? 'checked' : ''}> Trim the overlapping time from ${ov.length > 1 ? 'those entries' : 'that entry'} (splits an entry if this sits inside it)</label>`;
  }
  const nudge = (f, dlt) => `<button type="button" class="btn sm" data-act="e-nudge" data-f="${f}" data-d="${dlt}" aria-label="${f === 'start' ? 'Start' : 'End'} ${dlt > 0 ? 'later' : 'earlier'} by 5 minutes">${dlt > 0 ? '+5' : '−5'}</button>`;
  const tf = (f, label) => `<div class="field"><div class="flab"><span>${label}</span><span class="nudge">${nudge(f, -5)}${nudge(f, 5)}</span></div><input type="time" class="inp" id="e-${f}" data-bind="d.${f}" value="${esc(d[f])}" aria-label="${label} time"></div>`;
  const focusBtns = [[3, 'Deep'], [2, 'Okay'], [1, 'Scattered']].map(([v, t2]) => `<button type="button" class="${+d.focus === v ? 'on' : ''}" data-act="e-focus" data-v="${v}" aria-pressed="${+d.focus === v}">${t2}</button>`).join('');
  return `<div class="sh-head"><h2 id="sh-title">${title}</h2><button type="button" class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('x')}</button></div>
    ${actPick(d.activity, 'd.activity')}
    <div class="etimes">
      <label class="field e-day"><span>Day</span><input type="date" class="inp" id="e-date" data-bind="d.date" value="${esc(d.date)}"></label>
      ${tf('start', 'Start')}
      ${sh.mode === 'running' ? `<div class="field"><div class="flab"><span>End</span></div><div class="inp" style="display:grid;place-items:center;color:var(--ink-3)">running</div></div>` : tf('end', 'End')}
    </div>
    ${info}
    <label class="field"><span>Note</span><textarea class="inp" id="e-note" maxlength="300" data-bind="d.note" placeholder="What did you work on?">${esc(d.note)}</textarea></label>
    ${sh.mode !== 'running' && isStudyId(d.activity) ? `<div class="field"><span>Focus</span><div class="seg">${focusBtns}</div></div>` : ''}
    ${sh.err ? `<p class="err" role="alert">${esc(sh.err)}</p>` : ''}
    <div class="sh-foot"><div class="left">${sh.mode !== 'add' ? `<button type="button" class="btn sm danger ${sh.armed ? 'armed' : ''}" data-act="entry-del">${icon('trash')}${sh.armed ? 'Tap again to ' + (sh.mode === 'running' ? 'discard' : 'delete') : (sh.mode === 'running' ? 'Discard' : 'Delete')}</button>` : ''}${sh.mode === 'edit' ? `<button type="button" class="btn sm ghost" data-act="split-open">${icon('split')}Split</button>` : ''}</div>
      <button type="button" class="btn ghost" data-act="sheet-close">Cancel</button><button type="button" class="btn lamp" data-act="entry-save">${sh.mode === 'add' ? 'Add entry' : 'Save'}</button></div>`;
}
function sSplit(sh) {
  const en = ENTRIES.find(e => e.id === sh.id);
  return `<div class="sh-head"><h2 id="sh-title">Split entry</h2><button type="button" class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('x')}</button></div>
    <p class="note-line">${en ? esc(act(en.a).name) + ' ' + fmtT(en.s) + '–' + fmtT(en.e) + '. The first part keeps its activity; choose what the second part was.' : ''}</p>
    <label class="field" style="max-width:200px"><span>Split at</span><input type="time" class="inp" id="sp-at" data-bind="sheet.at" value="${esc(sh.at)}"></label>
    <div class="field"><span>Second part</span>${actPick(sh.activity, 'sheet.activity')}</div>
    ${sh.err ? `<p class="err" role="alert">${esc(sh.err)}</p>` : ''}
    <div class="sh-foot"><button type="button" class="btn ghost" data-act="sheet-close">Cancel</button><button type="button" class="btn lamp" data-act="split-save">Split</button></div>`;
}

SHEETS.entry = sEntry;
SHEETS.split = sSplit;
