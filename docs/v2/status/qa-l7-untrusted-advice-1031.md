# QA/ORC L7 — fail closed on malformed Insights telemetry (2026-10-31)

Owner: independent QA/ORC L7 regression slice, branch `v2/qa-l7-untrusted-telemetry-1031`. Based on `18bfbfae40468ef89a8639eb457cf1af907009be`. No active L7 PR; #169 owns parked-thought UI, #90 owns cross-tab synchronization and L6 #44 is gated by physical-device privacy acceptance.

## Defect and fix
Persisted JSON can contain arrays and objects with shadowed `toString`/`valueOf` fields. `Number(value)` and unary `+value` then throw a TypeError in Insights advice and flexible streaks. A corrupt `advice:<week>` dismissal object also crashes `new Set(value)`. Reject non-primitive telemetry before numeric coercion, require a primitive subject name for text advice, and treat malformed dismissal collections as empty. Preserve finite nonnegative numeric-string legacy values, valid suggestions and streak behavior.

## Verification
- New `web/test/qa_l7_untrusted_advice_test.js`: eleven regression assertions for poisoned JSON, array minutes, malformed dismissals, and legacy compatibility.
- Executed all 57 existing `web/test/advice_test.js` assertions and 11 targeted regression assertions in isolated V8 before committing; all passed.
- Exact-head [web build, full Node and v2 smoke CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/41163248292) passed on rerun; earlier attempts reproduced issue #90's independent two-tab lost-update race. [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41163248347) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41163248230) passed. ORC reviewed four L7 overview screenshots at 390/1280 in light/dark from rerun artifact `13029577003`. Squash-merged [#172](https://github.com/Mymayankyadav/carrel-app/pull/172) as [`c6053c6`](https://github.com/Mymayankyadav/carrel-app/commit/c6053c615633a494d6a41d171dac993ece6f2138).
- No new runtime files to register, no CSS or UI surface change, and no new native permissions, data recipients, secrets, Supabase changes or production migration.

## Boundaries
This change does not resolve issue #90's real simultaneous-tab lost-update race or authorize journal production cutover. L6 #44 remains draft until physical-device checks under #52 and #49.
