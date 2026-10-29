/* Cross-tab delivery ownership for the isolated #90 journal prototype.
 * NOT wired into production sync.js. A Web Lock is held from fresh journal
 * enumeration through remote acknowledgement. The browser releases it if the
 * tab dies. Without Web Locks, fail closed: never pretend a localStorage lease
 * is atomic. Delivery is at-least-once, NOT exactly-once at the server.
 */
'use strict';

function qaJournalDelivery(journal, locks, uid, session, send, isCurrent) {
  const validPart = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
  if (!validPart(uid) || !validPart(session) || !journal ||
      typeof journal.list !== 'function' || typeof journal.acknowledge !== 'function' ||
      journal.prefix !== 'carrel.pending-journal.v1:' + uid + ':' + session + ':' ||
      typeof send !== 'function' || typeof isCurrent !== 'function')
    throw new TypeError('Journal, account, session, send and identity fence are required');
  // Scope ownership exactly as the journal does. The lock is origin-wide,
  // shared by tabs in the same browser profile, not a server-side mutex.
  const lockName = 'carrel-journal-delivery.v1:' + uid + ':' + session;
  async function drain() {
    if (!locks || typeof locks.request !== 'function')
      return { ok: false, error: 'locks-unavailable', sent: 0, acknowledged: 0 };
    if (!isCurrent())
      return { ok: false, error: 'stale-session', sent: 0, acknowledged: 0 };
    try {
      return await locks.request(lockName, { mode: 'exclusive', ifAvailable: true }, async lock => {
        // A competing tab owns the queue. Caller may retry after it finishes.
        if (!lock) return { ok: false, error: 'busy', sent: 0, acknowledged: 0 };
        let sent = 0, acknowledged = 0;
        const failure = error => ({ ok: false, error, sent, acknowledged });
        if (!isCurrent()) return failure('stale-session');
        // MUST enumerate under the lock, not before acquiring it. Otherwise a
        // waiting tab could replay operations already acknowledged by its peer.
        const snapshot = journal.list();
        if (!snapshot || snapshot.ok !== true || !Array.isArray(snapshot.records))
          return failure('storage');
        // Migration copies are NOT authoritative for delivery. Check every
        // record before sending anything: key enumeration is not FIFO.
        if (snapshot.records.some(item => {
          const id = item && item.record && item.record.id;
          return id === 'legacy_stage_v1' ||
            (typeof id === 'string' && /^legacy_chunk_v1_[0-9]{6,}$/.test(id));
        })) return failure('migration-staged');
        // Pre-ordered journal actions were written without the shared Web Lock.
        // localStorage key enumeration is not chronological: sending two such
        // actions could replay a later same-path edit before an earlier one.
        // One legacy action remains safe to drain for backwards compatibility.
        // Never send ANY action from an ambiguous multi-record snapshot.
        if (snapshot.records.length > 1 &&
            snapshot.records.some(item =>
              !Object.prototype.hasOwnProperty.call(item.record, 'seq')))
          return failure('unordered-pending');
        for (const item of snapshot.records) {
          if (!isCurrent()) return failure('stale-session');
          const record = item && item.record;
          const ops = record && (Array.isArray(record.ops) ? record.ops :
            record.op ? [record.op] : null);
          if (!ops || !ops.length) return failure('corrupt');
          // A batch is one durable acknowledgement unit. A partially sent
          // batch stays intact for replay, possibly duplicating remote writes.
          for (const op of ops) {
            if (!isCurrent()) return failure('stale-session');
            try {
              const result = await send(op, item);
              if (result === false || (result && result.ok === false))
                return failure('send');
              sent++;
            } catch (_) { return failure('send'); }
          }
          if (!isCurrent()) return failure('stale-session');
          // If device cleanup fails, STOP. A later invocation may replay this
          // action; never silently skip it or send subsequent actions first.
          if (!journal.acknowledge(item)) return failure('ack');
          acknowledged++;
        }
        return { ok: true, sent, acknowledged };
      });
    } catch (_) {
      return { ok: false, error: 'lock', sent: 0, acknowledged: 0 };
    }
  }
  return { lockName, drain };
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { qaJournalDelivery };
