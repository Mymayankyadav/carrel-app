// Run: node web/test/supa_cache_test.js
// Regressions for IndexedDB ghost rows and out-of-order Supabase snapshots.
const assert = require('node:assert/strict');
const { makeDb } = require('../supa.js');
const tick = (ms = 12) => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function fakeSb(initial = []) {
  const rows = new Map(initial), channels = [];
  let held = null;
  const sb = {
    from() {
      const filters = [];
      let range = null;
      const q = {
        select() { return q; }, order() { return q; },
        eq(k, v) { filters.push([k, v]); return q; },
        gte() { return q; }, lte() { return q; },
        range(a, b) { range = [a, b]; return q; },
        then(ok, bad) {
          const data = [...rows].filter(([path]) => filters.every(([k, v]) =>
            k === 'path' ? path === v : k === 'coll' ? path.split('/')[0] === v : true))
            .map(([path, data]) => ({ path, data }));
          const result = { data: range ? data.slice(range[0], range[1] + 1) : data, error: null };
          const p = held || Promise.resolve(result);
          held = null;
          return p.then(ok, bad);
        }
      };
      return q;
    },
    channel(name) {
      const handlers = [];
      const ch = {
        name, handlers,
        on(type, config, callback) { handlers.push({ type, config, callback }); return ch; },
        subscribe(callback) { if (callback) callback('SUBSCRIBED'); return ch; }
      };
      channels.push(ch);
      return ch;
    },
    removeChannel() {},
    async rpc(name, args) {
      if (name === 'doc_set') { rows.set(args.p_path, args.p_data); return { data: args.p_data, error: null }; }
      if (name === 'doc_delete') { rows.delete(args.p_path); return { data: null, error: null }; }
      return { data: null, error: { code: 'P0002', message: 'missing' } };
    }
  };
  return {
    sb, rows,
    hold(p) { held = p; },
    emit(event, path, data, owner = 'u1') {
      const ch = channels.at(-1);
      const handler = ch.handlers.find(h => h.config.event === event);
      assert.ok(handler, 'realtime ' + event + ' handler exists');
      handler.callback(event === 'DELETE' ? { old: { owner, path } } : { new: { owner, path, data } });
    }
  };
}
function fakeIndexedDb() {
  const records = new Map();
  const db = {
    close() {},
    createObjectStore() {},
    transaction() {
      const tx = {
        objectStore() {
          const request = fn => {
            const q = {};
            queueMicrotask(() => {
              try { q.result = fn(); if (q.onsuccess) q.onsuccess(); }
              catch (e) { if (q.onerror) q.onerror(e); }
              queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
            });
            return q;
          };
          return {
            get(k) { return request(() => records.get(k)); },
            put(v, k) { return request(() => { records.set(k, structuredClone(v)); return k; }); },
            delete(k) { return request(() => { records.delete(k); return undefined; }); }
          };
        }
      };
      return tx;
    }
  };
  return {
    records,
    indexedDB: {
      open() {
        const req = { result: db };
        queueMicrotask(() => { if (req.onsuccess) req.onsuccess(); });
        return req;
      }
    }
  };
}
(async () => {
  // A realtime UPDATE arriving while an older network read is in flight wins.
  {
    const env = fakeSb([['state/current', { n: 2 }]]);
    const old = deferred(); env.hold(old.promise);
    const db = makeDb(env.sb, 'u1', {});
    let current = null;
    db.doc('state/current').onSnapshot(s => { current = s.exists ? s.data() : null; });
    await tick();
    env.emit('UPDATE', 'state/current', { n: 3 });
    old.resolve({ data: [{ path: 'state/current', data: { n: 1 } }], error: null });
    await tick();
    assert.equal(current.n, 3, 'stale network result must not roll back realtime UPDATE');
    db.close();
  }
  // A DELETE during an in-flight collection read must not resurrect a row.
  {
    const env = fakeSb();
    const old = deferred(); env.hold(old.promise);
    const db = makeDb(env.sb, 'u1', {});
    let docs = [];
    db.collection('days').onSnapshot(s => { docs = s.docs.map(d => d.id); });
    await tick();
    env.emit('DELETE', 'days/2026-10-28');
    old.resolve({ data: [{ path: 'days/2026-10-28', data: { date: '2026-10-28' } }], error: null });
    await tick();
    assert.deepEqual(docs, [], 'stale collection page must not resurrect deleted row');
    db.close();
  }
  // Two refreshes can finish out of order; only the newer result survives.
  {
    const env = fakeSb([['state/current', { n: 8 }]]);
    const old = deferred(); env.hold(old.promise);
    const db = makeDb(env.sb, 'u1', {});
    let current = null;
    db.doc('state/current').onSnapshot(s => { current = s.exists ? s.data() : null; });
    await tick();
    db.refresh();
    await tick();
    assert.equal(current.n, 8);
    old.resolve({ data: [{ path: 'state/current', data: { n: 1 } }], error: null });
    await tick();
    assert.equal(current.n, 8, 'older refresh must not replace newer snapshot');
    db.close();
  }
  // An old adapter must not refresh credentials and retry an RPC after
  // account teardown (a new account may already own the auth session).
  {
    const env = fakeSb();
    const held = deferred();
    let refreshes = 0;
    env.sb.rpc = () => held.promise;
    const db = makeDb(env.sb, 'u1', { refresh: async () => { refreshes++; } });
    const write = db.doc('days/2026-10-29').set({ date: '2026-10-29' });
    db.close();
    held.resolve({ data: null, error: { code: '42501', message: 'JWT expired' } });
    await assert.rejects(write, e => e.code === 'unavailable');
    assert.equal(refreshes, 0, 'closed adapter must never retry auth under another account');
  }
  // Simulate IndexedDB persistence, with the 1s debounce accelerated.
  const oldIndexedDB = global.indexedDB, oldTimeout = global.setTimeout;
  const idb = fakeIndexedDb();
  global.indexedDB = idb.indexedDB;
  global.setTimeout = (fn, ms, ...args) => oldTimeout(fn, ms === 1000 ? 1 : ms, ...args);
  try {
    idb.records.set('docs:u1', [['state/current', { n: 1 }]]);
    {
      const env = fakeSb([['state/current', { n: 1 }]]);
      const db = makeDb(env.sb, 'u1', { idb: true });
      let current = null;
      db.doc('state/current').onSnapshot(s => { current = s.exists ? s.data() : null; });
      await tick();
      env.rows.delete('state/current');
      env.emit('DELETE', 'state/current');
      await tick();
      assert.equal(current, null);
      assert.deepEqual(idb.records.get('docs:u1'), [], 'deleting last row must persist empty IDB snapshot');
      db.close();
      const next = makeDb(env.sb, 'u1', { idb: true });
      let revived = false;
      next.doc('state/current').onSnapshot(s => { if (s.exists) revived = true; });
      await tick();
      assert.equal(revived, false, 'reopening must not revive deleted row');
      next.close();
    }
    // Realtime DELETE before delayed hydration must suppress stale cached data.
    {
      idb.records.set('docs:u1', [['state/current', { n: 99 }]]);
      const env = fakeSb();
      const db = makeDb(env.sb, 'u1', { idb: true });
      env.emit('DELETE', 'state/current');
      let revived = false;
      db.doc('state/current').onSnapshot(s => { if (s.exists) revived = true; });
      await tick();
      assert.equal(revived, false, 'DELETE tombstone must fence hydration');
      db.close();
    }
    // Sign-out clear must be ordered ahead of a new adapter's hydration.
    {
      idb.records.set('docs:u1', [['state/current', { n: 42 }]]);
      const env = fakeSb();
      const db = makeDb(env.sb, 'u1', { idb: true });
      db.close();
      const clear = db.clear();
      const next = makeDb(env.sb, 'u1', { idb: true });
      let revived = false;
      next.doc('state/current').onSnapshot(s => { if (s.exists) revived = true; });
      await clear;
      await tick();
      assert.deepEqual(idb.records.get('docs:u1') || [], [], 'old account cache cleared (an empty snapshot is safe)');
      assert.equal(revived, false, 'new adapter must not read pre-sign-out cache');
      next.close();
    }
  } finally {
    global.indexedDB = oldIndexedDB;
    global.setTimeout = oldTimeout;
  }
  console.log('SUPABASE CACHE RACE TESTS PASSED');
})().catch(e => { console.error(e); process.exitCode = 1; });
