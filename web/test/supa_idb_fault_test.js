// Run: node web/test/supa_idb_fault_test.js
// Fault injection: IDB request success is not a transaction commit.
const assert = require('node:assert/strict');
const { makeDb } = require('../supa.js');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fakeIndexedDb() {
  const records = new Map();
  const state = { abortPuts: 1, abortDeletes: 1, putAttempts: 0,
    deleteAttempts: 0, getAttempts: 0, overlapping: false, active: false };
  const indexedDB = {
    open() {
      const request = {};
      const db = {
        close() {},
        createObjectStore() {},
        transaction() {
          if (state.active) state.overlapping = true;
          state.active = true;
          const tx = {
            objectStore() {
              const run = (kind, key, val) => {
                const q = {};
                queueMicrotask(() => {
                  if (kind === 'get') state.getAttempts++;
                  if (kind === 'put') state.putAttempts++;
                  if (kind === 'del') state.deleteAttempts++;
                  const fail = (kind === 'put' && state.abortPuts-- > 0) ||
                    (kind === 'del' && state.abortDeletes-- > 0);
                  if (fail) {
                    // A successful request can still be rolled back later.
                    q.result = key;
                    if (q.onsuccess) q.onsuccess();
                    queueMicrotask(() => {
                      if (tx.onerror) tx.onerror();
                      queueMicrotask(() => {
                        state.active = false;
                        if (tx.onabort) tx.onabort();
                      });
                    });
                    return;
                  }
                  q.result = kind === 'get' ? records.get(key) : key;
                  if (q.onsuccess) q.onsuccess();
                  queueMicrotask(() => {
                    if (kind === 'put') records.set(key, structuredClone(val));
                    if (kind === 'del') records.delete(key);
                    state.active = false;
                    if (tx.oncomplete) tx.oncomplete();
                  });
                });
                return q;
              };
              return {
                get: key => run('get', key),
                put: (val, key) => run('put', key, val),
                delete: key => run('del', key)
              };
            }
          };
          return tx;
        }
      };
      request.result = db;
      queueMicrotask(() => { if (request.onsuccess) request.onsuccess(); });
      return request;
    }
  };
  return { indexedDB, records, state };
}

function fakeSb() {
  return {
    async rpc(name, args) { return { data: args.p_data || null, error: null }; },
    channel() {
      const ch = { on() { return ch; }, subscribe(cb) { if (cb) cb('SUBSCRIBED'); return ch; } };
      return ch;
    },
    removeChannel() {}
  };
}

(async () => {
  const oldIdb = global.indexedDB;
  const oldTimeout = global.setTimeout;
  const idb = fakeIndexedDb();
  global.indexedDB = idb.indexedDB;
  global.setTimeout = (fn, ms, ...args) => oldTimeout(fn, ms === 1000 ? 1 : ms, ...args);
  try {
    const db = makeDb(fakeSb(), 'u1', { idb: true });
    await db.doc('state/current').set({ n: 42 });
    await sleep(30);
    assert.deepEqual(idb.records.get('docs:u1'), [['state/current', { n: 42 }]],
      'aborted first put must be retried and committed');
    assert.equal(idb.state.putAttempts, 2, 'one abort, one committed put');
    db.close();
    assert.equal(await db.clear(), true, 'sign-out deletion committed after retry');
    assert.equal(idb.state.deleteAttempts, 2, 'one abort, one committed delete');
    assert.equal(idb.records.has('docs:u1'), false, 'sign-out removed disk cache');
    assert.equal(idb.state.overlapping, false,
      'no next operation may start before abort settles');

    // A persistently aborted deletion must not be reported as successful.
    idb.records.set('docs:u2', [['days/old', { secret: 'cached' }]]);
    idb.state.abortDeletes = 10;
    const second = makeDb(fakeSb(), 'u2', { idb: true });
    second.close();
    assert.equal(await second.clear(), false, 'three failed deletes report failure');
    assert.equal(idb.state.deleteAttempts, 5, 'failed delete attempts are bounded');
    assert.equal(idb.records.has('docs:u2'), true, 'failed transaction never commits');
    idb.state.abortDeletes = 0;
    const third = makeDb(fakeSb(), 'u2', { idb: true });
    third.close();
    assert.equal(await third.clear(), true, 'later deletion can recover');
    assert.equal(idb.records.has('docs:u2'), false);

    // A signed-out cleanup must not read private cached documents or
    // require a Supabase client, session, or realtime channel.
    idb.records.set('docs:u3', [['days/old', { secret: 'cached' }]]);
    const reads = idb.state.getAttempts;
    const diskOnly = makeDb(null, 'u3', { idb: true, clearOnly: true });
    diskOnly.close();
    assert.equal(await diskOnly.clear(), true);
    assert.equal(idb.records.has('docs:u3'), false);
    assert.equal(idb.state.getAttempts, reads, 'cleanup never hydrates cache');
  } finally {
    global.indexedDB = oldIdb;
    global.setTimeout = oldTimeout;
  }

  // Realtime reconnect must refetch changes missed while disconnected.
  const rows = new Map([['state/current', { n: 1 }]]);
  let status;
  const sb = {
    from() {
      const q = {
        select() { return q; }, eq() { return q; },
        then(ok, bad) {
          return Promise.resolve({ data: [...rows].map(([path, data]) => ({ path, data })), error: null }).then(ok, bad);
        }
      };
      return q;
    },
    channel() {
      const ch = {
        on() { return ch; },
        subscribe(cb) { status = cb; cb('SUBSCRIBED'); return ch; }
      };
      return ch;
    },
    removeChannel() {}
  };
  const db = makeDb(sb, 'u1', {});
  let observed = null;
  db.doc('state/current').onSnapshot(s => { observed = s.data(); });
  await sleep(10);
  assert.equal(observed.n, 1);
  rows.set('state/current', { n: 2 });
  status('CHANNEL_ERROR');
  status('SUBSCRIBED');
  await sleep(10);
  assert.equal(observed.n, 2, 'reconnect refreshes missed changes');
  db.close();
  console.log('SUPABASE IDB FAULT / REALTIME RECOVERY TESTS PASSED');
})().catch(e => { console.error(e); process.exitCode = 1; });
