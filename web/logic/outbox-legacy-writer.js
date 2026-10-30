/* QA #90: opt-in legacy producer/acknowledgement coordination prototype.
 * NOT registered in web/files.json and NOT used by production sync.js.
 * Cooperating tabs serialize whole legacy queue writes under the SAME Web Lock
 * as journal staging/delivery. Existing (nonparticipating) v1 tabs are NOT
 * fenced: this is a prerequisite, not a production migration or cutover.
 */
'use strict';

function qaLegacyLockedWriter(storage, uid, session, locks, isCurrent) {
  const validPart = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
  if (!validPart(uid) || !validPart(session) || !storage ||
      typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' ||
      typeof isCurrent !== 'function')
    throw new TypeError('Exact session, storage and identity fence required');
  const sourceKey = 'carrel.pending:' + uid + ':' + session;
  const markerKeys = [
    'carrel.pending-migration-stage.v1:' + uid + ':' + session,
    'carrel.pending-migration-chunks.v1:' + uid + ':' + session
  ];
  const lockName = 'carrel-journal-delivery.v1:' + uid + ':' + session;
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const fail = (error, uncertain = false) => ({ ok: false, error, ...(uncertain ? { uncertain: true } : {}) });
  function validOp(op) {
    return !!op && typeof op === 'object' && !Array.isArray(op) &&
      typeof op.path === 'string' && op.path.includes('/') &&
      ['set', 'update', 'delete'].includes(op.kind) &&
      (op.kind === 'delete' || (own(op, 'data') && op.data !== undefined)) &&
      (!own(op, 'ensure') || op.ensure === null ||
        (typeof op.ensure === 'object' && !Array.isArray(op.ensure))) &&
      (!own(op, 'cond') || op.cond === null ||
        (typeof op.cond === 'object' && !Array.isArray(op.cond)));
  }
  function read(key) {
    try { return { ok: true, raw: storage.getItem(key) }; }
    catch (_) { return fail('storage-unreadable'); }
  }
  function checkMarkers() {
    for (const key of markerKeys) {
      const got = read(key);
      if (!got.ok) return got;
      if (got.raw !== null) return fail('migration-staged');
    }
    return { ok: true };
  }
  function snapshot() {
    const got = read(sourceKey);
    if (!got.ok) return got;
    if (got.raw === null) return { ok: true, raw: null, ops: [] };
    let ops;
    try { ops = JSON.parse(got.raw); }
    catch (_) { return fail('source-corrupt'); }
    if (!Array.isArray(ops) || !ops.every(validOp)) return fail('source-corrupt');
    return { ok: true, raw: got.raw, ops };
  }
  async function appendBatch(ops) {
    if (!Array.isArray(ops) || !ops.length || !ops.every(validOp))
      return fail('invalid');
    // Ensure that no operation is silently changed by JSON serialization.
    let copied;
    try {
      copied = JSON.parse(JSON.stringify(ops));
      if (!Array.isArray(copied) || !copied.every(validOp)) return fail('serialize');
    } catch (_) { return fail('serialize'); }
    if (!locks || typeof locks.request !== 'function') return fail('locks-unavailable');
    if (!isCurrent()) return fail('stale-session');
    try {
      return await locks.request(lockName, { mode: 'exclusive' }, async lock => {
        if (!lock) return fail('lock');
        if (!isCurrent()) return fail('stale-session');
        const marker = checkMarkers();
        if (!marker.ok) return marker;
        const before = snapshot();
        if (!before.ok) return before;
        const again = snapshot();
        if (!again.ok) return again;
        if (before.raw !== again.raw) return fail('source-changed');
        let next;
        try { next = JSON.stringify(before.ops.concat(copied)); }
        catch (_) { return fail('serialize'); }
        // No writes if the source changed or a staging marker appeared.
        const latest = read(sourceKey);
        if (!latest.ok) return latest;
        if (latest.raw !== before.raw) return fail('source-changed');
        const markerAgain = checkMarkers();
        if (!markerAgain.ok) return markerAgain;
        if (!isCurrent()) return fail('stale-session');
        // A thrown setItem or failed read-back is uncertain: do not undo a
        // potentially durable action, and never silently retry it.
        try { storage.setItem(sourceKey, next); }
        catch (_) { return fail('storage-write', true); }
        const after = read(sourceKey);
        if (!after.ok || after.raw !== next) return fail('storage-verify', true);
        return { ok: true, count: copied.length, total: before.ops.length + copied.length };
      });
    } catch (_) { return fail('lock'); }
  }
  // Prototype acknowledgement path: the caller must supply the exact durable
  // snapshot AND the exact remotely acknowledged FIFO prefix. A stale tab may
  // not delete a different tab's appended edits. Never call before server ack.
  // Old v1 tabs do not hold this lock; production use remains prohibited.
  async function acknowledgePrefix(expectedRaw, acknowledgedOps) {
    if (typeof expectedRaw !== 'string' || !Array.isArray(acknowledgedOps) ||
        !acknowledgedOps.length || !acknowledgedOps.every(validOp))
      return fail('invalid-ack');
    let acknowledged;
    try {
      acknowledged = JSON.stringify(acknowledgedOps);
      if (!Array.isArray(JSON.parse(acknowledged)))
        return fail('invalid-ack');
    } catch (_) { return fail('invalid-ack'); }
    if (!locks || typeof locks.request !== 'function') return fail('locks-unavailable');
    if (!isCurrent()) return fail('stale-session');
    try {
      return await locks.request(lockName, { mode: 'exclusive' }, async lock => {
        if (!lock) return fail('lock');
        if (!isCurrent()) return fail('stale-session');
        const marker = checkMarkers();
        if (!marker.ok) return marker;
        const before = snapshot();
        if (!before.ok) return before;
        const again = snapshot();
        if (!again.ok) return again;
        if (before.raw !== again.raw || before.raw !== expectedRaw)
          return fail('source-changed');
        if (acknowledgedOps.length > before.ops.length ||
            JSON.stringify(before.ops.slice(0, acknowledgedOps.length)) !== acknowledged)
          return fail('ack-prefix-mismatch');
        let next;
        try { next = JSON.stringify(before.ops.slice(acknowledgedOps.length)); }
        catch (_) { return fail('serialize'); }
        const latest = read(sourceKey);
        if (!latest.ok) return latest;
        if (latest.raw !== expectedRaw) return fail('source-changed');
        const markerAgain = checkMarkers();
        if (!markerAgain.ok) return markerAgain;
        if (!isCurrent()) return fail('stale-session');
        // Preserve an empty JSON queue instead of deleting the storage key:
        // a failed removal must never masquerade as an empty successful ack.
        try { storage.setItem(sourceKey, next); }
        catch (_) { return fail('storage-write', true); }
        const after = read(sourceKey);
        if (!after.ok || after.raw !== next) return fail('storage-verify', true);
        return { ok: true, acknowledged: acknowledgedOps.length,
          remaining: before.ops.length - acknowledgedOps.length };
      });
    } catch (_) { return fail('lock'); }
  }
  return { sourceKey, lockName, appendBatch, acknowledgePrefix, snapshot };
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { qaLegacyLockedWriter };
