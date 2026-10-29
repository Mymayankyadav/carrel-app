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
          !['set', 'update', 'delete'].includes(op.kind) || !own(op, 'data') ||
          (own(op, 'ensure') && op.ensure !== null &&
           (typeof op.ensure !== 'object' || Array.isArray(op.ensure))) ||
          (own(op, 'cond') && op.cond !== null &&
           (typeof op.cond !== 'object' || Array.isArray(op.cond))))
        return { ok: false, error: 'source-corrupt' };
    }
    // Copy only the fields supported by the journal. Never infer identity
    // from the legacy unscoped or pre-session pending keys.
    const ops = parsed.map(op => ({ path: op.path, kind: op.kind, data: op.data,
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
  return { sourceKey, inspect, verify };
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { qaJournalLegacyPreflight };
