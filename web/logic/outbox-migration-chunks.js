/* QA #90: restartable multi-batch legacy queue COPY. Not loaded by the app.
 * The legacy outbox stays authoritative. This is NOT a migration cutover:
 * legacy writers do not hold this lock, and no staged record may be delivered.
 */
'use strict';

function qaJournalChunkStage(storage, makeJournal, preflight, uid, session, locks, isCurrent, maxPerRun = 2) {
  const valid = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
  if (!valid(uid) || !valid(session) || !storage ||
      typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' ||
      typeof makeJournal !== 'function' || !preflight ||
      typeof preflight.snapshot !== 'function' ||
      preflight.sourceKey !== 'carrel.pending:' + uid + ':' + session ||
      typeof isCurrent !== 'function' ||
      !Number.isSafeInteger(maxPerRun) || maxPerRun < 1 || maxPerRun > 32)
    throw new TypeError('Exact session, preflight and bounded chunk budget required');

  const markerKey = 'carrel.pending-migration-chunks.v1:' + uid + ':' + session;
  const oldMarkerKey = 'carrel.pending-migration-stage.v1:' + uid + ':' + session;
  const lockName = 'carrel-journal-delivery.v1:' + uid + ':' + session;
  const prefix = 'carrel.pending-journal.v1:' + uid + ':' + session + ':';
  const chunkSize = 256;
  const idFor = i => 'legacy_chunk_v1_' + String(i).padStart(6, '0');
  const fail = error => ({ ok: false, error });
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  function read(key) {
    try { return { ok: true, raw: storage.getItem(key) }; }
    catch (_) { return fail('storage-unreadable'); }
  }
  function stableSource() {
    const a = preflight.snapshot();
    if (!a || !a.ok) return a || fail('source-unreadable');
    const b = preflight.snapshot();
    if (!b || !b.ok) return b || fail('source-unreadable');
    return a.raw === b.raw ? a : fail('source-changed');
  }
  function checkedMarker() {
    const got = read(markerKey);
    if (!got.ok || got.raw === null) return got;
    let m;
    try { m = JSON.parse(got.raw); }
    catch (_) { return fail('marker-corrupt'); }
    if (!m || m.v !== 1 || m.uid !== uid || m.session !== session ||
        m.sourceKey !== preflight.sourceKey || typeof m.sourceRaw !== 'string' ||
        m.chunkSize !== chunkSize || !Number.isSafeInteger(m.count) || m.count < 1 ||
        Object.keys(m).some(k => !['v','uid','session','sourceKey','sourceRaw','chunkSize','count'].includes(k)))
      return fail('marker-corrupt');
    return { ok: true, raw: got.raw, value: m };
  }
  function verifyRecords(records, ops, count) {
    if (!Array.isArray(records) || records.length > count)
      return fail('journal-conflict');
    const seen = new Set();
    for (const item of records) {
      if (!item || typeof item.key !== 'string' || !item.record)
        return fail('journal-conflict');
      const suffix = item.key.slice(prefix.length);
      if (!item.key.startsWith(prefix) || !/^legacy_chunk_v1_[0-9]{6,}$/.test(suffix))
        return fail('journal-conflict');
      const i = Number(suffix.slice('legacy_chunk_v1_'.length));
      if (!Number.isSafeInteger(i) || i >= count || idFor(i) !== suffix || seen.has(i))
        return fail('journal-conflict');
      seen.add(i);
      const record = item.record;
      if (own(record, 'seq') || own(record, 'op') || !Array.isArray(record.ops) ||
          JSON.stringify(record.ops) !== JSON.stringify(ops.slice(i * chunkSize, (i + 1) * chunkSize)))
        return fail('journal-conflict');
    }
    // A missing earlier chunk is not proof that a later chunk is authoritative.
    for (let i = 0; i < seen.size; i++)
      if (!seen.has(i)) return fail('chunk-gap');
    return { ok: true, completed: seen.size };
  }
  async function stage() {
    if (!locks || typeof locks.request !== 'function') return fail('locks-unavailable');
    if (!isCurrent()) return fail('stale-session');
    try {
      return await locks.request(lockName, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) return fail('busy');
        if (!isCurrent()) return fail('stale-session');
        const old = read(oldMarkerKey);
        if (!old.ok) return old;
        if (old.raw !== null) return fail('other-staging-protocol');
        const snap = stableSource();
        if (!snap.ok) return snap;
        const marker = checkedMarker();
        if (!marker.ok) return marker;
        const journal = makeJournal(idFor(0));
        if (!journal || journal.prefix !== prefix ||
            typeof journal.list !== 'function' || typeof journal.appendBatch !== 'function')
          return fail('journal-mismatch');
        let listed;
        try { listed = journal.list(); }
        catch (_) { return fail('journal-unreadable'); }
        if (!listed || !listed.ok) return fail('journal-unreadable');
        if (snap.raw === null || !snap.ops.length) {
          if (marker.raw !== null || listed.records.length) return fail('source-changed');
          return { ok: true, empty: true, complete: true, staged: 0 };
        }
        const count = Math.ceil(snap.ops.length / chunkSize);
        if (marker.raw === null && listed.records.length) return fail('unmarked-journal');
        if (marker.raw !== null &&
            (marker.value.sourceRaw !== snap.raw || marker.value.count !== snap.ops.length))
          return fail('source-changed');
        let verified = verifyRecords(listed.records, snap.ops, count);
        if (!verified.ok) return verified;
        if (marker.raw === null) {
          const raw = JSON.stringify({ v: 1, uid, session,
            sourceKey: preflight.sourceKey, sourceRaw: snap.raw,
            chunkSize, count: snap.ops.length });
          try { storage.setItem(markerKey, raw); }
          catch (_) { return fail('marker-write'); }
          const check = checkedMarker();
          if (!check.ok || check.raw !== raw) return fail('marker-uncertain');
        }
        let completed = verified.completed;
        const recovered = completed;
        let copied = 0;
        while (completed < count && copied < maxPerRun) {
          if (!isCurrent()) return fail('stale-session');
          const before = stableSource();
          if (!before.ok) return before;
          if (before.raw !== snap.raw) return fail('source-changed');
          const i = completed;
          const id = idFor(i);
          const part = snap.ops.slice(i * chunkSize, (i + 1) * chunkSize);
          let saved;
          try { saved = makeJournal(id).appendBatch(part); }
          catch (_) { return fail('journal-write'); }
          if (!saved || !saved.ok) return fail('journal-write');
          if (saved.id !== id || saved.key !== prefix + id)
            return fail('journal-id-mismatch');
          let check;
          try { check = journal.list(); }
          catch (_) { return fail('journal-unreadable'); }
          if (!check || !check.ok) return fail('journal-unreadable');
          verified = verifyRecords(check.records, snap.ops, count);
          if (!verified.ok || verified.completed !== completed + 1)
            return fail('journal-verify');
          completed++;
          copied++;
        }
        const after = stableSource();
        if (!after.ok) return after;
        if (after.raw !== snap.raw) return fail('source-changed');
        if (!isCurrent()) return fail('stale-session');
        return { ok: true, complete: completed === count, copied, recovered,
          staged: completed, totalChunks: count, count: snap.ops.length,
          sourceKey: preflight.sourceKey, markerKey };
      });
    } catch (_) { return fail('lock'); }
  }
  return { markerKey, lockName, stage };
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { qaJournalChunkStage };
