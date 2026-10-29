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
- Local isolated test fixture: `QA JOURNAL LEGACY PREFLIGHT TESTS PASSED` (fixture journal used only to validate helper behavior). GitHub CI results to be recorded after the PR runs.
- No UI surface or screenshot changes; production `web/files.json` remains unchanged.
