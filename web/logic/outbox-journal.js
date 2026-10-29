/* Durable per-operation journal for Carrel's future cross-tab outbox.
 * NOT connected to sync.js yet. The current shared queue remains authoritative
 * until a separately reviewed migration preserves sign-out/recovery semantics.
 *
 * Each action has its own immutable localStorage key (one operation or an
 * atomic batch). Unlike a shared JSON array, independent tabs cannot replace
 * one another's queued actions. A batch is one durable acknowledgement unit.
 * This is local durability, NOT server-side exactly-once delivery.
 */
'use strict';

function qaOutboxJournal(storage, uid, session, makeId) {
  const validPart = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
  if (!validPart(uid) || !validPart(session))
    throw new TypeError('Account and session are required for an isolated outbox');
  if (!storage || typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function' ||
      typeof storage.removeItem !== 'function' ||
      typeof storage.key !== 'function')
    throw new TypeError('Durable storage is required');
  const prefix = 'carrel.pending-journal.v1:' + uid + ':' + session + ':';
  const generate = makeId || (() => {
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function')
      throw new Error('Secure operation IDs unavailable');
    return crypto.randomUUID();
  });
  const validOp = op => !!op && typeof op === 'object' && !Array.isArray(op) &&
    typeof op.path === 'string' && op.path.includes('/') &&
    ['set', 'update', 'delete'].includes(op.kind) &&
    // Legacy delete writes have no payload: JSON.stringify omits data:undefined.
    // Requiring a data property here would strand an otherwise valid offline
    // delete during migration. Set/update retain the existing serialize check
    // for an explicitly undefined payload.
    (op.kind === 'delete' || Object.prototype.hasOwnProperty.call(op, 'data'));
  // An action may write several documents. Keep the whole write set in
  // ONE immutable key: a crash or quota failure cannot expose half an action.
  // Legacy single-op records remain readable without migration.
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const validRecord = (record, id) => !!record && record.v === 1 &&
    record.uid === uid && record.session === session && record.id === id &&
    (!own(record, 'seq') || (Number.isSafeInteger(record.seq) && record.seq > 0)) &&
    ((own(record, 'op') && !own(record, 'ops') && validOp(record.op)) ||
     (!own(record, 'op') && Array.isArray(record.ops) &&
      record.ops.length >= 1 && record.ops.length <= 256 &&
      record.ops.every(validOp)));
  function read(key) {
    try { return { ok: true, raw: storage.getItem(key) }; }
    catch (e) { return { ok: false, error: 'read' }; }
  }
  // A failed read-back is *uncertain*, not evidence that the write failed.
  // Never remove the key automatically: it may contain the only saved copy.
  function appendRecord(payload, seq) {
    let id;
    try { id = generate(); }
    catch (e) { return { ok: false, error: 'id' }; }
    if (!validPart(id)) return { ok: false, error: 'id' };
    const key = prefix + id;
    const before = read(key);
    if (!before.ok) return { ok: false, error: 'read', key, uncertain: true };
    if (before.raw !== null) return { ok: false, error: 'collision', key };
    let raw;
    try {
      raw = JSON.stringify({ v: 1, uid, session, id, ...(seq === undefined ? {} : { seq }), ...payload });
      if (!raw || !validRecord(JSON.parse(raw), id))
        return { ok: false, error: 'serialize' };
    } catch (e) { return { ok: false, error: 'serialize' }; }
    try { storage.setItem(key, raw); }
    catch (e) { return { ok: false, error: 'write', key, uncertain: true }; }
    const after = read(key);
    if (!after.ok || after.raw !== raw)
      return { ok: false, error: 'verify', key, uncertain: true };
    return { ok: true, key, raw, id };
  }
  function append(op) {
    return validOp(op) ? appendRecord({ op }) : { ok: false, error: 'invalid' };
  }
  // Persist the complete W()/commit() action in one localStorage operation.
  // Reject invalid/oversized batches before any storage mutation. Each batch
  // remains a single acknowledgement unit until all its remote writes succeed.
  function appendBatch(ops) {
    if (!Array.isArray(ops) || !ops.length || ops.length > 256 ||
        !ops.every(validOp))
      return { ok: false, error: 'invalid' };
    return appendRecord({ ops });
  }
  // Order is assigned under the SAME origin-wide Web Lock as delivery/ack.
  // This prevents an ack from deleting the highest sequence mid-append.
  // No shared counter is persisted: a crash before append leaves no phantom reservation.
  // All pending actions participate in the sequence. If older unsequenced
  // records exist, migration must explicitly handle them first.
  async function appendBatchOrdered(ops, locks, isCurrent) {
    if (!Array.isArray(ops) || !ops.length || ops.length > 256 ||
        !ops.every(validOp)) return { ok: false, error: 'invalid' };
    if (!locks || typeof locks.request !== 'function')
      return { ok: false, error: 'locks-unavailable' };
    if (typeof isCurrent !== 'function' || !isCurrent())
      return { ok: false, error: 'stale-session' };
    const lockName = 'carrel-journal-delivery.v1:' + uid + ':' + session;
    try {
      return await locks.request(lockName, { mode: 'exclusive' }, async lock => {
        if (!lock) return { ok: false, error: 'lock' };
        if (!isCurrent()) return { ok: false, error: 'stale-session' };
        const snapshot = list();
        if (!snapshot.ok) return { ok: false, error: snapshot.error };
        if (snapshot.records.some(item => !own(item.record, 'seq')))
          return { ok: false, error: 'legacy-pending' };
        const last = snapshot.records.length ?
          snapshot.records[snapshot.records.length - 1].record.seq : 0;
        if (last >= Number.MAX_SAFE_INTEGER)
          return { ok: false, error: 'sequence-exhausted' };
        if (!isCurrent()) return { ok: false, error: 'stale-session' };
        return appendRecord({ ops }, last + 1);
      });
    } catch (_) { return { ok: false, error: 'lock' }; }
  }
  async function appendOrdered(op, locks, isCurrent) {
    return appendBatchOrdered([op], locks, isCurrent);
  }
  // Enumeration is fail-closed: malformed data or an inaccessible key cannot
  // be treated as an empty outbox. A caller must not discard partial results.
  function list() {
    const records = [];
    try {
      const count = storage.length;
      if (!Number.isSafeInteger(count) || count < 0)
        return { ok: false, error: 'enumerate' };
      for (let i = 0; i < count; i++) {
        const key = storage.key(i);
        if (typeof key !== 'string') return { ok: false, error: 'enumerate' };
        if (!key.startsWith(prefix)) continue;
        const id = key.slice(prefix.length);
        if (!validPart(id)) return { ok: false, error: 'corrupt', key };
        const got = read(key);
        if (!got.ok || got.raw === null)
          return { ok: false, error: 'read', key };
        let record;
        try { record = JSON.parse(got.raw); }
        catch (e) { return { ok: false, error: 'corrupt', key }; }
        if (!validRecord(record, id))
          return { ok: false, error: 'corrupt', key };
        records.push({ key, raw: got.raw, record });
      }
    } catch (e) { return { ok: false, error: 'enumerate' }; }
    // localStorage key enumeration is NOT a FIFO guarantee. Ordered records
    // must all carry distinct sequence numbers; mixed modes fail closed.
    const ordered = records.filter(item => own(item.record, 'seq'));
    if (ordered.length && ordered.length !== records.length)
      return { ok: false, error: 'mixed-order' };
    if (ordered.length) {
      const seqs = new Set();
      for (const item of ordered) {
        if (seqs.has(item.record.seq)) return { ok: false, error: 'duplicate-order' };
        seqs.add(item.record.seq);
      }
      records.sort((a, b) => a.record.seq - b.record.seq);
    }
    return { ok: true, records };
  }
  // Only an acknowledged operation may be passed here by the sync layer.
  // Immutable per-op keys mean acknowledging A cannot erase B's offline edit.
  // Read/verify is not a transaction; a duplicate ID is forbidden by contract.
  function acknowledge(item) {
    if (!item || typeof item.key !== 'string' ||
        !item.key.startsWith(prefix) || typeof item.raw !== 'string')
      return false;
    const id = item.key.slice(prefix.length);
    // A migration COPY has not become authoritative. Only the future
    // exclusive handoff may retire it; a generic remote ack never may.
    if (!validPart(id) || id === 'legacy_stage_v1' ||
        /^legacy_chunk_v1_[0-9]{6,}$/.test(id)) return false;
    let record;
    try { record = JSON.parse(item.raw); } catch (e) { return false; }
    if (!validRecord(record, id)) return false;
    const got = read(item.key);
    if (!got.ok || got.raw !== item.raw) return false;
    try { storage.removeItem(item.key); }
    catch (e) { return false; }
    const after = read(item.key);
    return after.ok && after.raw === null;
  }
  return { prefix, append, appendBatch, appendOrdered, appendBatchOrdered, list, acknowledge };
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { qaOutboxJournal };
