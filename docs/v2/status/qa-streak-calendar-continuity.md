# QA/ORC — Insights streak calendar continuity (2026-10-30)

Owner: QA/ORC, independent L7 regression. Branch: `v2/qa-streak-calendar-continuity`.

## Problem and change
- The flexible streak algorithm counted consecutive **array entries**, not consecutive calendar dates. If a device had sparse offline/history data, a gap of one or more real days could falsely preserve a streak.
- It also ignored the newest failed day without knowing whether that date was **today**. A history last updated days ago could report a live streak.
- Validate Gregorian calendar keys (including leap days), ignore impossible/future dates, and require adjacent UTC calendar days in the streak count. Only today's unfinished day gets the original grace; yesterday's successful study remains eligible.
- Both Insights summary and Streak detail now supply `todayKey()` explicitly. Legacy three-argument pure-function calls remain supported.
- No Supabase, Android, production data, storage, migration, permissions, secrets or v1 features changed.

## Coordination and ownership
- PR #123 owns issue #90's immutable receipts and simultaneously edits BOARD.md/DECISIONS.md. This independent L7 QA branch avoids those ORC-shared files to prevent conflicting ownership; final board/decision updates should be handled by ORC after #123 merges.
- L6 #44 stays draft pending physical-device acceptance #52 and #49.

## Tests and evidence
- `web/test/advice_test.js` covers missing days, current-day grace, stale histories, future/invalid dates, leap years, and week boundaries.
- Verified on implementation head `650b44a`: [web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40996497336), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40996497350), [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40996497337) — all **success**. Push web CI [40996492312](https://github.com/Mymayankyadav/carrel-app/actions/runs/40996492312) also passed. Earlier test-only failures (unescaped apostrophe, incorrect weekly-freeze expectation) were corrected before these final implementation-head runs.
- No new UI surface or visual changes; screenshots are not claimed.

## Next
- Review the final diff and merge only after the documentation-head checks remain green and ownership is still clear.
- Continue issue #90 separately, without enabling the experimental journal or weakening physical-device release gates.
