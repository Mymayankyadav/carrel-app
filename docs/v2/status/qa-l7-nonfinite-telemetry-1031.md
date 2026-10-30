# QA/ORC L7: non-finite telemetry hardening (31 Oct 2026)

Owner: independent QA/ORC L7 slice. Branch: `v2/qa-l7-nonfinite-telemetry-1031`.

## Defect and change
Corrupt or missing duration/counter values could report an impossible goal percentage, show `Infinity` in advice, or award a study streak for `Infinity` minutes. Insights now accepts only finite nonnegative numeric evidence, preserves valid legacy numeric strings, tolerates malformed subject collections, and bounds the configured minimum day to 5–120 minutes (default 25).

## Scope and safety
Only `web/logic/advice.js`, `web/test/advice_test.js`, and this QA status file. No data writes, migration, Supabase, offline-sync, Android permissions or native changes. Existing valid numeric behavior is retained. No UI markup changes, so screenshot review is not claimed; CI browser acceptance remains required.

## Gates
- [x] Isolated pure-logic assertions executed before branch write (finite/infinite durations, thresholds, malformed subjects, legacy strings).
- [ ] GitHub web build, full Node tests and v2 smoke (await CI).
- [ ] GitHub browser acceptance and navigation audit (await CI).
- [ ] ORC merge review after green checks.

Shared BOARD/DECISIONS/contracts are frozen and currently touched by active issue #90 PR #123; no conflicting edits. L6 PR #44 remains draft pending physical-device privacy/Usage Access #52 and native QA #49. No physical-device result is claimed.
