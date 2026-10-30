/* QA #90: immutable receipts for diagnosing stale-view legacy outbox loss.
 * Isolated experiment, NOT loaded by the app or production sync.js.
 * A receipt is an independent durable copy of a proposed action. A successful
 * legacy array write does NOT prove that another tab can see it. Never deliver
 * receipts or delete them on the strength of this audit.
 */
'use strict';

function qaLegacyReceiptAudit(storage, writer, uid, session, makeId) {
  const validPart = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
  if (!validPart(uid) || !validPart(session) || !storage ||
      typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function' ||
      typeof storage.key !== 'function' ||
      !writer || writer.sourceKey !== 'carrel.pending:' + uid + ':' + session ||
      typeof writer.appendBatch !== 'function' || typeof writer.snapshot !== 'function')
    throw new TypeError('Matching session storage and legacy writer required');
  const prefix = 'carrel.pending-legacy-receipt.v1:' + uid + ':' + session + ':';
  const idFactory = makeId || (() => {
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function')
      throw new Error('Secure IDs unavailable');
    return crypto.randomUUID();
  });
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
  function validOp(op) {
    return op && typeof op === 'object' && !Array.isArray(op) &&
      typeof op.path === 'string' && op.path.includes('/') &&
      ['set','update','delete'].includes(op.kind) &&
      (op.kind === 'delete' || (own(op,'data') && op.data !== undefined)) &&
      (!own(op,'ensure') || op.ensure === null ||
        (typeof op.ensure === 'object' && !Array.isArray(op.ensure))) &&
      (!own(op,'cond') || op.cond === null ||
        (typeof op.cond === 'object' && !Array.isArray(op.cond)));
  }
  function read(key) {
    try { return { ok: true, raw: storage.getItem(key) }; }
    catch (_) { return fail('storage-unreadable'); }
  }
  // Receipt first: if the legacy array write races or fails, an immutable
  // recovery copy remains. A caller MUST NOT silently retry a failed write.
  async function appendBatch(ops) {
    if (!Array.isArray(ops) || !ops.length || !ops.every(validOp))
      return fail('invalid');
    let id, original, raw;
    try {
      id = idFactory();
      if (!validPart(id)) return fail('id');
      original = JSON.parse(JSON.stringify(ops));
      if (!original.every(validOp) || original.some(op => own(op,'qaReceiptId')))
        return fail('serialize');
      raw = JSON.stringify({ v:1, uid, session, id, ops:original });
    } catch (_) { return fail('serialize'); }
    const key = prefix + id;
    const before = read(key);
    if (!before.ok) return before;
    if (before.raw !== null) return fail('collision');
    try { storage.setItem(key, raw); }
    catch (_) { return fail('receipt-write', { uncertain:true, receiptKey:key }); }
    const saved = read(key);
    if (!saved.ok || saved.raw !== raw)
      return fail('receipt-verify', { uncertain:true, receiptKey:key });
    const tagged = original.map(op => ({ ...op, qaReceiptId:id }));
    let result;
    try { result = await writer.appendBatch(tagged); }
    catch (_) { return fail('legacy-write', { uncertain:true, receiptKey:key }); }
    if (!result || !result.ok)
      return fail(result && result.error || 'legacy-write',
        { uncertain:true, receiptKey:key });
    return { ok:true, receiptKey:key, id, legacyResult:result,
      // This only confirms THIS tab's read-back, never cross-tab visibility.
      crossTabVerified:false };
  }
  // Read-only audit. A missing receipt's operations are NOT discarded:
  // their immutable receipt is still available for explicit reconciliation.
  // After a legitimate remote acknowledgement, this diagnostic can report
  // missing until receipts are retired by a separately verified protocol.
  function audit() {
    const records = [];
    try {
      const n = storage.length;
      if (!Number.isSafeInteger(n) || n < 0) return fail('enumerate');
      for (let i=0; i<n; i++) {
        const key = storage.key(i);
        if (typeof key !== 'string') return fail('enumerate');
        if (!key.startsWith(prefix)) continue;
        const id = key.slice(prefix.length);
        if (!validPart(id)) return fail('receipt-corrupt');
        const got = read(key);
        if (!got.ok) return got;
        let value;
        try { value = JSON.parse(got.raw); }
        catch (_) { return fail('receipt-corrupt'); }
        if (!value || value.v !== 1 || value.uid !== uid ||
            value.session !== session || value.id !== id ||
            !Array.isArray(value.ops) || !value.ops.length ||
            !value.ops.every(validOp) ||
            Object.keys(value).some(k => !['v','uid','session','id','ops'].includes(k)))
          return fail('receipt-corrupt');
        records.push(value);
      }
    } catch (_) { return fail('enumerate'); }
    const snap = writer.snapshot();
    if (!snap || !snap.ok) return fail('source-unreadable');
    const missing = [];
    for (const receipt of records) {
      const tagged = receipt.ops.map(op => ({ ...op, qaReceiptId:receipt.id }));
      const found = snap.ops.filter(op => op.qaReceiptId === receipt.id);
      if (JSON.stringify(found) !== JSON.stringify(tagged))
        missing.push(receipt.id);
    }
    if (missing.length) return fail('receipt-missing',
      { missing, receiptCount:records.length, pendingCount:snap.ops.length });
    return { ok:true, receiptCount:records.length, pendingCount:snap.ops.length };
  }
  return { prefix, appendBatch, audit };
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { qaLegacyReceiptAudit };
