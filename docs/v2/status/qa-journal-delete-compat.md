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
Pending CI and PR verification; do not claim physical-device or screenshot acceptance for this non-UI change.
