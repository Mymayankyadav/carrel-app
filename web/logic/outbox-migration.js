/* Read-only legacy outbox migration preflight for issue #90.
 * This module does NOT migrate, delete, acknowledge, or send user data.
 * Production sync still owns the shared session queue. A future integration
 * must acquire an exclusive handoff before using the verified snapshot.
 */
'use strict';

function qaJournalLegacyPreflight(storage, journal, uid, session) {
  const validPart = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
  if (!validPart(uid) || !validPart(session) || !storage ||
      typeof storage.getItem !== 'function' || !journal ||
      typeof journal.list !== 'function' ||
      journal.prefix !== 'carrel.pending-journal.v1:' + uid + ':' + session + ':')
    throw new TypeError('Matching account/session storage and journal required');
  const sourceKey = 'carrel.pending:' + uid + ':' + session;
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  function snapshot() {
    let raw;
    try { raw = storage.getItem(sourceKey); }
    catch (_) { return { ok: false, error: 'source-unreadable' }; }
    if (raw === null) return { ok: true, raw: null, ops: [] };
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (_) { return { ok: false, error: 'source-corrupt' }; }
    if (!Array.isArray(parsed)) return { ok: false, error: 'source-corrupt' };
    // Do not silently skip a malformed edit. The old queue stores one op per
    // entry, including multi-document user actions flattened in FIFO order.
    for (const op of parsed) {
      if (!op || typeof op !== 'object' || Array.isArray(op) ||
          typeof op.path !== 'string' || !op.path.includes('/') ||
          !['set', 'update', 'delete'].includes(op.kind) ||
          // sync.js serializes delete operations with no data property.
          // They are valid offline edits, not corrupt queue entries.
          (op.kind !== 'delete' && !own(op, 'data')) ||
          (own(op, 'ensure') && op.ensure !== null &&
           (typeof op.ensure !== 'object' || Array.isArray(op.ensure))) ||
          (own(op, 'cond') && op.cond !== null &&
           (typeof op.cond !== 'object' || Array.isArray(op.cond))))
        return { ok: false, error: 'source-corrupt' };
    }
    // Copy only the fields supported by the journal. Never infer identity
    // from the legacy unscoped or pre-session pending keys.
    const ops = parsed.map(op => ({ path: op.path, kind: op.kind,
      ...(own(op, 'data') ? { data: op.data } : {}),
      ensure: own(op, 'ensure') ? op.ensure : null,
      cond: own(op, 'cond') ? op.cond : null }));
    return { ok: true, raw, ops };
  }
  function checkJournal() {
    let result;
    try { result = journal.list(); }
    catch (_) { return { ok: false, error: 'journal-unreadable' }; }
    if (!result || result.ok !== true || !Array.isArray(result.records))
      return { ok: false, error: 'journal-unreadable' };
    if (result.records.length) return { ok: false, error: 'journal-not-empty' };
    return { ok: true };
  }
  function inspect() {
    const before = snapshot();
    if (!before.ok) return before;
    const j = checkJournal();
    if (!j.ok) return j;
    const after = snapshot();
    if (!after.ok) return after;
    if (before.raw !== after.raw)
      return { ok: false, error: 'source-changed' };
    return { ok: true, sourceKey, sourceRaw: before.raw,
      ops: before.ops, count: before.ops.length, empty: before.ops.length === 0 };
  }
  function verify(plan, isCurrent) {
    if (!plan || plan.ok !== true || plan.sourceKey !== sourceKey ||
        typeof plan.sourceRaw !== 'string' || !Array.isArray(plan.ops) ||
        typeof isCurrent !== 'function' || !isCurrent())
      return { ok: false, error: 'stale-session' };
    const current = inspect();
    if (!current.ok) return current;
    if (current.sourceRaw !== plan.sourceRaw)
      return { ok: false, error: 'source-changed' };
    // A caller must not be able to mutate the inspected operation array and
    // then reuse a valid source token to authorize a different write set.
    try {
      if (JSON.stringify(current.ops) !== JSON.stringify(plan.ops))
        return { ok: false, error: 'plan-changed' };
    } catch (_) { return { ok: false, error: 'plan-changed' }; }
    return { ok: true, count: current.count };
  }
  return { sourceKey, inspect, verify, snapshot };
}


/* Staging only: keep the legacy queue authoritative. A reserved journal ID
 * and a write-ahead marker make a one-batch copy restartable after a crash.
 * Legacy producers do NOT participate in this Web Lock yet; source changes
 * fail closed, and no caller may use this result to switch sync authority.
 */
function qaJournalStageLegacy(storage, makeJournal, uid, session, locks, isCurrent) {
  const reservedId = 'legacy_stage_v1';
  const markerKey = 'carrel.pending-migration-stage.v1:' + uid + ':' + session;
  if (typeof makeJournal !== 'function' || typeof isCurrent !== 'function')
    throw new TypeError('Journal factory and identity fence required');
  const journal = makeJournal(reservedId);
  const pre = qaJournalLegacyPreflight(storage, journal, uid, session);
  if (!journal || typeof journal.appendBatch !== 'function')
    throw new TypeError('Journal append required');
  const lockName = 'carrel-journal-delivery.v1:' + uid + ':' + session;
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const error = reason => ({ ok: false, error: reason });
  function source() {
    const first = pre.snapshot();
    if (!first.ok) return first;
    const second = pre.snapshot();
    if (!second.ok) return second;
    return first.raw === second.raw ? first : error('source-changed');
  }
  function markerRead() {
    let raw;
    try { raw = storage.getItem(markerKey); }
    catch (_) { return error('marker-unreadable'); }
    if (raw === null) return { ok: true, raw: null };
    let value;
    try { value = JSON.parse(raw); }
    catch (_) { return error('marker-corrupt'); }
    if (!value || value.v !== 1 || value.uid !== uid ||
        value.session !== session || value.sourceKey !== pre.sourceKey ||
        typeof value.sourceRaw !== 'string' ||
        Object.keys(value).some(k => !['v','uid','session','sourceKey','sourceRaw'].includes(k)))
      return error('marker-corrupt');
    return { ok: true, raw, value };
  }
  async function stage() {
    if (!locks || typeof locks.request !== 'function')
      return error('locks-unavailable');
    if (!isCurrent()) return error('stale-session');
    try {
      return await locks.request(lockName, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) return error('busy');
        if (!isCurrent()) return error('stale-session');
        const snap = source();
        if (!snap.ok) return snap;
        const marker = markerRead();
        if (!marker.ok) return marker;
        let listed;
        try { listed = journal.list(); }
        catch (_) { return error('journal-unreadable'); }
        if (!listed || !listed.ok || !Array.isArray(listed.records))
          return error('journal-unreadable');
        if (snap.raw === null || !snap.ops.length) {
          // Never erase a marker or a previously staged copy on empty source.
          if (marker.raw !== null || listed.records.length)
            return error('source-changed');
          return { ok: true, empty: true, staged: false };
        }
        if (snap.ops.length > 256) return error('batch-too-large');
        const expectedKey = journal.prefix + reservedId;
        if (listed.records.some(x => x.key !== expectedKey) || listed.records.length > 1)
          return error('journal-not-empty');
        if (marker.raw === null && listed.records.length)
          return error('unmarked-journal');
        if (marker.raw !== null && marker.value.sourceRaw !== snap.raw)
          return error('source-changed');
        if (listed.records.length) {
          const record = listed.records[0].record;
          if (!own(record, 'ops') || own(record, 'seq') ||
              JSON.stringify(record.ops) !== JSON.stringify(snap.ops))
            return error('staged-record-mismatch');
        }
        if (marker.raw === null) {
          const raw = JSON.stringify({ v: 1, uid, session,
            sourceKey: pre.sourceKey, sourceRaw: snap.raw });
          try { storage.setItem(markerKey, raw); }
          catch (_) { return error('marker-write'); }
          const check = markerRead();
          if (!check.ok || check.raw !== raw)
            return error('marker-uncertain');
        }
        if (!isCurrent()) return error('stale-session');
        const beforeCopy = source();
        if (!beforeCopy.ok) return beforeCopy;
        if (beforeCopy.raw !== snap.raw) return error('source-changed');
        if (!listed.records.length) {
          const saved = journal.appendBatch(snap.ops);
          if (!saved || !saved.ok) return error('journal-write');
          if (saved.key !== expectedKey || saved.id !== reservedId)
            return error('journal-id-mismatch');
        }
        let finalList;
        try { finalList = journal.list(); }
        catch (_) { return error('journal-unreadable'); }
        if (!finalList || !finalList.ok || finalList.records.length !== 1 ||
            finalList.records[0].key !== expectedKey ||
            JSON.stringify(finalList.records[0].record.ops) !== JSON.stringify(snap.ops))
          return error('journal-verify');
        const after = source();
        if (!after.ok) return after;
        if (after.raw !== snap.raw) return error('source-changed');
        if (!isCurrent()) return error('stale-session');
        return { ok: true, staged: true, recovered: listed.records.length === 1,
          count: snap.ops.length, sourceKey: pre.sourceKey, markerKey };
      });
    } catch (_) { return error('lock'); }
  }
  return { markerKey, lockName, stage };
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { qaJournalLegacyPreflight, qaJournalStageLegacy };
