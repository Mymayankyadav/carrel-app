# QA/ORC — staged journal delivery and acknowledgement fence (#90)

Date: 2026-10-30 · Owner: QA/ORC · Branch: `v2/qa-journal-staged-delivery-fence` · [PR #113](https://github.com/Mymayankyadav/carrel-app/pull/113)

## Problem
The migration staging modules correctly leave copies unsequenced and non-authoritative, but the isolated `qaJournalDelivery` prototype previously accepted any valid unsequenced journal record. Accidentally connecting it to a staged journal could **send duplicate edits to Supabase** and `acknowledge()` could erase the staged copy. The comment "no staged record may be delivered" was not enforced.

## Implementation
- `web/logic/outbox-delivery.js`: pre-scan the entire enumerated journal **before any remote send**. Reject reserved `legacy_stage_v1` and `legacy_chunk_v1_*` records with `migration-staged`, including when an ordinary record enumerates first.
- `web/logic/outbox-journal.js`: generic `acknowledge()` rejects those reserved IDs. Only a future migration-specific exclusive authority handoff may retire copies.
- `web/test/qa_journal_staged_delivery_fence_test.js`: 600-op chunked staging, older one-batch staging, pre-scan order, no deletion, ordinary legacy and ordered compatibility, account/session isolation.
- `tools/v2_qa_journal_staged_delivery_smoke.py`: two independent real browser tabs, both refuse delivery, no send, no staged acknowledgement.

## Evidence and limits
- Isolated V8 test execution of existing journal delivery/ordering/chunk staging suites and the new regression suite passed against branch source. GitHub CI and Playwright smoke must pass before merge; no CI success claimed yet.
- No new UI or native code; no new screenshots required. The migration is still **not production-wired** and existing `web/core/sync.js` remains authoritative.
- Issue [#90](https://github.com/Mymayankyadav/carrel-app/issues/90) stays open for legacy writer locking, atomic promotion, sign-out and end-to-end production acceptance.
- L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) stays draft pending physical Android privacy [#52](https://github.com/Mymayankyadav/carrel-app/issues/52) and native QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49). No device test or privacy approval claimed.

## Next
Design a lock-aware legacy producer handoff and crash-safe promotion protocol. Keep migration copies non-deliverable until every old writer is fenced and explicit sign-out/legacy recovery semantics are verified.
