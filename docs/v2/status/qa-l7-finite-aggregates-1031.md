# QA/ORC L7: finite Insights aggregation (31 Oct 2026)

Owner: independent L7 QA slice. Branch: `v2/qa-l7-insights-finite-aggregates-1031`. Base: `ccd07cac` (after #154).

## Defect
Malformed or non-finite persisted study durations, subject goals, and drift totals could contaminate Insights charts, weekly goals, goal rings and fresh-start suggestions. Arrays could also be coerced into valid minutes. A malformed `Infinity` goal could incorrectly rank as the most important subject.

## Change
- `web/ui/stats.js`: validate numeric evidence, retain finite legacy numeric strings, and fail closed on malformed/negative/non-finite aggregates. Ignore overflowing additions rather than losing earlier valid totals.
- Apply the guard to day/week/subject summaries, goal ring, streak-day input, drift and fresh-start goal selection. No persisted values are modified.
- `web/test/stats_finite_aggregates_test.js`: isolated VM regression cases for corrupt values and valid legacy behavior.

## Verification and integration
- [x] Exact-head [web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41129591733), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41129591738), and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41129591853) succeeded.
- [x] ORC reviewed the code, isolated VM tests and four 390/1280 light/dark Insights screenshots from browser artifact 13012841404. These are mock-data visual regression screenshots, not evidence of corrupt production data.
- [x] [PR #155](https://github.com/Mymayankyadav/carrel-app/pull/155) squash-merged as [`ec5ed07`](https://github.com/Mymayankyadav/carrel-app/commit/ec5ed071a5d2adcf3fbc621b201c066bfd2c8f45); post-merge Pages, browser and navigation workflows also succeeded.
- [x] Pure UI data/logic hardening; no markup/layout or native changes. No production writes, migrations, Supabase changes, Android permissions, secrets or new recipients.

Shared BOARD/DECISIONS/contracts and issue #90 PR #123 remain owned separately. L6 #44 still requires physical Android acceptance under #52/#49; no device result is claimed.
