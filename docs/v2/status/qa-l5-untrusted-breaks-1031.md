# QA/ORC L5 — untrusted Flowtime duration safety (2026-10-31)

Owner: independent QA/ORC L5 regression slice. Branch `v2/qa-l5-untrusted-break-metadata-1031`, based on main `18bfbfae40468ef89a8639eb457cf1af907009be`. Open PR #169 owns Park UI, #172 owns L7 advice, #44 owns L6; no overlap with this L5 pure-logic slice.

## Defect and fix
`suggestBreak` and `l5BreakRemaining` coerced arbitrary persisted timer values with `Number(value)`. Synced JSON objects can shadow `toString` and `valueOf` and throw TypeError; arrays/booleans can masquerade as minutes. A finite but huge break target can also overflow the countdown to Infinity.

Only primitive finite numbers and nonblank numeric strings are now accepted. Invalid focus duration retains the existing safe 5-minute suggestion; invalid/overflowing countdown inputs return 0. Valid legacy numeric-string values and ordinary Flowtime recommendations remain compatible. No new collections, UI, permissions, data recipients or migrations.

## Evidence and gates
- Expanded `web/test/breaks_test.js` with poisoned objects, arrays, booleans, symbols, blank strings, legacy numeric strings and arithmetic overflow, in addition to existing Flowtime rules.
- Exact-head [web build, full Node and v2 smoke CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/41167638327), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41167638332) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41167638376) passed. ORC reviewed eight L5 Flowtime/break screenshots at 390/1280 in light/dark from artifact `13029587150`. Squash-merged [#173](https://github.com/Mymayankyadav/carrel-app/pull/173) as [`19ee777`](https://github.com/Mymayankyadav/carrel-app/commit/19ee777130b7215b53e5fc1fa5d064732366665f).
- Pure logic only; existing four-layout screenshot baseline suffices for visual regression review, but no new UI acceptance is claimed.

## Boundaries
- This does not change `web/core/sync.js` or resolve #90's genuine cross-tab lost-update race. Experimental journal remains non-production.
- L6 #44 remains draft pending physical Android Usage Access and privacy acceptance under #52 and #49.
