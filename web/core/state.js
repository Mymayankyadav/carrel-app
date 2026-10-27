/* R0a: core state, helpers, derived state and write sets. */
const ACT = {}, VIEWS = {}, SHEETS = {}, PAGES = {}, SUBMIT = {};
/* ===== Carrel app ===== */
const PALETTE = ['#3D7EA6', '#C2603E', '#2F9C8A', '#8A63B8', '#B8912E', '#5B8C3A', '#C24E7A', '#4F6BD8', '#2B8FC4', '#A0522D', '#6E7F2E', '#9C4DB0'];
const DEFAULTS = { dayStart: '04:00', planStart: '08:00', planEnd: '22:30', gap: 10, dailyGoal: 120, weekStart: 1, guardHours: 4, clock: 'auto', pomodoro: { focus: 25, short: 5, long: 15, every: 4 }, onboarded: false };
const PRESETS = { '25/5': { focus: 25, short: 5, long: 15, every: 4 }, '50/10': { focus: 50, short: 10, long: 20, every: 3 }, '90/20': { focus: 90, short: 20, long: 30, every: 2 } };
const STARTER = {
  study: { name: 'Study', color: '#3D7EA6', kind: 'study', order: 1 },
  break: { name: 'Break', color: '#B08A3E', kind: 'life', order: 10, role: 'break' },
  meals: { name: 'Meals', color: '#A86B4C', kind: 'life', order: 11 },
  exercise: { name: 'Exercise', color: '#5B8C3A', kind: 'life', order: 12 },
  commute: { name: 'Commute', color: '#6F7C86', kind: 'life', order: 13 },
  chores: { name: 'Chores & errands', color: '#8C7A5B', kind: 'life', order: 14 },
  social: { name: 'Friends & family', color: '#B0577A', kind: 'life', order: 15 },
  phone: { name: 'Phone & scrolling', color: '#8E8578', kind: 'life', order: 16, role: 'drift' },
  free: { name: 'Free time', color: '#7E8A76', kind: 'life', order: 17 },
  sleep: { name: 'Sleep', color: '#4E5A86', kind: 'life', order: 18, role: 'sleep', guard: 14 }
};
const EX_ACTS = {
  ex_math: { id: 'ex_math', name: 'Mathematics', color: '#3D7EA6', kind: 'study' },
  ex_phys: { id: 'ex_phys', name: 'Physics', color: '#C2603E', kind: 'study' },
  ex_chem: { id: 'ex_chem', name: 'Chemistry', color: '#2F9C8A', kind: 'study' },
  ex_eng: { id: 'ex_eng', name: 'English', color: '#8A63B8', kind: 'study' }
};
const SUGGEST = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Economics', 'Programming', 'English', 'Accounting', 'Political science'];
const WINDOW_DAYS = 125;
const PROMPTS = [
  ['Plan my day in Carrel', 'Claude reads your recent log and unfinished blocks, then writes today’s plan here.'],
  ['Plan my week in Carrel', 'Claude spreads your backlog and deadlines across the week, around your timetable.'],
  ['Review my week in Carrel', 'Claude reads the week and writes a review that appears on the Week page.'],
  ['Remind me quietly at 6 pm to start revision', 'Claude adds a calendar event with a plain notification, never an alarm.']
];

const store = {
  get(k) { try { const v = localStorage.getItem('carrel.' + k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('carrel.' + k); else localStorage.setItem('carrel.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};

const S = {
  db: null, dl: null, user: null, conn: 'connecting', owner: true, offline: false,
  base: { current: undefined, activities: undefined, settings: undefined, days: {}, plans: {}, reviews: [], planning: {}, distractions: {} },
  loaded: { current: false, activities: false, settings: false, days: false, plans: false, reviews: false, planning: false, distractions: false },
  pending: [], inflight: new Set(), windowFrom: null, fetched: new Set(), unsubs: [], resubT: 0
};
let V = { current: null, activities: null, settings: null, days: {}, plans: {}, reviews: [], planning: {}, distractions: {} };
let DRAG = null;
let CFG = Object.assign({}, DEFAULTS), ACTS = [], ACTMAP = {}, ENTRIES = [], CUR = null;
let H12 = false;
const UNDO = [];
const UI = {
  view: 'today', date: null, weekOff: 0, pweeks: 4,
  logMode: store.get('logMode') === 'list' ? 'list' : 'timeline',
  pomoOn: !!store.get('pomoOn'), pomoPreset: store.get('pomoPreset') || '25/5', from: 'now',
  openBlk: null, addBlk: false, ab: { activity: '', minutes: 50, title: '', at: '', pomo: '' }, planMenu: false, clearArmed: false,
  sheet: null, desk: false, deskCtl: 0, deskShift: [0, 0], guardOpen: false, guardTime: '',
  showArchived: false, hideEx: !!store.get('hideEx'), onbText: '', newAct: { name: '', kind: 'study' }, toast: null,
  cal: { view: store.get('calView') || null, anchor: null, show: store.get('calShow') || 'both', mm: null, scrollTo: true },
  ta: { title: '', activity: '', minutes: 60 }
};
CTX.cfg = CFG;

/* ---------- small helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
function deepMerge(t, s) {
  for (const k of Object.keys(s)) {
    const v = s[k];
    if (isObj(v) && isObj(t[k])) t[k] = deepMerge(Object.assign({}, t[k]), v);
    else t[k] = clone(v);
  }
  return t;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const todayKey = () => dayKeyOf(Date.now());
function detect12() { try { const hc = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle; return hc === 'h12' || hc === 'h11'; } catch (e) { return false; } }
const AUTO12 = detect12();
function fmtT(ms) { const d = new Date(ms), h = d.getHours(), m = d.getMinutes(); return H12 ? (h % 12 || 12) + ':' + pad(m) + (h < 12 ? ' am' : ' pm') : pad(h) + ':' + pad(m); }
function fmtHM(hm) { const t = hmToMin(hm), h = Math.floor(t / 60), m = t % 60; return H12 ? (h % 12 || 12) + ':' + pad(m) + (h < 12 ? ' am' : ' pm') : pad(h) + ':' + pad(m); }
function fmtHourL(h) { h = ((h % 24) + 24) % 24; return H12 ? (h % 12 || 12) + (h < 12 ? ' am' : ' pm') : pad(h) + ':00'; }
function fmtHourS(h) { h = ((h % 24) + 24) % 24; return H12 ? (h % 12 || 12) + (h < 12 ? 'a' : 'p') : pad(h); }
function fmtMinOfDay(m) { return fmtT(dayStartMs(todayKey()) + Math.round(m) * MIN); }
const DFc = {};
const DF = (o) => { const k = JSON.stringify(o); return DFc[k] || (DFc[k] = new Intl.DateTimeFormat(undefined, o)); };
function wdName(d, long) { return DF({ weekday: long ? 'long' : 'short' }).format(d); }
function stampText(k) { const d = dateOfKey(k); return wdName(d) + ' ' + d.getDate() + ' ' + DF({ month: 'short' }).format(d); }
function shortDay(k) { const d = dateOfKey(k); return wdName(d) + ' ' + d.getDate(); }
function longDay(k) { return DF({ weekday: 'long', day: 'numeric', month: 'long' }).format(dateOfKey(k)); }
function rowWeekday(i, long) { const wd = ((+CFG.weekStart || 0) + i) % 7; return wdName(new Date(2026, 0, 4 + wd), long); }
const tzOff = ms => -new Date(ms).getTimezoneOffset() * MIN;
function floorLocal(ms, step) { const o = tzOff(ms); return Math.floor((ms + o) / step) * step - o; }
function ceilLocal(ms, step) { const o = tzOff(ms); return Math.ceil((ms + o) / step) * step - o; }
function roundUpMs(ms, step) { return ceilLocal(ms, step); }
function fmtEl(ms) { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? h + 'h ' + pad(m) + 'm' : m + 'm ' + pad(s % 60) + 's'; }
function parsePreset(p) {
  if (!p) return null;
  if (p === 'custom') return Object.assign({}, CFG.pomodoro);
  if (PRESETS[p]) return Object.assign({}, PRESETS[p]);
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(p));
  if (!m) return null;
  return { focus: +m[1], short: +m[2], long: Math.max(+m[2] * 2, 15), every: 4 };
}
function presetLabel(o) { return o.focus + '/' + o.short; }

const P = {
  play: '<path d="M8 5.6v12.8a.6.6 0 0 0 .9.5l10.2-6.4a.6.6 0 0 0 0-1L8.9 5.1a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.6" fill="currentColor" stroke="none"/>',
  cup: '<path d="M5 9.5h11v3.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9.5z"/><path d="M16 10.5h1.3a2.4 2.4 0 0 1 0 4.8H16"/><path d="M8.5 3.8v2.4M11.5 3.3v2.9M14.5 3.8v2.4"/>',
  moon: '<path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="M14.5 6l-6 6 6 6"/>',
  right: '<path d="M9.5 6l6 6-6 6"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bars: '<path d="M5 19v-7M10 19V6M15 19v-9M20 19v-4"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  up: '<path d="M12 19V5M6.5 10.5L12 5l5.5 5.5"/>',
  down: '<path d="M12 5v14M6.5 13.5L12 19l5.5-5.5"/>',
  skip: '<path d="M6 6.5l8 5.5-8 5.5z"/><path d="M17.5 6v12"/>',
  next: '<path d="M4 12h11M10.5 6.5L16 12l-5.5 5.5M20 5v14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M5 7h14M10 7V4.6h4V7M7 7l1 13h8l1-13"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11.5" rx="2"/><path d="M5.5 15.5V6.5a2 2 0 0 1 2-2h8"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  dots: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  split: '<path d="M12 4v16M7.5 8.5L4 12l3.5 3.5M16.5 8.5L20 12l-3.5 3.5"/>',
  shrink: '<path d="M4 12h6M14 12h6M7 8.5l3 3.5-3 3.5M17 8.5L14 12l3 3.5"/>',
  undo: '<path d="M9 7.5L4.5 12 9 16.5"/><path d="M5 12h9.5a5 5 0 0 1 0 10H12"/>',
  archive: '<rect x="4" y="5" width="16" height="4" rx="1"/><path d="M6 9v9.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  pin: '<path d="M12 20.5V15M8.5 4h7l-1 5.5 3 2.5h-11l3-2.5z"/>',
  flag: '<path d="M6 21V4.5M6 5h10.5l-2 4 2 4H6"/>',
  inbox: '<path d="M4 13.5l2.2-7.2A1.5 1.5 0 0 1 7.6 5.2h8.8a1.5 1.5 0 0 1 1.4 1.1l2.2 7.2V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>',
  wand: '<path d="M5 19L15.5 8.5M14 4.5v2M19.5 10h-2M17.6 6.4l-1.4 1.4M10 4.5l.6 1.4M19.5 14l-1.4-.6"/>'
};
const icon = (n, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

/* ---------- derived state ---------- */
function mergeSettings(s) { s = s || {}; return Object.assign({}, DEFAULTS, s, { pomodoro: Object.assign({}, DEFAULTS.pomodoro, s.pomodoro || {}) }); }
function buildActs(doc) {
  const items = (doc && doc.items) || {};
  const list = Object.entries(items).filter(([, a]) => a && a.name).map(([id, a]) => ({
    id, name: String(a.name), color: a.color || '#7A7F87', kind: a.kind === 'study' ? 'study' : 'life', order: +a.order || 0,
    goal: a.goal ? +a.goal : null, archived: !!a.archived, role: a.role || null, guard: a.guard ? +a.guard : null, today: a.today == null ? undefined : !!a.today
  }));
  list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'study' ? -1 : 1) || a.order - b.order || a.name.localeCompare(b.name));
  return list;
}
function act(id) { return ACTMAP[id] || EX_ACTS[id] || { id, name: id ? String(id).replace(/[_-]+/g, ' ') : 'Unknown', color: '#8A918C', kind: 'life', missing: true }; }
function breakAct() { return ACTS.find(a => a.role === 'break' && !a.archived) || ACTS.find(a => a.id === 'break'); }
function runningCur(v) {
  const c = v.current;
  if (!c || !c.running || !c.start || !c.id || !c.activity) return null;
  const s = parseT(c.start);
  if (s == null) return null;
  const d = v.days[dayKeyOf(s)];
  if (d && d.entries && d.entries[c.id]) return null; // already finalized elsewhere
  return c;
}
function normEntries(v, cur) {
  const out = [], seen = new Set();
  for (const day in v.days) {
    const ents = v.days[day] && v.days[day].entries;
    if (!ents) continue;
    for (const id in ents) {
      const x = ents[id];
      if (!x || !x.start || !x.activity || seen.has(id)) continue;
      const s = parseT(x.start), e = parseT(x.end);
      if (s == null || e == null || e <= s) continue;
      seen.add(id);
      out.push({ id, day, a: x.activity, s, e, note: x.note || '', focus: x.focus || null, block: x.block || null, pomo: x.pomo || null });
    }
  }
  if (cur) {
    const s = parseT(cur.start);
    out.push({ id: cur.id, day: dayKeyOf(s), a: cur.activity, s, e: null, note: cur.note || '', focus: null, block: cur.block || null, pomo: cur.pomo && cur.pomo.phase === 'focus' ? { phase: cur.pomo.phaseStart, target: cur.pomo.focus } : null, running: true });
  }
  out.sort((a, b) => a.s - b.s);
  return out;
}
function recompute() {
  V = computeView();
  CFG = mergeSettings(V.settings);
  CTX.cfg = CFG;
  CTX.act = act;
  H12 = CFG.clock === '12' ? true : CFG.clock === '24' ? false : AUTO12;
  ACTS = buildActs(V.activities);
  ACTMAP = {};
  ACTS.forEach(a => { ACTMAP[a.id] = a; });
  CUR = runningCur(V);
  ENTRIES = normEntries(V, CUR);
}
function lastEntry() {
  let best = null;
  for (const en of ENTRIES) if (en.e != null && (!best || en.e > best.e)) best = en;
  return best;
}
function entryDoc(o) { return { activity: o.a, start: isoLocal(o.s), end: isoLocal(o.e), note: o.note || '', focus: o.focus || null, block: o.block || null, pomo: o.pomo || null }; }
function entryFromCur(c, end) {
  return { activity: c.activity, start: c.start, end: isoLocal(end), note: c.note || '', focus: null, block: c.block || null, pomo: c.pomo && c.pomo.phase === 'focus' ? { phase: c.pomo.phaseStart, target: c.pomo.focus } : null };
}
function pomoState(now) {
  const c = CUR;
  if (!c || !c.pomo) return null;
  const p = c.pomo, ps = parseT(p.phaseStart);
  if (ps == null) return null;
  if (p.phase === 'break') { const len = (+p.breakLen || 5) * MIN; return { phase: 'break', len, ps, end: ps + len, left: ps + len - now }; }
  const len = (+p.focus || 25) * MIN, cycle = +p.cycle || 1, every = +p.every || 4;
  return { phase: 'focus', len, ps, end: ps + len, left: ps + len - now, cycle, every, longNext: cycle % every === 0, nextBreak: cycle % every === 0 ? (+p.long || 15) : (+p.short || 5) };
}
function guardInfo(now) {
  const c = CUR;
  if (!c) return null;
  const s = parseT(c.start), a = act(c.activity);
  const limit = (a.guard || (a.role === 'sleep' ? 14 : +CFG.guardHours || 4)) * HOUR;
  const ack = parseT(c.ack);
  const ref = ack && ack > s ? ack : s;
  if (now - ref < limit) return null;
  return { ran: now - s, at: ref + limit };
}

/* ---------- write sets, commit and undo ---------- */
function W() {
  const map = new Map();
  const api = {
    update(path, data, ensure) {
      const ex = map.get(path);
      if (ex) { deepMerge(ex.data, data); if (ensure && !ex.ensure && ex.kind === 'update') ex.ensure = ensure; }
      else map.set(path, { path, kind: 'update', data: clone(data), ensure: ensure || null });
      return api;
    },
    set(path, data, cond) { map.set(path, { path, kind: 'set', data: clone(data), cond: cond || null }); return api; },
    day(k, entries) { return api.update('days/' + k, { date: k, entries }, { date: k }); },
    dis(k, id, item) { return api.update('distractions/' + k, { date: k, items: { [id]: item } }, { date: k }); },
    plan(k, data) { return api.update('plans/' + k, Object.assign({ date: k }, data), { date: k, source: 'me', blocks: {} }); },
    list() { return Array.from(map.values()); }
  };
  return api;
}
function invertMerge(prev, data) {
  const out = {};
  for (const k of Object.keys(data)) {
    const dv = data[k], pv = prev ? prev[k] : undefined;
    out[k] = isObj(dv) && isObj(pv) ? invertMerge(pv, dv) : (pv === undefined ? null : clone(pv));
  }
  return out;
}
function inverseOf(w, prev) {
  if (w.kind === 'set') return { path: w.path, kind: 'set', data: prev ? clone(prev) : (w.path === 'state/current' ? { running: false } : {}) };
  return { path: w.path, kind: 'update', data: invertMerge(prev, w.data), ensure: w.ensure };
}
function commit(msg, w, opt) {
  opt = opt || {};
  if (!canWrite()) { toast(S.db ? 'This view can’t save changes.' : 'Sign in to save changes.'); return false; }
  const writes = Array.isArray(w) ? w : w.list();
  if (!writes.length) return false;
  const inv = writes.map(x => inverseOf(x, readPath(V, x.path))).reverse();
  writes.forEach(enqueue);
  if (opt.undo !== false) { UNDO.push({ msg, inv }); if (UNDO.length > 40) UNDO.shift(); }
  recompute();
  render();
  if (msg) toast(msg, { undo: opt.undo !== false, rate: opt.rate || null });
  return true;
}
function undo() {
  const u = UNDO.pop();
  if (!u) { toast('Nothing to undo.'); return; }
  if (!canWrite()) return;
  u.inv.forEach(enqueue);
  recompute();
  render();
  toast('Undone: ' + String(u.msg || 'last change').replace(/\.$/, '') + '.', { undo: false });
}

