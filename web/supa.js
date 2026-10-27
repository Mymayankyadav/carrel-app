/* supa.js: a Firestore-shaped adapter over the Supabase table public.docs.
   Same interface the app already used for the artifact database:
   db.doc(path).get/set/update/delete/onSnapshot, db.collection(name).where/orderBy/limit/get/onSnapshot. */
function makeDb(sb, uid, opts) {
  opts = opts || {};
  const cache = new Map();      // path -> data (object)
  const listeners = new Set();
  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
  const collOf = p => p.slice(0, p.indexOf('/'));
  const idOf = p => p.slice(p.indexOf('/') + 1);
  const OPS = { '>=': 'gte', '<=': 'lte', '>': 'gt', '<': 'lt', '==': 'eq' };
  let hydrated = Promise.resolve(), saveT = 0, dropped = false, chan = null, closed = false;

  /* ----- local copy on this device (works offline) ----- */
  const IDB_KEY = 'docs:' + uid;
  function idb(op, key, val) {
    return new Promise(res => {
      try {
        const r = indexedDB.open('carrel', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onerror = () => res(null);
        r.onsuccess = () => {
          try {
            const st = r.result.transaction('kv', op === 'get' ? 'readonly' : 'readwrite').objectStore('kv');
            const q = op === 'get' ? st.get(key) : op === 'del' ? st.delete(key) : st.put(val, key);
            q.onsuccess = () => res(q.result === undefined ? null : q.result);
            q.onerror = () => res(null);
          } catch (e) { res(null); }
        };
      } catch (e) { res(null); }
    });
  }
  function schedSave() {
    if (!opts.idb || closed) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => { const arr = Array.from(cache); if (arr.length) idb('put', IDB_KEY, arr); }, 1000);
  }
  if (opts.idb) hydrated = idb('get', IDB_KEY).then(arr => { if (Array.isArray(arr)) arr.forEach(([p, d]) => { if (!cache.has(p)) cache.set(p, d); }); });

  /* ----- errors, in the shape the app's write queue expects ----- */
  function mapErr(e) {
    const code = e && e.code, msg = String((e && e.message) || e || '');
    if (code === 'P0002') return { code: 'invalid_argument', message: msg };
    if (code === '42501' || code === '28000' || code === 'PGRST301' || code === 'PGRST303' || /JWT|not signed in/i.test(msg)) return { code: 'not_granted', message: msg, auth: true };
    if (!code || /Failed to fetch|NetworkError|Load failed/i.test(msg) || /^(5|08|57|53)/.test(String(code)) || /^PGRST[01]/.test(String(code))) return { code: 'unavailable', message: msg };
    if (/^(22|23)/.test(String(code)) || code === '42P01' || code === '42883') return { code: 'invalid_argument', message: msg };
    return { code: 'unavailable', message: msg };
  }
  async function call(fn) {
    for (let i = 0; i < 2; i++) {
      let res;
      try { res = await fn(); } catch (e) { throw { code: 'unavailable', message: String((e && e.message) || e) }; }
      if (!res.error) return res.data;
      const m = mapErr(res.error);
      if (m.auth && i === 0 && opts.refresh) { try { await opts.refresh(); continue; } catch (e) { /* fall through */ } }
      throw m;
    }
  }

  /* ----- queries over the local copy ----- */
  function docSnap(path, fromCache) {
    const d = cache.get(path);
    return { id: idOf(path), exists: d !== undefined, data: () => d === undefined ? undefined : clone(d), metadata: { fromCache: !!fromCache } };
  }
  function match(d, filters) {
    return filters.every(([f, op, v]) => {
      const x = d[f];
      if (x === undefined || x === null) return false;
      switch (op) {
        case '>=': return x >= v;
        case '<=': return x <= v;
        case '>': return x > v;
        case '<': return x < v;
        case '==': return x === v;
        default: return false;
      }
    });
  }
  function runQuery(q, fromCache) {
    let rows = [];
    for (const [p, d] of cache) if (collOf(p) === q.coll && match(d, q.f)) rows.push([p, d]);
    if (q.o) {
      const f = q.o.field, dir = q.o.dir === 'desc' ? -1 : 1;
      rows.sort((a, b) => { const x = a[1][f], y = b[1][f]; return (x < y ? -1 : x > y ? 1 : 0) * dir; });
    } else rows.sort((a, b) => a[0] < b[0] ? -1 : 1);
    if (q.l != null) rows = rows.slice(0, q.l);
    const docs = rows.map(([p]) => docSnap(p, fromCache));
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: !!fromCache } };
  }

  /* ----- network reads ----- */
  async function fetchColl(coll, filters) {
    const seen = new Set();
    for (let from = 0; ; from += 1000) {
      const rows = await call(() => {
        let qb = sb.from('docs').select('path,data').eq('coll', coll);
        for (const [f, op, v] of filters) if (OPS[op]) qb = qb[OPS[op]](f === 'date' ? 'date' : 'data->>' + f, v);
        return qb.order('path').range(from, from + 999);
      });
      rows.forEach(r => { cache.set(r.path, r.data); seen.add(r.path); });
      if (rows.length < 1000) break;
    }
    for (const [p, d] of Array.from(cache)) if (collOf(p) === coll && !seen.has(p) && match(d, filters)) cache.delete(p);
    schedSave();
  }
  async function fetchDoc(path) {
    const rows = await call(() => sb.from('docs').select('path,data').eq('path', path));
    if (rows.length) cache.set(path, rows[0].data); else cache.delete(path);
    schedSave();
  }

  /* ----- listeners ----- */
  function listen(l) {
    l.ready = false; l.dead = false;
    l.refetch = async () => {
      try { await l.fetch(); if (l.dead) return; l.ready = true; l.emit(false); }
      catch (e) { if (!l.dead && l.err) l.err(e); }
    };
    listeners.add(l);
    (async () => {
      await hydrated;
      if (l.dead) return;
      if (l.has()) { l.ready = true; l.emit(true); }
      await l.refetch();
    })();
    return () => { l.dead = true; listeners.delete(l); };
  }
  function notify(path) { for (const l of Array.from(listeners)) if (l.ready && !l.dead && l.matches(path)) l.emit(false); }
  function refreshAll() { for (const l of Array.from(listeners)) if (!l.dead) l.refetch(); }

  /* ----- realtime ----- */
  function connect() {
    if (!sb.channel) return;
    const onWrite = p => {
      if (p.new && p.new.owner === uid && p.new.path) {
        cache.set(p.new.path, p.new.data); notify(p.new.path);
        schedSave();
      }
    };
    chan = sb.channel('docs-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'docs', filter: 'owner=eq.' + uid }, onWrite)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'docs', filter: 'owner=eq.' + uid }, onWrite)
      // Supabase does not support filters on DELETE. Check the composite
      // primary key's owner before touching the local cache.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'docs' }, p => {
        const old = p.old || {};
        if (old.owner !== uid || !old.path) return;
        cache.delete(old.path); notify(old.path); schedSave();
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { if (dropped) { dropped = false; refreshAll(); } }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') dropped = true;
      });
  }
  connect();

  /* ----- the Firestore-shaped surface ----- */
  function docRef(path) {
    return {
      path, id: idOf(path),
      async get() { await fetchDoc(path); return docSnap(path); },
      async set(data) { await call(() => sb.rpc('doc_set', { p_path: path, p_data: data })); cache.set(path, clone(data)); schedSave(); notify(path); },
      async update(patch) { const r = await call(() => sb.rpc('doc_merge', { p_path: path, p_patch: patch, p_ensure: null })); cache.set(path, r); schedSave(); notify(path); },
      async delete() { await call(() => sb.rpc('doc_delete', { p_path: path })); cache.delete(path); schedSave(); notify(path); },
      onSnapshot(next, err) {
        return listen({ err, fetch: () => fetchDoc(path), has: () => cache.has(path), matches: p => p === path, emit: fc => next(docSnap(path, fc)) });
      }
    };
  }
  function query(coll, f, o, l) {
    const q = { coll, f, o, l };
    return {
      where: (a, op, v) => query(coll, f.concat([[a, op, v]]), o, l),
      orderBy: (field, dir) => query(coll, f, { field, dir: dir || 'asc' }, l),
      limit: n => query(coll, f, o, n),
      async get() { await fetchColl(coll, f); return runQuery(q); },
      onSnapshot(next, err) {
        return listen({ err, fetch: () => fetchColl(coll, f), has: () => { for (const p of cache.keys()) if (collOf(p) === coll) return true; return false; }, matches: p => collOf(p) === coll, emit: fc => next(runQuery(q, fc)) });
      }
    };
  }
  return {
    doc: docRef,
    collection: name => query(name, [], null, null),
    refresh: refreshAll,
    close() { closed = true; clearTimeout(saveT); listeners.clear(); if (chan && sb.removeChannel) { try { sb.removeChannel(chan); } catch (e) { /* closed */ } } },
    async clear() { cache.clear(); if (opts.idb) await idb('del', IDB_KEY); }
  };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { makeDb };
