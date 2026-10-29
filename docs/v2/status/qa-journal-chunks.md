# QA/ORC — resumable multi-batch legacy outbox staging (#90)

Date: 2026-10-30 · Owner: QA/ORC · Branch: `v2/qa-journal-chunked-staging`

## Scope and invariants
- New isolated `web/logic/outbox-migration-chunks.js` stages an exact-session legacy queue in deterministic, ordered **copies** of at most 256 operations per journal record. Each invocation copies at most two chunks by default, permitting large queues to resume after interruption.
- A durable marker contains the exact original source bytes, identity, count and chunk size. Every restart verifies the marker, source and existing contiguous chunks before appending. Missing/foreign/conflicting records, old staging markers, unavailable Web Locks, account switches and storage errors fail closed.
- The old queue is **never** deleted, acknowledged or changed; no remote delivery, authority promotion, sign-out modification or runtime registration. Staged records deliberately lack sequence numbers and are not eligible for ordered production delivery.
- **Important:** legacy producers still do not participate in the Web Lock. Byte rechecks detect changes but cannot prevent a concurrent writer immediately after checking. A later exclusive producer handoff and independently reviewed promotion are mandatory before enabling this in production. No data migration permission is inferred from this prototype.

## Verification
- New `web/test/qa_journal_chunked_staging_test.js`: 600-operation three-chunk ordering, reload/idempotence, 520-operation mid-copy quota interruption, marker-only recovery, malformed/unreadable storage, journal conflicts, missing chunk, old protocol conflict, lock contention, identity change, legacy source race and empty queue.
- Node test auto-discovered by `.github/workflows/ci.yml`; existing build and browser smoke matrix must pass before merge.
- No UI, Android permissions or native changes; new screenshots and physical-device claims are not applicable.

## Remaining gates
- Issue #90 remains open: legacy producer locking, atomic authority switch, ordered promotion, cross-tab sign-out and real production sync acceptance.
- L6 PR #44 remains draft pending physical-device privacy issue #52 and native QA #49.
