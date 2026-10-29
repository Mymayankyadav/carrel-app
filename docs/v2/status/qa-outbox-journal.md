# QA/ORC — atomic per-operation outbox foundation (issue #90)

Date: 2026-10-29 · Owner: QA/ORC · Branch: `v2/qa-atomic-outbox-journal-foundation`.

## Scope
- Add `web/logic/outbox-journal.js`, a **pure, not-yet-integrated** storage helper with immutable account/session-scoped per-operation keys. Separate tabs append different keys instead of overwriting a shared JSON array.
- Fail closed on quota, read-back, key enumeration and malformed records; expose uncertain write outcomes for recovery; only remove an explicitly acknowledged operation's exact key. No existing v1 or v2 outbox data is migrated or modified.
- Add `web/test/qa_outbox_journal_test.js` covering overlapping independent-tab writes, reload/crash recovery, account/session isolation, stale acknowledgements, quota, permission errors and malformed records.
- This PR is **foundation only**: `web/core/sync.js` continues to use the existing queue until a follow-up ORC integration has robust migration, per-path FIFO, ownership/reconnect and sign-out discard behavior. No claim of atomic cross-tab network delivery or exactly-once Supabase writes.

## Remaining integration gates
1. Choose recovery/delivery ownership for abandoned journal entries; prevent two active tabs from pumping the same entry. Web Locks or a documented safe fallback are required.
2. Preserve the existing session-scoped queue and explicit legacy import without automatic replay of discarded sign-out data.
3. Extend sign-out and pending-clear recovery to scan journal keys and guard against writes during confirmation; add real two-context browser smoke and CI screenshots.
4. Only after those gates pass, register this module in `web/files.json` and switch `sync.js` behind a reviewed migration.

L6 physical-device privacy acceptance #52 and native QA #49 remain separate and unclaimed.
