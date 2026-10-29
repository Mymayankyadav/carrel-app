/* Durable per-operation journal for Carrel's future cross-tab outbox.
 * NOT connected to sync.js yet. The current shared queue remains authoritative
 * until a separately reviewed migration preserves sign-out/recovery semantics.
 *
 * Each operation has its own immutable localStorage key. Unlike a shared JSON
 * array, two tabs never need a read/modify/write cycle for different edits.
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
    Object.prototype.hasOwnProperty.call(op, 'data');
  const validRecord = (record, id) => !!record && record.v === 1 &&
    record.uid === uid && record.session === session && record.id === id &&
    validOp(record.op);
  function read(key) {
    try { return { ok: true, raw: storage.getItem(key) }; }
    catch (e) { return { ok: false, error: 'read' }; }
  }
  // A failed read-back is *uncertain*, not evidence that the write failed.
  // Never remove the key automatically: it may contain the only saved copy.
  function append(op) {
    if (!validOp(op)) return { ok: false, error: 'invalid' };
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
      raw = JSON.stringify({ v: 1, uid, session, id, op });
      if (!raw) return { ok: false, error: 'serialize' };
    } catch (e) { return { ok: false, error: 'serialize' }; }
    try { storage.setItem(key, raw); }
    catch (e) { return { ok: false, error: 'write', key, uncertain: true }; }
    const after = read(key);
    if (!after.ok || after.raw !== raw)
      return { ok: false, error: 'verify', key, uncertain: true };
    return { ok: true, key, raw, id };
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
    if (!validPart(id)) return false;
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
  return { prefix, append, list, acknowledge };
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { qaOutboxJournal };
