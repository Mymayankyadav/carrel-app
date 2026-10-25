/* Local test double for window.claude: an in-memory db with realistic seed data. Not shipped. */
(function () {
  const MINm = 60000;
  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
  const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
  function merge(t, s) { for (const k in s) { if (isObj(s[k]) && isObj(t[k])) t[k] = merge(Object.assign({}, t[k]), s[k]); else t[k] = clone(s[k]); } return t; }
  const pad = n => String(n).padStart(2, '0');
  function iso(ms) { const d = new Date(ms), off = -d.getTimezoneOffset(), a = Math.abs(off); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + (off >= 0 ? '+' : '-') + pad(Math.floor(a / 60)) + ':' + pad(a % 60); }
  const key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const docs = new Map();
  const ls = [];
  const snap = p => { const d = docs.get(p); return { id: p.split('/').pop(), exists: !!d, data: () => d ? Object.freeze(clone(d)) : undefined, metadata: { fromCache: false, hasPendingWrites: false } }; };
  const cmp = (a, op, b) => op === '>=' ? a >= b : op === '<=' ? a <= b : op === '==' ? a === b : op === '>' ? a > b : op === '<' ? a < b : true;
  function run(q) {
    let list = [];
    for (const [p, d] of docs) if (p.startsWith(q.path + '/') && !p.slice(q.path.length + 1).includes('/')) list.push([p, d]);
    q.f.forEach(([f, op, v]) => { list = list.filter(([, d]) => cmp(d[f], op, v)); });
    if (q.o) list.sort((a, b) => (a[1][q.o[0]] < b[1][q.o[0]] ? -1 : 1) * (q.o[1] === 'desc' ? -1 : 1)); else list.sort((a, b) => a[0] < b[0] ? -1 : 1);
    if (q.l) list = list.slice(0, q.l);
    const ds = list.map(([p]) => snap(p));
    return { docs: ds, size: ds.length, empty: !ds.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  }
  const notify = () => setTimeout(() => ls.slice().forEach(l => l()), 5);
  const sub = (fire) => { ls.push(fire); setTimeout(fire, 20); return () => { const i = ls.indexOf(fire); if (i >= 0) ls.splice(i, 1); }; };
  const ref = p => ({
    id: p.split('/').pop(), path: p,
    get: async () => snap(p),
    set: async d => { docs.set(p, clone(d)); notify(); },
    update: async d => { if (!docs.has(p)) throw { code: 'invalid_argument', message: 'missing document' }; docs.set(p, merge(clone(docs.get(p)), d)); notify(); },
    delete: async () => { docs.delete(p); notify(); },
    onSnapshot: (next) => sub(() => next(snap(p)))
  });
  const query = (path, f, o, l) => ({
    path,
    where: (a, op, v) => query(path, f.concat([[a, op, v]]), o, l),
    orderBy: (a, dir) => query(path, f, [a, dir || 'asc'], l),
    limit: n => query(path, f, o, n),
    get: async () => run({ path, f, o, l }),
    onSnapshot: (next) => sub(() => next(run({ path, f, o, l }))),
    doc: id => ref(path + '/' + (id || Math.random().toString(36).slice(2)))
  });
  const db = { doc: ref, collection: p => query(p, [], null, null) };

  /* ---- seed ---- */
  const acts = {
    physics: { name: 'Physics', color: '#C2603E', kind: 'study', order: 1, goal: 600 },
    maths: { name: 'Mathematics', color: '#3D7EA6', kind: 'study', order: 2, goal: 540 },
    chem: { name: 'Chemistry', color: '#2F9C8A', kind: 'study', order: 3, goal: 420 },
    study: { name: 'Study', color: '#8A63B8', kind: 'study', order: 4 },
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
  docs.set('config/activities', { items: acts });
  docs.set('config/settings', { dayStart: '04:00', planStart: '08:00', planEnd: '22:30', gap: 10, dailyGoal: 240, weekStart: 1, guardHours: 4, clock: 'auto', pomodoro: { focus: 25, short: 5, long: 15, every: 4 }, onboarded: true });

  const now = Date.now();
  const base = new Date(); base.setHours(0, 0, 0, 0);
  const logicalToday = new Date(now - 4 * 60 * MINm); logicalToday.setHours(0, 0, 0, 0);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const put = (dayDate, id, a, s, e, extra) => {
    const k = key(dayDate);
    const p = 'days/' + k;
    const d = docs.get(p) || { date: k, entries: {} };
    d.entries[id] = Object.assign({ activity: a, start: iso(s), end: iso(e), note: '', focus: null, block: null, pomo: null }, extra || {});
    docs.set(p, d);
  };
  let n = 0;
  // past days
  for (let i = 12; i >= 1; i--) {
    const d = new Date(logicalToday); d.setDate(d.getDate() - i);
    const b = d.getTime();
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    let t = b + (weekend ? 8 * 60 : 7 * 60) * MINm + Math.round(rnd() * 30) * MINm;
    const p = (a, m, ex) => { put(d, 'p' + (n++), a, t, t + m * MINm, ex); t += m * MINm; };
    p('meals', 25); t += 10 * MINm;
    const subj = ['physics', 'maths', 'chem'];
    const sessions = weekend ? 2 : 4 + Math.round(rnd());
    for (let j = 0; j < sessions; j++) {
      p(subj[(i + j) % 3], 40 + Math.round(rnd() * 50), { focus: rnd() < 0.5 ? 3 : 2 });
      if (rnd() < 0.3) p('phone', 10 + Math.round(rnd() * 15));
      p('break', 8 + Math.round(rnd() * 6));
      if (j === 1) { p('meals', 40); t += 20 * MINm; }
    }
    if (rnd() < 0.5) { t += 20 * MINm; p('exercise', 45); }
    t = Math.max(t, b + 19 * 60 * MINm + Math.round(rnd() * 40) * MINm);
    p('meals', 40);
    if (!weekend) p(subj[i % 3], 50 + Math.round(rnd() * 30), { focus: 2 });
    p('phone', 25 + Math.round(rnd() * 30));
    t = Math.max(t, b + (23 * 60 + 15) * MINm + Math.round(rnd() * 40) * MINm);
    if (i > 1) p('sleep', 7 * 60 + Math.round(rnd() * 60));
  }
  // today, up to now
  const L = logicalToday.getTime();
  const at = (h, m) => L + (h * 60 + m) * MINm;
  const today = [
    ['meals', at(7, 30), at(7, 55)], ['commute', at(8, 10), at(8, 35)],
    ['physics', at(8, 45), at(9, 35), { note: 'Rotational dynamics, problems 1–12', block: 'b1', pomo: { phase: iso(at(8, 45)), target: 50 }, focus: 3 }],
    ['break', at(9, 35), at(9, 46)],
    ['physics', at(9, 46), at(10, 30), { block: 'b1', pomo: { phase: iso(at(9, 46)), target: 50 }, focus: 3 }],
    ['phone', at(10, 30), at(10, 48)],
    ['maths', at(10, 50), at(11, 55), { note: 'Integration by parts', focus: 2 }],
    ['meals', at(13, 5), at(13, 45)],
    ['maths', at(14, 30), at(15, 10), { focus: 2 }],
    ['break', at(15, 10), at(15, 22)],
    ['chem', at(15, 22), at(16, 20), { note: 'SN1 vs SN2 summary', focus: 1 }],
    ['exercise', at(17, 0), at(17, 45)]
  ];
  const lastSleep = new Date(logicalToday); lastSleep.setDate(lastSleep.getDate() - 1);
  put(lastSleep, 'sleep-last', 'sleep', at(-1, -20) - 0, at(7, 5));
  let lastEnd = at(7, 5);
  today.forEach(([a, s, e, ex], i) => { if (e < now - 10 * MINm) { put(logicalToday, 't' + i, a, s, e, ex); lastEnd = e; } });
  const runStart = Math.max(lastEnd + 12 * MINm, now - 19 * MINm);
  docs.set('state/current', { running: true, id: 'run1', activity: 'chem', start: iso(runStart), note: 'Organic: reaction mechanisms', block: null, pomo: { focus: 25, short: 5, long: 15, every: 4, cycle: 2, phase: 'focus', phaseStart: iso(runStart), breakLen: null }, ret: null, ack: null });
  const tk = key(logicalToday);
  docs.set('plans/' + tk, {
    date: tk, source: 'claude', end: '22:30',
    note: 'Physics test on Tuesday, so the problem sets come first. Keep the past paper for tonight if you still have energy.',
    blocks: {
      b1: { activity: 'physics', title: 'Rotational dynamics: problems 1–20', minutes: 90, orig: 90, order: 1, at: null, status: 'open', pomo: '50/10', from: null },
      b2: { activity: 'maths', title: 'Integration by parts', minutes: 90, orig: 90, order: 2, at: null, status: 'open', pomo: null, from: null },
      b3: { activity: 'chem', title: 'Organic: reaction mechanisms', minutes: 120, orig: 120, order: 3, at: null, status: 'open', pomo: '25/5', from: null },
      b4: { activity: 'physics', title: 'Formula sheet revision', minutes: 45, orig: 45, order: 4, at: '20:30', status: 'open', pomo: null, from: null },
      b5: { activity: 'maths', title: 'Past paper, questions 1–6', minutes: 90, orig: 90, order: 5, at: null, status: 'open', pomo: null, from: null }
    }
  });
  const yk = key(lastSleep);
  docs.set('plans/' + yk, { date: yk, source: 'me', blocks: { y1: { activity: 'physics', title: '', minutes: 60, orig: 60, order: 1, status: 'open' }, y2: { activity: 'chem', title: 'Thermodynamics notes', minutes: 150, orig: 150, order: 2, status: 'open' } } });

  // planning: weekly timetable, one-off busy time, backlog, deadlines, tomorrow's plan
  const wdT = logicalToday.getDay();
  const kAdd = n => { const d = new Date(logicalToday); d.setDate(d.getDate() + n); return key(d); };
  docs.set('planning/commitments', { items: {
    c1: { title: 'Physics lecture', days: [1, 3, 5], start: '10:00', end: '11:30', activity: 'physics', from: null, until: null, archived: false },
    c2: { title: 'Maths coaching', days: [2, 4, 6], start: '17:30', end: '19:00', activity: 'maths', from: null, until: null, archived: false },
    c3: { title: 'Lab', days: [0, 2], start: '14:00', end: '16:00', activity: 'chem', from: null, until: null, archived: false }
  } });
  const tp = docs.get('plans/' + tk);
  tp.events = { v1: { title: 'Call home', start: '21:00', end: '21:30', activity: 'social' } };
  docs.set('plans/' + tk, tp);
  docs.set('plans/' + kAdd(1), { date: kAdd(1), source: 'me', blocks: {
    n1: { activity: 'physics', title: 'Chapter 7 problems', minutes: 90, orig: 90, order: 1, at: '09:30', status: 'open', pomo: '50/10', from: null },
    n2: { activity: 'chem', title: 'Organic reactions', minutes: 60, orig: 60, order: 2, at: null, status: 'open', pomo: null, from: null },
    n3: { activity: 'maths', title: 'Past paper 2023', minutes: 120, orig: 120, order: 3, at: null, status: 'open', pomo: null, from: null }
  } });
  docs.set('planning/backlog', { items: {
    t1: { title: 'Rotational dynamics: derivations', activity: 'physics', minutes: 90, due: kAdd(3), prio: 1, order: 1, created: iso(now) },
    t2: { title: 'Integration practice set B', activity: 'maths', minutes: 120, due: kAdd(5), prio: 2, order: 2, created: iso(now) },
    t3: { title: 'Make a formula sheet', activity: 'physics', minutes: 45, due: null, prio: 2, order: 3, created: iso(now) },
    t4: { title: 'Read chapter 12', activity: 'chem', minutes: 60, due: null, prio: 3, order: 4, created: iso(now) }
  } });
  docs.set('planning/deadlines', { items: {
    d1: { title: 'Physics unit test', date: kAdd(3), time: '09:00', activity: 'physics', kind: 'exam', done: false },
    d2: { title: 'Maths assignment', date: kAdd(5), time: null, activity: 'maths', kind: 'due', done: false },
    d3: { title: 'Chemistry practical', date: kAdd(12), time: null, activity: 'chem', kind: 'exam', done: false }
  } });

  window.claude = {
    use: async name => {
      await new Promise(r => setTimeout(r, 30));
      if (name === 'db') return db;
      if (name === 'user') return { isOwner: async () => true, canEdit: async () => true, can: async () => true, id: async () => 'u_test' };
      if (name === 'downloads') return { save: async () => ({ status: 'saved' }) };
      if (name === 'mcp') {
        const ev = (sum, s, e, id) => ({ id, summary: sum, status: 'confirmed', eventType: 'DEFAULT', htmlLink: 'https://www.google.com/calendar/event?eid=' + id, start: { dateTime: iso(s) }, end: { dateTime: iso(e) } });
        const payload = { events: [ev('Dentist', at(24 + 11, 0), at(24 + 12, 0), 'g1'), ev('Group project call', at(21, 45), at(22, 15), 'g2'),
          { id: 'g3', summary: 'Diwali break', status: 'confirmed', start: { date: kAdd(6) + 'T00:00:00Z' }, end: { date: kAdd(8) + 'T00:00:00Z' } }] };
        const G = window.__gcal = window.__gcal || { events: [], calls: [], watchers: [], n: 0, failNext: null };
        const cl = v => JSON.parse(JSON.stringify(v));
        const listFor = i => (i && i.calendarId === 'carrel@group.calendar.google.com') ? { events: cl(G.events) } : payload;
        const notifyAll = () => G.watchers.slice().forEach(w => setTimeout(() => w.h({ type: 'data', result: { payload: listFor(w.i) } }), 10));
        G.notify = notifyAll;
        const call = async (srv, tool, a) => {
          G.calls.push({ tool, args: cl(a || {}) });
          if (G.failNext) { const f = G.failNext; G.failNext = null; throw f; }
          if (tool === 'list_calendars') return { payload: { calendars: [{ id: 'c_classroom1@group.calendar.google.com', summary: 'Calculus II', timeZone: 'UTC' }, { id: 'en.indian#holiday@group.v.calendar.google.com', summary: 'Holidays in India' }, { id: 'mayank@example.com', summary: 'mayank@example.com' }, { id: 'carrel@group.calendar.google.com', summary: 'Carrel Live' }] } };
          if (tool === 'create_event') { const id = 'ev' + (++G.n); G.events.push({ id, status: 'confirmed', summary: a.summary, description: a.description, start: { dateTime: a.startTime + '+05:30' }, end: { dateTime: a.endTime + '+05:30' } }); notifyAll(); return { payload: { id } }; }
          if (tool === 'update_event') { const e = G.events.find(x => x.id === a.eventId); if (!e) { throw { code: 'tool_error', message: 'Event not found (404)' }; } if (a.summary) e.summary = a.summary; if (a.description) e.description = a.description; notifyAll(); return { payload: { id: e.id } }; }
          if (tool === 'delete_event') { G.events = G.events.filter(x => x.id !== a.eventId); notifyAll(); return { payload: {} }; }
          if (tool === 'get_event') { const e = G.events.find(x => x.id === a.eventId); return { payload: e || {} }; }
          return { payload: listFor(a) };
        };
        return { watchTool: (s, t, i, h) => { const w = { i, h }; G.watchers.push(w); setTimeout(() => h({ type: 'data', result: { payload: listFor(i) } }), 40); return () => { const k = G.watchers.indexOf(w); if (k >= 0) G.watchers.splice(k, 1); }; }, callTool: call };
      }
      return null;
    }
  };
  window.__mockDocs = docs;
})();
