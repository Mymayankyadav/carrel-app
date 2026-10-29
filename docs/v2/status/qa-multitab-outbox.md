# QA/ORC — stale multi-tab outbox overwrite fence

Date: 2026-10-29 · Branch: `v2/qa-multitab-outbox-conflict` · Ownership: QA/ORC (frozen `web/core/sync.js`, `web/core/state.js`, `web/auth.js`, `web/ui/shell.js`).

## Risk and implementation
Two Carrel tabs sharing the same Supabase session can hold different in-memory copies of the same `pending:<uid>:<session>` localStorage queue. A later write or remote-ack cleanup from a stale tab could replace the newer tab's durable unsent edits. This change records the last observed outbox snapshot, refuses stale writes and deletions, and surfaces a persistent accessible warning telling the user to close other tabs and reload. It also rejects writes to an outbox flagged for failed sign-out deletion. No user data is intentionally deleted or migrated.

## Evidence / gate
- [x] Web build and all Node tests passed on implementation head `2dde089e` ([CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/40855291747)).
- [x] `sync_multitab_outbox_conflict_test.js` passed as part of Node suite.
- [x] All v2 smoke checks, including `v2_qa_multitab_outbox_smoke.py`, passed in CI.
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40855291545) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40855291540) passed. Four 390/1280 light/dark screenshots from artifact `12888433946` inspected: persistent warning legible, no clipping; transient toast overlaps content briefly as in existing design.
- [x] ORC reviewed owned-file diff and merged [PR #89](https://github.com/Mymayankyadav/carrel-app/pull/89) at [`9e40c68`](https://github.com/Mymayankyadav/carrel-app/commit/9e40c68b094c5bdd832599a48544055e5ba311ab) after green final-head [web/Node/v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40855652566), [browser](https://github.com/Mymayankyadav/carrel-app/actions/runs/40855652665) and [navigation](https://github.com/Mymayankyadav/carrel-app/actions/runs/40855652677) checks. Atomic simultaneous-write follow-up: [#90](https://github.com/Mymayankyadav/carrel-app/issues/90).

## Limitations
This is an optimistic conflict detector, not an atomic cross-tab transaction. Simultaneous writes that race between read and write can still overwrite one another, and a second tab can replay an operation already in the first tab's queue. A full solution needs per-tab outboxes or browser locking plus server-side idempotency. Never claim exactly-once delivery. L6 PR #44 remains draft; issues #49/#52 require real Android device QA.
