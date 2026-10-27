/* ---------- example data for empty Week and Patterns pages ---------- */
let EXC = null;
function exampleMode() {
  if (UI.hideEx) return false;
  const days = new Set();
  for (const en of ENTRIES) days.add(dayKeyOf(en.s));
  return days.size < 3;
}
function exEntries(now) {
  const tk = todayKey();
  const study = ACTS.filter(a => a.kind === 'study' && !a.archived).map(a => a.id);
  const ck = tk + '|' + study.join(',');
  if (EXC && EXC.k === ck) return EXC.list;
  const ids = study.length >= 2 ? study.slice(0, 5) : Object.keys(EX_ACTS);
  const by = (pred) => { const a = ACTS.find(pred); return a ? a.id : null; };
  const life = {
    sleep: by(a => a.role === 'sleep' || a.id === 'sleep'), meals: by(a => a.id === 'meals'), break: by(a => a.role === 'break'),
    exercise: by(a => a.id === 'exercise'), commute: by(a => a.id === 'commute'), phone: by(a => a.role === 'drift'), free: by(a => a.id === 'free')
  };
  EXC = { k: ck, list: exampleEntries(now, ids, life) };
  return EXC.list;
}

/* ---------- views: Week ---------- */
function vExBar() {
  return `<div class="exbar"><span><b>Example data</b>This preview shows what the page looks like after a few weeks. Your own numbers replace it once you’ve logged three days.</span><button type="button" class="btn sm ghost" data-act="ex-hide">Hide the example</button></div>`;
}
function planStatsRange(fromK, toK, now) {
  let planned = 0, done = 0, days = 0;
  const left = {};
  for (let k = fromK; k <= toK; k = addDaysKey(k, 1)) {
    const pm = planModelFor(k, now);
    if (!pm || !pm.planned) continue;
    days++; planned += pm.planned; done += pm.done;
    if (k < todayKey()) pm.rows.forEach(r => { if (r.st !== 'done') left[r.activity] = (left[r.activity] || 0) + Math.max(0, r.target - r.done); });
  }
  const top = Object.entries(left).sort((a, b) => b[1] - a[1])[0];
  return { planned, done, days, ratio: planned ? done / planned : 0, carried: top && top[1] >= 30 * MIN ? (act(top[0]).name || String(top[0])) : null };
}
function vWeek() {
  const now = Date.now(), tk = todayKey();
  const ws = addDaysKey(weekStartKey(tk), -7 * UI.weekOff), we = addDaysKey(ws, 6);
  ensureRange(addDaysKey(ws, -7), we);
  const ex = exampleMode();
  const entries = ex ? exEntries(now) : ENTRIES;
  const keys = Array.from({ length: 7 }, (_, i) => addDaysKey(ws, i));
  const agg = aggregate(entries, now, ws, we);
  const pws = addDaysKey(ws, -7);
  const elapsed = keys.filter(k => k <= tk).length;
  const pagg = aggregate(entries, now, pws, addDaysKey(pws, Math.max(elapsed, 1) - 1));
  const sumS = a => Object.values(a).reduce((s, d) => s + d.study, 0);
  const study = sumS(agg), prev = sumS(pagg);
  const pomoD = pomodoroByDay(entries, now);
  const pomos = keys.reduce((s, k) => s + (pomoD[k] || 0), 0);
  const studied = keys.filter(k => k <= tk && agg[k] && agg[k].study >= MIN).length;
  const goal = (+CFG.dailyGoal || 0) * MIN;
  const goalDays = keys.filter(k => agg[k] && goal && agg[k].study >= goal).length;
  const ps = ex ? null : planStatsRange(ws, we < tk ? we : tk, now);
  const delta = study - prev;
  const range = `${dateOfKey(ws).getDate()} ${DF({ month: 'short' }).format(dateOfKey(ws))} – ${dateOfKey(we).getDate()} ${DF({ month: 'short', year: 'numeric' }).format(dateOfKey(we))}`;
  const head = `<section class="vhead"><button type="button" class="icon-btn" data-act="wk-prev" aria-label="Previous week">${icon('left')}</button><div class="grow"><h1>${UI.weekOff === 0 ? 'This week' : UI.weekOff === 1 ? 'Last week' : 'Week of ' + dateOfKey(ws).getDate() + ' ' + DF({ month: 'short' }).format(dateOfKey(ws))}</h1><p>${range}</p></div>${UI.weekOff > 0 ? `<button type="button" class="chip-btn" data-act="wk-this">This week</button>` : ''}<button type="button" class="icon-btn" data-act="wk-next" aria-label="Next week"${UI.weekOff === 0 ? ' disabled' : ''}>${icon('right')}</button></section>`;
  const kpi = `<dl class="kpirow">
    <div><dt>Study time</dt><dd>${fmtDur(study)}</dd><dd class="delta ${delta > 5 * MIN ? 'up' : delta < -5 * MIN ? 'down' : ''}">${prev || study ? (delta >= 0 ? '+' : '−') + fmtDur(Math.abs(delta)) + ' vs ' + (UI.weekOff === 0 ? 'same point last week' : 'the week before') : 'no study logged'}</dd></div>
    <div><dt>Daily average</dt><dd>${fmtDur(study / Math.max(elapsed, 1))}</dd><dd class="delta">over ${elapsed} day${elapsed === 1 ? '' : 's'}</dd></div>
    <div><dt>Days studied</dt><dd>${studied}<span class="delta"> / ${elapsed}</span></dd><dd class="delta">${goal ? goalDays + ' met your ' + fmtDur(goal) + ' goal' : ''}</dd></div>
    <div><dt>Pomodoros</dt><dd>${pomos}</dd><dd class="delta">completed</dd></div>
    <div><dt>Plan followed</dt><dd>${ps && ps.planned ? Math.round(ps.ratio * 100) + '%' : '–'}</dd><dd class="delta">${ps && ps.planned ? fmtDur(ps.done) + ' of ' + fmtDur(ps.planned) : 'no plans this week'}</dd></div>
  </dl>`;
  return head + (ex ? vExBar() : '') + kpi + `<div class="pgrid">
    ${vWeekBars(keys, agg, tk, goal)}
    ${vWeekRibbons(keys, entries, now, tk)}
    ${vSubjects(keys, agg, pagg, entries, now)}
    ${vLifeWeek(agg, elapsed)}
    <div class="span2">${vReview(ws, ex)}</div>
  </div>`;
}
function niceMax(ms) { const h = ms / HOUR; const steps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]; return (steps.find(s => s >= h) || Math.ceil(h)) * HOUR; }
function vWeekBars(keys, agg, tk, goal) {
  const vals = keys.map(k => (agg[k] && agg[k].study) || 0);
  const max = niceMax(Math.max(goal * 1.15, ...vals, HOUR));
  const Hpx = 180;
  const stepH = max <= 4 * HOUR ? 1 : max <= 8 * HOUR ? 2 : 4;
  const gl = [], yl = [];
  for (let h = 0; h * HOUR <= max; h += stepH) { const b = (h * HOUR / max * 100).toFixed(2); gl.push(`<i class="gl" style="bottom:${b}%"></i>`); yl.push(`<span style="bottom:${b}%">${h}h</span>`); }
  const studyActs = new Set();
  keys.forEach(k => { if (agg[k]) Object.keys(agg[k].acts).forEach(id => { if (isStudyId(id)) studyActs.add(id); }); });
  const order = Array.from(studyActs).sort((a, b) => (act(a).order || 0) - (act(b).order || 0));
  const cols = keys.map((k, i) => {
    const d = agg[k];
    const segs = d ? order.filter(id => d.acts[id]).map(id => `<i style="height:${(d.acts[id] / max * 100).toFixed(2)}%;--c:${act(id).color}" title="${esc(act(id).name)} ${fmtDur(d.acts[id])}"></i>`).join('') : '';
    const v = vals[i];
    return `<button type="button" class="ch-col ${k === tk ? 'today' : ''}" data-act="goto-day" data-k="${k}" aria-label="${esc(longDay(k))}: ${fmtDur(v)} studied">${segs}${v ? `<span class="tot" style="bottom:calc(${(v / max * 100).toFixed(2)}% + 4px)">${fmtDur(v)}</span>` : ''}</button>`;
  }).join('');
  const goalLine = goal && goal <= max ? `<i class="goal" style="bottom:${(goal / max * 100).toFixed(2)}%"><span>goal ${fmtDur(goal)}</span></i>` : '';
  return `<section class="panel" aria-labelledby="wb-h"><div class="sec-head"><h2 id="wb-h">Study by day</h2></div>
    <div class="a5-chart-summary" role="img" aria-label="${esc('Study by day: ' + keys.map((k, i) => wdName(dateOfKey(k)) + ' ' + fmtDur(vals[i])).join(', '))}"></div>
    <div class="chart"><div class="ch-y" style="height:${Hpx}px">${yl.join('')}</div><div class="ch-plot" style="height:${Hpx}px">${gl.join('')}${goalLine}<div class="ch-bars">${cols}</div></div>
    <div class="ch-x">${keys.map(k => `<span><b>${esc(wdName(dateOfKey(k)))}</b>${dateOfKey(k).getDate()}</span>`).join('')}</div></div>
    ${order.length ? `<div class="legend">${order.map(id => `<span><i style="--c:${act(id).color}"></i>${esc(act(id).name)}</span>`).join('')}</div>` : ''}
  </section>`;
}
function vWeekRibbons(keys, entries, now, tk) {
  const rows = keys.map(k => {
    const ds = dayStartMs(k), de = dayEndMs(k);
    const ents = entries.filter(en => en.s < de && entryEnd(en, now) > ds);
    return `<button type="button" class="wrib-row ${k === tk ? 'today' : ''}" data-act="goto-day" data-k="${k}" aria-label="Open ${esc(longDay(k))}"><span class="d">${esc(wdName(dateOfKey(k)))}</span><span class="ribbon">${k <= tk ? ribbonSegs(ents, now, ds, de) : ''}${futMask(ds, de, now)}</span></button>`;
  }).join('');
  const used = new Set();
  keys.forEach(k => { const ds = dayStartMs(k), de = dayEndMs(k); entries.forEach(en => { if (en.s < de && entryEnd(en, now) > ds) used.add(en.a); }); });
  const leg = Array.from(used).sort((a, b) => (isStudyId(a) === isStudyId(b) ? 0 : isStudyId(a) ? -1 : 1) || (act(a).order || 0) - (act(b).order || 0));
  return `<section class="panel" aria-labelledby="wr-h"><div class="sec-head"><h2 id="wr-h">Every hour of the week</h2></div>
    <div class="a5-chart-summary" role="img" aria-label="${esc('Activity timing across the week, ' + keys.map(k => wdName(dateOfKey(k)) + ' ' + fmtDur(entries.filter(en => en.s < dayEndMs(k) && entryEnd(en, now) > dayStartMs(k)).reduce((total, en) => total + Math.min(entryEnd(en, now), dayEndMs(k)) - Math.max(en.s, dayStartMs(k)), 0))).join(', '))}"></div>
    <div class="wrib">${rows}<div class="wrib-ax"><span></span><div class="rib-ax">${ribbonAxis(dayStartMs(keys[0]))}</div></div></div>
    <div class="legend">${leg.map(id => `<span><i style="--c:${act(id).color}"></i>${esc(act(id).name)}</span>`).join('')}<span><i class="hatch"></i>untracked</span></div>
  </section>`;
}
function vSubjects(keys, agg, pagg, entries, now) {
  const cur = {}, prev = {};
  Object.values(agg).forEach(d => { for (const id in d.acts) if (isStudyId(id)) cur[id] = (cur[id] || 0) + d.acts[id]; });
  Object.values(pagg).forEach(d => { for (const id in d.acts) if (isStudyId(id)) prev[id] = (prev[id] || 0) + d.acts[id]; });
  const ids = new Set(Object.keys(cur).concat(Object.keys(prev)));
  ACTS.forEach(a => { if (a.kind === 'study' && a.goal && !a.archived) ids.add(a.id); });
  const list = Array.from(ids).sort((a, b) => (cur[b] || 0) - (cur[a] || 0));
  if (!list.length) return `<section class="panel"><div class="sec-head"><h2>Subjects</h2></div><p class="cap">No study logged in this week.</p></section>`;
  const max = Math.max(...list.map(id => Math.max(cur[id] || 0, (act(id).goal || 0) * MIN)), 1);
  return `<section class="panel" aria-labelledby="sj-h"><div class="sec-head"><h2 id="sj-h">Subjects</h2><span class="lbl">this week · last</span></div>
    <div class="stable">${list.map(id => {
      const a = act(id), v = cur[id] || 0, p = prev[id] || 0, g = (a.goal || 0) * MIN;
      const w = g ? Math.min(100, v / g * 100) : v / max * 100;
      return `<div class="st-row" style="--c:${a.color}"><span class="an"><i class="dot"></i><span>${esc(a.name)}</span></span><span class="gbar"><span class="tr"><i style="width:${w.toFixed(1)}%"></i></span><small>${g ? Math.round(v / g * 100) + '% of ' + fmtDur(g) + ' goal' : 'no weekly goal'}</small></span><span class="v">${fmtDur(v)}<small>${fmtDur(p)}</small></span></div>`;
    }).join('')}</div>
  </section>`;
}
function vLifeWeek(agg, elapsed) {
  const tot = {};
  Object.values(agg).forEach(d => { for (const id in d.acts) if (!isStudyId(id)) tot[id] = (tot[id] || 0) + d.acts[id]; });
  const list = Object.entries(tot).sort((a, b) => b[1] - a[1]);
  if (!list.length) return `<section class="panel"><div class="sec-head"><h2>Life around study</h2></div><p class="cap">Sleep, meals, breaks and everything else you log shows up here.</p></section>`;
  const max = list[0][1];
  return `<section class="panel" aria-labelledby="lf-h"><div class="sec-head"><h2 id="lf-h">Life around study</h2><span class="lbl">total · per day</span></div>
    <div class="abars">${list.map(([id, ms]) => { const a = act(id); return `<div class="abar wide" style="--c:${a.color}"><span class="an"><i class="dot"></i><span>${esc(a.name)}</span></span><span class="tr"><i style="width:${(ms / max * 100).toFixed(1)}%"></i></span><span class="v">${fmtDur(ms)} · ${fmtDur(ms / Math.max(elapsed, 1))}</span></div>`; }).join('')}</div>
  </section>`;
}
function vReview(ws, ex) {
  const r = (V.reviews || []).find(x => x.week === ws);
  if (r && !ex) {
    const list = (title, arr) => Array.isArray(arr) && arr.length ? `<h3>${title}</h3><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    const written = parseT(r.written);
    return `<section class="review" aria-labelledby="rv-h"><div class="sec-head"><h2 id="rv-h" style="font-family:var(--f-display);font-size:22px">${esc(r.title || 'Weekly review')}</h2><span class="lbl">From Claude${written ? ' · ' + esc(shortDay(dayKeyOf(written))) : ''}</span></div>
      ${r.summary ? `<p class="rv-sum">${esc(r.summary)}</p>` : ''}${list('What went well', r.wins)}${list('Worth watching', r.watch)}${list('For next week', r.next)}</section>`;
  }
  // During an ongoing week, don't prompt for a review until Friday.
  const currentWeek = weekStartKey(todayKey());
  const friday = addDaysKey(currentWeek, (5 - ((+CFG.weekStart || 0) % 7) + 7) % 7);
  if (ws === currentWeek && todayKey() < friday)
    return `<section class="panel" aria-labelledby="rv-h"><div class="sec-head"><h2 id="rv-h">Weekly review</h2></div><p class="cap">Your weekly review prompt appears on Friday. Keep logging as the week unfolds.</p></section>`;
  return `<section class="panel" aria-labelledby="rv-h"><div class="sec-head"><h2 id="rv-h">Weekly review</h2></div><div class="empty"><p>When the week is done, ask Claude in chat for a review. It reads this week’s log and plans and writes the review here.</p><div class="ask"><code>Review my week in Carrel</code><button type="button" class="btn sm" data-act="copy" data-text="Review my week in Carrel">${icon('copy')}Copy prompt</button></div></div></section>`;
}

/* ---------- views: Patterns ---------- */
function patternsPending(pm, title) {
  if (pm.studyDays >= 7) return '';
  const needed = 7 - pm.studyDays;
  return `<section class="panel" aria-label="${esc(title)}"><div class="sec-head"><h2>${esc(title)}</h2></div><p class="cap">Needs ${needed} more day${needed === 1 ? '' : 's'} of study logs to show a reliable pattern (${pm.studyDays} of 7).</p></section>`;
}
function heatColor(f) { return f <= 0 ? 'var(--sunk)' : `color-mix(in oklab, var(--lamp) ${Math.round(18 + f * 82)}%, var(--surface))`; }
function vPatterns() {
  const now = Date.now(), tk = todayKey();
  const ex = exampleMode();
  const weeks = UI.pweeks;
  if (!ex) ensureRange(addDaysKey(tk, -7 * 16), tk);
  const entries = ex ? exEntries(now) : ENTRIES;
  const pm = patternsModel(entries, now, weeks);
  const ps = ex ? null : planStatsRange(pm.fromK, tk, now);
  const ins = insights(pm, h => fmtHourL(h), { weekday: i => rowWeekday(i, true), minuteOfDay: m => fmtMinOfDay(m) }, ps);
  const head = `<section class="vhead"><div class="grow"><h1>Patterns</h1><p>${weeks} weeks · ${pm.studyDays} study day${pm.studyDays === 1 ? '' : 's'} · ${fmtDur(pm.studyTotal)} studied</p></div><div class="seg" role="group" aria-label="Range"><button type="button" class="${weeks === 4 ? 'on' : ''}" data-act="pw" data-w="4" aria-pressed="${weeks === 4}">4 weeks</button><button type="button" class="${weeks === 12 ? 'on' : ''}" data-act="pw" data-w="12" aria-pressed="${weeks === 12}">12 weeks</button></div></section>`;
  const insHtml = ins.length ? `<ul class="insights">${ins.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>` : `<div class="empty"><p>Findings appear here after a few days of tracking, once there are at least three study days and two hours of study in the range.</p></div>`;
  return head + (ex ? vExBar() : '') + `<div class="pgrid">
    <section class="panel span2" aria-labelledby="in-h"><div class="sec-head"><h2 id="in-h">What the log says</h2></div>${insHtml}</section>
    ${vDistractionPatterns(now, weeks)}
    ${vHeat(pm)}
    ${vCal(pm, tk)}
    ${vHist(pm)}
    ${vMix(pm)}
    ${vSpans(pm)}
    ${vFocusHours(pm)}
  </div>`;
}
function vHeat(pm) {
  if (pm.studyDays < 7) return patternsPending(pm, 'When you study');
  let mx = 0;
  const avg = pm.heat.map((r, i) => r.map(v => { const a = pm.wdCount[i] ? v / pm.wdCount[i] : 0; mx = Math.max(mx, a); return a; }));
  const rows = avg.map((r, i) => `<div class="heat-row"><span>${esc(rowWeekday(i))}</span>${r.map((v, c) => `<i style="background:${heatColor(mx ? v / mx : 0)}" title="${esc(rowWeekday(i))} ${fmtHourL(pm.dsh + c)}: ${fmtDur(v)} on average"></i>`).join('')}</div>`).join('');
  const xs = `<div class="heat-row heat-x"><span></span>${Array.from({ length: 24 }, (_, c) => `<span>${c % 3 === 0 ? fmtHourS(pm.dsh + c) : ''}</span>`).join('')}</div>`;
  return `<section class="panel" aria-labelledby="ht-h"><div class="sec-head"><h2 id="ht-h">When you study</h2></div><p class="cap">Average study minutes in each hour, by weekday. Late-night hours sit on the day they belong to.</p>
    <div class="heat" role="img" aria-label="Average study by weekday and hour, with the busiest three-hour period starting at ${esc(fmtHourL(pm.dsh + pm.bestCol))}.">${rows}${xs}</div>
    <div class="scale"><span>less</span>${[0, .25, .5, .75, 1].map(f => `<i style="background:${heatColor(f)}"></i>`).join('')}<span>more</span>${mx ? `<span style="margin-left:auto">darkest = ${fmtDur(mx)}</span>` : ''}</div></section>`;
}
function vCal(pm, tk) {
  if (pm.studyDays < 7) return patternsPending(pm, 'Consistency');
  const cells = [];
  let mx = 0;
  for (let k = pm.calFrom; k <= tk; k = addDaysKey(k, 1)) mx = Math.max(mx, (pm.cal[k] && pm.cal[k].study) || 0);
  const end = addDaysKey(weekStartKey(tk), 6);
  for (let k = pm.calFrom; k <= end; k = addDaysKey(k, 1)) {
    if (k > tk) { cells.push('<i class="fut"></i>'); continue; }
    const v = (pm.cal[k] && pm.cal[k].study) || 0;
    const met = pm.goal && v >= pm.goal;
    cells.push(`<i class="${k === tk ? 'tdy' : ''}" style="background:${v ? heatColor(Math.max(0.12, v / Math.max(mx, 1))) : 'var(--sunk)'}${met ? ';box-shadow:inset 0 0 0 1.5px var(--lamp-strong)' : ''}" title="${esc(longDay(k))}: ${fmtDur(v)}"></i>`);
  }
  const lbls = Array.from({ length: 7 }, (_, i) => `<span>${i % 2 === 0 ? esc(rowWeekday(i)) : ''}</span>`).join('');
  return `<section class="panel" aria-labelledby="cl-h"><div class="sec-head"><h2 id="cl-h">Consistency</h2><span class="lbl">16 weeks</span></div>
    <p class="cap">Current streak <b class="num">${pm.streak}</b> day${pm.streak === 1 ? '' : 's'} · best <b class="num">${pm.bestStreak}</b> · a streak day means at least ${fmtDur(pm.goal)} of study (outlined squares).</p>
    <div class="cal"><div class="cal-lbls">${lbls}</div><div class="cal-grid" role="img" aria-label="Study by date for 16 weeks: current streak ${pm.streak} days, best streak ${pm.bestStreak} days; a filled square represents study time.">${cells.join('')}</div></div></section>`;
}
function vHist(pm) {
  if (pm.studyDays < 7) return patternsPending(pm, 'How long you stay with it');
  const mx = Math.max(1, ...pm.buckets.map(b => b.n));
  const names = ['<15m', '15–30', '30–45', '45–60', '1–1.5h', '1.5–2h', '2h+'];
  return `<section class="panel" aria-labelledby="hs-h"><div class="sec-head"><h2 id="hs-h">How long you stay with it</h2></div><p class="cap">Unbroken study stretches (pauses under five minutes don’t break one). Typical stretch: <b class="num">${pm.lens.length ? fmtDur(pm.median * MIN) : '–'}</b>.</p>
    <div class="hist" role="img" aria-label="Unbroken study session durations: ${pm.lens.length} sessions, median ${esc(fmtDur(pm.median * MIN))}; seven bins from under 15 minutes to two hours or longer.">${pm.buckets.map(b => `<div><span>${b.n || ''}</span><i style="height:${(b.n / mx * 100).toFixed(1)}%"></i></div>`).join('')}</div>
    <div class="hist-x">${names.map(n => `<span>${n}</span>`).join('')}</div></section>`;
}
function vMix(pm) {
  if (pm.studyDays < 7) return patternsPending(pm, 'Subjects by week');
  const mx = Math.max(1, ...pm.mix.map(w => w.total));
  const mixL = pm.mix.slice(-12);
  const i0 = mixL.findIndex(w => w.total > 0);
  if (i0 < 0) return `<section class="panel"><div class="sec-head"><h2>Subjects by week</h2></div><p class="cap">No study logged in this range yet.</p></section>`;
  const rows = mixL.slice(i0).map(w => {
    const ids = Object.keys(w.acts).sort((a, b) => (act(a).order || 0) - (act(b).order || 0));
    const segs = ids.map(id => `<i style="width:${(w.acts[id] / mx * 100).toFixed(2)}%;--c:${act(id).color}" title="${esc(act(id).name)} ${fmtDur(w.acts[id])}"></i>`).join('');
    return `<div class="mix-row"><span>${dateOfKey(w.w).getDate()} ${esc(DF({ month: 'short' }).format(dateOfKey(w.w)))}</span><span class="bar">${segs}</span><span class="v">${fmtDur(w.total)}</span></div>`;
  }).join('');
  const used = new Set();
  pm.mix.forEach(w => Object.keys(w.acts).forEach(id => used.add(id)));
  return `<section class="panel" aria-labelledby="mx-h"><div class="sec-head"><h2 id="mx-h">Subjects by week</h2></div><div class="mix" role="img" aria-label="${esc('Weekly subject mix: ' + mixL.slice(i0).map(w => w.w + ', ' + fmtDur(w.total)).join('; '))}">${rows}</div>
    <div class="legend">${Array.from(used).map(id => `<span><i style="--c:${act(id).color}"></i>${esc(act(id).name)}</span>`).join('')}</div></section>`;
}
function vSpans(pm) {
  if (pm.studyDays < 7) return patternsPending(pm, 'Study hours of each day');
  if (!pm.spans.length) return `<section class="panel"><div class="sec-head"><h2>Study hours of each day</h2></div><p class="cap">Shows when your first and last study of each day happened.</p></section>`;
  const lo = Math.max(0, Math.floor(Math.min(...pm.spans.map(s => s.first)) / 60) * 60);
  const hi = Math.min(1440, Math.ceil(Math.max(...pm.spans.map(s => s.last)) / 60) * 60);
  const span = Math.max(60, hi - lo);
  const byK = {};
  pm.spans.forEach(s => { byK[s.k] = s; });
  const cols = pm.keys.map(k => { const s = byK[k]; return `<div>${s ? `<i style="top:${((s.first - lo) / span * 100).toFixed(2)}%;height:${Math.max(1, (s.last - s.first) / span * 100).toFixed(2)}%" title="${esc(longDay(k))}: ${fmtMinOfDay(s.first)}–${fmtMinOfDay(s.last)}"></i>` : ''}</div>`; }).join('');
  const step = span > 12 * 60 ? 180 : 120;
  const ys = [];
  for (let m = lo; m <= hi; m += step) ys.push(`<span style="top:${((m - lo) / span * 100).toFixed(2)}%">${fmtMinOfDay(m)}</span>`);
  return `<section class="panel" aria-labelledby="sp-h"><div class="sec-head"><h2 id="sp-h">Study hours of each day</h2></div><p class="cap">Each bar runs from your first study to your last, oldest day on the left.</p>
    <div class="spans-wrap"><div class="spans-y">${ys.join('')}</div><div class="spans" role="img" aria-label="${esc('First and last study of ' + pm.spans.length + ' logged study days, ordered oldest to newest.')}">${cols}</div></div></section>`;
}
function vFocusHours(pm) {
  if (pm.studyDays < 7) return patternsPending(pm, 'Focus by hour');
  if (pm.rated < 8) return `<section class="panel" aria-labelledby="fq-h"><div class="sec-head"><h2 id="fq-h">Focus by hour</h2></div><p class="cap">After you stop a study timer, rate it Deep, Okay or Scattered in the message that appears. After eight ratings this shows when your best focus happens.</p></section>`;
  const cols = pm.fh.map((x, i) => ({ i, v: x.w ? x.v / x.w : 0, w: x.w })).filter(x => x.w > 0);
  return `<section class="panel" aria-labelledby="fq-h"><div class="sec-head"><h2 id="fq-h">Focus by hour</h2></div><p class="cap">Average rating of sessions started in each hour (3 = deep).</p>
    <div class="abars" role="img" aria-label="${esc('Average focus rating by starting hour: ' + cols.map(x => fmtHourL(pm.dsh + x.i) + ' ' + x.v.toFixed(1) + ' of 3').join('; '))}">${cols.map(x => `<div class="abar" style="--c:var(--lamp)"><span class="an"><span class="num">${fmtHourL(pm.dsh + x.i)}</span></span><span class="tr"><i style="width:${(x.v / 3 * 100).toFixed(1)}%"></i></span><span class="v">${x.v.toFixed(1)}</span></div>`).join('')}</div></section>`;
}


VIEWS.stats = vWeek;
VIEWS.week = vWeek;
VIEWS.patterns = vPatterns;
