# QA L3 — bounded backward-planning allocation (2026-10-30)

Owner: QA/ORC independent L3 regression; branch `v2/qa-backward-plan-bounded-20261030`.

## Finding
`backwardPlan` previously materialized every day between today and an arbitrary valid deadline, including year 9999, and rescanned all selected days for every five-minute allocation. A far-future or high-capacity exam could freeze the planner or exhaust browser memory. This is a local computation, not a server or user-data migration.

## Fix
- Reject exam horizons beyond 3,660 days before allocating the date array; valid plans up to approximately ten years remain supported.
- Preserve the exact existing weighted greedy five-minute allocation (including tie order) with a priority heap, changing the worst-case distribution cost from quadratic to O(increments × log days).
- Keep 25-minute minimum sessions, per-day caps, deadline exclusion, date keys, and public return shape unchanged.
- Add exact ordinary-plan parity, far-future fail-closed, and long-horizon saturation regression tests.

## Validation and safety
- Isolated local Node prototype: 3,000 randomized small-horizon cases matched the original greedy algorithm; 3,660 days at 24 hours/day allocated in 384 ms in that isolated run. This is **not** a repository build or CI result.
- Repository CI, v2 smoke and navigation/browser acceptance: pending PR checks.
- No UI or CSS changed, so no new visual screenshots; existing L3 visual smoke remains in CI.
- No Supabase/Android changes, no user data rewritten, no v1 feature removal, and no changes to #90 offline outbox or L6 #44.
- Shared `BOARD.md` and `DECISIONS.md` remain with the active #123 ORC owner. Request a board/decision reconciliation after merging; do not collide with #123.
