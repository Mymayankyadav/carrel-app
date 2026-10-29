# QA/ORC — fail closed on unordered multi-action journal delivery (#90)

Date: 2026-10-30 · Owner: QA/ORC · Branch: `v2/qa-journal-unsequenced-delivery-fence`

## Problem
The pre-ordered `appendBatch()` API writes immutable actions without a shared ordering lock. `journal.list()` explicitly does not promise FIFO for these records. The experimental delivery coordinator nevertheless sent multiple such actions in arbitrary localStorage enumeration order. Two edits to the same path could therefore be applied in reverse order.

## Change
- `web/logic/outbox-delivery.js`: after the existing staged-migration pre-scan, reject an ambiguous multi-action snapshot with `unordered-pending` **before any send or ack**. A single unsequenced legacy action stays compatible. All ordered actions remain deliverable in their explicit sequence.
- `web/test/qa_journal_unsequenced_delivery_test.js`: reversed-key two-action fail-closed, no data deletion, single legacy compatibility, ordered replay, staged-migration precedence and account isolation.
- `tools/v2_qa_journal_unsequenced_smoke.py`: real two-tab unordered append refusal and ordered cross-tab replay.

## Safety boundary
This is an isolated prototype hardening change. The production `web/core/sync.js` legacy outbox remains authoritative; no migration promotion, data deletion, new permission, server recipient or sign-out behavior change is claimed. Issue #90 remains open for lock-aware legacy producers, crash-safe authority promotion, sign-out and production two-tab acceptance. L6 #44 remains draft pending physical-device privacy #52 and native QA #49.

## Verification
CI evidence and merge status must be filled in only after actual checks complete. No physical Android tests are claimed.
