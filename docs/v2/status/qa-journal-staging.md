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
- Hardened `tools/v2_qa_journal_batch_smoke.py` to wait for real cross-tab localStorage visibility instead of assuming instantaneous propagation; the original assertion remains strict.
- Initial [CI run 40938702523](https://github.com/Mymayankyadav/carrel-app/actions/runs/40938702523): build and all Node tests passed, including new staging tests, but an existing two-tab batch smoke asserted before storage propagation; fixed with bounded visibility waits. Final-head [web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40938973194) passed, as did [second CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/40938962869), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40938973091), and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40938973228). Implementation [PR #109](https://github.com/Mymayankyadav/carrel-app/pull/109) squash-merged as [`e4a86e7`](https://github.com/Mymayankyadav/carrel-app/commit/e4a86e78314a6f33350c839630978161448f775d). No UI screenshot or physical-device claim.

## Gates
- #90 remains open: lock legacy producers, safe atomic authority switch, multi-batch migration, sign-out coordination, two-tab end-to-end acceptance.
- #52 physical-device privacy acceptance and #49 native QA remain open. L6 PR #44 stays draft.
