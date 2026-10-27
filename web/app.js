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

/* ---------- local view of the database (snapshots + pending writes) ---------- */
function readPath(v, path) {
  const [c, id] = path.split('/');
  if (c === 'state') return v.current;
  if (c === 'config') return id === 'activities' ? v.activities : v.settings;
  if (c === 'days') return v.days[id];
  if (c === 'plans') return v.plans[id];
  if (c === 'planning') return v.planning[id];
  if (c === 'distractions') return v.distractions[id];
  return undefined;
}
function writePath(v, path, val) {
  const [c, id] = path.split('/');
  if (c === 'state') v.current = val;
  else if (c === 'config') { if (id === 'activities') v.activities = val; else v.settings = val; }
  else if (c === 'days') { if (val === undefined) delete v.days[id]; else v.days[id] = val; }
  else if (c === 'plans') { if (val === undefined) delete v.plans[id]; else v.plans[id] = val; }
  else if (c === 'planning') { if (val === undefined) delete v.planning[id]; else v.planning[id] = val; }
  else if (c === 'distractions') { if (val === undefined) delete v.distractions[id]; else v.distractions[id] = val; }
}
function applyOp(v, op) {
  const prev = readPath(v, op.path);
  let next;
  if (op.kind === 'set') next = clone(op.data);
  else if (op.kind === 'delete') next = undefined;
  else next = deepMerge(Object.assign({}, prev || op.ensure || {}), op.data);
  writePath(v, op.path, next);
}
function computeView() {
  const b = S.base;
  const v = { current: b.current, activities: b.activities, settings: b.settings, days: Object.assign({}, b.days), plans: Object.assign({}, b.plans), reviews: b.reviews || [], planning: Object.assign({}, b.planning), distractions: Object.assign({}, b.distractions) };
  for (const op of S.pending) applyOp(v, op);
  return v;
}

let opSeq = 0;
const retryT = {};
function enqueue(w) {
  const op = { oid: ++opSeq, path: w.path, kind: w.kind, data: w.data, ensure: w.ensure || null, cond: w.cond || null, tries: 0 };
  S.pending.push(op);
  savePending();
  pump(op.path);
}
function savePending() {
  store.set('pending', S.pending.length ? S.pending.map(o => ({ path: o.path, kind: o.kind, data: o.data, ensure: o.ensure, cond: o.cond })) : null);
}
function restorePending() {
  const arr = store.get('pending');
  if (!Array.isArray(arr)) return;
  for (const o of arr) if (o && o.path && o.kind) S.pending.push({ oid: ++opSeq, path: o.path, kind: o.kind, data: o.data, ensure: o.ensure || null, cond: o.cond || null, tries: 1 });
}
function pumpAll() {
  const paths = new Set(S.pending.map(o => o.path));
  paths.forEach(p => { clearTimeout(retryT[p]); pump(p); });
}
async function execOp(op) {
  const ref = S.db.doc(op.path);
  if (op.cond && op.tries > 0) {
    const snap = await ref.get();
    const cur = snap.exists ? snap.data() : null;
    const curId = cur && cur.running ? cur.id : null;
    if (curId !== op.cond.prevId) return; // superseded by a newer change from another device
  }
  if (op.kind === 'set') return ref.set(op.data);
  if (op.kind === 'delete') return ref.delete();
  try {
    await ref.update(op.data);
  } catch (e) {
    if (e && (e.code === 'invalid_argument' || e.code === 'transform_error')) {
      const snap = await ref.get();
      if (!snap.exists) return ref.set(deepMerge(Object.assign({}, op.ensure || {}), op.data));
    }
    throw e;
  }
}
async function pump(path) {
  if (!S.db || S.inflight.has(path) || S.conn === 'readonly') return;
  const op = S.pending.find(o => o.path === path);
  if (!op) return;
  S.inflight.add(path);
  let drop = false, retry = false;
  try { await execOp(op); drop = true; }
  catch (e) {
    const code = e && e.code;
    if (code === 'invalid_argument' || code === 'transform_error' || code === 'quota_exceeded') {
      drop = true;
      console.warn('Carrel write dropped', op.path, e);
      toast(code === 'quota_exceeded' ? 'Storage is full. Export your data from Setup, then remove old days.' : 'One change could not be saved and was dropped.');
    } else if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') {
      S.conn = 'readonly';
      if (typeof recoverAuth === 'function') recoverAuth();
    } else retry = true;
  }
  if (retry && ++op.tries >= 10) {
    retry = false; drop = true;
    console.warn('Carrel write retry limit reached', op.path, op);
    toast('One change kept failing and was dropped.');
  }
  S.inflight.delete(path);
  if (drop) { S.pending = S.pending.filter(o => o !== op); savePending(); }
  if (retry) {
    S.offline = true;
    const delay = Math.min(60000, 1500 * Math.pow(2, Math.min(op.tries, 6))) * (0.75 + Math.random() * 0.5);
    clearTimeout(retryT[path]);
    retryT[path] = setTimeout(() => pump(path), delay);
  } else {
    S.offline = S.pending.some(o => o.tries > 0 && !S.inflight.has(o.path));
    if (drop) pump(path);
  }
  changed();
}
function syncState() {
  if (S.conn === 'none') return 'none';
  if (!S.db) return 'connecting';
  if (S.conn === 'readonly') return 'readonly';
  if (S.offline) return 'offline';
  if (S.pending.length) return 'saving';
  return S.loaded.activities ? 'live' : 'connecting';
}
const canWrite = () => !!S.db && S.conn !== 'readonly' && S.owner;

function subscribe() {
  S.unsubs.forEach(u => { try { u(); } catch (e) { /* already closed */ } });
  S.unsubs = [];
  const db = S.db, from = S.windowFrom;
  const onErr = name => e => {
    console.warn('Carrel subscription', name, e);
    if (e && e.code === 'revoked') { S.conn = 'readonly'; if (typeof recoverAuth === 'function') recoverAuth(); changed(); }
    else if (e && e.code !== 'invalid_argument') { clearTimeout(S.resubT); S.resubT = setTimeout(subscribe, 5000); }
  };
  S.unsubs.push(db.doc('state/current').onSnapshot(s => { S.base.current = s.exists ? s.data() : null; S.loaded.current = true; changed(); }, onErr('current')));
  S.unsubs.push(db.doc('config/activities').onSnapshot(s => { S.base.activities = s.exists ? s.data() : null; S.loaded.activities = true; changed(); }, onErr('activities')));
  S.unsubs.push(db.doc('config/settings').onSnapshot(s => { S.base.settings = s.exists ? s.data() : null; S.loaded.settings = true; changed(); }, onErr('settings')));
  const coll = (name, key) => db.collection(name).where('date', '>=', from).onSnapshot(q => {
    const m = {};
    for (const k in S.base[key]) if (k < from) m[k] = S.base[key][k];
    q.docs.forEach(d => { if (d.exists) m[d.id] = d.data(); });
    S.base[key] = m;
    S.loaded[key] = true;
    changed();
  }, onErr(name));
  S.unsubs.push(coll('days', 'days'));
  S.unsubs.push(coll('plans', 'plans'));
  S.unsubs.push(coll('distractions', 'distractions'));
  S.unsubs.push(db.collection('reviews').orderBy('week', 'desc').limit(12).onSnapshot(q => {
    S.base.reviews = q.docs.filter(d => d.exists).map(d => Object.assign({ id: d.id }, d.data()));
    S.loaded.reviews = true;
    changed();
  }, onErr('reviews')));
  S.unsubs.push(db.collection('planning').onSnapshot(q => {
    const m = {};
    q.docs.forEach(d => { if (d.exists) m[d.id] = d.data(); });
    S.base.planning = m;
    S.loaded.planning = true;
    changed();
  }, onErr('planning')));
}
function ensureRange(fromK, toK) {
  if (!S.db || !S.windowFrom || fromK >= S.windowFrom) return;
  const hi = toK < S.windowFrom ? toK : addDaysKey(S.windowFrom, -1);
  const tag = fromK + '>' + hi;
  if (S.fetched.has(tag)) return;
  S.fetched.add(tag);
  Promise.all([
    S.db.collection('days').where('date', '>=', fromK).where('date', '<=', hi).get(),
    S.db.collection('plans').where('date', '>=', fromK).where('date', '<=', hi).get(),
    S.db.collection('distractions').where('date', '>=', fromK).where('date', '<=', hi).get()
  ]).then(([d, p, ds]) => {
    ds.docs.forEach(x => { if (x.exists) S.base.distractions[x.id] = x.data(); });
    d.docs.forEach(x => { if (x.exists) S.base.days[x.id] = x.data(); });
    p.docs.forEach(x => { if (x.exists) S.base.plans[x.id] = x.data(); });
    changed();
  }).catch(e => { S.fetched.delete(tag); console.warn('Carrel fetch', e); });
}

/* ---------- derived state ---------- */
function mergeSettings(s) { s = s || {}; return Object.assign({}, DEFAULTS, s, { pomodoro: Object.assign({}, DEFAULTS.pomodoro, s.pomodoro || {}) }); }
function buildActs(doc) {
  const items = (doc && doc.items) || {};
  const list = Object.entries(items).filter(([, a]) => a && a.name).map(([id, a]) => ({
    id, name: String(a.name), color: a.color || '#7A7F87', kind: a.kind === 'study' ? 'study' : 'life', order: +a.order || 0,
    goal: a.goal ? +a.goal : null, archived: !!a.archived, role: a.role || null, guard: a.guard ? +a.guard : null
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

/* ---------- views: shell ---------- */
function vHeader() {
  const st = syncState(), pend = S.pending.length;
  const lbl = { live: 'Saved', saving: 'Saving…', offline: 'Offline · ' + pend + ' waiting', readonly: 'View only', none: 'Signed out', connecting: 'Connecting…' }[st];
  const tabs = [['today', 'Today'], ['calendar', 'Calendar'], ['week', 'Week'], ['patterns', 'Patterns']].map(([v, t]) =>
    `<button type="button" class="tt ${UI.view === v ? 'on' : ''}" data-act="view" data-v="${v}"${UI.view === v ? ' aria-current="page"' : ''}>${t}</button>`).join('');
  let pill = '';
  if (CUR && (UI.view !== 'today' || (UI.date && UI.date !== todayKey()))) {
    const a = act(CUR.activity), s = parseT(CUR.start);
    pill = `<span class="runpill" style="--c:${a.color}"><i class="dot"></i><span class="rp-name">${esc(a.name)}</span><span class="num" data-tk="elx" data-s="${s}">${fmtEl(Date.now() - s)}</span><button type="button" class="icon-btn" data-act="stop" aria-label="Stop ${esc(a.name)}">${icon('stop')}</button></span>`;
  }
  return `<div class="wrap bar-in ${UI.view === 'calendar' ? 'wide' : ''}"><div class="brand"><i class="lampdot" aria-hidden="true"></i>Carrel</div><nav class="tabs-top" aria-label="Views">${tabs}</nav><div class="bar-right">${pill}<span class="sync s-${st}" role="status">${lbl}</span><button type="button" class="icon-btn hide-sm" data-act="setup" aria-label="Setup">${icon('sliders')}</button></div></div>`;
}
function vNav() {
  const items = [['today', 'Today', 'clock'], ['calendar', 'Calendar', 'cal'], ['week', 'Week', 'bars'], ['patterns', 'Patterns', 'grid']];
  return `<div class="tb-in">${items.map(([v, t, ic]) => `<button type="button" class="tb ${UI.view === v ? 'on' : ''}" data-act="view" data-v="${v}"${UI.view === v ? ' aria-current="page"' : ''}>${icon(ic)}<span>${t}</span></button>`).join('')}<button type="button" class="tb" data-act="setup">${icon('sliders')}<span>Setup</span></button></div>`;
}
function vNotices() {
  if (S.conn === 'none') return `<div class="banner" style="margin-bottom:22px"><h3>Sign in to Carrel</h3><p>Your timers and log are saved to your own account so they follow you across devices.</p><div class="row"><button type="button" class="btn lamp" data-act="signin">Sign in with Google</button></div></div>`;
  if (!S.owner) return `<div class="banner" style="margin-bottom:22px"><h3>This tracker is private</h3><p>Only the person who owns it can see or change its log.</p></div>`;
  if (S.conn === 'readonly') return `<div class="banner warn" style="margin-bottom:22px"><h3>View only</h3><p>Can't save right now. Carrel will retry automatically.</p><div class="row"><button type="button" class="btn sm" data-act="a1-reconnect">Try again</button></div></div>`;
  return '';
}
function vMain() {
  const n = vNotices();
  if (S.conn === 'none' || !S.owner) return `<div class="wrap">${n}</div>`;
  if (UI.view === 'calendar') return `<div class="wrap wide">${n}${vCalendar()}</div>`;
  if (UI.view === 'week') return `<div class="wrap">${n}${vWeek()}</div>`;
  if (UI.view === 'patterns') return `<div class="wrap">${n}${vPatterns()}</div>`;
  return `<div class="wrap">${n}${vToday()}</div>`;
}

/* ---------- views: Today ---------- */
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
    colB.push(vLog(k, now, pm));
    colB.push(vBreakdown(k, now, agg, pomos));
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
function vNoActs() {
  return `<section class="banner"><h3>Set up your activities</h3><p>Carrel has nothing to track yet. Add the starter set (Study plus everyday activities like sleep, meals and breaks) and rename anything later in Setup.</p><div class="row"><button type="button" class="btn lamp" data-act="starter">Add the starter set</button><button type="button" class="btn" data-act="setup">Open Setup</button></div></section>`;
}
function vFutureNote(k) {
  return `<section class="sec"><div class="sec-head"><h2>Ahead</h2></div><div class="empty"><p>Nothing is logged for ${esc(longDay(k))} yet. Blocks you add here are waiting when the day starts, and anything you carry over from today lands here.</p><div class="ask"><code>Plan ${k === addDaysKey(todayKey(), 1) ? 'tomorrow' : esc(shortDay(k))} in Carrel</code><button type="button" class="btn sm" data-act="copy" data-text="Plan ${k === addDaysKey(todayKey(), 1) ? 'tomorrow' : esc(shortDay(k))} in Carrel">${icon('copy')}Copy</button></div></div></section>`;
}
function vOnboard() {
  if (CFG.onboarded) return '';
  const studies = ACTS.filter(a => a.kind === 'study' && !a.archived);
  const names = new Set(studies.map(a => a.name.toLowerCase()));
  const sugg = SUGGEST.filter(n => !names.has(n.toLowerCase())).slice(0, 8);
  return `<section class="banner" aria-labelledby="onb-h">
    <h3 id="onb-h">What are you studying?</h3>
    <p>Add each subject or course, so timers, plans and patterns can tell them apart. Everyday activities like sleep, meals and breaks are already set up.</p>
    <form class="row" data-submit="onb-add"><input class="inp" id="onb-text" style="flex:1 1 220px;width:auto" placeholder="e.g. Organic chemistry, Calculus" data-bind="onbText" value="${esc(UI.onbText)}" autocomplete="off" aria-label="Subjects, separated by commas"><button class="btn lamp" type="submit">Add</button></form>
    ${sugg.length ? `<div class="chips">${sugg.map(n => `<button type="button" class="chip-btn" data-act="onb-chip" data-name="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="row"><span class="muted" style="font-size:13px;flex:1 1 200px">Studying: ${studies.map(a => esc(a.name)).join(', ') || 'nothing yet'}</span><button type="button" class="btn sm" data-act="onb-done">Done</button></div>
  </section>`;
}
function vRing(p, color) {
  const f = clamp((Date.now() - p.ps) / p.len, 0, 1);
  return `<svg class="ring ${p.left <= 0 ? 'due' : ''}" viewBox="0 0 64 64" aria-hidden="true" style="--c:${color}"><circle class="rb" cx="32" cy="32" r="27"/><circle class="rf" cx="32" cy="32" r="27" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="${Math.round(1000 * (1 - f))}" data-tk="ring" data-s="${p.ps}" data-len="${p.len}"/></svg>`;
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
    <input class="t-note" id="cur-note" data-change="cur-note" value="${esc(c.note || '')}" placeholder="This session I will… (optional)" maxlength="200" autocomplete="off" aria-label="What I will do this session">
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
  return `${back}<div class="row notice-row"><button type="button" class="btn sm" data-act="notice" title="Press X">Noticed <kbd>X</kbd></button>${chips}
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
    return `<button type="button" class="act ${a.id === runId ? 'on' : ''}" style="--c:${a.color}" data-act="start" data-id="${esc(a.id)}"${a.id === runId ? ' aria-pressed="true"' : ''}><span class="act-name">${esc(a.name)}</span><span class="act-meta"><span class="num">${t ? fmtDur(t) + ' today' : ''}</span>${k ? `<span class="kbd">${k}</span>` : ''}</span></button>`;
  }).join('');
  const lifeBtns = life.map(a => {
    const k = keyOf(a.id), t = tot(a.id);
    return `<button type="button" class="pill ${a.id === runId ? 'on' : ''}" style="--c:${a.color}" data-act="start" data-id="${esc(a.id)}"${a.id === runId ? ' aria-pressed="true"' : ''}><i class="dot"></i>${esc(a.name)}${t ? `<span class="num">${fmtDur(t)}</span>` : ''}${k ? `<span class="kbd">${k}</span>` : ''}</button>`;
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
  let lo = Infinity, hi = -Infinity;
  for (const en of ents) { lo = Math.min(lo, Math.max(en.s, ds)); hi = Math.max(hi, Math.min(entryEnd(en, now), de)); }
  const pieces = [];
  if (pm && (pm.isToday || pm.isFuture)) pm.rows.forEach(r => r.pieces.forEach(p => pieces.push({ r, a: p[0], b: p[1] })));
  if (k >= todayKey()) busyOf(k).forEach(z => { if (!isToday || z.e > now) pieces.push({ busy: z, a: z.s, b: z.e }); });
  pieces.forEach(p => { lo = Math.min(lo, p.a); hi = Math.max(hi, p.b); });
  if (isToday) { lo = Math.min(lo, now - 30 * MIN); hi = Math.max(hi, now + 30 * MIN); }
  if (pm && (pm.isToday || pm.isFuture) && pm.rows.length) hi = Math.max(hi, Math.min(pm.endMs, de));
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
    const a = act(en.a), s = Math.max(en.s, lo), e = Math.min(entryEnd(en, now), hi);
    if (e <= s) return '';
    const top = y(s), h = Math.max(6, y(e) - top - 1);
    const cls = `${en.running ? 'run' : ''} ${h < 17 ? 'tiny' : ''}`;
    const attrs = en.running ? 'data-act="edit-running"' : `data-act="edit-entry" data-id="${esc(en.id)}"`;
    return `<button type="button" class="tl-e ${cls}" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px;--c:${a.color}" ${attrs} data-key="${esc(en.id)}" aria-label="${esc(a.name)}, ${fmtT(en.s)} to ${en.running ? 'now' : fmtT(en.e)}"><span class="n">${esc(a.name)}${en.note && h >= 34 ? ' · <span class="muted">' + esc(en.note) + '</span>' : ''}</span>${h >= 30 ? `<span class="d">${fmtT(en.s)}–${en.running ? 'now' : fmtT(en.e)} · ${fmtDur(entryEnd(en, now) - en.s)}</span>` : ''}</button>`;
  }).join('');
  const gaps = gapsOf(ents, now, ds, de, isToday).map(([a, b]) => {
    const top = y(a), h = Math.max(10, y(b) - top - 2);
    return `<button type="button" class="tl-gap" style="top:${(top + 1).toFixed(1)}px;height:${h.toFixed(1)}px" data-act="fill" data-s="${a}" data-e="${b === now ? 'now' : b}" aria-label="Untracked ${fmtDur(b - a)}, ${fmtT(a)} to ${fmtT(b)}">${h >= 16 ? `<span>+ ${fmtDur(b - a)}</span>` : ''}</button>`;
  }).join('');
  const plan = pieces.filter(p => p.b > lo && p.a < hi).map(p => {
    if (p.busy) { const top = y(p.a), h = Math.max(8, y(p.b) - top - 2); return `<div class="tl-p busy" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px">${h >= 16 ? esc(p.busy.title) : ''}</div>`; }
    const a = act(p.r.activity), top = y(p.a), h = Math.max(8, y(p.b) - top - 2);
    return `<div class="tl-p ${p.r.over > 0 && p.b > pm.endMs ? 'over' : ''}" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px;--c:${a.color}">${h >= 16 ? esc(a.name) : ''}</div>`;
  }).join('');
  const nowLine = isToday && now >= lo && now <= hi ? `<i class="tl-now" style="top:${y(now).toFixed(1)}px"></i>` : '';
  const endLine = pm && (pm.isToday || pm.isFuture) && pm.rows.length && pm.endMs > lo && pm.endMs < hi ? `<div class="tl-end" style="top:${y(pm.endMs).toFixed(1)}px"><span>plan ends</span></div>` : '';
  return `<div class="tl-heads"><span></span><span>Logged</span><span>Plan ahead</span></div>
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
  let mx = 0;
  const avg = pm.heat.map((r, i) => r.map(v => { const a = pm.wdCount[i] ? v / pm.wdCount[i] : 0; mx = Math.max(mx, a); return a; }));
  const rows = avg.map((r, i) => `<div class="heat-row"><span>${esc(rowWeekday(i))}</span>${r.map((v, c) => `<i style="background:${heatColor(mx ? v / mx : 0)}" title="${esc(rowWeekday(i))} ${fmtHourL(pm.dsh + c)}: ${fmtDur(v)} on average"></i>`).join('')}</div>`).join('');
  const xs = `<div class="heat-row heat-x"><span></span>${Array.from({ length: 24 }, (_, c) => `<span>${c % 3 === 0 ? fmtHourS(pm.dsh + c) : ''}</span>`).join('')}</div>`;
  return `<section class="panel" aria-labelledby="ht-h"><div class="sec-head"><h2 id="ht-h">When you study</h2></div><p class="cap">Average study minutes in each hour, by weekday. Late-night hours sit on the day they belong to.</p>
    <div class="heat" role="img" aria-label="Study by hour and weekday">${rows}${xs}</div>
    <div class="scale"><span>less</span>${[0, .25, .5, .75, 1].map(f => `<i style="background:${heatColor(f)}"></i>`).join('')}<span>more</span>${mx ? `<span style="margin-left:auto">darkest = ${fmtDur(mx)}</span>` : ''}</div></section>`;
}
function vCal(pm, tk) {
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
    <div class="cal"><div class="cal-lbls">${lbls}</div><div class="cal-grid" role="img" aria-label="Study per day for 16 weeks">${cells.join('')}</div></div></section>`;
}
function vHist(pm) {
  const mx = Math.max(1, ...pm.buckets.map(b => b.n));
  const names = ['<15m', '15–30', '30–45', '45–60', '1–1.5h', '1.5–2h', '2h+'];
  return `<section class="panel" aria-labelledby="hs-h"><div class="sec-head"><h2 id="hs-h">How long you stay with it</h2></div><p class="cap">Unbroken study stretches (pauses under five minutes don’t break one). Typical stretch: <b class="num">${pm.lens.length ? fmtDur(pm.median * MIN) : '–'}</b>.</p>
    <div class="hist">${pm.buckets.map(b => `<div><span>${b.n || ''}</span><i style="height:${(b.n / mx * 100).toFixed(1)}%"></i></div>`).join('')}</div>
    <div class="hist-x">${names.map(n => `<span>${n}</span>`).join('')}</div></section>`;
}
function vMix(pm) {
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
  return `<section class="panel" aria-labelledby="mx-h"><div class="sec-head"><h2 id="mx-h">Subjects by week</h2></div><div class="mix">${rows}</div>
    <div class="legend">${Array.from(used).map(id => `<span><i style="--c:${act(id).color}"></i>${esc(act(id).name)}</span>`).join('')}</div></section>`;
}
function vSpans(pm) {
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
    <div class="spans-wrap"><div class="spans-y">${ys.join('')}</div><div class="spans">${cols}</div></div></section>`;
}
function vFocusHours(pm) {
  if (pm.rated < 8) return `<section class="panel" aria-labelledby="fq-h"><div class="sec-head"><h2 id="fq-h">Focus by hour</h2></div><p class="cap">After you stop a study timer, rate it Deep, Okay or Scattered in the message that appears. After eight ratings this shows when your best focus happens.</p></section>`;
  const cols = pm.fh.map((x, i) => ({ i, v: x.w ? x.v / x.w : 0, w: x.w })).filter(x => x.w > 0);
  return `<section class="panel" aria-labelledby="fq-h"><div class="sec-head"><h2 id="fq-h">Focus by hour</h2></div><p class="cap">Average rating of sessions started in each hour (3 = deep).</p>
    <div class="abars">${cols.map(x => `<div class="abar" style="--c:var(--lamp)"><span class="an"><span class="num">${fmtHourL(pm.dsh + x.i)}</span></span><span class="tr"><i style="width:${(x.v / 3 * 100).toFixed(1)}%"></i></span><span class="v">${x.v.toFixed(1)}</span></div>`).join('')}</div></section>`;
}

/* ---------- views: sheets ---------- */
function vSheet() {
  const sh = UI.sheet;
  if (!sh) return '';
  let inner = '';
  if (sh.type === 'entry') inner = sEntry(sh);
  else if (sh.type === 'split') inner = sSplit(sh);
  else if (sh.type === 'block') inner = sBlock(sh);
  else if (sh.type === 'wrap') inner = sWrap(sh);
  else if (sh.type === 'setup') inner = sSetup(sh);
  else if (sh.type === 'qnew') inner = sQnew(sh);
  else if (sh.type === 'busy') inner = sBusy(sh);
  else if (sh.type === 'deadline') inner = sDeadline(sh);
  else if (sh.type === 'task') inner = sTask(sh);
  return `<div class="scrim" data-act="sheet-close"><div class="sheet ${sh.type === 'setup' ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="sh-title" data-act="noop">${inner}</div></div>`;
}
function actPick(sel, bind) {
  const list = ACTS.filter(a => !a.archived || a.id === sel);
  return `<div class="pick" role="radiogroup" aria-label="Activity">${list.map(a => `<button type="button" role="radio" aria-checked="${a.id === sel}" class="${a.id === sel ? 'on' : ''}" style="--c:${a.color}" data-act="pick" data-bind-to="${bind}" data-v="${esc(a.id)}"><i class="dot"></i>${esc(a.name)}</button>`).join('')}</div>`;
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
function sSetup() {
  const study = ACTS.filter(a => a.kind === 'study'), life = ACTS.filter(a => a.kind !== 'study');
  const row = a => `<div class="arow ${a.archived ? 'arch' : ''}" style="--c:${a.color}" data-key="a-${esc(a.id)}">
      <button type="button" class="swatch" data-act="act-color" data-id="${esc(a.id)}" aria-label="Change color of ${esc(a.name)}"></button>
      <input class="inp" id="an-${esc(a.id)}" data-change="act-name" data-id="${esc(a.id)}" value="${esc(a.name)}" maxlength="40" aria-label="Name">
      <span class="tools">
        <button type="button" class="icon-btn" data-act="act-move" data-id="${esc(a.id)}" data-d="-1" aria-label="Move ${esc(a.name)} up">${icon('up')}</button>
        <button type="button" class="icon-btn" data-act="act-move" data-id="${esc(a.id)}" data-d="1" aria-label="Move ${esc(a.name)} down">${icon('down')}</button>
        <button type="button" class="icon-btn" data-act="act-arch" data-id="${esc(a.id)}" aria-label="${a.archived ? 'Restore' : 'Archive'} ${esc(a.name)}" title="${a.archived ? 'Restore' : 'Archive (keeps its history)'}">${a.archived ? icon('undo') : icon('archive')}</button>
      </span>
      <span class="arow-sub"><span class="seg"><button type="button" class="${a.kind === 'study' ? 'on' : ''}" data-act="act-kind" data-id="${esc(a.id)}" data-k="study">Study</button><button type="button" class="${a.kind !== 'study' ? 'on' : ''}" data-act="act-kind" data-id="${esc(a.id)}" data-k="life">Life</button></span>
      ${a.kind === 'study' ? `<label>Weekly goal <input type="number" class="inp sm goal" min="0" max="80" step="0.5" id="ag-${esc(a.id)}" data-change="act-goal" data-id="${esc(a.id)}" value="${a.goal ? +(a.goal / 60).toFixed(1) : ''}" placeholder="–"> h</label>` : ''}
      ${a.role === 'break' ? '<span class="tag brass">break</span>' : ''}${a.role === 'sleep' ? '<span class="tag">sleep</span>' : ''}${a.role === 'drift' ? '<span class="tag">drift</span>' : ''}</span>
    </div>`;
  const shown = l => l.filter(a => UI.showArchived || !a.archived);
  const arch = ACTS.filter(a => a.archived).length;
  const pd = CFG.pomodoro;
  const num = (f, v, min, max, step, lbl, suf) => `<label class="field"><span>${lbl}</span><input type="number" class="inp" id="set-${f}" data-change="set-num" data-f="${f}" min="${min}" max="${max}" step="${step}" value="${esc(v)}"${suf ? ` aria-label="${lbl} (${suf})"` : ''}></label>`;
  const nd = Object.keys(V.days || {}).length;
  const ne = ENTRIES.filter(e => !e.running).length;
  return `<div class="sh-head"><h2 id="sh-title">Setup</h2><button type="button" class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('x')}</button></div>
    <div class="setsec" style="border-top:0;padding-top:0"><h3>Activities</h3><p class="note-line">Study activities count toward study time, goals and streaks. Archiving hides an activity but keeps its history.</p>
      <span class="lbl">Study</span><div>${shown(study).map(row).join('') || '<p class="note-line">No study activities yet.</p>'}</div>
      <span class="lbl">Life</span><div>${shown(life).map(row).join('')}</div>
      <form class="row" data-submit="act-add"><input class="inp" id="na-name" style="flex:1 1 180px;width:auto" maxlength="40" placeholder="New activity" data-bind="newAct.name" value="${esc(UI.newAct.name)}" autocomplete="off" aria-label="New activity name"><span class="seg"><button type="button" class="${UI.newAct.kind === 'study' ? 'on' : ''}" data-act="na-kind" data-k="study">Study</button><button type="button" class="${UI.newAct.kind !== 'study' ? 'on' : ''}" data-act="na-kind" data-k="life">Life</button></span><button type="submit" class="btn sm lamp">${icon('plus')}Add</button></form>
      ${arch ? `<button type="button" class="btn sm ghost" data-act="show-arch" style="justify-self:start">${UI.showArchived ? 'Hide' : 'Show'} ${arch} archived</button>` : ''}
    </div>
    <div class="setsec"><h3>Pomodoro</h3><p class="note-line">Silent by design. When a focus block ends, the timer turns brass and waits; time keeps counting as study until you take the break.</p>
      <div class="chips">${Object.keys(PRESETS).concat(['1/1']).map(p => `<button type="button" class="chip-btn ${presetLabel(pd) === p ? 'on' : ''}" data-act="preset-apply" data-p="${p}">${p === '1/1' ? '1/1 test' : p}</button>`).join('')}</div>
      <div class="g2">${num('focus', pd.focus, 1, 180, 1, 'Focus minutes')}${num('short', pd.short, 1, 60, 1, 'Short break')}${num('long', pd.long, 1, 90, 1, 'Long break')}${num('every', pd.every, 2, 8, 1, 'Long break every')}</div>
    </div>
    <div class="setsec"><h3>Your day</h3>
      <div class="g2">
        <label class="field"><span>A new day starts at</span><input type="time" class="inp" id="set-dayStart" data-change="set-time" data-f="dayStart" value="${esc(CFG.dayStart)}"></label>
        <label class="field"><span>Daily study goal (hours)</span><input type="number" class="inp" id="set-goal" data-change="set-goal" min="0" max="16" step="0.25" value="${+(CFG.dailyGoal / 60).toFixed(2)}"></label>
        <label class="field"><span>Plans start at</span><input type="time" class="inp" id="set-planStart" data-change="set-time" data-f="planStart" value="${esc(CFG.planStart)}"></label>
        <label class="field"><span>Plans end by</span><input type="time" class="inp" id="set-planEnd" data-change="set-time" data-f="planEnd" value="${esc(CFG.planEnd)}"></label>
        ${num('gap', CFG.gap, 0, 60, 5, 'Breathing room between blocks (min)')}
        ${num('guardHours', CFG.guardHours, 1, 12, 1, 'Ask about timers running longer than (hours)')}
        <label class="field"><span>Week starts on</span><select class="sel" id="set-week" data-change="set-week" data-value="${CFG.weekStart}"><option value="1"${+CFG.weekStart === 1 ? ' selected' : ''}>Monday</option><option value="0"${+CFG.weekStart === 0 ? ' selected' : ''}>Sunday</option><option value="6"${+CFG.weekStart === 6 ? ' selected' : ''}>Saturday</option></select></label>
        <label class="field"><span>Clock</span><select class="sel" id="set-clock" data-change="set-clock" data-value="${esc(CFG.clock)}"><option value="auto"${CFG.clock === 'auto' ? ' selected' : ''}>Like this device</option><option value="24"${CFG.clock === '24' ? ' selected' : ''}>24-hour</option><option value="12"${CFG.clock === '12' ? ' selected' : ''}>12-hour</option></select></label>
      </div>
      <p class="note-line">Time after midnight and before the day start still counts toward the evening it began.</p>
    </div>
    ${vPhonePanel()}
    <div class="setsec"><h3>Ask Claude in chat</h3><p class="note-line">Everything routine happens on this page. For thinking work, open a chat with Claude and say one of these.</p>
      ${PROMPTS.map(([p, d]) => `<div class="field"><div class="ask"><code>${esc(p)}</code><button type="button" class="btn sm" data-act="copy" data-text="${esc(p)}">${icon('copy')}Copy</button></div><span style="font-weight:400;color:var(--ink-3)">${esc(d)}</span></div>`).join('')}
    </div>
    <div class="setsec"><h3>Your data</h3><p class="note-line">${ne} entries across ${nd} days are loaded on this device. Exports include everything saved.</p>
      ${S.user && S.user.email ? `<div class="row"><span class="note-line">Signed in as ${esc(S.user.email)}</span><button type="button" class="btn sm" data-act="signout">Sign out</button></div>` : ''}<div class="row">${S.dl ? `<button type="button" class="btn sm" data-act="export" data-f="csv">${icon('download')}Export CSV</button><button type="button" class="btn sm" data-act="export" data-f="json">${icon('download')}Export JSON backup</button>` : '<span class="note-line">Exports are not available in this view.</span>'}</div>
    </div>
    <div class="setsec"><h3>Keyboard</h3><div class="keys">
      <kbd>1–9</kbd><span>Start or switch to an activity, in the order shown on Today</span>
      <kbd>S</kbd><span>Stop the timer</span><kbd>B</kbd><span>Take a break, or go back from one</span><kbd>R</kbd><span>Resume the last activity</span>
      <kbd>M</kbd><span>Pomodoro on or off</span><kbd>D</kbd><span>Desk view</span><kbd>N</kbd><span>Add an entry</span>
      <kbd>← →</kbd><span>Previous or next day (or week)</span><kbd>T C W P</kbd><span>Today, Calendar, Week, Patterns</span><kbd>N</kbd><span>In Calendar: plan something new</span><kbd>Ctrl Z</kbd><span>Undo</span>
    </div></div>`;
}

/* ---------- desk view ---------- */
function vDesk() {
  const now = Date.now(), c = CUR;
  let big, sub = '', bar = '', label = 'Not tracking', color = 'var(--ink-3)', over = false, due = false;
  if (c) {
    const a = act(c.activity), s = parseT(c.start), ps = pomoState(now);
    label = a.name; color = a.color;
    if (ps) {
      due = ps.left <= 0; over = due;
      big = `<div class="desk-time ${over ? 'over' : ''}" data-tk="cd" data-to="${ps.end}">${fmtClock(ps.left)}</div>`;
      sub = ps.phase === 'focus' ? (due ? 'Break due · ' : 'Focus ' + ps.cycle + ' · ') + '<span data-tk="elx" data-s="' + s + '">' + fmtEl(now - s) + '</span> logged' : (due ? 'Break over' : 'Break');
      bar = `<div class="desk-ring ${due ? 'due' : ''}"><i data-tk="bar" data-s="${ps.ps}" data-len="${ps.len}" style="width:${(clamp((now - ps.ps) / ps.len, 0, 1) * 100).toFixed(2)}%"></i></div>`;
    } else {
      big = `<div class="desk-time" data-tk="elh" data-s="${s}">${fmtClock(now - s, true)}</div>`;
      sub = 'since ' + fmtT(s);
    }
  } else {
    const l = lastEntry();
    big = `<div class="desk-time">${l ? `<span data-tk="elh" data-s="${l.e}">${fmtClock(now - l.e, true)}</span>` : '0:00:00'}</div>`;
    sub = l ? 'untracked since ' + fmtT(l.e) : '';
  }
  const ctlHidden = Date.now() > UI.deskCtl;
  const isBreak = c && act(c.activity).role === 'break';
  const ctl = c ? `${isBreak && c.ret ? `<button type="button" data-act="back">Back to ${esc(act(c.ret.activity).name)}</button>` : !isBreak ? `<button type="button" data-act="break">Take a break</button>` : ''}<button type="button" data-act="stop">Stop</button>` : (lastEntry() ? `<button type="button" data-act="resume">Resume ${esc(act(lastEntry().a).name)}</button>` : '');
  return `<div class="desk" data-act="desk-tap" role="dialog" aria-modal="true" aria-label="Desk view"><div class="desk-in" style="transform:translate(${UI.deskShift[0]}px,${UI.deskShift[1]}px)">
    <div class="desk-act" style="--c:${color}"><i></i>${esc(label)}</div>${big}<div class="desk-sub">${sub}</div>${bar}
    <div class="desk-ctl ${ctlHidden ? 'hid' : ''}">${ctl}<button type="button" data-act="desk-exit">Exit</button></div></div>
    <div class="desk-hint">${ctlHidden ? 'Tap for controls · stays silent' : ''}</div></div>`;
}

/* ---------- toast ---------- */
let toastT = 0;
function toast(msg, o) {
  o = o || {};
  UI.toast = { msg, undo: !!o.undo, rate: o.rate || null };
  renderToast();
  clearTimeout(toastT);
  toastT = setTimeout(() => { UI.toast = null; renderToast(); }, o.rate ? 9000 : 5500);
}
function renderToast() {
  const el = document.getElementById('toast');
  if (!el) return;
  const t = UI.toast;
  morphInto(el, t ? `<div class="toast" role="status">${esc(t.msg)}${t.rate ? `<span class="rate" role="group" aria-label="Rate your focus"><button type="button" data-act="rate" data-v="3">Deep</button><button type="button" data-act="rate" data-v="2">Okay</button><button type="button" data-act="rate" data-v="1">Scattered</button></span>` : ''}${t.undo ? `<button type="button" class="tbtn" data-act="undo">Undo</button>` : ''}</div>` : '');
}

/* ---------- rendering: DOM morphing keeps focus and scroll while live data arrives ---------- */
function keyOf(n) { return n.nodeType === 1 ? n.getAttribute('data-key') : null; }
function syncAttrs(from, to) {
  const ta = to.attributes, fa = from.attributes;
  for (let i = fa.length - 1; i >= 0; i--) { const n = fa[i].name; if (!to.hasAttribute(n)) from.removeAttribute(n); }
  for (let i = 0; i < ta.length; i++) { const { name, value } = ta[i]; if (from.getAttribute(name) !== value) from.setAttribute(name, value); }
}
function morph(from, to) {
  if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) { from.replaceWith(to); return; }
  if (from.nodeType === 3 || from.nodeType === 8) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
  syncAttrs(from, to);
  const tag = from.nodeName;
  const focused = document.activeElement === from;
  if (tag === 'INPUT') {
    if (from.type === 'checkbox' || from.type === 'radio') from.checked = to.hasAttribute('checked');
    else if (!focused && from.value !== to.getAttribute('value')) from.value = to.getAttribute('value') || '';
    return;
  }
  if (tag === 'TEXTAREA') { if (!focused && from.value !== to.textContent) from.value = to.textContent; return; }
  morphChildren(from, to);
  if (tag === 'SELECT' && !focused && to.hasAttribute('data-value')) { const v = to.getAttribute('data-value'); if (from.value !== v) from.value = v; }
}
function morphChildren(parent, toParent) {
  const newKids = Array.from(toParent.childNodes);
  const keyed = new Map();
  parent.childNodes.forEach(n => { const k = keyOf(n); if (k) keyed.set(k, n); });
  let i = 0;
  for (const nk of newKids) {
    const k = keyOf(nk), cur = parent.childNodes[i] || null;
    let match = null;
    if (k) { match = keyed.get(k) || null; if (match) keyed.delete(k); }
    else if (cur && !keyOf(cur) && cur.nodeName === nk.nodeName) match = cur;
    if (match) {
      if (match !== cur) parent.insertBefore(match, cur);
      morph(match, nk);
    } else parent.insertBefore(nk, cur);
    i++;
  }
  while (parent.childNodes.length > newKids.length) parent.removeChild(parent.lastChild);
}
function morphInto(el, html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  morphChildren(el, t.content);
}
let rq = 0, lastFull = 0, nextDue = Infinity;
function changed() {
  if (rq) return;
  rq = requestAnimationFrame(() => { rq = 0; recompute(); render(); });
}
function render() {
  if (rq) { cancelAnimationFrame(rq); rq = 0; }
  if (DRAG && DRAG.started) { DRAG.pending = true; return; }
  const app = document.getElementById('app');
  if (!app) return;
  lastFull = Date.now();
  applyPhoneDrifts();
  computeNextDue();
  morphInto(document.getElementById('hdr'), vHeader());
  morphInto(document.getElementById('main'), vMain());
  morphInto(document.getElementById('nav'), vNav());
  morphInto(document.getElementById('sheet'), UI.sheet ? vSheet() : '');
  morphInto(document.getElementById('desk'), UI.desk ? vDesk() : '');
  document.documentElement.style.overflow = UI.sheet || UI.desk ? 'hidden' : '';
  if (S.mcp) gcWatch();
  nativeSync();
  if (UI.view === 'calendar' && UI.cal.scrollTo) { const sc = document.getElementById('cv-scroll'); if (sc) { UI.cal.scrollTo = false; sc.scrollTop = calScrollTarget(); } }
  tick(true);
}
function renderSheet() { morphInto(document.getElementById('sheet'), UI.sheet ? vSheet() : ''); }
function computeNextDue() {
  const now = Date.now();
  let due = Infinity;
  const ps = pomoState(now);
  if (ps && ps.end > now) due = Math.min(due, ps.end);
  const g = CUR && guardInfo(now) == null ? (() => { const s = parseT(CUR.start), a = act(CUR.activity); const ack = parseT(CUR.ack); const ref = ack && ack > s ? ack : s; return ref + (a.guard || (a.role === 'sleep' ? 14 : +CFG.guardHours || 4)) * HOUR; })() : Infinity;
  due = Math.min(due, g);
  nextDue = due;
}
function tick(fromRender) {
  const now = Date.now();
  if (!fromRender) {
    if (now >= nextDue || now - lastFull > 30000 || (UI.desk && UI.deskCtl && now > UI.deskCtl && now - UI.deskCtl < 1500)) { recompute(); render(); return; }
  }
  document.querySelectorAll('[data-tk]').forEach(el => {
    const k = el.getAttribute('data-tk');
    if (k === 'el') el.textContent = fmtClock(now - +el.getAttribute('data-s'));
    else if (k === 'elh') el.textContent = fmtClock(now - +el.getAttribute('data-s'), true);
    else if (k === 'elx') el.textContent = fmtEl(now - +el.getAttribute('data-s'));
    else if (k === 'dur') el.textContent = fmtDur(now - +el.getAttribute('data-s'));
    else if (k === 'cd') el.textContent = fmtClock(+el.getAttribute('data-to') - now);
    else if (k === 'ring') { const f = clamp((now - +el.getAttribute('data-s')) / +el.getAttribute('data-len'), 0, 1); el.setAttribute('stroke-dashoffset', String(Math.round(1000 * (1 - f)))); }
    else if (k === 'bar') { const f = clamp((now - +el.getAttribute('data-s')) / +el.getAttribute('data-len'), 0, 1); el.style.width = (f * 100).toFixed(2) + '%'; }
  });
}

/* ---------- sheets helpers ---------- */
let sheetOpener = null;
function focusSheet() {
  requestAnimationFrame(() => {
    const sh = document.querySelector('#sheet .sheet');
    if (!sh) return;
    const f = sh.querySelector('input:not([type=checkbox]),textarea,select,button.btn.lamp');
    if (f && window.matchMedia('(pointer:fine)').matches) f.focus({ preventScroll: true });
    else sh.focus && sh.setAttribute('tabindex', '-1');
  });
}
function openSheet(s) { sheetOpener = document.activeElement; UI.sheet = s; render(); focusSheet(); }
function closeSheet(silent) {
  UI.sheet = null;
  if (!silent) render();
  if (sheetOpener && sheetOpener.isConnected) { try { sheetOpener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  sheetOpener = null;
}

/* ---------- desk view helpers ---------- */
let wake = null, driftT = 0;
async function wakeOn() { try { if ('wakeLock' in navigator && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
function wakeOff() { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; }
function enterDesk() {
  UI.desk = true; UI.deskCtl = Date.now() + 5000; UI.deskShift = [0, 0];
  wakeOn();
  clearInterval(driftT);
  driftT = setInterval(() => {
    if (!UI.desk) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    UI.deskShift = reduce ? [0, 0] : [Math.round((Math.random() - 0.5) * 36), Math.round((Math.random() - 0.5) * 28)];
    const el = document.querySelector('.desk-in');
    if (el) el.style.transform = `translate(${UI.deskShift[0]}px,${UI.deskShift[1]}px)`;
  }, 45000);
  render();
}
function exitDesk() { UI.desk = false; clearInterval(driftT); wakeOff(); render(); }

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

/* ---------- actions ---------- */
const ACT = {
  notice() { noticeNow(); },
  'notice-drift'(el) { noticeDrift(+el.getAttribute('data-m')); },
  'park-backlog'(el) { parkToBacklog(el.getAttribute('data-k'), el.getAttribute('data-id')); },
  'park-drop'(el) { const k = el.getAttribute('data-k'); commit('Dropped.', W().dis(k, el.getAttribute('data-id'), { dismissed: true }), { undo: true }); },
  noop() {},
  view(el) { UI.view = el.getAttribute('data-v'); UI.planMenu = false; if (UI.view === 'today') UI.date = null; if (UI.view === 'calendar') UI.cal.scrollTo = true; try { history.replaceState(null, '', '#' + UI.view); } catch (e) { /* ignore */ } render(); window.scrollTo(0, 0); },
  setup() { openSheet({ type: 'setup' }); },
  'sheet-close'(el, e) { if (e && e.target !== el && el.classList.contains('scrim')) return; closeSheet(); },
  'day-prev'() { UI.date = addDaysKey(UI.date || todayKey(), -1); UI.openBlk = null; UI.planMenu = false; render(); },
  'day-next'() { const k = addDaysKey(UI.date || todayKey(), 1); UI.date = k === todayKey() ? null : k; UI.openBlk = null; UI.planMenu = false; render(); },
  'day-today'() { UI.date = null; render(); },
  'day-pick'(el) { const v = el.value; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { UI.date = v === todayKey() ? null : v; render(); } },
  'goto-day'(el) { const k = el.getAttribute('data-k'); UI.view = 'today'; UI.date = k === todayKey() ? null : k; try { history.replaceState(null, '', '#today'); } catch (e) { /* ignore */ } render(); window.scrollTo(0, 0); },
  start(el) { startActivity(el.getAttribute('data-id')); },
  stop() { stopTimer(); },
  break() { takeBreak(); },
  back() { backFromBreak(); },
  resume() { const l = lastEntry(); if (l) startActivity(l.a); },
  desk() { enterDesk(); },
  'desk-exit'(el, e) { e.stopPropagation(); exitDesk(); },
  'desk-tap'() { UI.deskCtl = Date.now() + 6000; render(); },
  'pomo-toggle'() {
    const on = pomoShown();
    UI.pomoOn = !on; store.set('pomoOn', UI.pomoOn);
    const c = CUR;
    const w = W();
    if (c && !on && !c.pomo && isStudyId(c.activity)) w.update('state/current', { pomo: newPomo(parsePreset(UI.pomoPreset) || PRESETS['25/5'], Date.now()) });
    else if (c && on && c.pomo) w.update('state/current', { pomo: null });
    if (w.list().length) { commit(UI.pomoOn ? 'Pomodoro on for this session.' : 'Pomodoro off. The timer keeps running.', w, { undo: false }); return; }
    render();
  },
  'pomo-preset'(el) {
    UI.pomoPreset = el.value; store.set('pomoPreset', UI.pomoPreset);
    const c = CUR, p = parsePreset(UI.pomoPreset);
    if (c && c.pomo && c.pomo.phase === 'focus' && p) { const w = W(); w.update('state/current', { pomo: { focus: p.focus, short: p.short, long: p.long, every: p.every } }); commit(null, w, { undo: false }); return; }
    render();
  },
  'start-from'(el) { UI.from = el.value; },
  'cur-note'(el) { const c = CUR; if (!c) return; const v = el.value.trim().slice(0, 200); if (v === (c.note || '')) return; const w = W(); w.update('state/current', { note: v }); commit(null, w, { undo: false }); },
  'edit-running'() { openEntrySheet('running'); },
  'edit-entry'(el) { openEntrySheet('edit', { id: el.getAttribute('data-id') }); },
  'add-entry'() { openEntrySheet('add'); },
  fill(el) { const s = +el.getAttribute('data-s'), ev = el.getAttribute('data-e'); openEntrySheet('add', { s, e: ev === 'now' ? Date.now() : +ev }); },
  logmode(el) { UI.logMode = el.getAttribute('data-m'); store.set('logMode', UI.logMode); render(); },
  'guard-keep'() { const w = W(); w.update('state/current', { ack: isoLocal(Date.now()) }); UI.guardOpen = false; commit(null, w, { undo: false }); },
  'guard-fix'() { UI.guardOpen = !UI.guardOpen; if (UI.guardOpen && CUR) { const s = parseT(CUR.start); UI.guardTime = msToHm(Math.min(Date.now(), s + 60 * MIN)); } render(); },
  'guard-save'() {
    const c = CUR; if (!c || !/^\d{1,2}:\d{2}/.test(UI.guardTime)) return;
    const s = parseT(c.start), now = Date.now();
    const [h, m] = UI.guardTime.split(':').map(Number);
    const d = new Date(now); d.setHours(h, m, 0, 0);
    let t = d.getTime();
    while (t > now) t -= DAY;
    if (t <= s) { toast('That time is before the timer started (' + fmtT(s) + ').'); return; }
    stopTimer({ at: t });
  },
  'guard-seen'(el) { stopTimer({ at: +el.getAttribute('data-t') }); },
  'entry-save'() { saveEntrySheet(); },
  'entry-del'() { deleteEntrySheet(); },
  'split-open'() {
    const sh = UI.sheet; const en = ENTRIES.find(e => e.id === sh.id); if (!en) return;
    const other = ACTS.find(a => !a.archived && a.id !== en.a);
    openSheet({ type: 'split', id: en.id, at: msToHm(en.s + (en.e - en.s) / 2), activity: other ? other.id : en.a, err: '' });
  },
  'split-save'() { saveSplit(); },
  pick(el) { setBind(el.getAttribute('data-bind-to'), el.getAttribute('data-v')); render(); },
  'e-focus'(el) { const d = UI.sheet.d; const v = +el.getAttribute('data-v'); d.focus = d.focus === v ? null : v; render(); },
  'e-nudge'(el) {
    const d = UI.sheet.d, f = el.getAttribute('data-f'), dl = +el.getAttribute('data-d');
    if (!/^\d{1,2}:\d{2}/.test(d[f] || '')) return;
    const t = hmOnDay(d.date, d[f]) + dl * MIN;
    d[f] = msToHm(t);
    if (f === 'start') { const nk = dayKeyOf(t); if (nk !== d.date) d.date = nk; }
    render();
  },
  rate(el) {
    const t = UI.toast && UI.toast.rate; if (!t) return;
    const w = W(); w.day(t.day, { [t.id]: { focus: +el.getAttribute('data-v') } });
    UI.toast = null; renderToast();
    commit(null, w, { undo: false });
    toast('Rated ' + ({ 3: 'deep', 2: 'okay', 1: 'scattered' })[el.getAttribute('data-v')] + '.');
  },
  undo() { undo(); },
  copy(el) { copyText(el); },
  // plan
  'plan-menu'() { UI.planMenu = !UI.planMenu; UI.clearArmed = false; render(); },
  'plan-end'(el) { const k = UI.date || todayKey(); if (!/^\d{1,2}:\d{2}/.test(el.value)) return; const w = W(); w.plan(k, { end: el.value }); commit(null, w, { undo: false }); },
  'plan-start'(el) { const k = UI.date || todayKey(); if (!/^\d{1,2}:\d{2}/.test(el.value)) return; const w = W(); w.plan(k, { start: el.value }); commit(null, w, { undo: false }); },
  'plan-extend'(el) { const k = UI.date || todayKey(); const w = W(); w.plan(k, { end: el.getAttribute('data-t') }); commit('Plan now runs until ' + fmtHM(el.getAttribute('data-t')) + '.', w); },
  'plan-shrink'() { UI.planMenu = false; planShrink(UI.date || todayKey()); },
  'plan-overflow'() { UI.planMenu = false; planOverflow(UI.date || todayKey()); },
  'plan-wrap'() { UI.planMenu = false; const k = UI.date || todayKey(); const pm = planModelFor(k); const pick = {}; if (pm) pm.rows.forEach(r => { if (r.remaining > 0) pick[r.id] = true; }); openSheet({ type: 'wrap', k, pick, stop: false }); },
  'wrap-pick'(el) { UI.sheet.pick[el.getAttribute('data-id')] = el.checked; },
  'wrap-stop'(el) { UI.sheet.stop = el.checked; },
  'wrap-save'() { wrapUp(); },
  'plan-clear'() {
    if (!UI.clearArmed) { UI.clearArmed = true; render(); return; }
    UI.clearArmed = false; UI.planMenu = false;
    const k = UI.date || todayKey(); const w = W(); w.set('plans/' + k, { date: k, source: 'me', blocks: {} });
    commit('Cleared the plan.', w);
  },
  'carry-y'() { planCarryYesterday(); },
  'carry-n'() { const yk = addDaysKey(todayKey(), -1); const w = W(); w.plan(yk, { closed: true }); commit('Left yesterday’s plan as it was.', w); },
  'addblk-open'() { UI.addBlk = true; render(); requestAnimationFrame(() => { const el = document.getElementById('ab-min'); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }); },
  'addblk-close'() { UI.addBlk = false; render(); },
  'ab-min'(el) { UI.ab.minutes = +el.getAttribute('data-m'); render(); },
  'blk-toggle'(el) { const id = el.getAttribute('data-id'); UI.openBlk = UI.openBlk === id ? null : id; render(); },
  'blk-start'(el) {
    const k = UI.date || todayKey(); const b = blocksOf(k)[el.getAttribute('data-id')]; if (!b) return;
    if (k !== todayKey()) return;
    UI.openBlk = null;
    startActivity(b.activity, { block: el.getAttribute('data-id'), pomoPreset: b.pomo || undefined, force: true });
  },
  'blk-min'(el) { const k = UI.date || todayKey(), id = el.getAttribute('data-id'), b = blocksOf(k)[id]; if (!b) return; const m = Math.max(5, Math.min(720, (+b.minutes || 0) + +el.getAttribute('data-d'))); const w = W(); w.plan(k, { blocks: { [id]: { minutes: m } } }); commit(null, w); },
  'blk-move'(el) { planReorder(UI.date || todayKey(), el.getAttribute('data-id'), +el.getAttribute('data-d')); },
  'blk-status'(el) { const k = UI.date || todayKey(), id = el.getAttribute('data-id'), s = el.getAttribute('data-s'); const w = W(); w.plan(k, { blocks: { [id]: { status: s } } }); UI.openBlk = null; commit(s === 'skipped' ? 'Skipped the block.' : s === 'done' ? 'Marked the block done.' : 'Reopened the block.', w); },
  'blk-unfix'(el) { const k = UI.date || todayKey(), id = el.getAttribute('data-id'); const w = W(); w.plan(k, { blocks: { [id]: { at: null } } }); commit('The block now fits wherever there’s room today.', w); },
  'blk-tomorrow'(el) {
    const k = UI.date || todayKey(), id = el.getAttribute('data-id'); const pm = planModelFor(k); const r = pm && pm.rows.find(x => x.id === id); if (!r) return;
    const w = W();
    w.plan(k, { blocks: { [id]: r.done > MIN ? { minutes: Math.round(r.done / MIN), status: 'done' } : { status: 'moved' } } });
    const nk = carryTo(w, k, [{ activity: r.activity, title: r.title, minutes: Math.ceil(r.remaining / MIN), pomo: r.pomo }]);
    UI.openBlk = null;
    commit('Moved ' + fmtDur(r.remaining) + ' of ' + act(r.activity).name + ' to ' + shortDay(nk) + '.', w);
  },
  'blk-edit'(el) { openBlockSheet(UI.date || todayKey(), el.getAttribute('data-id')); },
  'block-save'() { saveBlockSheet(); },
  'blk-del'(el) { const k = UI.date || todayKey(), id = el.getAttribute('data-id'); const w = W(); w.plan(k, { blocks: { [id]: null } }); UI.openBlk = null; commit('Deleted the block.', w); },
  // onboarding and activities
  'onb-chip'(el) { addActs([el.getAttribute('data-name')], 'study'); },
  'onb-done'() { saveSetting({ onboarded: true }, null); },
  starter() { const w = W(); w.set('config/activities', { items: STARTER }); commit('Added the starter activities.', w); },
  'act-color'(el) { const a = ACTMAP[el.getAttribute('data-id')]; if (!a) return; const i = PALETTE.findIndex(c => c.toUpperCase() === a.color.toUpperCase()); saveAct(a.id, { color: PALETTE[(i + 1) % PALETTE.length] }); },
  'act-name'(el) { const a = ACTMAP[el.getAttribute('data-id')]; const v = el.value.trim().replace(/\s+/g, ' ').slice(0, 40); if (!a || !v || v === a.name) { if (a) el.value = a.name; return; } saveAct(a.id, { name: v }, 'Renamed to ' + v + '.'); },
  'act-kind'(el) { const a = ACTMAP[el.getAttribute('data-id')]; const k = el.getAttribute('data-k'); if (!a || a.kind === k) return; saveAct(a.id, { kind: k }, a.name + ' now counts as ' + (k === 'study' ? 'study.' : 'life.')); },
  'act-goal'(el) { const a = ACTMAP[el.getAttribute('data-id')]; if (!a) return; const h = parseFloat(el.value); saveAct(a.id, { goal: h > 0 ? Math.round(h * 60) : null }); },
  'act-arch'(el) { const a = ACTMAP[el.getAttribute('data-id')]; if (!a) return; saveAct(a.id, { archived: !a.archived }, (a.archived ? 'Restored ' : 'Archived ') + a.name + '.'); },
  'act-move'(el) {
    const a = ACTMAP[el.getAttribute('data-id')]; if (!a) return;
    const list = ACTS.filter(x => x.kind === a.kind);
    const i = list.indexOf(a), j = i + +el.getAttribute('data-d');
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const items = {}; list.forEach((x, n) => { items[x.id] = { order: n + 1 }; });
    const w = W(); w.update('config/activities', { items }, { items: {} }); commit(null, w, { undo: false });
  },
  'na-kind'(el) { UI.newAct.kind = el.getAttribute('data-k'); renderSheet(); },
  'show-arch'() { UI.showArchived = !UI.showArchived; renderSheet(); },
  'preset-apply'(el) { const p = parsePreset(el.getAttribute('data-p')); if (p) saveSetting({ pomodoro: p }, null); },
  'set-num'(el) {
    const f = el.getAttribute('data-f'), v = +el.value;
    if (!Number.isFinite(v)) return;
    const lim = { focus: [1, 180], short: [1, 60], long: [1, 90], every: [2, 8], gap: [0, 60], guardHours: [1, 12] }[f];
    if (!lim) return;
    const val = clamp(Math.round(v), lim[0], lim[1]);
    if (['focus', 'short', 'long', 'every'].includes(f)) saveSetting({ pomodoro: { [f]: val } }, null); else saveSetting({ [f]: val }, null);
  },
  'set-time'(el) { if (/^\d{1,2}:\d{2}/.test(el.value)) saveSetting({ [el.getAttribute('data-f')]: el.value.slice(0, 5) }, null); },
  'set-goal'(el) { const h = parseFloat(el.value); if (Number.isFinite(h) && h >= 0) saveSetting({ dailyGoal: Math.round(h * 60) }, null); },
  'set-week'(el) { saveSetting({ weekStart: +el.value }, null); },
  'set-clock'(el) { saveSetting({ clock: el.value }, null); },
  export(el) { exportData(el.getAttribute('data-f')); },
  'ex-hide'() { UI.hideEx = true; store.set('hideEx', true); render(); },
  // week and patterns
  'wk-prev'() { UI.weekOff++; render(); },
  'wk-next'() { UI.weekOff = Math.max(0, UI.weekOff - 1); render(); },
  'wk-this'() { UI.weekOff = 0; render(); },
  pw(el) { UI.pweeks = +el.getAttribute('data-w'); render(); }
};
const SUBMIT = {
  'park-add'() { parkAdd(UI.parkText); },
  'onb-add'() { const names = String(UI.onbText || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean); if (!names.length) return; UI.onbText = ''; const el = document.getElementById('onb-text'); if (el) el.value = ''; addActs(names, 'study'); },
  'act-add'() { const n = UI.newAct.name; if (!String(n).trim()) return; UI.newAct.name = ''; const el = document.getElementById('na-name'); if (el) el.value = ''; addActs([n], UI.newAct.kind); },
  'blk-add'(f) { planAddBlock(f.getAttribute('data-k')); }
};
function addActs(names, kind) {
  const items = {};
  const added = [];
  names.slice(0, 20).forEach(n => { const r = addActivity(n, kind); if (r) { items[r.id] = r.doc; added.push(r.doc.name); } });
  if (!added.length) { render(); return; }
  const w = W(); w.update('config/activities', { items }, { items: {} });
  commit('Added ' + added.join(', ') + '.', w);
}
function setBind(path, value) {
  const parts = path.split('.');
  let o;
  if (parts[0] === 'sheet') { o = UI.sheet; parts.shift(); }
  else if (parts[0] === 'd' || parts[0] === 'b') o = UI.sheet;
  else o = UI;
  if (!o) return;
  for (let i = 0; i < parts.length - 1; i++) { o = o[parts[i]]; if (!o) return; }
  o[parts[parts.length - 1]] = value;
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const name = el.getAttribute('data-act');
  if (name === 'sheet-close' && el.classList.contains('scrim') && e.target !== el) return;
  if (name === 'desk-tap' && e.target.closest('button')) return;
  if ((el.type === 'checkbox')) { const fn = ACT[name]; if (fn) fn(el, e); return; }
  const fn = ACT[name];
  if (fn) fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.hasAttribute && el.hasAttribute('data-bind')) {
    setBind(el.getAttribute('data-bind'), el.type === 'checkbox' ? el.checked : el.value);
    if (UI.sheet) renderSheet(); else render();
  }
  const ch = el.getAttribute && el.getAttribute('data-change');
  if (ch && ACT[ch]) ACT[ch](el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.hasAttribute && el.hasAttribute('data-bind') && el.type !== 'checkbox') {
    setBind(el.getAttribute('data-bind'), el.value);
    if (UI.sheet && el.closest('#sheet')) renderSheet();
  }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, fn = SUBMIT[f.getAttribute('data-submit')];
  if (fn) fn(f, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (DRAG && DRAG.started) { cancelDrag(); e.preventDefault(); return; }
    if (UI.sheet) { closeSheet(); e.preventDefault(); return; }
    if (UI.desk) { exitDesk(); e.preventDefault(); return; }
    if (UI.planMenu || UI.openBlk) { UI.planMenu = false; UI.openBlk = null; render(); return; }
  }
  const t = e.target;
  if (e.key === 'Enter' && t && t.id === 'cur-note') { t.blur(); return; }
  const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || UI.sheet) return;
  const k = e.key;
  if (k === 'x' || k === 'X') { if (CUR) { e.preventDefault(); noticeNow(); } return; }
  if (/^[1-9]$/.test(k)) {
    const list = ACTS.filter(a => !a.archived);
    const order = list.filter(a => a.kind === 'study').concat(list.filter(a => a.kind !== 'study'));
    const a = order[+k - 1];
    if (a) { e.preventDefault(); startActivity(a.id); }
    return;
  }
  const lk = k.toLowerCase();
  if (lk === 's') { if (CUR) stopTimer(); }
  else if (lk === 'b') { if (CUR && act(CUR.activity).role === 'break') backFromBreak(); else takeBreak(); }
  else if (lk === 'r') { if (!CUR) { const l = lastEntry(); if (l) startActivity(l.a); } }
  else if (lk === 'm') ACT['pomo-toggle']();
  else if (lk === 'd') { if (UI.desk) exitDesk(); else enterDesk(); }
  else if (lk === 'n') { if (UI.view === 'calendar') ACT['cal-new'](); else openEntrySheet('add'); }
  else if (lk === 't') ACT.view({ getAttribute: () => 'today' });
  else if (lk === 'c') ACT.view({ getAttribute: () => 'calendar' });
  else if (lk === 'w') ACT.view({ getAttribute: () => 'week' });
  else if (lk === 'p') ACT.view({ getAttribute: () => 'patterns' });
  else if (k === 'ArrowLeft') { if (UI.view === 'week') ACT['wk-prev'](); else if (UI.view === 'today') ACT['day-prev'](); else if (UI.view === 'calendar') ACT['cal-prev'](); else return; }
  else if (k === 'ArrowRight') { if (UI.view === 'week') ACT['wk-next'](); else if (UI.view === 'today') ACT['day-next'](); else if (UI.view === 'calendar') ACT['cal-next'](); else return; }
  else return;
  e.preventDefault();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { recompute(); render(); pumpAll(); if (UI.desk) wakeOn(); }
  else store.set('seen', Date.now());
});
window.addEventListener('pagehide', () => store.set('seen', Date.now()));
window.addEventListener('online', () => pumpAll());
window.addEventListener('hashchange', () => {
  const h = (location.hash || '').replace('#', '');
  if (['today', 'calendar', 'week', 'patterns'].includes(h) && h !== UI.view) { UI.view = h; if (h === 'today') UI.date = null; if (h === 'calendar') UI.cal.scrollTo = true; render(); }
});

/* ---------- boot ---------- */
async function boot(hot) {
  hot = hot || {};
  if (hot.view) UI.view = hot.view;
  if (hot.date) UI.date = hot.date;
  const h = (location.hash || '').replace('#', '');
  if (['today', 'calendar', 'week', 'patterns'].includes(h)) UI.view = h;
  S.windowFrom = addDaysKey(keyOfDate(new Date()), -WINDOW_DAYS);
  restorePending();
  recompute();
  render();
  let seenW = 0;
  setInterval(() => { tick(false); const n = Date.now(); if (document.visibilityState === 'visible' && n - seenW > 30000) { seenW = n; store.set('seen', n); } }, 1000);
  await startSession();
}
