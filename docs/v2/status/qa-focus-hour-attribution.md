# QA/ORC — L7 focus-hour attribution (2026-10-30)

Owner: QA/ORC, independent L7 correctness slice. Branch: `v2/qa-focus-hour-split-20261030`.

## Problem and implementation
- Insights > Focus grouped a rated session's **entire** duration under its starting clock hour. A session from 23:45 to 00:15 made 23:00 appear to have 30 minutes and 00:00 none.
- `l7FocusStats` now divides each session at local hour boundaries, accumulating duration-weighted focus scores per actual hour. Subject totals remain full-session totals. Non-finite timestamps are ignored.
- No data writes, new UI surfaces, permissions, Supabase changes, Android code, v1 feature removal, or migration activation.

## Tests and ownership
- `web/test/stats_pages_test.js` covers two rated overnight sessions, minute-weighted scores, subject totals and malformed timestamps.
- No change to frozen files, BOARD.md or DECISIONS.md while PR #123 owns their active #90 integration updates. ORC should reconcile a board/decision row when that work lands.
- L6 PR #44 remains draft until physical-device privacy acceptance in #52 and native QA #49.
- Run web build, Node suite, v2 smoke, browser acceptance and navigation CI before merge. No new visual surface; screenshots are not claimed.

## Next
Continue cross-tab journal receipt investigation in #90 separately. Do not enable production migration until lossless write and acknowledgement semantics are proven.
