/* ===== Carrel logic: time math, stats, plan projection (pure; reads CTX) ===== */
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const CTX = { cfg: null, act: null };
const pad = n => String(n).padStart(2, '0');

function hmToMin(hm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm || '');
  return m ? ((+m[1]) % 24) * 60 + Math.min(59, +m[2]) : 0;
}
function minToHm(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
function keyOfDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function dateOfKey(k) { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDaysKey(k, n) { const d = dateOfKey(k); d.setDate(d.getDate() + n); return keyOfDate(d); }
function dsMin() { return hmToMin(CTX.cfg.dayStart); }
/* A "day" runs from the day-start time (default 04:00) to the same time next morning,
   so studying past midnight still counts toward the evening it began. */
function dayKeyOf(ms) { return keyOfDate(new Date(ms - dsMin() * MIN)); }
function dayStartMs(k) { const d = dateOfKey(k); const m = dsMin(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); }
function dayEndMs(k) { return dayStartMs(addDaysKey(k, 1)); }
function hmOnDay(k, hm) { const off = (hmToMin(hm) - dsMin() + 1440) % 1440; return dayStartMs(k) + off * MIN; }
function msToHm(ms) { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function weekdayOfKey(k) { return dateOfKey(k).getDay(); }
function weekStartKey(k) { const diff = (weekdayOfKey(k) - (+CTX.cfg.weekStart || 0) + 7) % 7; return addDaysKey(k, -diff); }
function isoLocal(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), a = Math.abs(off);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' +
    pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + (off >= 0 ? '+' : '-') + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
}
function parseT(v) { if (v == null || v === '') return null; if (typeof v === 'number') return v; const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
function fmtDur(ms) {
  const m = Math.round(Math.max(0, ms || 0) / MIN);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? h + 'h ' + r + 'm' : h + 'h';
}
function fmtClock(ms, forceH) {
  const neg = ms < 0, s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (neg ? '+' : '') + (h || forceH ? h + ':' + pad(m) : String(m)) + ':' + pad(x);
}
function isStudyId(id) { const a = CTX.act(id); return !!a && a.kind === 'study'; }
function entryEnd(en, now) { return en.e == null ? now : en.e; }

function eachDaySlice(s, e, cb) {
  let k = dayKeyOf(s), t = s, guard = 0;
  while (t < e && guard++ < 400) {
    const end = Math.min(e, dayEndMs(k));
    if (end > t) { cb(k, t, end); t = end; }
    k = addDaysKey(k, 1);
  }
}

/* Per-day totals between two day keys (inclusive): { key: { acts: {id: ms}, study: ms, all: ms } } */
function aggregate(entries, now, fromK, toK) {
  const out = {}, lo = dayStartMs(fromK), hi = dayEndMs(toK);
  for (const en of entries) {
    const e = entryEnd(en, now);
    if (e <= lo || en.s >= hi || e <= en.s) continue;
    const study = isStudyId(en.a);
    eachDaySlice(Math.max(en.s, lo), Math.min(e, hi), (k, a, b) => {
      const d = out[k] || (out[k] = { acts: {}, study: 0, all: 0 });
      const ms = b - a;
      d.acts[en.a] = (d.acts[en.a] || 0) + ms;
      d.all += ms;
      if (study) d.study += ms;
    });
  }
  return out;
}

/* Completed pomodoros per day: focus phases whose logged focus time reached the target. */
function pomodoroByDay(entries, now) {
  const ph = new Map();
  for (const en of entries) {
    const p = en.pomo;
    if (!p || !p.phase) continue;
    const o = ph.get(p.phase) || { ms: 0, target: +p.target || 25, s: parseT(p.phase) };
    o.ms += entryEnd(en, now) - en.s;
    ph.set(p.phase, o);
  }
  const out = {};
  for (const o of ph.values()) {
    if (o.s != null && o.ms >= o.target * MIN - 30000) { const k = dayKeyOf(o.s); out[k] = (out[k] || 0) + 1; }
  }
  return out;
}

/* Continuous study stretches: study entries closer than 5 minutes merge, subject switches inside are counted. */
function studySessions(entries, now, lo, hi) {
  const st = entries.filter(en => isStudyId(en.a))
    .map(en => ({ s: Math.max(en.s, lo), e: Math.min(entryEnd(en, now), hi), a: en.a }))
    .filter(x => x.e > x.s).sort((a, b) => a.s - b.s);
  const out = [];
  let cur = null;
  for (const x of st) {
    if (cur && x.s - cur.e <= 5 * MIN) {
      cur.ms += Math.max(0, x.e - Math.max(x.s, cur.e));
      cur.e = Math.max(cur.e, x.e);
      if (x.a !== cur.lastA) { cur.switches++; cur.lastA = x.a; }
    } else {
      cur = { s: x.s, e: x.e, ms: x.e - x.s, switches: 0, lastA: x.a };
      out.push(cur);
    }
  }
  return out;
}

/* ---------- Plans: attribution of logged time to blocks, then projection of what is left ---------- */
function planCompute(plan, k, entries, now, cur, busy) {
  if (!plan) return null;
  const blocks = Object.entries(plan.blocks || {})
    .filter(([, b]) => b && b.activity)
    .map(([id, b]) => ({
      id, activity: b.activity, title: b.title || '', minutes: Math.max(0, Math.round(+b.minutes || 0)),
      orig: b.orig != null ? Math.round(+b.orig) : null, order: +b.order || 0, at: b.at || null,
      status: b.status || 'open', pomo: b.pomo || null, from: b.from || null, done: 0
    }))
    .sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : 1));
  const ds = dayStartMs(k), de = dayEndMs(k), byId = {};
  blocks.forEach(b => { byId[b.id] = b; });
  const closed = s => s === 'skipped' || s === 'moved' || s === 'done';
  const unplanned = {};
  let activeId = null;
  const rel = entries.filter(en => en.s < de && entryEnd(en, now) > ds).sort((a, b) => a.s - b.s);
  const rest = [];
  for (const en of rel) {
    const ms = Math.max(0, Math.min(entryEnd(en, now), de) - Math.max(en.s, ds));
    const b = en.block ? byId[en.block] : null;
    if (b && b.activity === en.a && b.status !== 'skipped') { b.done += ms; if (en.running) activeId = b.id; }
    else rest.push([en, ms]);
  }
  for (const [en, ms0] of rest) {
    let ms = ms0, last = null;
    for (const b of blocks) {
      if (b.activity !== en.a || closed(b.status)) continue;
      const cap = b.minutes * MIN - b.done;
      if (cap <= 0) continue;
      if (ms <= 0) { if (en.running && !last) last = b.id; break; }
      const take = Math.min(cap, ms);
      b.done += take; ms -= take; last = b.id;
    }
    if (ms > 0) unplanned[en.a] = (unplanned[en.a] || 0) + ms;
    else if (en.running && last) activeId = last;
  }
  const rows = blocks.map(b => {
    const target = b.minutes * MIN;
    let st = b.status;
    if (st === 'open') {
      if (b.id === activeId) st = 'active';
      else if (target > 0 && b.done >= target - 30000) st = 'done';
      else if (b.done > 0) st = 'partial';
    }
    const live = st === 'open' || st === 'partial' || st === 'active';
    return Object.assign(b, { target, st, remaining: live ? Math.max(0, target - b.done) : 0, pieces: [], over: 0, missed: false, late: false, clash: false, clashWith: null });
  });
  const tk = dayKeyOf(now);
  const model = {
    k, rows, unplanned, activeId, isToday: k === tk, isFuture: k > tk,
    planned: rows.reduce((s, r) => s + (r.st === 'skipped' ? 0 : r.target), 0),
    orig: rows.reduce((s, r) => s + (r.orig != null ? r.orig * MIN : r.target), 0),
    done: rows.reduce((s, r) => s + (r.st === 'skipped' ? 0 : Math.min(r.done, r.target)), 0),
    remaining: rows.reduce((s, r) => s + r.remaining, 0),
    endMs: hmOnDay(k, plan.end || CTX.cfg.planEnd),
    startMs: hmOnDay(k, plan.start || CTX.cfg.planStart),
    finish: null, over: 0, missed: []
  };
  if (model.isToday || model.isFuture) projectPlan(model, now, cur, busy || []);
  return model;
}

function projectPlan(model, now, cur, busy) {
  const k = model.k, gap = Math.max(0, +CTX.cfg.gap || 0) * MIN;
  let cursor = model.isToday ? now : model.startMs;
  if (model.isToday && cur && cur.running && cur.pomo && cur.pomo.phase === 'break') {
    const be = parseT(cur.pomo.phaseStart) + (+cur.pomo.breakLen || 5) * MIN;
    if (be > cursor) cursor = be;
  }
  const live = model.rows.filter(r => r.remaining > 0);
  let active = null;
  const fixed = [], late = [], flex = [];
  for (const r of live) {
    if (r.st === 'active') { active = r; continue; }
    if (r.at) {
      const a = hmOnDay(k, r.at);
      if (!model.isToday || a >= now) fixed.push(r);
      else if (r.done === 0 && now >= a + r.target) { r.missed = true; model.missed.push(r); }
      else { r.late = true; late.push(r); }
    } else flex.push(r);
  }
  const bz = (busy || []).filter(b => b && b[1] > b[0]);
  const fx = fixed.map(r => {
    const a = hmOnDay(k, r.at), b = a + r.remaining;
    r.pieces.push([a, b]);
    const clashWith = bz.findIndex(z => z[0] < b && z[1] > a);
    if (clashWith >= 0) { r.clash = true; r.clashWith = clashWith; }
    return [a, b];
  }).concat(bz.map(z => [z[0], z[1]])).sort((x, y) => x[0] - y[0]);
  const flow = (r, first) => {
    let rem = r.remaining, guard = 0;
    if (first) {
      // the running block keeps going from now until the next fixed or busy item
      const nf = fx.find(([fa]) => fa > now);
      const end = Math.min(now + rem, nf ? nf[0] : Infinity);
      r.pieces.push([now, end]);
      rem -= end - now;
      cursor = Math.max(cursor, end);
      if (rem <= 0) { cursor = Math.max(cursor, end + gap); return; }
      cursor = nf[1] + gap;
    }
    while (rem > 0 && guard++ < 80) {
      for (const [fa, fb] of fx) if (cursor >= fa - gap && cursor < fb) cursor = fb + gap;
      const nf = fx.find(([fa]) => fa >= cursor);
      const limit = nf ? nf[0] - gap : Infinity;
      const avail = limit - cursor;
      if (nf && avail < Math.min(rem, 20 * MIN)) { cursor = nf[1] + gap; continue; }
      const take = Math.min(rem, avail);
      r.pieces.push([cursor, cursor + take]);
      rem -= take; cursor += take;
    }
    cursor += gap;
  };
  if (active) flow(active, true);
  for (const r of late.concat(flex)) flow(r, false);
  let finish = null, over = 0;
  for (const r of model.rows) {
    for (const [a, b] of r.pieces) {
      finish = finish == null ? b : Math.max(finish, b);
      const o = Math.max(0, b - Math.max(a, model.endMs));
      r.over += o; over += o;
    }
  }
  model.finish = finish;
  model.over = over;
}

/* Busy time for one day: weekly timetable items plus one-off events stored on that day's plan. */
function busyFor(k, commitments, plan) {
  const out = [], wd = weekdayOfKey(k), skip = (plan && plan.skip) || {};
  for (const id in commitments || {}) {
    const c = commitments[id];
    if (!c || c.archived || !Array.isArray(c.days) || c.days.indexOf(wd) < 0 || !c.start || !c.end) continue;
    if ((c.from && k < c.from) || (c.until && k > c.until) || skip[id]) continue;
    const s = hmOnDay(k, c.start);
    let e = hmOnDay(k, c.end);
    if (e <= s) e += DAY;
    out.push({ id, rec: true, title: c.title || 'Busy', activity: c.activity || null, s, e });
  }
  const evs = (plan && plan.events) || {};
  for (const id in evs) {
    const v = evs[id];
    if (!v || !v.start || !v.end) continue;
    const s = hmOnDay(k, v.start);
    let e = hmOnDay(k, v.end);
    if (e <= s) e += DAY;
    out.push({ id, rec: false, title: v.title || 'Busy', activity: v.activity || null, s, e });
  }
  return out.sort((a, b) => a.s - b.s);
}
function mergeIntervals(list) {
  const xs = list.filter(x => x[1] > x[0]).sort((a, b) => a[0] - b[0]), out = [];
  for (const x of xs) { const l = out[out.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else out.push([x[0], x[1]]); }
  return out;
}
/* Free time left in a day's planning window (minus busy time) against the plan still to do. */
function dayCapacity(k, plan, pm, busy, now) {
  const tk = dayKeyOf(now);
  if (k < tk) return null;
  const ws = hmOnDay(k, (plan && plan.start) || CTX.cfg.planStart);
  const we = hmOnDay(k, (plan && plan.end) || CTX.cfg.planEnd);
  const from = k === tk ? Math.max(ws, now) : ws;
  let free = Math.max(0, we - from);
  mergeIntervals((busy || []).map(b => [Math.max(b[0], from), Math.min(b[1], we)])).forEach(([a, b]) => { free -= b - a; });
  return { free: Math.max(0, free), need: pm ? pm.remaining : 0, from, to: we };
}
/* Side-by-side columns for overlapping calendar items (each item gets col and ncol). */
function layoutOverlaps(items) {
  items.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
  let cluster = [], end = -Infinity;
  const flush = () => {
    const cols = [];
    for (const it of cluster) {
      let c = cols.findIndex(x => x <= it.s);
      if (c < 0) { c = cols.length; cols.push(it.e); } else cols[c] = it.e;
      it.col = c;
    }
    cluster.forEach(it => { it.ncol = cols.length; });
    cluster = [];
  };
  for (const it of items) {
    if (it.s >= end) { flush(); end = -Infinity; }
    cluster.push(it);
    end = Math.max(end, it.e);
  }
  flush();
  return items;
}

/* ---------- Patterns ---------- */
function patternsModel(entries, now, weeks, extra) {
  const cfg = CTX.cfg, tk = dayKeyOf(now);
  const fromK = addDaysKey(tk, -(weeks * 7) + 1);
  const keys = [];
  for (let k = fromK; k <= tk; k = addDaysKey(k, 1)) keys.push(k);
  const agg = aggregate(entries, now, fromK, tk);
  const lo = dayStartMs(fromK), hi = Math.min(dayEndMs(tk), now);
  const dsh = Math.floor(dsMin() / 60), ws = +cfg.weekStart || 0;
  const rowOf = k => (weekdayOfKey(k) - ws + 7) % 7;

  // hour-of-day heat by weekday (study only)
  const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const wdCount = new Array(7).fill(0);
  keys.forEach(k => { wdCount[rowOf(k)]++; });
  for (const en of entries) {
    if (!isStudyId(en.a)) continue;
    let s = Math.max(en.s, lo);
    const e = Math.min(entryEnd(en, now), hi);
    let guard = 0;
    while (s < e && guard++ < 600) {
      const d = new Date(s);
      const hEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
      const b = Math.min(e, hEnd);
      heat[rowOf(dayKeyOf(s))][(d.getHours() - dsh + 24) % 24] += b - s;
      s = b;
    }
  }
  const colTotals = new Array(24).fill(0);
  heat.forEach(r => r.forEach((v, i) => { colTotals[i] += v; }));
  const studyTotal = keys.reduce((s, k) => s + ((agg[k] && agg[k].study) || 0), 0);

  // best 3-hour window
  let best = -1, bestCol = 0;
  for (let i = 0; i < 24; i++) { const v = colTotals[i] + colTotals[(i + 1) % 24] + colTotals[(i + 2) % 24]; if (v > best) { best = v; bestCol = i; } }

  // weekday averages
  const wdSum = new Array(7).fill(0);
  keys.forEach(k => { wdSum[rowOf(k)] += (agg[k] && agg[k].study) || 0; });
  const wdAvg = wdSum.map((v, i) => wdCount[i] ? v / wdCount[i] : 0);

  // sessions
  const sess = studySessions(entries, now, lo, hi);
  const lens = sess.map(x => x.ms / MIN).sort((a, b) => a - b);
  const median = lens.length ? lens[Math.floor(lens.length / 2)] : 0;
  const buckets = [[0, 15], [15, 30], [30, 45], [45, 60], [60, 90], [90, 120], [120, Infinity]].map(([a, b]) => ({ a, b, n: lens.filter(x => x >= a && x < b).length }));
  const switches = sess.reduce((s, x) => s + x.switches, 0);
  const sessMs = sess.reduce((s, x) => s + x.ms, 0);

  // first and last study per day (minutes after day start)
  const spans = [];
  for (const k of keys) {
    const ds = dayStartMs(k), de = dayEndMs(k);
    let first = null, last = null;
    for (const en of entries) {
      if (!isStudyId(en.a)) continue;
      const e = entryEnd(en, now);
      if (e <= ds || en.s >= de) continue;
      const a = Math.max(en.s, ds), b = Math.min(e, de);
      if (first == null || a < first) first = a;
      if (last == null || b > last) last = b;
    }
    if (first != null) spans.push({ k, first: (first - ds) / MIN, last: (last - ds) / MIN, weekend: [0, 6].includes(weekdayOfKey(k)) });
  }
  const avgOf = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
  const wkdStart = avgOf(spans.filter(x => !x.weekend).map(x => x.first));
  const wkeStart = avgOf(spans.filter(x => x.weekend).map(x => x.first));

  // weekly subject mix
  const mix = [];
  for (let w = weekStartKey(fromK); w <= tk; w = addDaysKey(w, 7)) {
    const a = aggregate(entries, now, w, addDaysKey(w, 6));
    const acts = {};
    Object.values(a).forEach(d => { for (const id in d.acts) if (isStudyId(id)) acts[id] = (acts[id] || 0) + d.acts[id]; });
    mix.push({ w, acts, total: Object.values(acts).reduce((s, v) => s + v, 0) });
  }

  // focus rating by clock hour (weighted by duration)
  const fh = Array.from({ length: 24 }, () => ({ w: 0, v: 0, n: 0 }));
  let rated = 0;
  for (const en of entries) {
    if (!en.focus || en.e == null || en.s < lo || !isStudyId(en.a)) continue;
    const h = (new Date(en.s).getHours() - dsh + 24) % 24, w = en.e - en.s;
    fh[h].w += w; fh[h].v += w * en.focus; fh[h].n++; rated++;
  }

  // life signals
  const lifeAvg = {};
  const ids = new Set();
  Object.values(agg).forEach(d => Object.keys(d.acts).forEach(id => ids.add(id)));
  for (const id of ids) {
    if (isStudyId(id)) continue;
    const vals = keys.map(k => (agg[k] && agg[k].acts[id]) || 0).filter(v => v > 0);
    if (vals.length) lifeAvg[id] = { avg: vals.reduce((s, v) => s + v, 0) / vals.length, days: vals.length };
  }

  // streaks
  const goal = (+cfg.dailyGoal || 60) * MIN;
  const calFrom = weekStartKey(addDaysKey(tk, -7 * 15));
  const cal = aggregate(entries, now, calFrom, tk);
  let streak = 0;
  {
    let k = tk;
    if (!((cal[k] && cal[k].study) >= goal)) k = addDaysKey(k, -1);
    while ((cal[k] && cal[k].study) >= goal) { streak++; k = addDaysKey(k, -1); }
  }
  let bestStreak = 0, run = 0;
  for (let k = calFrom; k <= tk; k = addDaysKey(k, 1)) {
    if ((cal[k] && cal[k].study) >= goal) { run++; bestStreak = Math.max(bestStreak, run); } else run = 0;
  }
  const daysWithData = keys.filter(k => agg[k] && agg[k].all > 0).length;
  const studyDays = keys.filter(k => agg[k] && agg[k].study >= MIN).length;

  return {
    fromK, tk, keys, agg, heat, wdCount, colTotals, studyTotal, bestCol, best, wdAvg, sess, lens, median, buckets,
    switches, sessMs, spans, wkdStart, wkeStart, mix, fh, rated, lifeAvg, calFrom, cal, streak, bestStreak, goal,
    daysWithData, studyDays, dsh, extra: extra || null
  };
}

/* Plain-language findings, only where the data supports them. */
function insights(pm, fmtHourLabel, nameOf, planStats) {
  const out = [];
  if (pm.studyDays < 3 || pm.studyTotal < 2 * HOUR) return out;
  if (pm.best > 0) {
    const share = Math.round(pm.best / pm.studyTotal * 100);
    const a = (pm.dsh + pm.bestCol) % 24, b = (a + 3) % 24;
    out.push({ k: 'peak', text: 'Most of your study happens between ' + fmtHourLabel(a) + ' and ' + fmtHourLabel(b) + ' (' + share + '% of it).' });
  }
  const wd = pm.wdAvg.map((v, i) => ({ v, i })).filter(x => pm.wdCount[x.i] > 0);
  if (wd.length >= 5) {
    wd.sort((x, y) => y.v - x.v);
    const hi = wd[0], lo = wd[wd.length - 1];
    if (hi.v - lo.v > 30 * MIN) out.push({ k: 'days', text: nameOf.weekday(hi.i) + ' is your strongest day (' + fmtDur(hi.v) + ' on average); ' + nameOf.weekday(lo.i) + ' the lightest (' + fmtDur(lo.v) + ').' });
  }
  if (pm.lens.length >= 6) {
    const short = Math.round(pm.lens.filter(x => x < 15).length / pm.lens.length * 100);
    out.push({ k: 'sess', text: 'Your typical unbroken study stretch is ' + fmtDur(pm.median * MIN) + (short >= 10 ? '; ' + short + '% of stretches end within 15 minutes.' : '.') });
  }
  if (pm.switches >= 3 && pm.sessMs > 0) {
    out.push({ k: 'switch', text: 'While studying you change subject about every ' + fmtDur(pm.sessMs / pm.switches) + '.' });
  }
  if (pm.wkdStart != null) {
    let t = 'You start studying around ' + nameOf.minuteOfDay(pm.wkdStart) + ' on weekdays';
    if (pm.wkeStart != null && Math.abs(pm.wkeStart - pm.wkdStart) >= 30) t += ' and ' + nameOf.minuteOfDay(pm.wkeStart) + ' at weekends';
    out.push({ k: 'start', text: t + '.' });
  }
  if (planStats && planStats.days >= 3) {
    let t = 'You complete ' + Math.round(planStats.ratio * 100) + '% of planned time';
    if (planStats.carried) t += '; ' + planStats.carried + ' is the subject most often left unfinished';
    out.push({ k: 'plan', text: t + '.' });
  }
  for (const id in pm.lifeAvg) {
    const a = CTX.act(id), x = pm.lifeAvg[id];
    if (a && a.role === 'sleep' && x.days >= 5) out.push({ k: 'sleep', text: 'You log ' + fmtDur(x.avg) + ' of sleep on an average night.' });
    if (a && a.role === 'drift' && x.days >= 4) out.push({ k: 'drift', text: a.name + ' takes ' + fmtDur(x.avg) + ' on the days you log it.' });
  }
  if (pm.rated >= 8) {
    let bi = -1, bv = 0, tw = 0, tv = 0;
    pm.fh.forEach(x => { tw += x.w; tv += x.v; });
    const overall = tw ? tv / tw : 0;
    pm.fh.forEach((x, i) => { if (x.n >= 3 && x.w >= 60 * MIN) { const v = x.v / x.w; if (v > bv) { bv = v; bi = i; } } });
    if (bi >= 0 && bv >= overall + 0.25) out.push({ k: 'focus', text: 'Sessions you start around ' + fmtHourLabel((pm.dsh + bi) % 24) + ' get your best focus ratings.' });
  }
  return out;
}

/* ---------- Example data for previews (never saved) ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function exampleEntries(now, studyIds, life) {
  const out = [], tk = dayKeyOf(now), rnd = mulberry32(20261024);
  const J = n => Math.round((rnd() - 0.5) * 2 * n);
  const pick = () => studyIds[Math.floor(rnd() * studyIds.length)];
  let carry = 0;
  for (let i = 84; i >= 1; i--) {
    const k = addDaysKey(tk, -i), dow = weekdayOfKey(k), weekend = dow === 0 || dow === 6;
    const base = dateOfKey(k).getTime();
    const at = (h, m) => base + (h * 60 + (m || 0)) * MIN;
    let t = Math.max(at(weekend ? 8 : 7, J(20)), carry + 5 * MIN);
    const push = (a, dur, focus) => { if (a && dur > 0) out.push({ id: 'x' + out.length, a, s: t, e: t + dur * MIN, focus: focus || null, note: '', block: null, pomo: null, day: k }); t += dur * MIN; };
    const gapM = m => { t += m * MIN; };
    push(life.meals, 25 + J(5)); gapM(10 + J(6));
    if (!weekend && life.commute && rnd() < 0.5) push(life.commute, 25 + J(8));
    const nm = weekend ? 1 + (rnd() < 0.5 ? 1 : 0) : 3 + (rnd() < 0.4 ? 1 : 0);
    for (let j = 0; j < nm; j++) {
      push(pick(), 35 + Math.round(rnd() * 45), rnd() < 0.6 ? 3 : rnd() < 0.7 ? 2 : 1);
      if (rnd() < 0.25) push(life.phone, 8 + Math.round(rnd() * 15));
      push(life.break, 6 + Math.round(rnd() * 8));
    }
    t = Math.max(t, at(13, J(15)));
    push(life.meals, 35 + J(10)); gapM(15 + J(10));
    const na = weekend ? (rnd() < 0.6 ? 1 : 0) : 2 + (rnd() < 0.5 ? 1 : 0);
    for (let j = 0; j < na; j++) {
      push(pick(), 30 + Math.round(rnd() * 40), rnd() < 0.35 ? 3 : rnd() < 0.7 ? 2 : 1);
      if (rnd() < 0.35) push(life.phone, 10 + Math.round(rnd() * 20));
      push(life.break, 8 + Math.round(rnd() * 8));
    }
    if (life.exercise && rnd() < (weekend ? 0.6 : 0.35)) { gapM(20); push(life.exercise, 40 + J(10)); }
    t = Math.max(t, at(19, 30 + J(20)));
    push(life.meals, 40 + J(10));
    if (rnd() < (weekend ? 0.3 : 0.7)) push(pick(), 45 + Math.round(rnd() * 50), rnd() < 0.3 ? 3 : 2);
    push(life.phone, 20 + Math.round(rnd() * 40));
    push(life.free, 30 + Math.round(rnd() * 40));
    t = Math.max(t, at(23, J(30)));
    push(life.sleep, 7 * 60 + J(50));
    carry = t;
  }
  return out.filter(x => x.e <= now);
}


/* ---------- Carrel Live: phone bridge (pure) ---------- */
const LIVE_URL = 'https://claude.ai/artifact/GPbHEVpi3YYoRM7UcpZxT6';
function b64urlEnc(str) {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDec(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64').toString('utf8');
  const bin = atob(s); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function encodeToken(obj) { return 'carrel1:' + b64urlEnc(JSON.stringify(obj)); }
/* Finds the first well-formed carrel1 token anywhere in a description (Google may wrap it in HTML). */
function decodeToken(desc) {
  if (typeof desc !== 'string' || desc.length > 1048576) return null;
  const re = /carrel1:([A-Za-z0-9_-]+)/g; let m;
  while ((m = re.exec(desc))) {
    try { const o = JSON.parse(b64urlDec(m[1])); if (o && typeof o === 'object' && o.v === 1) return o; } catch (e) { /* try the next candidate */ }
  }
  return null;
}
const LIVE_FALLBACK_COLOR = '#B5543A';
function liveColor(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : LIVE_FALLBACK_COLOR; }
/* o: { act(id)->{id,name,color}, breakId, url, rev, blockTitle } */
function liveStateOf(cur, o) {
  const base = { v: 1, kind: 'state', rev: Math.round(o.rev), status: 'idle', activity: null, startedAt: null, intention: null, pomo: null, breakStartedAt: null, returnTo: null, url: o.url || LIVE_URL };
  if (!cur || !cur.running) return base;
  const a = o.act(cur.activity) || {}, start = parseT(cur.start);
  if (start == null) return base;
  const actv = { id: String(cur.activity), name: String(a.name || 'Study').slice(0, 80), color: liveColor(a.color) };
  const pm = cur.pomo, ps = pm && parseT(pm.phaseStart);
  if (o.breakId && cur.activity === o.breakId) {
    let pomo = null;
    if (pm && pm.phase === 'break' && +pm.breakLen > 0 && ps != null) pomo = { focusEndsAt: null, breakEndsAt: Math.round(ps + pm.breakLen * MIN) };
    let returnTo = null;
    const r = cur.ret && cur.ret.activity && o.act(cur.ret.activity);
    if (r) returnTo = { name: String(r.name || 'Study').slice(0, 80), color: liveColor(r.color) };
    return Object.assign(base, { status: 'break', activity: actv, breakStartedAt: Math.round(start), returnTo, pomo });
  }
  const note = (cur.note || '').trim() || (o.blockTitle || '').trim();
  let pomo = null;
  if (pm && pm.phase === 'focus' && +pm.focus > 0 && ps != null) pomo = { focusEndsAt: Math.round(ps + pm.focus * MIN) };
  return Object.assign(base, { status: 'running', activity: actv, startedAt: Math.round(start), intention: note ? note.slice(0, 200) : null, pomo });
}
function liveTitle(state) { return state.status === 'running' ? '▶ ' + state.activity.name : state.status === 'break' ? '☕ Break' : 'Carrel · idle'; }
const MARK_TYPES = ['urge', 'drift', 'park', 'stop', 'break'];
/* Validates a decoded mark payload the way the phone app does; returns a clean mark or null. */
function cleanMark(o) {
  if (!o || o.kind !== 'mark' || o.v !== 1 || MARK_TYPES.indexOf(o.type) < 0) return null;
  if (typeof o.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(o.id) || !Number.isInteger(o.at)) return null;
  const cmd = o.type === 'stop' || o.type === 'break';
  if (o.type === 'drift' && [1, 5, 15].indexOf(o.driftMin) < 0) return null;
  if (o.type !== 'drift' && o.driftMin != null) return null;
  if (o.type === 'park' && typeof o.text !== 'string') return null;
  if (cmd && !Number.isInteger(o.startedAt)) return null;
  return { id: o.id, type: o.type, at: o.at, driftMin: o.driftMin || null, text: o.type === 'park' ? o.text.trim().slice(0, 300) : null, activityId: typeof o.activityId === 'string' ? o.activityId : null, stateRev: Number.isInteger(o.stateRev) ? o.stateRev : null, startedAt: cmd ? o.startedAt : null };
}
/* Orders marks by time and decides what to do with each. curStart is the running timer's start (ms) or null.
   A stop/break only applies if it was made against the timer that is running now; the timer's start moves as we go. */
function planMarks(marks, curStart, imported) {
  imported = imported || {};
  const seen = {}, list = marks.filter(m => m && !imported[m.id] && !seen[m.id] && (seen[m.id] = true)).sort((a, b) => a.at - b.at);
  let start = curStart == null ? null : curStart;
  return list.map(m => {
    if (m.type === 'stop') { if (start != null && m.startedAt === start) { start = null; return { mark: m, action: 'stop' }; } return { mark: m, action: 'stale' }; }
    if (m.type === 'break') { if (start != null && m.startedAt === start) { start = m.at; return { mark: m, action: 'break' }; } return { mark: m, action: 'stale' }; }
    return { mark: m, action: m.type, running: start != null };
  });
}
function localNoOffset(ms) { return isoLocal(ms).slice(0, 19); }


/* Distraction patterns over a window. items: [{type:'urge'|'drift', at:ms, driftMin}], entries as from normEntries. */
function distractionStats(entries, items, now, fromMs) {
  const study = entries.filter(en => isStudyId(en.a) && en.s >= fromMs && entryEnd(en, now) - en.s >= 5 * MIN)
    .map(en => ({ s: en.s, e: entryEnd(en, now) })).sort((a, b) => a.s - b.s);
  if (study.length < 3) return { enough: false, sessions: study.length };
  const marks = items.filter(m => (m.type === 'urge' || m.type === 'drift') && m.at >= fromMs);
  const urges = marks.filter(m => m.type === 'urge').length, drifts = marks.length - urges;
  const hours = study.reduce((t, x) => t + (x.e - x.s), 0) / HOUR;
  const lost = marks.reduce((t, m) => t + (m.type === 'drift' ? (+m.driftMin || 0) : 0), 0);
  let longest = 0, a = study[0].s, b = study[0].e;
  for (const x of study.slice(1)) { if (x.s - b <= 2 * MIN) b = Math.max(b, x.e); else { longest = Math.max(longest, b - a); a = x.s; b = x.e; } }
  longest = Math.max(longest, b - a);
  const firsts = [];
  for (const x of study) {
    const inside = marks.filter(m => m.at >= x.s && m.at <= x.e).map(m => m.at);
    if (inside.length) firsts.push((Math.min.apply(null, inside) - x.s) / MIN);
  }
  firsts.sort((p, q) => p - q);
  const median = firsts.length ? (firsts.length % 2 ? firsts[(firsts.length - 1) / 2] : (firsts[firsts.length / 2 - 1] + firsts[firsts.length / 2]) / 2) : null;
  return {
    enough: true, sessions: study.length, hours, urges, drifts,
    perHour: hours ? marks.length / hours : 0,
    catchRate: marks.length ? urges / marks.length : null,
    lostMin: lost, longestStretch: longest, firstAtMin: median
  };
}

if (typeof module !== 'undefined') module.exports = { distractionStats, LIVE_URL, b64urlEnc, b64urlDec, encodeToken, decodeToken, liveColor, liveStateOf, liveTitle, cleanMark, planMarks, localNoOffset, busyFor, mergeIntervals, dayCapacity, layoutOverlaps, CTX, MIN, HOUR, DAY, hmToMin, minToHm, keyOfDate, dateOfKey, addDaysKey, dayKeyOf, dayStartMs, dayEndMs, hmOnDay, weekStartKey, isoLocal, parseT, fmtDur, fmtClock, aggregate, pomodoroByDay, studySessions, planCompute, patternsModel, insights, exampleEntries, eachDaySlice };
