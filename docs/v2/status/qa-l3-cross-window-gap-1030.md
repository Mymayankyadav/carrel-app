# QA/ORC L3 — preserve study gaps across adjacent availability windows (2026-10-30)

Owner: independent L3 QA/ORC slice, branch `v2/qa-l3-cross-window-gap-1030`. Base `3969eed1893cc13f291417e60654fbdc293c2867`.

## Bug and fix
A user-configured 10-minute break could be silently reduced to 5 minutes when availability was split by a short commitment: 08:00–09:00 and 09:05–10:05 previously placed consecutive 60m/30m study blocks at 08:00 and 09:05. Similarly, a peak-first 10:00 block allowed an earlier 09:00–09:55 study block to finish only five minutes before it.

The scheduler now subtracts each placed block plus its configured gap from **all** free intervals, preserving useful >=25-minute fragments on either side. This preserves peak-first planning, sorted output, the 10% budget, 25-minute minimum and visible `unplaced` leftovers. No new persisted fields.

## Scope and evidence
- Changed only `web/logic/sched.js`, `web/test/sched_test.js` and this task-specific status file.
- Local V8: all 69 scheduler assertions passed with the modified module, including four new cross-window/peak-gap assertions.
- Local V8: 400 deterministic two-window gap scenarios checked; no consecutive block violated the configured break.
- Full GitHub web build/Node/v2 smoke, browser acceptance and navigation audit: **pending at PR creation**, not claimed.
- No UI/CSS or Android change; new screenshots not applicable. Existing screenshot acceptance still required by CI.
- No production data, offline outbox, Supabase, Android permissions, secrets or v1 feature changes.
- Issue #90 / PR #123 retains separate ownership of shared BOARD/DECISIONS and synchronization; those files are not modified here.
- L6 PR #44 remains draft pending physical-device acceptance #52/#49.

Merge only after final-head required CI checks and PR diff review.
