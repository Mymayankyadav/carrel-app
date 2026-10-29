# QA/ORC — preserve payload-free legacy deletes in journal migration (#90)

Date: 2026-10-30 · Owner: QA/ORC · Branch: `v2/qa-journal-legacy-delete-compat`

## Problem
`web/core/sync.js` persists pending operations through JSON serialization. A `delete` operation may have `data: undefined`, so its durable JSON has **no `data` property**. The isolated legacy preflight and journal validators incorrectly rejected that valid operation as corrupt, blocking recovery and migration of any queue containing a delete.

## Change
- `web/logic/outbox-migration.js`: accept missing `data` for `delete` only; retain whether the source had a payload when constructing a migration copy. `set` and `update` still require payloads.
- `web/logic/outbox-journal.js`: allow a payload-free `delete` to survive JSON round-trip and remain a valid journal record, while rejecting missing/undefined `set` and `update` payloads.
- `web/test/qa_journal_legacy_delete_compat_test.js`: 260-operation mixed queue, two-chunk staging, exact source preservation, account isolation, non-authoritative copy delivery/ack fences, ordered delete delivery, malformed set/update rejection.

## Boundaries
This change is to **isolated, non-production** QA migration modules only. No production sync authority change, automatic legacy import, source deletion, user-data rewrite, new recipient, permissions or Android change. Existing queues remain authoritative. The actual cross-tab producer lock, migration promotion, sign-out coordination and end-to-end production acceptance are still open under #90. L6 #44 physical-device privacy #52 and native QA #49 remain hard gates.

## Evidence
- [PR #117](https://github.com/Mymayankyadav/carrel-app/pull/117) squash-merged at [`74a577e`](https://github.com/Mymayankyadav/carrel-app/commit/74a577e63c99dd94af0c668528dae22216edd368).
- [Final-head web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40971093294) — **success**; new `QA JOURNAL LEGACY DELETE COMPAT TESTS PASSED` suite also passed in the earlier implementation run.
- [Second final-head CI run](https://github.com/Mymayankyadav/carrel-app/actions/runs/40971086688) — **success**.
- [Final-head browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40971093290) — **success**.
- [Final-head v2 navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40971093280) — **success**.
- Initial CI failed because an existing test expected the original `serialize` error for an explicit undefined `set` payload; the validator was adjusted to preserve that contract, and all final-head checks passed. No failed run is counted as acceptance.
- No UI or native changes; no new screenshots or physical-device tests claimed.
