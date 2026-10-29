# QA/ORC — Web Locks journal delivery ownership (#90)

Date: 2026-10-29 · Owner: QA/ORC · Branch: `v2/qa-journal-delivery-lock`.

## Scope
- Add isolated `web/logic/outbox-delivery.js` for cross-tab single-flight journal delivery. It holds an exclusive account/session-scoped **Web Lock** from fresh enumeration through remote sends and durable acknowledgement. A second tab returns `busy` and can retry; a crashed tab releases the browser lock.
- Process every operation within a multi-document action in order, and acknowledge **only after every send succeeds**. Partial remote success or failed local acknowledgement retains the entire action for at-least-once replay. Recheck account/session identity before every operation and acknowledgement.
- **Fallback:** no Web Locks (or a denied lock) means no journal dispatch; never use a non-atomic localStorage lease. The current production shared outbox remains in service. Unsupported browsers need a separate safe design before enabling the journal.
- Add `web/test/qa_outbox_delivery_lock_test.js` (busy lock, fresh re-enumeration, partial failure, cleanup failure, inaccessible storage, stale account, unavailable locks) and `tools/v2_qa_journal_delivery_smoke.py` (real two-tab lock contention, crash release, reload-safe recovery).

## Boundaries / not yet accepted
- This is a **non-production prototype**: no changes to `web/core/sync.js`, `web/files.json`, authentication, Supabase or existing user data. No migration, sign-out coordination, production retry scheduling or release gate is changed.
- Cross-tab append ordering / per-path FIFO is **not** established by this delivery lock: journal records still lack a global append sequence, and localStorage enumeration order is not a contractual FIFO. New records may also arrive during a drain. Integrate append + delivery under a shared transaction/ordering protocol before enabling this in production.
- At-least-once delivery can replay partially completed batches after a crash or cleanup failure. Server-side exactly-once requires a separate idempotency contract.
- Issue #90 stays open. L6 draft PR #44 and physical-device acceptance #52/#49 remain blocked.

## Evidence
- Local Node test: `node web/test/qa_outbox_delivery_lock_test.js` passed before push.
- Browser smoke was authored for CI; local Chromium is blocked by container administrator policy on file/localhost navigation. **Do not claim local browser acceptance.**
- PR CI and screenshot evidence: pending.
