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
function enqueue(w) {
  const op = { oid: ++opSeq, path: w.path, kind: w.kind, data: w.data, ensure: w.ensure || null, cond: w.cond || null, tries: 0 };
  S.pending.push(op);
  savePending();
  pump(op.path);
}
// Offline writes belong to one authenticated account. Never replay the old
// unscoped "pending" key: it has no owner and may be from another account.
// Keep that legacy key untouched for manual recovery instead of guessing.
function pendingStoreKey() {
  return S.uid ? 'pending:' + S.uid : null;
}
function savePending() {
  const key = pendingStoreKey();
  if (!key) return;
  store.set(key, S.pending.length ? S.pending.map(o => ({ path: o.path, kind: o.kind, data: o.data, ensure: o.ensure, cond: o.cond })) : null);
}
function restorePending() {
  const key = pendingStoreKey();
  if (!key || S.pending.length) return;
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
  const key = pendingStoreKey(), arr = store.get('pending');
  if (!key || !Array.isArray(arr) || !arr.length) return 0;
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
  store.set('pending', null);
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
  const op = S.pending.find(o => o.path === path);
  if (!op) return;
  S.inflight.add(path);
  const db = S.db;
  let drop = false, retry = false;
  try {
    await execOp(op);
    if (S.db !== db) return; // stale completion after account switch
    drop = true;
  }
  catch (e) {
    if (S.db !== db) return; // never change the new account's queue/connection
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
  const tag = fromK + '>' + hi;
  if (fetched.has(tag)) return;
  fetched.add(tag);
  Promise.all([
    db.collection('days').where('date', '>=', fromK).where('date', '<=', hi).get(),
    db.collection('plans').where('date', '>=', fromK).where('date', '<=', hi).get(),
    db.collection('distractions').where('date', '>=', fromK).where('date', '<=', hi).get()
  ]).then(([d, p, ds]) => {
    // A previous account's range fetch must never populate the new view.
    if (S.db !== db || S.fetched !== fetched) return;
    ds.docs.forEach(x => { if (x.exists) S.base.distractions[x.id] = x.data(); });
    d.docs.forEach(x => { if (x.exists) S.base.days[x.id] = x.data(); });
    p.docs.forEach(x => { if (x.exists) S.base.plans[x.id] = x.data(); });
    changed();
  }).catch(e => {
    if (S.db !== db || S.fetched !== fetched) return;
    fetched.delete(tag); console.warn('Carrel fetch', e);
  });
}

