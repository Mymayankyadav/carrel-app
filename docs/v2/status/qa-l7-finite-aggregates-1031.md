# QA/ORC L7: finite Insights aggregation (31 Oct 2026)

Owner: independent L7 QA slice. Branch: `v2/qa-l7-insights-finite-aggregates-1031`. Base: `ccd07cac` (after #154).

## Defect
Malformed or non-finite persisted study durations, subject goals, and drift totals could contaminate Insights charts, weekly goals, goal rings and fresh-start suggestions. Arrays could also be coerced into valid minutes. A malformed `Infinity` goal could incorrectly rank as the most important subject.

## Change
- `web/ui/stats.js`: validate numeric evidence, retain finite legacy numeric strings, and fail closed on malformed/negative/non-finite aggregates. Ignore overflowing additions rather than losing earlier valid totals.
- Apply the guard to day/week/subject summaries, goal ring, streak-day input, drift and fresh-start goal selection. No persisted values are modified.
- `web/test/stats_finite_aggregates_test.js`: isolated VM regression cases for corrupt values and valid legacy behavior.

## Verification and integration
- [ ] Full GitHub CI web build, Node suite and v2 smoke.
- [ ] Browser acceptance and navigation audit.
- [ ] ORC review and merge after checks.
- [x] Pure UI data/logic hardening; no markup/layout or native changes; new screenshot review not claimed.
- [x] No production writes, migrations, Supabase changes, Android permissions, secrets or new recipients.

Shared BOARD/DECISIONS/contracts and issue #90 PR #123 remain owned separately. L6 #44 still requires physical Android acceptance under #52/#49; no device result is claimed.
