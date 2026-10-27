// Focused plan projection and UI regression tests. Run with TZ=Asia/Kolkata.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const L = require('../logic.js');
const { CTX, MIN } = L;
CTX.cfg = { dayStart: '04:00', planStart: '08:00', planEnd: '22:30', gap: 10, dailyGoal: 120, weekStart: 1 };
CTX.act = id => ({ id, kind: 'study', name: id === 'math' ? 'Mathematics' : 'Physics', color: '#234567' });
const T = x => Date.parse(x + '+05:30');
const k = '2026-10-28';
const now = T('2026-10-27T12:00:00');
const busy = [{ title: 'Seminar & lecture', s: T('2026-10-28T21:00:00'), e: T('2026-10-28T21:30:00') }];
const plan = { blocks: {
  completed: { activity: 'math', minutes: 30, order: 1, status: 'done' },
  flexible: { activity: 'math', minutes: 45, order: 2 },
  pinned: { activity: 'math', minutes: 45, order: 3, at: '20:30', pomo: '50/10' },
  later: { activity: 'math', minutes: 50, order: 4 }
} };
const pm = L.planCompute(plan, k, [], now, null, busy.map(b => [b.s, b.e]));
const row = id => pm.rows.find(x => x.id === id);
assert.equal(row('pinned').clash, true, 'pinned block overlapping a calendar commitment is flagged');
assert.equal(row('pinned').clashWith, 0, 'first overlapping busy interval index retained');
assert.deepStrictEqual(row('pinned').pieces, [[T('2026-10-28T20:30:00'), T('2026-10-28T21:15:00')]]);
const noClash = L.planCompute({ blocks: { f: { activity: 'math', minutes: 30, order: 1, at: '18:00' } } }, k, [], now, null, busy.map(b => [b.s, b.e]));
assert.equal(noClash.rows[0].clash, false);
assert.equal(noClash.rows[0].clashWith, null);
const twice = L.planCompute({ blocks: { f: { activity: 'math', minutes: 60, order: 1, at: '20:45' } } }, k, [], now, null, [[T('2026-10-28T21:40:00'), T('2026-10-28T22:00:00')], [busy[0].s, busy[0].e]]);
assert.equal(twice.rows[0].clashWith, 0, 'first clashing interval in busy array selected');

const app = require('./src').app;
function section(a, b) {
  const from = app.indexOf('function ' + a + '(');
  const next = app.indexOf('function ' + b + '(', from);
  assert(from >= 0, a + ' source exists');
  const r=/^function [A-Za-z_$]/gm; r.lastIndex=from+9;
  const m=r.exec(app);
  const to=next>from?(m?Math.min(next,m.index):next):(m?m.index:app.length);
  return app.slice(from,to);
}
const display = vm.runInNewContext(section('planDisplayRows', 'vPlan') + '\nplanDisplayRows');
const order = Array.from(display(pm), x => x.id);
assert.equal(order[0], 'completed', 'completed blocks appear before pending blocks');
const liveRows = display(pm).filter(x => x.remaining > 0);
const times = liveRows.map(r => r.pieces.length ? r.pieces[0][0] : Infinity);
assert.deepStrictEqual(times, [...times].sort((a, b) => a - b), 'pending blocks displayed in chronological order');
const activeTest = { rows: [
  { id: 'late', st: 'open', remaining: MIN, pieces: [[300, 400]], order: 1 },
  { id: 'running', st: 'active', remaining: MIN, pieces: [[500, 600]], order: 2 },
  { id: 'done', st: 'done', remaining: 0, pieces: [], order: 3 }
] };
assert.deepStrictEqual(Array.from(display(activeTest), r => r.id), ['done', 'running', 'late'], 'active block shown immediately after done');

const recorder = [];
const planReorder = vm.runInNewContext(section('planReorder', 'planShrink') + '\nplanReorder', {
  planModelFor: () => pm,
  planDisplayRows: display,
  W: () => ({ plan: (_k, changes) => recorder.push(changes.blocks) }),
  commit: () => {}
});
planReorder(k, 'pinned', -1);
planReorder(k, 'completed', 1);
assert.equal(recorder.length, 0, 'fixed and completed blocks cannot be reordered');
planReorder(k, 'flexible', 1);
assert.equal(recorder.length, 1);
assert.equal(recorder[0].completed, undefined, 'completed block priority remains untouched');
assert.equal(recorder[0].pinned, undefined, 'fixed block priority remains untouched');
assert.equal(recorder[0].flexible.order, 4, 'flexible block moved past fixed');
assert.equal(recorder[0].later.order, 2, 'flexible neighbour moved up');

const esc = s => String(s).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const UI = { openBlk: 'pinned' };
const render = vm.runInNewContext(section('vBlk', 'vAddBlock') + '\nvBlk', {
  act: () => ({ name: 'Mathematics', color: '#234567' }),
  UI, icon: () => '*', busyOf: () => busy,
  parsePreset: s => s === '50/10' ? { focus: 50, short: 10 } : null,
  esc, fmtT: () => '8:30 pm', fmtHM: s => s, fmtDur: s => Math.round(s / MIN) + 'm'
});
const html = render(row('pinned'), k, pm, true);
assert(html.includes('Mathematics'), 'full activity name rendered');
assert(html.includes('Clashes with Seminar &amp; lecture'), 'overlap names the conflicting commitment safely');
assert(html.includes('50/10 pomo'), 'pomodoro badge explained');
assert(html.includes('50-minute focus, 10-minute breaks'), 'pomodoro duration accessible');
assert(!html.includes('data-act="blk-move"'), 'fixed-time block has no reorder controls');
UI.openBlk = 'later';
const htmlFlexible = render(row('later'), k, pm, true);
assert(htmlFlexible.includes('data-act="blk-move"'), 'unfixed incomplete block can be reordered');
UI.openBlk = 'completed';
const htmlDone = render(row('completed'), k, pm, true);
assert(!htmlDone.includes('data-act="blk-move"'), 'completed block has no reorder controls');
assert(app.includes('planDisplayRows(pm).map(r => vBlk('), 'plan uses sorted display rows');
assert(app.includes('class="busy-it"'), 'busy items remain together');
assert(app.includes('aria-label="Open this day in the calendar"') && app.includes('aria-label="Plan options"'), 'header icon buttons labelled');
console.log('PLAN TESTS PASSED');
