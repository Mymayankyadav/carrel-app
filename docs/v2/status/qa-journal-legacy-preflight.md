# QA/ORC — legacy session queue migration preflight (#90)

Date: 2026-10-29 · Owner: QA/ORC · Branch: `v2/qa-journal-legacy-preflight`.

## Scope
- Add `web/logic/outbox-migration.js`: a **read-only** preflight for the exact current session's `carrel.pending:<uid>:<session>` storage key. This is not a migration executor.
- Validate every legacy operation and preserve FIFO, payload, `ensure`, and `cond`. Never skip corrupt operations or assume a failed read is an empty queue.
- Require an empty, readable journal for that session. Check the source twice to detect a changing queue, and expose a revalidation method that checks both source bytes and active identity.
- Never inspect or import unscoped `pending`, pre-session `pending:<uid>`, another UID, or a previous session without an explicit separate recovery flow.
- Add `web/test/qa_journal_legacy_preflight_test.js` for ordered same-path edits, malformed/unreadable storage, changed source, identity changes, existing journal data and no-mutation guarantees.

## Shipping boundary
- **No production wiring, no source deletion, no remote sends, no data migration.** The current shared queue remains authoritative.
- A read-only snapshot is not an exclusive transaction. A future integration must stop legacy producers, acquire a cross-tab handoff lock, persist a durable idempotent migration marker, verify all journal records, and only then switch authority. This helper must never be treated as authorization to delete source data.
- If the legacy queue exceeds a single journal batch, migration must preserve all entries and handle partial-copy crash recovery. No truncation or implicit opt-in.
- The Web Locks fallback remains fail-closed; client delivery remains at-least-once. Issue #90 stays open, and L6 physical-device acceptance #52 / native QA #49 are unaffected.

## Evidence
- [PR #107](https://github.com/Mymayankyadav/carrel-app/pull/107) squash-merged at [`ad3bcea`](https://github.com/Mymayankyadav/carrel-app/commit/ad3bcea11ee812d27394cf8374fa1b144be0b719).
- Final-head [web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40929323807) **passed**; the job log explicitly includes `QA JOURNAL LEGACY PREFLIGHT TESTS PASSED`. A second [final-head CI run](https://github.com/Mymayankyadav/carrel-app/actions/runs/40929310141) also passed.
- [Redesign browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40929323767) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40929323766) **passed**.
- An earlier intermediate-head [CI failure](https://github.com/Mymayankyadav/carrel-app/actions/runs/40929302709) exposed a test-fixture mistake (a nonempty journal masked the source-race assertion). The fixture was isolated in the final head; the failure was not ignored.
- No UI surface or screenshot changes; production `web/files.json` remains unchanged. No physical-device testing claimed.
