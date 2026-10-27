// Run: node web/test/supa_test.js
const { makeDb } = require('../supa.js');
const assert = require('assert');

function deepMerge(t, s) { t = Object.assign({}, t); for (const k of Object.keys(s)) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object') t[k] = deepMerge(t[k], s[k]); else t[k] = s[k]; } return t; }
function fakeSb(rows, hooks) {
  hooks = hooks || {};
  const log = { filters: [], rpcs: [], channels: [] };
  const sb = {
    log,
    channel(name) {
      const handlers = [];
      const ch = {
        name, handlers,
        on(type, config, callback) { handlers.push({ type, config, callback }); return ch; },
        subscribe(callback) { if (callback) callback('SUBSCRIBED'); return ch; }
      };
      log.channels.push(ch);
      return ch;
    },
    removeChannel() { },
    from() {
      const st = { f: [] };
      const qb = {
        select() { return qb; }, order() { return qb; },
        eq(c, v) { st.f.push(['eq', c, v]); return qb; },
        gte(c, v) { st.f.push(['gte', c, v]); return qb; }, lte(c, v) { st.f.push(['lte', c, v]); return qb; },
        gt(c, v) { st.f.push(['gt', c, v]); return qb; }, lt(c, v) { st.f.push(['lt', c, v]); return qb; },
        range(a, b) { st.r = [a, b]; return qb; },
        then(ok, bad) {
          log.filters.push(st.f.slice());
          if (hooks.fail) return Promise.resolve({ data: null, error: hooks.fail }).then(ok, bad);
          const out = [];
          for (const [path, data] of rows) {
            const coll = path.split('/')[0];
            const good = st.f.every(([op, c, v]) => {
              const x = c === 'coll' ? coll : c === 'path' ? path : c === 'date' ? data.date : data[c.replace('data->>', '')];
              return op === 'eq' ? x === v : op === 'gte' ? x >= v : op === 'lte' ? x <= v : op === 'gt' ? x > v : x < v;
            });
            if (good) out.push({ path, data });
          }
          return Promise.resolve({ data: out, error: null }).then(ok, bad);
        }
      };
      return qb;
    },
    async rpc(fn, a) {
      log.rpcs.push([fn, a]);
      if (hooks.rpcError) return { data: null, error: hooks.rpcError };
      if (fn === 'doc_merge') { if (!rows.has(a.p_path)) return { data: null, error: { code: 'P0002', message: 'missing document' } }; const n = deepMerge(rows.get(a.p_path), a.p_patch); rows.set(a.p_path, n); return { data: n, error: null }; }
      if (fn === 'doc_set') { rows.set(a.p_path, a.p_data); return { data: a.p_data, error: null }; }
      if (fn === 'doc_delete') { rows.delete(a.p_path); return { data: null, error: null }; }
      return { data: null, error: { code: 'PGRST202', message: 'no function' } };
    }
  };
  return sb;
}
const tick = () => new Promise(r => setTimeout(r, 5));

(async () => {
  const rows = new Map([
    ['days/2026-10-10', { date: '2026-10-10', entries: { a: 1 } }],
    ['days/2026-10-20', { date: '2026-10-20', entries: { b: 2 } }],
    ['days/2026-10-21', { date: '2026-10-21', entries: { c: 3 } }],
    ['reviews/2026-10-12', { week: '2026-10-12' }], ['reviews/2026-10-19', { week: '2026-10-19' }], ['reviews/2026-10-05', { week: '2026-10-05' }],
    ['state/current', { running: false }]
  ]);
  const sb = fakeSb(rows);
  const db = makeDb(sb, 'u1', {});

  // collection snapshot with a date filter: server filter mapping + in-memory result
  let snap;
  db.collection('days').where('date', '>=', '2026-10-15').onSnapshot(s => { snap = s; });
  await tick();
  assert.deepStrictEqual(snap.docs.map(d => d.id), ['2026-10-20', '2026-10-21']);
  assert.ok(sb.log.filters.some(f => f.some(x => x[0] === 'gte' && x[1] === 'date' && x[2] === '2026-10-15')), 'date filter sent to server');

  // orderBy + limit evaluated locally
  let rv;
  db.collection('reviews').orderBy('week', 'desc').limit(2).onSnapshot(s => { rv = s; });
  await tick();
  assert.deepStrictEqual(rv.docs.map(d => d.id), ['2026-10-19', '2026-10-12']);

  // doc snapshot, then update with local echo (no realtime needed)
  let cur;
  db.doc('state/current').onSnapshot(s => { cur = s; });
  await tick();
  assert.strictEqual(cur.exists, true);
  await db.doc('state/current').update({ running: true, id: 'x' });
  assert.strictEqual(cur.data().running, true, 'local echo reached the listener');

  // INSERT/UPDATE are owner-filtered, but DELETE must be unfiltered by Supabase.
  const handlers = sb.log.channels[0].handlers;
  assert.deepStrictEqual(handlers.map(h => h.config.event), ['INSERT', 'UPDATE', 'DELETE']);
  assert.ok(handlers.slice(0, 2).every(h => h.config.filter === 'owner=eq.u1'));
  const deleted = handlers[2];
  assert.ok(!('filter' in deleted.config), 'DELETE subscription must not be filtered');
  deleted.callback({ eventType: 'DELETE', old: { owner: 'other-user', path: 'state/current' } });
  assert.strictEqual(cur.exists, true, 'foreign owners cannot evict the cached document');
  deleted.callback({ eventType: 'DELETE', old: { path: 'state/current' } });
  assert.strictEqual(cur.exists, true, 'missing owner cannot evict the cached document');
  deleted.callback({ eventType: 'DELETE', old: { owner: 'u1', path: 'state/current' } });
  assert.strictEqual(cur.exists, false, 'cross-device DELETE removes cached document and notifies subscribers');
  handlers[0].callback({ eventType: 'INSERT', new: { owner: 'u1', path: 'state/current', data: { running: true } } });
  assert.strictEqual(cur.exists, true, 'cross-device INSERT restores cached document');
  handlers[1].callback({ eventType: 'UPDATE', new: { owner: 'other-user', path: 'state/current', data: { running: false } } });
  assert.strictEqual(cur.data().running, true, 'foreign UPDATE ignored');

  assert.strictEqual(sb.log.rpcs.at(-1)[0], 'doc_merge');
  assert.strictEqual(sb.log.rpcs.at(-1)[1].p_ensure, null);

  // update on a missing doc maps to invalid_argument (app then falls back to set)
  await assert.rejects(db.doc('plans/2026-10-30').update({ a: 1 }), e => e.code === 'invalid_argument');
  const s2 = await db.doc('plans/2026-10-30').get();
  assert.strictEqual(s2.exists, false);
  await db.doc('plans/2026-10-30').set({ date: '2026-10-30', blocks: {} });
  assert.strictEqual((await db.doc('plans/2026-10-30').get()).exists, true);

  // delete
  await db.doc('plans/2026-10-30').delete();
  assert.strictEqual((await db.doc('plans/2026-10-30').get()).exists, false);

  // error mapping
  const dbOff = makeDb(fakeSb(new Map(), { rpcError: { message: 'TypeError: Failed to fetch' } }), 'u1', {});
  await assert.rejects(dbOff.doc('a/b').set({}), e => e.code === 'unavailable');
  const dbAuth = makeDb(fakeSb(new Map(), { rpcError: { code: '42501', message: 'permission denied' } }), 'u1', { refresh: async () => {} });
  await assert.rejects(dbAuth.doc('a/b').set({}), e => e.code === 'not_granted');
  const dbBad = makeDb(fakeSb(new Map(), { rpcError: { code: '23514', message: 'check violation' } }), 'u1', {});
  await assert.rejects(dbBad.doc('a/b').set({}), e => e.code === 'invalid_argument');
  for (const [code, expected] of [
    ['P0002', 'invalid_argument'], ['22007', 'invalid_argument'],
    ['23505', 'invalid_argument'], ['42P01', 'invalid_argument'],
    ['42883', 'invalid_argument'], ['42703', 'unavailable'],
    ['40001', 'unavailable'], ['PGRST202', 'unavailable']
  ]) {
    const errDb = makeDb(fakeSb(new Map(), { rpcError: { code, message: 'database failure' } }), 'u1', {});
    await assert.rejects(errDb.doc('a/b').set({}), e => e.code === expected,
      'SQLSTATE ' + code + ' should be ' + expected);
    errDb.close();
  }

  // refresh drops rows deleted elsewhere
  rows.delete('days/2026-10-21');
  await db.collection('days').where('date', '>=', '2026-10-15').get();
  assert.deepStrictEqual(snap.docs.map(d => d.id), ['2026-10-20', '2026-10-21'], 'listener not re-emitted by get()');
  const q = await db.collection('days').where('date', '>=', '2026-10-15').get();
  assert.deepStrictEqual(q.docs.map(d => d.id), ['2026-10-20']);

  console.log('SUPA TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
