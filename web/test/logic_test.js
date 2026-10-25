/* One run of the pure logic against hand-checked cases. Run with TZ=Asia/Kolkata. */
const assert = require('assert');
const L = require('../logic.js');
const { CTX, MIN, HOUR } = L;
CTX.cfg = { dayStart: '04:00', planStart: '08:00', planEnd: '22:30', gap: 10, dailyGoal: 120, weekStart: 1 };
const acts = { phys: { kind: 'study' }, math: { kind: 'study' }, chem: { kind: 'study' }, brk: { kind: 'life', role: 'break' }, sleep: { kind: 'life', role: 'sleep' }, meals: { kind: 'life' }, phone: { kind: 'life', role: 'drift' } };
CTX.act = id => acts[id] ? Object.assign({ id }, acts[id]) : null;
const T = s => Date.parse(s + '+05:30');
const out = [];
const ok = (name, cond, detail) => { out.push((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };

// time math
ok('after-midnight belongs to evening', L.dayKeyOf(T('2026-10-25T01:30:00')) === '2026-10-24');
ok('day starts at 04:00', L.dayKeyOf(T('2026-10-25T04:00:00')) === '2026-10-25');
ok('hmOnDay wraps past midnight', L.hmOnDay('2026-10-24', '01:00') === T('2026-10-25T01:00:00'));
ok('iso round trip', L.isoLocal(T('2026-10-24T09:05:07')) === '2026-10-24T09:05:07+05:30', L.isoLocal(T('2026-10-24T09:05:07')));
ok('week starts Monday', L.weekStartKey('2026-10-24') === '2026-10-19');
ok('fmtDur', L.fmtDur(95 * MIN) === '1h 35m' && L.fmtDur(40 * MIN) === '40m' && L.fmtDur(2 * HOUR) === '2h');
ok('fmtClock countdown overtime', L.fmtClock(-130000) === '+2:10' && L.fmtClock(3723000) === '1:02:03');

// aggregation across the day boundary
const E = (id, a, s, e, x) => Object.assign({ id, a, s: T(s), e: e ? T(e) : null, note: '', focus: null, block: null, pomo: null }, x || {});
const sleep = [E('s1', 'sleep', '2026-10-23T23:00:00', '2026-10-24T07:00:00')];
const ag = L.aggregate(sleep, T('2026-10-24T12:00:00'), '2026-10-23', '2026-10-24');
ok('sleep split at 04:00', ag['2026-10-23'].acts.sleep === 5 * HOUR && ag['2026-10-24'].acts.sleep === 3 * HOUR, JSON.stringify({ a: ag['2026-10-23'].acts.sleep / HOUR, b: ag['2026-10-24'].acts.sleep / HOUR }));

// plan: explicit + automatic attribution, running block, fixed block, overflow
const now = T('2026-10-24T19:20:00');
const entries = [
  E('e1', 'phys', '2026-10-24T08:45:00', '2026-10-24T09:35:00', { block: 'b1', pomo: { phase: '2026-10-24T08:45:00+05:30', target: 50 } }),
  E('e2', 'brk', '2026-10-24T09:35:00', '2026-10-24T09:46:00'),
  E('e3', 'phys', '2026-10-24T09:46:00', '2026-10-24T10:30:00', { block: 'b1', pomo: { phase: '2026-10-24T09:46:00+05:30', target: 50 } }),
  E('e4', 'math', '2026-10-24T10:50:00', '2026-10-24T11:55:00'),
  E('e5', 'math', '2026-10-24T14:30:00', '2026-10-24T15:10:00'),
  E('e6', 'chem', '2026-10-24T15:22:00', '2026-10-24T16:20:00'),
  E('run', 'chem', '2026-10-24T19:01:00', null, { running: true })
];
const plan = { date: '2026-10-24', blocks: {
  b1: { activity: 'phys', minutes: 90, order: 1 },
  b2: { activity: 'math', minutes: 90, order: 2 },
  b3: { activity: 'chem', minutes: 120, order: 3 },
  b4: { activity: 'phys', minutes: 45, order: 4, at: '20:30' },
  b5: { activity: 'math', minutes: 90, order: 5 },
  b6: { activity: 'chem', minutes: 30, order: 6, status: 'skipped' }
} };
const pm = L.planCompute(plan, '2026-10-24', entries, now, { running: true });
const r = id => pm.rows.find(x => x.id === id);
const fm = ms => Math.round(ms / MIN);
const hm = ms => L.isoLocal(ms).slice(11, 16);
ok('b1 done from explicit links (94m)', r('b1').st === 'done' && fm(r('b1').done) === 94, r('b1').st + ' ' + fm(r('b1').done));
ok('b2 filled by maths automatically', r('b2').st === 'done' && fm(r('b2').done) === 90);
ok('b5 gets maths overflow 15m', r('b5').st === 'partial' && fm(r('b5').done) === 15, fm(r('b5').done));
ok('b3 is active (running chem)', pm.activeId === 'b3' && r('b3').st === 'active' && fm(r('b3').done) === 77, fm(r('b3').done));
ok('active block projected from now', hm(r('b3').pieces[0][0]) === '19:20' && hm(r('b3').pieces[0][1]) === '20:03', r('b3').pieces.map(p => hm(p[0]) + '-' + hm(p[1])).join(','));
ok('fixed block stays at 20:30', hm(r('b4').pieces[0][0]) === '20:30' && hm(r('b4').pieces[0][1]) === '21:15');
ok('flex block skips a too-small slot before the fixed block', hm(r('b5').pieces[0][0]) === '21:25' && hm(r('b5').pieces[0][1]) === '22:40', r('b5').pieces.map(p => hm(p[0]) + '-' + hm(p[1])).join(','));
ok('overflow past 22:30 is 10m', fm(pm.over) === 10, fm(pm.over));
ok('skipped block excluded from planned', fm(pm.planned) === 435, fm(pm.planned));

// quitting early: same plan, but the chem session stopped at 19:05 and nothing is running
const stopped = entries.filter(x => x.id !== 'run').concat([E('run', 'chem', '2026-10-24T19:01:00', '2026-10-24T19:05:00')]);
const pm2 = L.planCompute(plan, '2026-10-24', stopped, now, null);
const r2 = id => pm2.rows.find(x => x.id === id);
ok('early stop keeps the rest of the block', r2('b3').st === 'partial' && fm(r2('b3').remaining) === 58, fm(r2('b3').remaining));
ok('rest of block flows into the next free slot', hm(r2('b3').pieces[0][0]) === '19:20', r2('b3').pieces.map(p => hm(p[0]) + '-' + hm(p[1])).join(','));

// a late fixed block that was never started becomes missed
const plan3 = { blocks: { f: { activity: 'math', minutes: 30, order: 1, at: '15:00' } } };
const pm3 = L.planCompute(plan3, '2026-10-24', [], T('2026-10-24T16:00:00'), null);
ok('fixed block whose window passed is missed', pm3.rows[0].missed === true && pm3.missed.length === 1);

// future day projects from plan start
const pm4 = L.planCompute({ blocks: { a: { activity: 'phys', minutes: 60, order: 1 }, b: { activity: 'math', minutes: 30, order: 2 } } }, '2026-10-25', [], now, null);
ok('tomorrow starts at 08:00 with gaps', hm(pm4.rows[0].pieces[0][0]) === '08:00' && hm(pm4.rows[1].pieces[0][0]) === '09:10');

// pomodoros: two focus phases; the second reaches 44m of a 50m target, so only one counts
const pd = L.pomodoroByDay(entries, now);
ok('pomodoro counts completed phases only', pd['2026-10-24'] === 1, JSON.stringify(pd));

// sessions merge short pauses, count switches
const ss = L.studySessions([E('a', 'phys', '2026-10-24T08:00:00', '2026-10-24T09:00:00'), E('b', 'math', '2026-10-24T09:03:00', '2026-10-24T09:30:00'), E('c', 'phys', '2026-10-24T10:00:00', '2026-10-24T10:20:00')], now, T('2026-10-24T04:00:00'), T('2026-10-25T04:00:00'));
ok('sessions merge across a 3-minute pause', ss.length === 2 && fm(ss[0].ms) === 87 && ss[0].switches === 1, ss.map(x => fm(x.ms) + '/' + x.switches).join(','));

// patterns + insights on the example generator
const ex = L.exampleEntries(now, ['phys', 'math', 'chem'], { sleep: 'sleep', meals: 'meals', break: 'brk', phone: 'phone' });
const pmod = L.patternsModel(ex, now, 4);
const ins = L.insights(pmod, h => String(h).padStart(2, '0') + ':00', { weekday: i => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i], minuteOfDay: m => L.minToHm(m + 240) }, { days: 5, ratio: 0.72, carried: 'Physics' });
ok('example data fills the range', pmod.studyDays >= 26, String(pmod.studyDays));
ok('insights are generated', ins.length >= 5, String(ins.length));
ok('no overlapping example entries', ex.every((x, i) => i === 0 || ex[i - 1].e <= x.s));
// busy time: weekly items + one-off events; projection flows around them
const commits = { c1: { title: 'Lecture', days: [6], start: '19:30', end: '20:30', activity: 'phys' }, c2: { title: 'Other day', days: [1], start: '10:00', end: '11:00' } };
const bplan = { blocks: { a: { activity: 'math', minutes: 60, order: 1 }, b: { activity: 'phys', minutes: 30, order: 2, at: '19:45' } }, events: { v: { title: 'Call', start: '21:00', end: '21:30' } } };
const bz = L.busyFor('2026-10-24', commits, bplan);
ok('busy for Saturday: weekly lecture + one-off call', bz.length === 2 && bz[0].title === 'Lecture' && bz[1].title === 'Call', bz.map(x => x.title).join(','));
const now2 = T('2026-10-24T19:00:00');
const pmB = L.planCompute(bplan, '2026-10-24', [], now2, null, bz.map(x => [x.s, x.e]));
const rB = id => pmB.rows.find(x => x.id === id);
ok('fixed block inside busy time is flagged', rB('b').clash === true);
ok('flexible block flows around busy and fixed time', rB('a').pieces.map(p => hm(p[0]) + '-' + hm(p[1])).join(',') === '19:00-19:20,21:40-22:20', rB('a').pieces.map(p => hm(p[0]) + '-' + hm(p[1])).join(','));
const capB = L.dayCapacity('2026-10-24', bplan, pmB, bz.map(x => [x.s, x.e]), now2);
ok('capacity subtracts busy time from 19:00-22:30', fm(capB.free) === 120 && fm(capB.need) === 90, fm(capB.free) + ' free / ' + fm(capB.need) + ' need');
const lay = L.layoutOverlaps([{ s: 0, e: 10 }, { s: 5, e: 15 }, { s: 12, e: 20 }, { s: 30, e: 40 }]);
ok('overlap layout uses two columns, then resets', lay[0].ncol === 2 && lay[1].col === 1 && lay[2].col === 0 && lay[3].ncol === 1, lay.map(x => x.col + '/' + x.ncol).join(' '));
ok('skip hides a weekly item for one day', L.busyFor('2026-10-24', commits, { skip: { c1: true } }).length === 0);
// the running block pauses around busy time
const pmA = L.planCompute({ blocks: { a: { activity: 'chem', minutes: 120, order: 1 } } }, '2026-10-24', [E('r', 'chem', '2026-10-24T19:13:00', null, { running: true })], T('2026-10-24T20:50:00'), { running: true }, [[T('2026-10-24T21:00:00'), T('2026-10-24T21:30:00')]]);
ok('running block stops for the call and resumes after it', pmA.rows[0].pieces.map(p => hm(p[0]) + '-' + hm(p[1])).join(',') === '20:50-21:00,21:40-21:53', pmA.rows[0].pieces.map(p => hm(p[0]) + '-' + hm(p[1])).join(','));

// ---- Carrel Live bridge ----
{
  const A = id => ({ chem: { id: 'chem', name: 'Chemistry', color: '#2F9C8A' }, hindi: { id: 'hindi', name: 'Hindi — हिंदी', color: '#8A63B8' }, brk: { id: 'brk', name: 'Break', color: '#B08A3E' }, bad: { id: 'bad', name: 'Odd', color: 'red' } })[id];
  const o = { act: A, breakId: 'brk', rev: 1761371520000.4, blockTitle: 'Q4 of chapter 7' };
  const ints = st => JSON.stringify(st).match(/:\s*-?\d+\.\d+/g) === null;
  const idle = L.liveStateOf({ running: false, stopped: 'x' }, o);
  ok('live: idle has url and nulls', idle.status === 'idle' && idle.activity === null && idle.url === L.LIVE_URL && ints(idle) && idle.rev === 1761371520000);
  const cur = { running: true, activity: 'chem', start: '2026-10-24T09:00:00+05:30', note: '', pomo: { focus: 25, short: 5, long: 15, every: 4, cycle: 1, phase: 'focus', phaseStart: '2026-10-24T09:00:00+05:30', breakLen: null } };
  const run = L.liveStateOf(cur, o);
  ok('live: running with pomo and block title', run.status === 'running' && run.intention === 'Q4 of chapter 7' && run.startedAt === T('2026-10-24T09:00:00') && run.pomo.focusEndsAt === T('2026-10-24T09:25:00') && ints(run));
  ok('live: note wins over block title', L.liveStateOf(Object.assign({}, cur, { note: ' mock paper ' }), o).intention === 'mock paper');
  ok('live: no pomo when none', L.liveStateOf(Object.assign({}, cur, { pomo: null }), o).pomo === null);
  const brk = L.liveStateOf({ running: true, activity: 'brk', start: '2026-10-24T09:30:00+05:30', ret: { activity: 'chem' }, pomo: Object.assign({}, cur.pomo, { phase: 'break', phaseStart: '2026-10-24T09:30:00+05:30', breakLen: 5 }) }, o);
  ok('live: break with return and breakEndsAt', brk.status === 'break' && brk.breakStartedAt === T('2026-10-24T09:30:00') && brk.returnTo.name === 'Chemistry' && brk.pomo.breakEndsAt === T('2026-10-24T09:35:00') && brk.pomo.focusEndsAt === null);
  const brk2 = L.liveStateOf({ running: true, activity: 'brk', start: '2026-10-24T09:30:00+05:30' }, o);
  ok('live: manual break has no pomo or return', brk2.status === 'break' && brk2.pomo === null && brk2.returnTo === null);
  ok('live: bad colour falls back', L.liveStateOf({ running: true, activity: 'bad', start: '2026-10-24T09:00:00+05:30' }, o).activity.color === '#B5543A');
  const tok = L.encodeToken(L.liveStateOf({ running: true, activity: 'hindi', start: '2026-10-24T09:00:00+05:30' }, o));
  ok('token: no padding and url-safe', /^carrel1:[A-Za-z0-9_-]+$/.test(tok));
  const back = L.decodeToken('<p>Hello</p>\n<b>' + tok + '</b>&nbsp;');
  ok('token: round trip with non-ASCII inside html', back && back.activity.name === 'Hindi — हिंदी' && back.kind === 'state');
  ok('token: garbage and wrong version ignored', L.decodeToken('carrel1:@@@') === null && L.decodeToken(L.encodeToken({ v: 2, kind: 'state' })) === null && L.decodeToken(null) === null);
  const id1 = '11111111-2222-3333-4444-555555555555', id2 = '11111111-2222-3333-4444-555555555556', id3 = '11111111-2222-3333-4444-555555555557', id4 = '11111111-2222-3333-4444-555555555558';
  const S0 = T('2026-10-24T09:00:00');
  const mk = (id, type, at, extra) => L.cleanMark(Object.assign({ v: 1, kind: 'mark', id, type, at: S0 + at * MIN, driftMin: null, text: null, activityId: 'chem', stateRev: 1 }, extra || {}));
  ok('mark: valid and invalid shapes', mk(id1, 'urge', 5) && mk(id1, 'drift', 5, { driftMin: 5 }) && !mk(id1, 'drift', 5, { driftMin: 7 }) && !mk(id1, 'park', 5) && !mk(id1, 'stop', 5) && mk(id1, 'stop', 5, { startedAt: S0 }) && !mk('nope', 'urge', 5) && !mk(id1, 'urge', 5, { driftMin: 1 }));
  const marks = [mk(id3, 'break', 40, { startedAt: S0 + 30 * MIN }), mk(id1, 'urge', 5), mk(id2, 'stop', 30, { startedAt: S0 }), mk(id4, 'park', 10, { text: 'reply to Rahul' }), mk(id1, 'urge', 5)].filter(Boolean);
  const plan = L.planMarks(marks, S0, {});
  ok('planMarks: ordered, stop applies, later break is stale, duplicate dropped', plan.map(p => p.action).join(',') === 'urge,park,stop,stale', plan.map(p => p.action).join(','));
  ok('planMarks: break moves the timer start for a later stop', L.planMarks([mk(id1, 'break', 10, { startedAt: S0 }), mk(id2, 'stop', 20, { startedAt: S0 + 10 * MIN })], S0, {}).map(p => p.action).join(',') === 'break,stop');
  ok('planMarks: already imported skipped, nothing running makes stop stale', L.planMarks([mk(id1, 'urge', 5)], S0, { [id1]: 1 }).length === 0 && L.planMarks([mk(id2, 'stop', 30, { startedAt: S0 })], null, {})[0].action === 'stale');
  ok('planMarks: older timer stop is stale', L.planMarks([mk(id2, 'stop', 30, { startedAt: S0 - 3600000 })], S0, {})[0].action === 'stale');
  ok('localNoOffset has no offset', L.localNoOffset(S0) === '2026-10-24T09:00:00');
}

console.log(out.join('\n'));
console.log('\nInsights:\n- ' + ins.map(x => x.text).join('\n- '));
console.log('\nPeak col', pmod.bestCol, 'median', Math.round(pmod.median), 'streak', pmod.streak, 'best', pmod.bestStreak);
const fails = out.filter(l => l.startsWith('FAIL')).length;
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
