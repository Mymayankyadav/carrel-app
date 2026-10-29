/* ---------- local view of the database (snapshots + pending writes) ---------- */
function readPath(v, path) {
  const [c, id] = path.split('/');
  if (c === 'state') return v.current;
  if (c === 'config') return id === 'activities' ? v.activities : v.settings;
  if (c === 'days') return v.days[id];
  if (c === 'plans') return v.plans[id];
  if (c === 'planning') return v.planning[id];
  if (c === 'distractions') return v.distractions[id];
  if (['topics','rituals','coach','usage'].includes(c)) return v[c][id];
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
  else if (['topics','rituals','coach','usage'].includes(c)) { if (val === undefined) delete v[c][id]; else v[c][id] = val; }
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
  const v = { current: b.current, activities: b.activities, settings: b.settings, days: Object.assign({}, b.days), plans: Object.assign({}, b.plans), reviews: b.reviews || [], planning: Object.assign({}, b.planning), distractions: Object.assign({}, b.distractions), topics: Object.assign({}, b.topics), rituals: Object.assign({}, b.rituals), coach: Object.assign({}, b.coach), usage: Object.assign({}, b.usage) };
  for (const op of S.pending) applyOp(v, op);
  return v;
}

let opSeq = 0;
const retryT = {};
// A remote acknowledgement is not durable until its removal from the local
// outbox is persisted. Keep acknowledged operations in memory (but never
// resend them) while device storage is unavailable, and retry cleanup.
let qaSyncAckCleanup = null;
function qaSyncScheduleAckCleanup() {
  if (!S.uid || !S.db) return;
  if (qaSyncAckCleanup) {
    if (qaSyncAckCleanup.uid === S.uid && qaSyncAckCleanup.db === S.db) return;
    clearTimeout(qaSyncAckCleanup.id);
  }
  const token = { uid: S.uid, db: S.db, id: null };
  qaSyncAckCleanup = token;
  token.id = setTimeout(() => {
    if (qaSyncAckCleanup !== token) return;
    qaSyncAckCleanup = null;
    if (S.uid !== token.uid || S.db !== token.db) return;
    if (!savePending()) qaSyncScheduleAckCleanup();
    changed();
  }, 5000);
}
// Persist an entire user action before any of its writes can reach Supabase.
// If localStorage rejects the new queue, leave the old durable queue intact
// and refuse the new action instead of claiming an offline-safe save.
function enqueueBatch(writes) {
  if (!writes.length) return true;
  const ops = writes.map(w => ({
    oid: ++opSeq, path: w.path, kind: w.kind, data: w.data,
    ensure: w.ensure || null, cond: w.cond || null, tries: 0
  }));
  S.pending.push(...ops);
  if (!savePending()) {
    S.pending.splice(S.pending.length - ops.length, ops.length);
    S.pendingStorageError = S.uid;
    return false;
  }
  S.pendingStorageError = null;
  ops.forEach(op => pump(op.path));
  return true;
}
function enqueue(w) { return enqueueBatch([w]); }
// Offline writes belong to one authenticated account. Never replay the old
// unscoped "pending" key: it has no owner and may be from another account.
// Keep that legacy key untouched for manual recovery instead of guessing.
function pendingStoreKey() {
  // A fresh Supabase sign-in gets a different JWT session_id. Even if
  // sign-out cannot remove a stale queue, the next login never replays it.
  // Test fixtures without auth sessions retain the original key.
  return S.uid ? 'pending:' + S.uid +
    (S.pendingSession ? ':' + S.pendingSession : '') : null;
}
function savePending() {
  const key = pendingStoreKey();
  // The in-memory browser fixture has no authenticated UID and never sends
  // real network writes. Production must have an account-scoped durable key.
  if (!key) {
    const mock = typeof MOCK !== 'undefined' && MOCK;
    // The browser fixture has no durable account key, but completed writes
    // must still leave its in-memory queue as they did before this change.
    if (mock) S.pending = S.pending.filter(o => !o.acked);
    return mock;
  }
  // The real store returns false for quota, security and read-back failures.
  // Older test adapters return undefined on success; only explicit failure
  // rejects the queue.
  const remaining = S.pending.filter(o => !o.acked);
  const saved = store.set(key, remaining.length ? remaining.map(o => ({
    path: o.path, kind: o.kind, data: o.data, ensure: o.ensure, cond: o.cond
  })) : null) !== false;
  if (saved) {
    // Only release acknowledged operations after their durable outbox
    // removal succeeds. An interrupted cleanup must not resend them in this
    // session or claim the local queue is clean.
    S.pending = remaining;
    if (S.pendingAckStorageError === S.uid) S.pendingAckStorageError = null;
    if (qaSyncAckCleanup && qaSyncAckCleanup.uid === S.uid) {
      clearTimeout(qaSyncAckCleanup.id);
      qaSyncAckCleanup = null;
    }
  }
  return saved;
}
function restorePending() {
  const key = pendingStoreKey();
  if (!key || S.pending.length ||
      (typeof a1PendingClearFailed !== 'undefined' && a1PendingClearFailed.has(key))) return;
  const arr = store.get(key);
  if (!Array.isArray(arr)) return;
  for (const o of arr) if (o && typeof o.path === 'string' && o.path.includes('/') &&
    ['set','update','delete'].includes(o.kind)) {
    S.pending.push({ oid: ++opSeq, path: o.path, kind: o.kind, data: o.data, ensure: o.ensure || null, cond: o.cond || null, tries: 1 });
  }
}
// A pre-upgrade queue has no owner. It can only be assigned by an explicit
// account-level recovery action, never by the authentication callback.
function importLegacyPending() {
  const key = pendingStoreKey();
  // Pre-session-key account queues are retained for explicit recovery, not
  // silently replayed after a sign-out or app upgrade.
  const oldScoped = S.uid && 'pending:' + S.uid;
  const olderSessions = S.uid && typeof store.keys === 'function' ?
    store.keys('pending:' + S.uid + ':').filter(k => k !== key) : [];
  const candidates = [oldScoped, ...olderSessions, 'pending'];
  const source = candidates.find(k => k && k !== key &&
    !(typeof a1PendingClearFailed !== 'undefined' && a1PendingClearFailed.has(k)) &&
    Array.isArray(store.get(k)) && store.get(k).length);
  if (!key || !source) return 0;
  const arr = store.get(source);
  const valid = o => {
    if (!o || typeof o.path !== 'string') return false;
    const parts = o.path.split('/');
    return parts.length === 2 && /^[a-z]+$/.test(parts[0]) && !!parts[1] &&
      ['set','update','delete'].includes(o.kind) &&
      (o.kind === 'delete' || (o.data && typeof o.data === 'object' && !Array.isArray(o.data)));
  };
  if (!arr.every(valid)) return -1;
  const ops = arr.map(o => ({ oid: ++opSeq, path: o.path, kind: o.kind,
    data: o.data, ensure: o.ensure || null, cond: o.cond || null, tries: 1 }));
  S.pending.push(...ops);
  savePending();
  const saved = store.get(key);
  if (!Array.isArray(saved) || saved.length !== S.pending.length) {
    S.pending.splice(-ops.length, ops.length); // leave legacy data untouched
    return -1;
  }
  // Do not delete the source until the account's new outbox is durable.
  // A failed source deletion remains visible for manual cleanup, never auto replay.
  if (store.set(source, null) === false) {
    if (typeof a1PendingClearFailed !== 'undefined') {
      a1PendingClearFailed.add(source);
      a1SavePendingClear();
    }
  }
  pumpAll();
  changed();
  return ops.length;
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
  const op = S.pending.find(o => o.path === path && !o.acked);
  if (!op) return;
  S.inflight.add(path);
  const db = S.db;
  // Only a confirmed remote success (including a superseded conditional
  // write) may dequeue an edit. Even permanent-looking errors can be caused by
  // a temporary schema/quota mismatch; keep the user's local copy recoverable.
  let complete = false, retry = false;
  try {
    await execOp(op);
    if (S.db !== db) return; // stale completion after account switch
    complete = true;
  }
  catch (e) {
    if (S.db !== db) return; // never change the new account's queue/connection
    const code = e && e.code;
    if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') {
      S.conn = 'readonly';
      if (typeof recoverAuth === 'function') recoverAuth();
    } else {
      retry = true;
      if ((code === 'invalid_argument' || code === 'transform_error' || code === 'quota_exceeded') && op.tries === 0) {
        console.warn('Carrel write retained after rejection', op.path, e);
        toast(code === 'quota_exceeded'
          ? 'Storage is full. Change kept on this device; export data from Setup.'
          : 'Change could not sync. Kept on this device; export data from Setup.');
      }
    }
  }
  if (retry) {
    op.tries++;
    if (op.tries === 10) {
      console.warn('Carrel write still pending after repeated retries', op.path);
      toast('A change is still on this device. Carrel will keep retrying.');
    }
  }
  S.inflight.delete(path);
  if (complete) {
    op.acked = true;
    if (!savePending()) {
      if (S.pendingAckStorageError !== S.uid)
        toast('Change synced, but device cleanup failed. Keep Carrel open while it retries.');
      S.pendingAckStorageError = S.uid;
      qaSyncScheduleAckCleanup();
    }
  }
  if (retry) {
    S.offline = true;
    // Bounded backoff, not bounded attempts: never silently lose unsent work.
    const delay = Math.min(60000, 1500 * Math.pow(2, Math.min(op.tries, 6))) * (0.75 + Math.random() * 0.5);
    clearTimeout(retryT[path]);
    retryT[path] = setTimeout(() => pump(path), delay);
  } else {
    S.offline = S.pending.some(o => !o.acked && o.tries > 0 && !S.inflight.has(o.path));
    if (complete) pump(path);
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

/* QA: callbacks from an unsubscribed generation can still arrive after a
   reconnect on the SAME adapter. Adapter identity alone cannot fence them. */
let qaSyncSubscriptionEpoch = 0;
function qaSyncRetrySubscription(db, epoch) {
  if (S.db !== db || epoch !== qaSyncSubscriptionEpoch || S.resubT) return;
  const timer = setTimeout(() => {
    // A canceled timer may fire after a new generation schedules its own
    // retry. Never erase that newer timer's handle.
    if (S.resubT === timer) S.resubT = 0;
    if (S.db === db && epoch === qaSyncSubscriptionEpoch) subscribe();
  }, 5000);
  S.resubT = timer;
}

/* Historical reads can finish after a newer live snapshot or a newer,
   overlapping range read. Track revisions per account's fetched Set, not
   globally, so stale responses never revive deleted or updated documents. */
const qaSyncHistoricalStates = new WeakMap();
function qaSyncHistoricalState(fetched) {
  let state = qaSyncHistoricalStates.get(fetched);
  if (!state) {
    state = { seq: 0, touched: new Map(), completed: new Map() };
    qaSyncHistoricalStates.set(fetched, state);
  }
  return state;
}
function qaSyncHistoricalLiveUpdate(name, from, docs) {
  const state = qaSyncHistoricalState(S.fetched);
  const revision = ++state.seq;
  // Include missing old rows: a live snapshot with no row is a deletion.
  for (const id in S.base[name]) if (id >= from)
    state.touched.set(name + '/' + id, revision);
  docs.forEach(doc => state.touched.set(name + '/' + doc.id, revision));
}

/* F1: realtime subscriptions for additive v2 collections. */
function watchColl(name, epoch = qaSyncSubscriptionEpoch) {
  if (!['topics','rituals','coach','usage'].includes(name) || !S.db) return null;
  // A closed account's subscription can still deliver an already queued callback.
  const db = S.db;
  const ranged = name === 'rituals' || name === 'usage';
  const from = S.windowFrom || addDaysKey(todayKey(), -WINDOW_DAYS);
  const query = ranged ? db.collection(name).where('date', '>=', from) : db.collection(name);
  return query.onSnapshot(q => {
    if (S.db !== db || epoch !== qaSyncSubscriptionEpoch) return;
    const m = {};
    if (ranged) for (const id in S.base[name]) if (id < from) m[id] = S.base[name][id];
    q.docs.forEach(d => { if (d.exists) m[d.id] = d.data(); });
    S.base[name] = m; S.loaded[name] = true; changed();
  }, e => {
    if (S.db !== db || epoch !== qaSyncSubscriptionEpoch) return;
    console.warn('Carrel subscription', name, e);
    if (e && e.code === 'revoked') { S.conn='readonly'; if (typeof recoverAuth === 'function') recoverAuth(); changed(); }
    else if (e && e.code !== 'invalid_argument') qaSyncRetrySubscription(db, epoch);
  });
}
function subscribe() {
  // Invalidate old handlers BEFORE unsubscribing: some adapters may deliver
  // already-queued callbacks (including errors) during or after unsubscribe.
  const epoch = ++qaSyncSubscriptionEpoch;
  clearTimeout(S.resubT); S.resubT = 0;
  S.unsubs.forEach(u => { try { u(); } catch (e) { /* already closed */ } });
  S.unsubs = [];
  const db = S.db, from = S.windowFrom;
  if (!db) return;
  const onErr = name => e => {
    if (S.db !== db || epoch !== qaSyncSubscriptionEpoch) return;
    console.warn('Carrel subscription', name, e);
    if (e && e.code === 'revoked') { S.conn = 'readonly'; if (typeof recoverAuth === 'function') recoverAuth(); changed(); }
    else if (e && e.code !== 'invalid_argument') qaSyncRetrySubscription(db, epoch);
  };
  S.unsubs.push(db.doc('state/current').onSnapshot(s => { if (S.db !== db || epoch !== qaSyncSubscriptionEpoch) return; S.base.current = s.exists ? s.data() : null; S.loaded.current = true; changed(); }, onErr('current')));
  S.unsubs.push(db.doc('config/activities').onSnapshot(s => { if (S.db !== db || epoch !== qaSyncSubscriptionEpoch) return; S.base.activities = s.exists ? s.data() : null; S.loaded.activities = true; changed(); }, onErr('activities')));
  S.unsubs.push(db.doc('config/settings').onSnapshot(s => { if (S.db !== db || epoch !== qaSyncSubscriptionEpoch) return; S.base.settings = s.exists ? s.data() : null; S.loaded.settings = true; changed(); }, onErr('settings')));
  const coll = (name, key) => db.collection(name).where('date', '>=', from).onSnapshot(q => {
    if (S.db !== db || epoch !== qaSyncSubscriptionEpoch) return;
    qaSyncHistoricalLiveUpdate(key, from, q.docs);
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
  for (const name of ['topics','rituals','coach','usage']) S.unsubs.push(watchColl(name, epoch));
  S.unsubs.push(db.collection('reviews').orderBy('week', 'desc').limit(12).onSnapshot(q => {
    if (S.db !== db || epoch !== qaSyncSubscriptionEpoch) return;
    S.base.reviews = q.docs.filter(d => d.exists).map(d => Object.assign({ id: d.id }, d.data()));
    S.loaded.reviews = true;
    changed();
  }, onErr('reviews')));
  S.unsubs.push(db.collection('planning').onSnapshot(q => {
    if (S.db !== db || epoch !== qaSyncSubscriptionEpoch) return;
    const m = {};
    q.docs.forEach(d => { if (d.exists) m[d.id] = d.data(); });
    S.base.planning = m;
    S.loaded.planning = true;
    changed();
  }, onErr('planning')));
}
function ensureRange(fromK, toK) {
  if (!S.db || !S.windowFrom || fromK >= S.windowFrom) return;
  const db = S.db, fetched = S.fetched;
  const hi = toK < S.windowFrom ? toK : addDaysKey(S.windowFrom, -1);
  if (hi < fromK) return;
  const tag = fromK + '>' + hi;
  if (fetched.has(tag)) return;
  fetched.add(tag);
  const history = qaSyncHistoricalState(fetched);
  const revision = ++history.seq;
  Promise.all([
    db.collection('days').where('date', '>=', fromK).where('date', '<=', hi).get(),
    db.collection('plans').where('date', '>=', fromK).where('date', '<=', hi).get(),
    db.collection('distractions').where('date', '>=', fromK).where('date', '<=', hi).get()
  ]).then(([d, p, ds]) => {
    // Account-switch and reconnect guards are independent: an old fetch
    // cannot write into a new account or override a newer live snapshot.
    if (S.db !== db || S.fetched !== fetched) return;
    const merge = (name, snap) => {
      const rows = new Map(snap.docs.filter(x => x.exists).map(x => [x.id, x.data()]));
      const newerRange = id => {
        for (const other of history.completed.values())
          if (other.name === name && other.revision > revision &&
              other.from <= id && id <= other.hi) return true;
        return false;
      };
      const canApply = id => id < S.windowFrom &&
        (history.touched.get(name + '/' + id) || 0) <= revision &&
        !newerRange(id);
      // The completed query is authoritative for its historical interval.
      // Missing rows are deletions, but never delete newer live/fetch data.
      for (const id in S.base[name]) {
        if (id >= fromK && id <= hi && !rows.has(id) && canApply(id)) {
          delete S.base[name][id];
          history.touched.set(name + '/' + id, revision);
        }
      }
      for (const [id, data] of rows) if (canApply(id)) {
        S.base[name][id] = data;
        history.touched.set(name + '/' + id, revision);
      }
      history.completed.set(tag + '/' + name, { name, from: fromK, hi, revision });
    };
    merge('days', d);
    merge('plans', p);
    merge('distractions', ds);
    changed();
  }).catch(e => {
    if (S.db !== db || S.fetched !== fetched) return;
    fetched.delete(tag); console.warn('Carrel fetch', e);
  });
}
