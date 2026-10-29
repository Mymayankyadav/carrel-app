# QA/ORC — bounded crash-restartable legacy journal staging (#90)

Date: 2026-10-30 · Owner: QA/ORC · Branch: \`v2/qa-journal-crash-safe-staging\`

## Changes
- \`qaJournalStageLegacy\` stages a **copy only** of the active session's exact legacy queue, with a source-byte write-ahead marker and reserved journal ID.
- Acquires the same origin-wide Web Lock as journal append/delivery, revalidates source and identity, checks journal contents, verifies durable marker and journal copy. A crash after marker but before copy can resume; a crash after copy cannot create a second record.
- Never deletes/acks the legacy queue, changes production sync, sends network requests, or imports older/unscoped/other-account queues. An existing unrelated journal record fails closed.
- The staging copy remains **unsequenced** and is **not eligible for production ordered delivery**; subsequent integration must establish the handoff protocol and ordering.
- Bounded to 256 operations. Larger queues return \`batch-too-large\` without writes; chunked migration is a separate slice.
- Legacy writers **do not acquire this lock**. Source revalidation detects many concurrent changes but is not a linearizable freeze. Do not treat success as permission to switch authority.

## Tests
- \`web/test/qa_journal_legacy_staging_test.js\`: source retention, crash after marker, repeated restart, changed source, quota/read/corrupt marker, identity fencing, unrelated journal, no-lock/busy and >256 queue.
- Existing read-only preflight tests remain unchanged.
- CI evidence: pending; do not merge without green final-head checks.

## Gates
- #90 remains open: lock legacy producers, safe atomic authority switch, multi-batch migration, sign-out coordination, two-tab end-to-end acceptance.
- #52 physical-device privacy acceptance and #49 native QA remain open. L6 PR #44 stays draft.
