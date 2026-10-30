# QA/ORC — lock-aware legacy writer prototype (#90)

Date: 2026-10-30 · Owner: QA/ORC · Branch: `v2/qa-legacy-writer-lock-prototype`

## Implementation
- `web/logic/outbox-legacy-writer.js` provides a **non-production**, account/session-scoped legacy queue writer that holds the existing journal Web Lock across read, validation, append and read-back.
- Cooperating tabs serialize whole actions; unreadable/corrupt queues, unavailable locks, account changes, existing staging markers and observable legacy races fail closed.
- Storage writes with uncertain durability are never silently retried. Payload-free deletes remain valid.
- No production code imports this module; `web/core/sync.js` and existing offline data remain unchanged. Old tabs still use the unlocked writer, so this prototype alone **does not** make production cross-tab atomic or authorize migration.
- `web/test/qa_journal_legacy_writer_test.js` tests overlapping writers, session isolation, staging fences, corrupt storage, quota, stale identity, observable races and uncertain read-back.
- `tools/v2_qa_legacy_writer_smoke.py` tests two real tabs and a cross-tab staging marker; automatically discovered by the v2 CI smoke loop.

## Verification and limitations
- Local Node test: `node web/test/qa_journal_legacy_writer_test.js` — passed on the authored source. Local Chromium smoke was attempted but the sandbox browser blocked both file:// and localhost navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`); GitHub CI must establish browser acceptance before merge.
- No UI or native changes; no new screenshots are applicable.
- Remaining #90: integrate all production producers and acknowledgements under one safe authority, handle old-tab compatibility and sign-out, design crash-safe promotion, and run real two-context end-to-end acceptance.
- L6 PR #44 remains draft pending physical Android #52/#49; no device acceptance claimed.
