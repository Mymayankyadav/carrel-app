# QA L3 — non-finite auto-plan input safety

Date: 2026-10-30. Branch: `v2/qa-l3-nonfinite-autoplan-1030`.

## Ownership and defect
Checked fresh `main` at `cdc1842`, active `docs/PLAN-v2.md` Parts B/D (especially D5/D14), `docs/v2/BOARD.md`, `docs/v2/DECISIONS.md`, `docs/v2/contracts.md`, L3 status, recent commits, open PRs and issues. L3 is merged and no active L3 PR owns these files. PR #123 independently owns #90 and shared BOARD/DECISIONS; L6 #44 is draft behind physical-device #52/#49.

`autoPlan` accepted `Infinity` as a positive task duration. A malformed high-priority item could consume the entire 90% availability budget, preventing a valid task from being proposed. Non-finite gaps could likewise exhaust remaining capacity after the first block.

## Implementation
- `web/logic/sched.js`: only finite positive durations may enter the planner; malformed-duration items remain in `unplaced` instead of silently consuming availability or disappearing. Non-finite gap input falls back to zero. Existing finite scheduling, 10% buffer and v1 persisted block shape are unchanged.
- `web/test/sched_test.js`: Infinity and NaN task regressions, zero-minute legacy compatibility, non-finite gap regression.
- No changes to frozen files, shared BOARD/DECISIONS, production synchronization, Android, Supabase, user documents or permissions.

## Verification
- Isolated V8 execution of the complete updated `web/test/sched_test.js` with the updated pure module: **passed** (2026-10-30). This is not a claim of the complete Node suite.
- [GitHub web build, full Node suite and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41054143504): **success** on final PR head `2da63b4`.
- [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41054143753) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41054143362): **success** on final PR head.
- No new UI surface; no new screenshots claimed. Existing preview and accessible unplaced count are retained.
- L6 real-device privacy/Usage Access acceptance is **not** satisfied by these tests.

## Merge and parity evidence
- [PR #141](https://github.com/Mymayankyadav/carrel-app/pull/141) squash-merged as [`22f1522`](https://github.com/Mymayankyadav/carrel-app/commit/22f1522a34bb5636fd4f7f683dc3c07c460eaec0) after all three required checks succeeded.
- Compared current-main and patched pure `autoPlan` outputs in **3,000 seeded randomized finite-input cases** in isolated V8; all outputs were identical. Invalid high-priority Infinity input previously consumed 54 minutes and displaced a valid task; now the valid task is placed and the invalid task remains visibly unplaced.
- Shared BOARD/DECISIONS remain reserved by #123; a reconciliation comment was posted there. No physical-device tests or screenshot review were claimed.
