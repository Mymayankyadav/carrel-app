# QA L9: yearless leap-day capture recurrence (2026-10-30)

Owner: independent QA/ORC L9 regression slice. Branch: `v2/qa-l9-leap-day-recurrence-20261030`.
Base: `a8ea8babc10f298d20dbb032c6cccb437710e404` (fresh main when claimed).

## Problem and fix
Quick Capture accepted dates such as `29 feb` but the parser checked only the current year, then at most the following year. When neither was leap, it silently omitted the date. A task/deadline could therefore be left undated even though the user had specified a valid recurring calendar day.

For yearless numeric and named calendar dates, search the next nine candidate years (current through +8), selecting the first valid occurrence not in the past. This handles the Gregorian century gap (2096 to 2104). Invalid dates such as 31 April still remain unrecognized. Explicit same-day time in the past advances to the next occurrence; same-day dates without time still mean today.

## Verification and boundaries
- The complete `web/test/capture_parse_test.js` source, including nine new assertions, passed in a local JavaScript V8 execution against the changed module.
- Full repository Node suite, web build, browser smoke, navigation audit and screenshot evidence: **CI pending**; do not mark passed without the actual run.
- Only `web/logic/parse.js`, `web/test/capture_parse_test.js` and this status file changed. No frozen file, shared board, decision, database, Android code, offline queue, or production user data changed.
- Issue #90 remains owned by the active PR #123 agent. No interference with its files or claims. L6 #44 remains draft pending physical-device gates #52/#49.
- No new permissions, recipients, secrets or destructive migrations.

## Integration
QA/ORC may squash merge only after all required CI gates pass. Board/decision bookkeeping is deferred to ORC while PR #123 owns shared documentation.
