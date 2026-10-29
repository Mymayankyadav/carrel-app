# QA/ORC — stale multi-tab outbox overwrite fence

Date: 2026-10-29 · Branch: `v2/qa-multitab-outbox-conflict` · Ownership: QA/ORC (frozen `web/core/sync.js`, `web/core/state.js`, `web/auth.js`, `web/ui/shell.js`).

## Risk and implementation
Two Carrel tabs sharing the same Supabase session can hold different in-memory copies of the same `pending:<uid>:<session>` localStorage queue. A later write or remote-ack cleanup from a stale tab could replace the newer tab's durable unsent edits. This change records the last observed outbox snapshot, refuses stale writes and deletions, and surfaces a persistent accessible warning telling the user to close other tabs and reload. It also rejects writes to an outbox flagged for failed sign-out deletion. No user data is intentionally deleted or migrated.

## Evidence / gate
- [ ] Build and all Node tests on final PR head.
- [ ] New `sync_multitab_outbox_conflict_test.js` regression green.
- [ ] All v2 smoke checks, including `v2_qa_multitab_outbox_smoke.py`, green.
- [ ] Browser acceptance, navigation audit, 390/1280 light/dark screenshots reviewed.
- [ ] ORC merge review and CI gates complete.

## Limitations
This is an optimistic conflict detector, not an atomic cross-tab transaction. Simultaneous writes that race between read and write can still overwrite one another, and a second tab can replay an operation already in the first tab's queue. A full solution needs per-tab outboxes or browser locking plus server-side idempotency. Never claim exactly-once delivery. L6 PR #44 remains draft; issues #49/#52 require real Android device QA.
