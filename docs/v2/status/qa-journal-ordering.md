# QA/ORC — ordered cross-tab journal appends (#90)

Date: 2026-10-29 · Owner: QA/ORC · Branch: `v2/qa-journal-ordered-append`.

## Scope
- `web/logic/outbox-journal.js`: add `appendOrdered` and `appendBatchOrdered` with account/session-scoped Web Locks. The append lock is intentionally **the same lock** used by journal delivery and acknowledgement, preventing a remote acknowledgement from removing the highest pending sequence during an append.
- Assign durable, positive integer `seq` under the lock and sort records by `seq` rather than localStorage key enumeration or random ID order. Fail closed on duplicate sequence numbers, mixed ordered/unsequenced records, corrupt storage, missing Web Locks and stale identity.
- Existing `append`/`appendBatch` APIs remain for the isolated foundation and legacy tests; ordered append explicitly rejects unsequenced pending records. No automatic legacy migration is attempted.
- Add `web/test/qa_journal_ordering_test.js` and `tools/v2_qa_journal_ordering_smoke.py`: same-path writes from two tabs, lock wait, reversed lexical IDs, reload/delivery order, account isolation and storage errors.

## Release boundaries
- **Still not wired into production `web/core/sync.js`**. The shared v1 queue remains authoritative. No existing offline edits or production documents were modified or migrated.
- The shared append/delivery Web Lock can delay an append during a slow remote send; production UX must explicitly handle this before switching queue implementations.
- A failed local write may have uncertain durability. Client delivery remains at-least-once; server-side exactly-once is not claimed.
- Issue #90 stays open until migration, sign-out coordination, production wiring and end-to-end tests pass. L6 physical-device privacy gate #52 and native QA #49 are unaffected.

## Evidence
- New test files are picked up automatically by `.github/workflows/ci.yml` via `web/test/*_test.js` and `tools/v2_*_smoke.py`.
- Initial PR-head CI: [web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40918564647) **passed**, with explicit `QA JOURNAL ORDERED APPEND TESTS PASSED` and `QA JOURNAL ORDERED TWO-TAB SMOKE PASSED` markers in job logs. [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40918564767) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40918564506) **passed**. Final PR head `5a8cd23`: [web build, Node and all v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40918963851), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40918963869) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40918963841) **all passed**. Both ordered-append test markers were confirmed in the final CI job log. [PR #104](https://github.com/Mymayankyadav/carrel-app/pull/104) squash-merged at [`ceaffe3`](https://github.com/Mymayankyadav/carrel-app/commit/ceaffe3bc0ddc6885bf6a6213aeabc7c4746e9b2).
- No UI surface is introduced; screenshots are not applicable to this isolated, unregistered logic module.
