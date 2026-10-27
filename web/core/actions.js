/* ---------- timer actions ---------- */
function newPomo(o, at) { return { focus: +o.focus || 25, short: +o.short || 5, long: +o.long || 15, every: +o.every || 4, cycle: 1, phase: 'focus', phaseStart: isoLocal(at), breakLen: null }; }
function startAt(cur) {
  const now = Date.now();
  const f = UI.from;
  if (f === 'gap') { const l = lastEntry(); if (l && !cur) return l.e; return now; }
  const m = +f;
  return m > 0 ? now - m * MIN : now;
}
function startActivity(aid, o) {
  o = o || {};
  if (!ACTMAP[aid] && !o.allowMissing) { toast('That activity no longer exists.'); return; }
  const now = Date.now(), cur = CUR, a = act(aid);
  let at = o.at != null ? o.at : startAt(cur);
  UI.from = 'now';
  const w = W();
  let label;
  if (cur) {
    const cs = parseT(cur.start);
    if (cur.activity === aid && !o.block && !o.force) { toast('Already tracking ' + a.name + '.'); return; }
    if (at <= cs + 1000) at = Math.min(now, cs + 1000);
    if (at > now) at = now;
    if (at - cs < 15000) {
      at = cs; // a quick correction replaces the mistaken start instead of logging seconds
      label = 'Switched to ' + a.name + '.';
    } else {
      const k = dayKeyOf(cs);
      w.day(k, { [cur.id]: entryFromCur(cur, at) });
      label = 'Logged ' + fmtDur(at - cs) + ' of ' + act(cur.activity).name + ' · now ' + a.name + '.';
    }
  } else {
    const l = lastEntry();
    if (l && at < l.e && at < now) at = Math.min(now, l.e);
    label = 'Started ' + a.name + (at < now - 30000 ? ' from ' + fmtT(at) : '') + '.';
  }
  let pomo = null;
  if (o.pomoRaw !== undefined) pomo = o.pomoRaw;
  else if (o.pomoPreset) { const pp = parsePreset(o.pomoPreset); pomo = pp ? newPomo(pp, at) : null; }
  else if (cur && cur.pomo && cur.pomo.phase === 'focus' && a.kind === 'study') pomo = cur.pomo;
  else if (UI.pomoOn && a.kind === 'study') pomo = newPomo(parsePreset(UI.pomoPreset) || PRESETS['25/5'], at);
  const nc = { running: true, id: uid('e'), activity: aid, start: isoLocal(at), note: '', block: o.block || null, pomo, ret: o.ret || null, ack: null };
  w.set('state/current', nc, { prevId: cur ? cur.id : null });
  commit(label, w);
}
function stopTimer(o) {
  o = o || {};
  const c = CUR;
  if (!c) return;
  const now = Date.now(), cs = parseT(c.start);
  let end = o.at != null ? o.at : now;
  end = clamp(end, cs, now);
  const w = W();
  const brief = end - cs < 15000;
  if (!brief) w.day(dayKeyOf(cs), { [c.id]: entryFromCur(c, end) });
  w.set('state/current', { running: false, stopped: isoLocal(end) }, { prevId: c.id });
  const a = act(c.activity);
  UI.guardOpen = false;
  if (UI.desk) exitDesk();
  let msg = brief ? 'Discarded a ' + Math.round((end - cs) / 1000) + '-second entry.' : 'Logged ' + fmtDur(end - cs) + ' of ' + a.name + '.';
  if (!brief) {
    const k = dayKeyOf(cs), plan = V.plans[k];
    if (plan && k === todayKey()) {
      const before = planCompute(plan, k, ENTRIES, now, CUR, busyIv(k));
      const r = before && before.rows.find(x => x.id === (c.block || before.activeId));
      if (r && r.st === 'active' && r.remaining > 2 * MIN) msg += ' ' + fmtDur(r.remaining) + ' of this block stays in your plan.';
    }
  }
  commit(msg, w, { rate: !brief && a.kind === 'study' ? { day: dayKeyOf(cs), id: c.id } : null });
}
function takeBreak(o) {
  const c = CUR, br = breakAct(), at = o && o.at != null ? o.at : Date.now();
  if (!br) { toast('Add a Break activity in Setup first.'); return; }
  if (c && c.activity === br.id) return;
  if (!c) { startActivity(br.id, { at }); return; }
  const now = Math.min(at, Date.now());
  let pomo = null;
  if (c.pomo && c.pomo.phase === 'focus') {
    const cyc = +c.pomo.cycle || 1, every = +c.pomo.every || 4;
    pomo = Object.assign({}, c.pomo, { phase: 'break', phaseStart: isoLocal(now), breakLen: cyc % every === 0 ? (+c.pomo.long || 15) : (+c.pomo.short || 5) });
  }
  startActivity(br.id, { at: now, pomoRaw: pomo, ret: { activity: c.activity, block: c.block || null } });
}
function backFromBreak() {
  const c = CUR;
  const target = c && c.ret && c.ret.activity;
  if (!target || !ACTMAP[target]) { const l = lastStudy(); if (l) startActivity(l.a, { at: Date.now() }); return; }
  let pomo = null;
  if (c.pomo) pomo = Object.assign({}, c.pomo, { phase: 'focus', cycle: (+c.pomo.cycle || 1) + 1, phaseStart: isoLocal(Date.now()), breakLen: null });
  startActivity(target, { at: Date.now(), pomoRaw: pomo, block: c.ret.block || null, force: true });
}
function pomoShown() { const c = CUR; if (c && (isStudyId(c.activity) || c.pomo)) return !!c.pomo; return UI.pomoOn; }
function lastStudy() { for (let i = ENTRIES.length - 1; i >= 0; i--) if (isStudyId(ENTRIES[i].a) && ENTRIES[i].e != null) return ENTRIES[i]; return null; }
function resumeLast() {
  const l = lastEntry();
  if (!l) return;
  startActivity(l.a, UI.from === 'now' ? {} : {});
}

/* ---------- entry editing ---------- */
function openEntrySheet(mode, x) {
  const now = Date.now();
  let d;
  if (mode === 'running') {
    const c = CUR;
    if (!c) return;
    const s = parseT(c.start);
    d = { activity: c.activity, date: dayKeyOf(s), start: msToHm(s), end: msToHm(now), note: c.note || '', focus: null };
    UI.sheet = { type: 'entry', mode, id: c.id, d, trim: true, armed: false, err: '' };
  } else if (mode === 'edit') {
    const en = ENTRIES.find(e => e.id === x.id && !e.running);
    if (!en) return;
    d = { activity: en.a, date: dayKeyOf(en.s), start: msToHm(en.s), end: msToHm(en.e), note: en.note, focus: en.focus };
    UI.sheet = { type: 'entry', mode, id: en.id, day: en.day, block: en.block, pomo: en.pomo, d, trim: true, armed: false, err: '' };
  } else {
    let s = x && x.s != null ? x.s : null, e = x && x.e != null ? x.e : null;
    const k = UI.date || todayKey();
    if (s == null) {
      if (k === todayKey()) { const l = lastEntry(); e = now; s = l && now - l.e < 6 * HOUR && now - l.e > MIN ? l.e : now - 30 * MIN; if (CUR) { e = parseT(CUR.start); s = e - 30 * MIN; } }
      else { s = hmOnDay(k, '09:00'); e = s + 60 * MIN; }
    }
    const study = ACTS.find(a => !a.archived && a.kind === 'study');
    d = { activity: (x && x.activity) || (study && study.id) || (ACTS[0] && ACTS[0].id) || '', date: dayKeyOf(s), start: msToHm(s), end: msToHm(e), note: '', focus: null };
    const bz = busyOf(dayKeyOf(s)).find(z => z.s < e && z.e > s);
    if (bz) { if (bz.activity && ACTMAP[bz.activity]) d.activity = bz.activity; d.note = bz.title; }
    UI.sheet = { type: 'entry', mode: 'add', id: null, d, trim: true, armed: false, err: '' };
  }
  render();
  focusSheet();
}
function sheetTimes(sh) {
  const d = sh.d;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '') || !/^\d{1,2}:\d{2}/.test(d.start || '')) return null;
  const s = hmOnDay(d.date, d.start);
  if (sh.mode === 'running') return { s, e: Date.now() };
  if (!/^\d{1,2}:\d{2}/.test(d.end || '')) return null;
  let e = hmOnDay(d.date, d.end);
  if (e <= s) e += DAY;
  return { s, e };
}
function overlapsFor(sh, s, e) {
  const now = Date.now();
  return ENTRIES.filter(x => x.id !== sh.id && x.s < e && entryEnd(x, now) > s);
}
function trimOthers(others, s, e, w) {
  const now = Date.now();
  for (const o of others) {
    const oe = entryEnd(o, now);
    if (o.running) {
      if (s <= o.s) {
        if (e >= now - 5000) continue;
        w.set('state/current', Object.assign({}, CUR, { start: isoLocal(e) }), { prevId: CUR.id });
      } else {
        w.day(dayKeyOf(o.s), { [CUR.id]: entryFromCur(CUR, s) });
        const cont = Math.min(e, now);
        const nc = Object.assign({}, CUR, { id: uid('e'), start: isoLocal(cont) });
        if (nc.pomo && nc.pomo.phase === 'focus') nc.pomo = Object.assign({}, nc.pomo, { phaseStart: isoLocal(cont) });
        w.set('state/current', nc, { prevId: CUR.id });
      }
      continue;
    }
    if (o.s >= s && oe <= e) w.day(o.day, { [o.id]: null });
    else if (o.s < s && oe > e) {
      w.day(o.day, { [o.id]: { end: isoLocal(s) } });
      const k2 = dayKeyOf(e);
      w.day(k2, { [uid('e')]: Object.assign(entryDoc(o), { start: isoLocal(e), end: isoLocal(oe), focus: o.focus || null }) });
    } else if (o.s < s) w.day(o.day, { [o.id]: { end: isoLocal(s) } });
    else {
      const k2 = dayKeyOf(e);
      if (k2 !== o.day) { w.day(o.day, { [o.id]: null }); w.day(k2, { [o.id]: Object.assign(entryDoc(o), { start: isoLocal(e) }) }); }
      else w.day(o.day, { [o.id]: { start: isoLocal(e) } });
    }
  }
}
function saveEntrySheet() {
  const sh = UI.sheet, d = sh.d, now = Date.now();
  const t = sheetTimes(sh);
  sh.err = '';
  if (!t) sh.err = 'Enter a start and end time.';
  else if (!ACTMAP[d.activity]) sh.err = 'Choose an activity.';
  else if (sh.mode !== 'running' && t.e - t.s < MIN) sh.err = 'An entry needs at least one minute.';
  else if (t.e - t.s > DAY) sh.err = 'An entry can be at most 24 hours.';
  else if (t.s > now) sh.err = 'That start time is in the future.';
  else if (sh.mode !== 'running' && t.e > now + MIN) sh.err = 'That end time is in the future. Use the timer for time still running.';
  if (sh.err) { render(); return; }
  const { s, e } = t;
  const w = W();
  const others = sh.trim ? overlapsFor(sh, s, e) : [];
  if (sh.mode === 'running') {
    const c = CUR;
    if (!c) { closeSheet(); return; }
    const nc = Object.assign({}, c, { activity: d.activity, start: isoLocal(s), note: (d.note || '').trim() });
    if (nc.activity !== c.activity) { nc.block = null; if (!isStudyId(nc.activity) && nc.pomo && nc.pomo.phase === 'focus') nc.pomo = null; }
    if (others.length) {
      for (const o of others) {
        const oe = entryEnd(o, now);
        if (o.s >= s) w.day(o.day, { [o.id]: null });
        else if (oe > s) w.day(o.day, { [o.id]: { end: isoLocal(s) } });
      }
    }
    w.set('state/current', nc, { prevId: c.id });
    closeSheet(true);
    commit('Updated the running timer.', w);
    return;
  }
  const id = sh.mode === 'add' ? uid('e') : sh.id;
  const k = dayKeyOf(s);
  const keepBlock = sh.block && V.plans[k] && V.plans[k].blocks && V.plans[k].blocks[sh.block] && V.plans[k].blocks[sh.block].activity === d.activity;
  const doc = { activity: d.activity, start: isoLocal(s), end: isoLocal(e), note: (d.note || '').trim(), focus: d.focus || null, block: keepBlock ? sh.block : null, pomo: d.activity === (ENTRIES.find(x => x.id === id) || {}).a ? (sh.pomo || null) : null };
  if (sh.mode === 'edit' && sh.day && sh.day !== k) w.day(sh.day, { [id]: null });
  if (others.length) trimOthers(others, s, e, w);
  w.day(k, { [id]: doc });
  closeSheet(true);
  commit(sh.mode === 'add' ? 'Added ' + fmtDur(e - s) + ' of ' + act(d.activity).name + '.' : 'Saved the entry.', w);
}
function deleteEntrySheet() {
  const sh = UI.sheet;
  if (!sh.armed) { sh.armed = true; render(); return; }
  const w = W();
  if (sh.mode === 'running') {
    w.set('state/current', { running: false, stopped: isoLocal(Date.now()) }, { prevId: sh.id });
    closeSheet(true);
    commit('Discarded the running timer.', w);
    return;
  }
  w.day(sh.day, { [sh.id]: null });
  closeSheet(true);
  commit('Deleted the entry.', w);
}
function saveSplit() {
  const sh = UI.sheet;
  const en = ENTRIES.find(e => e.id === sh.id && !e.running);
  if (!en) { closeSheet(); return; }
  let at = hmOnDay(dayKeyOf(en.s), sh.at);
  if (at <= en.s) at += DAY;
  if (!(at > en.s + 30000 && at < en.e - 30000)) { sh.err = 'Pick a time inside the entry (' + fmtT(en.s) + '–' + fmtT(en.e) + ').'; render(); return; }
  const w = W();
  w.day(en.day, { [en.id]: { end: isoLocal(at) } });
  const k2 = dayKeyOf(at);
  w.day(k2, { [uid('e')]: { activity: sh.activity, start: isoLocal(at), end: isoLocal(en.e), note: '', focus: null, block: null, pomo: null } });
  closeSheet(true);
  commit('Split the entry at ' + fmtT(at) + '.', w);
}

/* ---------- plan actions ---------- */
function planModelFor(k, now) { return planCompute(V.plans[k], k, ENTRIES, now || Date.now(), CUR, busyIv(k)); }
function blocksOf(k) { const p = V.plans[k]; return (p && p.blocks) || {}; }
function nextOrder(k) { let m = 0; const b = blocksOf(k); for (const id in b) if (b[id]) m = Math.max(m, +b[id].order || 0); return m + 1; }
function blockDoc(o) { return { activity: o.activity, title: o.title || '', minutes: Math.round(o.minutes), orig: Math.round(o.orig != null ? o.orig : o.minutes), order: o.order, at: o.at || null, status: o.status || 'open', pomo: o.pomo || null, from: o.from || null }; }
function carryTo(w, k, items) {
  const tk2 = addDaysKey(k, 1);
  let ord = Math.max(nextOrder(tk2), 1);
  const blocks = {};
  for (const it of items) blocks[uid('b')] = blockDoc({ activity: it.activity, title: it.title, minutes: it.minutes, order: ord++, pomo: it.pomo, from: k });
  w.plan(tk2, { blocks });
  return tk2;
}
function planAddBlock(k) {
  const ab = UI.ab;
  const minutes = Math.round(+ab.minutes);
  if (!ACTMAP[ab.activity]) { toast('Choose an activity for the block.'); return; }
  if (!(minutes >= 5 && minutes <= 720)) { toast('Use between 5 and 720 minutes.'); return; }
  const w = W();
  w.plan(k, { blocks: { [uid('b')]: blockDoc({ activity: ab.activity, title: (ab.title || '').trim(), minutes, order: nextOrder(k), at: ab.at || null, pomo: ab.pomo || null }) } });
  UI.ab.title = ''; UI.ab.at = '';
  commit('Added ' + fmtDur(minutes * MIN) + ' of ' + act(ab.activity).name + ' to the plan.', w);
}
function planReorder(k, id, dir) {
  const pm = planModelFor(k);
  if (!pm) return;
  const rows = planDisplayRows(pm);
  const i = rows.findIndex(r => r.id === id);
  if (i < 0 || rows[i].at || !(rows[i].remaining > 0)) return;
  let j = i + dir;
  while (j >= 0 && j < rows.length && (rows[j].at || !(rows[j].remaining > 0))) j += dir;
  if (j < 0 || j >= rows.length) return;
  // Change only the two flexible blocks. Renumbering the entire visual
  // list would silently rewrite fixed-time and completed block priorities.
  if (rows[i].order === rows[j].order) return;
  const blocks = {
    [rows[i].id]: { order: rows[j].order },
    [rows[j].id]: { order: rows[i].order }
  };
  const w = W();
  w.plan(k, { blocks });
  commit(null, w);
}
function planShrink(k) {
  const pm = planModelFor(k);
  if (!pm || pm.over <= 0) return;
  const flex = pm.rows.filter(r => r.remaining > 0 && !r.at && r.st !== 'active');
  const R = flex.reduce((s, r) => s + r.remaining, 0);
  if (!R) { toast('Only fixed-time blocks run over. Move or skip one of them.'); return; }
  const factor = Math.max(0, (R - pm.over) / R);
  const blocks = {};
  for (const r of flex) {
    let rem = Math.floor(r.remaining * factor / (5 * MIN)) * 5;
    if (rem < 10) rem = 0;
    const minutes = Math.round(r.done / MIN) + rem;
    blocks[r.id] = minutes <= 0 ? { status: 'skipped' } : { minutes };
  }
  const w = W();
  w.plan(k, { blocks });
  commit('Shrunk the rest of the plan to fit.', w);
}
function planOverflow(k) {
  const pm = planModelFor(k);
  if (!pm || pm.over <= 0) return;
  const blocks = {}, carry = [];
  for (const r of pm.rows) {
    if (r.over <= 0) continue;
    const m = Math.min(Math.ceil(r.over / (5 * MIN)) * 5, Math.ceil(r.remaining / MIN));
    if (m >= Math.ceil(r.remaining / MIN) - 1) {
      blocks[r.id] = r.done > MIN ? { minutes: Math.round(r.done / MIN), status: 'done' } : { status: 'moved' };
      carry.push({ activity: r.activity, title: r.title, minutes: Math.ceil(r.remaining / MIN), pomo: r.pomo });
    } else {
      blocks[r.id] = { minutes: r.minutes - m };
      carry.push({ activity: r.activity, title: r.title, minutes: m, pomo: r.pomo });
    }
  }
  const w = W();
  w.plan(k, { blocks });
  const tk2 = carryTo(w, k, carry);
  commit('Moved ' + fmtDur(carry.reduce((s, c) => s + c.minutes, 0) * MIN) + ' to ' + shortDay(tk2) + '.', w);
}
function planCarryYesterday() {
  const tk = todayKey(), yk = addDaysKey(tk, -1);
  const ym = planModelFor(yk);
  if (!ym) return;
  const left = ym.rows.filter(r => (r.st === 'open' || r.st === 'partial') && r.remaining >= 10 * MIN);
  const w = W();
  const yb = {};
  left.forEach(r => { yb[r.id] = r.done > MIN ? { minutes: Math.round(r.done / MIN), status: 'done' } : { status: 'moved' }; });
  w.plan(yk, { blocks: yb, closed: true });
  carryTo(w, yk, left.map(r => ({ activity: r.activity, title: r.title, minutes: Math.ceil(r.remaining / MIN), pomo: r.pomo })));
  commit('Added yesterday’s unfinished blocks to today.', w);
}
function wrapUp() {
  const sh = UI.sheet, k = sh.k;
  const pm = planModelFor(k);
  const w = W();
  const blocks = {}, carry = [];
  if (pm) for (const r of pm.rows) {
    if (!(r.remaining > 0 && sh.pick[r.id])) continue;
    blocks[r.id] = r.done > MIN ? { minutes: Math.round(r.done / MIN), status: 'done' } : { status: 'moved' };
    carry.push({ activity: r.activity, title: r.title, minutes: Math.ceil(r.remaining / MIN), pomo: r.pomo });
  }
  w.plan(k, { blocks, closed: true });
  if (carry.length) carryTo(w, k, carry);
  if (sh.stop && CUR) {
    const c = CUR, now = Date.now(), cs = parseT(c.start);
    if (now - cs >= 15000) w.day(dayKeyOf(cs), { [c.id]: entryFromCur(c, now) });
    w.set('state/current', { running: false, stopped: isoLocal(now) }, { prevId: c.id });
  }
  closeSheet(true);
  commit(carry.length ? 'Day wrapped up. ' + carry.length + ' block' + (carry.length > 1 ? 's' : '') + ' moved to tomorrow.' : 'Day wrapped up.', w);
}

/* ---------- activities and settings ---------- */
function slug(name) { return String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'activity'; }
function nextColor() { const used = new Set(ACTS.map(a => a.color.toUpperCase())); return PALETTE.find(c => !used.has(c.toUpperCase())) || PALETTE[ACTS.length % PALETTE.length]; }
function addActivity(name, kind) {
  name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) return null;
  if (ACTS.some(a => a.name.toLowerCase() === name.toLowerCase() && !a.archived)) { toast(name + ' is already on your list.'); return null; }
  let id = slug(name);
  while (ACTMAP[id] || EX_ACTS[id]) id = slug(name) + '-' + Math.random().toString(36).slice(2, 5);
  const order = ACTS.filter(a => a.kind === kind).reduce((m, a) => Math.max(m, a.order), 0) + 1;
  const color = nextColor();
  ACTMAP[id] = { id, name, color, kind, order }; // reserve during a burst of adds
  ACTS.push(ACTMAP[id]);
  return { id, doc: { name, color, kind, order, goal: null, archived: false } };
}
function saveSetting(patch, msg) { const w = W(); w.update('config/settings', patch, {}); commit(msg || null, w, { undo: !!msg }); }
function saveAct(id, patch, msg) { const w = W(); w.update('config/activities', { items: { [id]: patch } }, { items: {} }); commit(msg || null, w, { undo: !!msg }); }

/* ---------- copy ---------- */
function copyText(el) {
  const text = el.getAttribute('data-text') || '';
  const fallback = () => {
    const code = el.parentElement && el.parentElement.querySelector('code');
    if (code) { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    toast('Selected. Copy it with your keyboard or the share menu.');
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied: ' + text), fallback);
    else fallback();
  } catch (e) { fallback(); }
}

/* ---------- export ---------- */
async function exportData(fmt) {
  if (!S.dl || !S.db) return;
  toast('Preparing your export…');
  try {
    const [days, plans] = await Promise.all([S.db.collection('days').get(), S.db.collection('plans').get()]);
    const dayDocs = {}, planDocs = {};
    days.docs.forEach(d => { if (d.exists) dayDocs[d.id] = d.data(); });
    plans.docs.forEach(d => { if (d.exists) planDocs[d.id] = d.data(); });
    let data, name;
    const stamp = todayKey();
    if (fmt === 'csv') {
      const q = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const lines = ['date,activity,kind,start,end,minutes,note,focus,plan_block'];
      Object.keys(dayDocs).sort().forEach(k => {
        const ents = dayDocs[k].entries || {};
        Object.entries(ents).filter(([, x]) => x && x.start && x.end).sort((a, b) => parseT(a[1].start) - parseT(b[1].start)).forEach(([, x]) => {
          const a = act(x.activity);
          lines.push([k, a.name, a.kind, x.start, x.end, Math.round((parseT(x.end) - parseT(x.start)) / MIN), x.note || '', x.focus || '', x.block || ''].map(q).join(','));
        });
      });
      data = lines.join('\n') + '\n';
      name = 'carrel-log-' + stamp + '.csv';
    } else {
      data = JSON.stringify({ exported: isoLocal(Date.now()), activities: V.activities, settings: V.settings, current: V.current, days: dayDocs, plans: planDocs, reviews: V.reviews }, null, 2);
      name = 'carrel-backup-' + stamp + '.json';
    }
    await S.dl.save({ filename: name, data });
    toast('Saved ' + name + '.');
  } catch (e) {
    const code = e && e.code;
    if (code === 'declined') toast('Export cancelled.');
    else if (code === 'rate_limited') toast('Another save is open. Try again in a moment.');
    else { console.warn(e); toast('The export could not be saved here.'); }
  }
}

