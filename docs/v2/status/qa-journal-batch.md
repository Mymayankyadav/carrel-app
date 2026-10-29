# QA/ORC — atomic multi-document journal actions (#90)

Date: 2026-10-29 · Owner: QA/ORC · Branch: `v2/qa-journal-atomic-action-batches`.

## Scope
- Extend the **isolated, not-yet-integrated** `web/logic/outbox-journal.js` with `appendBatch(ops)`. One `W()/commit()` action (up to 256 writes) is one immutable localStorage record and acknowledgement unit; a failed write cannot publish a partial multi-document action.
- Preserve the original `append(op)` single-op records and their crash/reload recovery without migration.
- Fail closed for invalid, partially serialized, oversized, malformed and unreadable batch records. Do not delete uncertain writes.
- Extend Node tests for two-tab independent batches, quota, crash recovery, stale acknowledgements, account/session isolation and corrupted batches.
- Add `tools/v2_qa_journal_batch_smoke.py`: two independent same-origin browser tabs in one Chromium context, overlapping actions, real reload, isolated acknowledgement and quota failure.

## Boundaries
This does **not** replace the production shared `pending:<uid>:<session>` queue. The journal remains unregistered in `web/files.json`; it is loaded explicitly by the browser smoke. No user data is migrated or deleted. #90 remains open.

The next integration must implement per-path FIFO and cross-tab delivery ownership (Web Locks or a verified safe fallback), migrate legacy queues without silent replay, and coordinate sign-out/cleanup with active writers. At-least-once remote delivery is not server-side exactly-once. L6 physical-device acceptance #52 and native QA #49 are separate hard gates.

## Verification
Pending final-head CI and browser smoke evidence. Do not mark merged until checks complete.
