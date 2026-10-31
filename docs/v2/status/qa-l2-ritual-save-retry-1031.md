# QA/ORC — L2 ritual offline-save retry visibility

Date: 2026-10-31 · Owner: independent QA/ORC · Branch: `v2/qa-l2-ritual-save-retry-1031`

## Defect and fix
- Morning **Accept plan**, morning **Done** (intention), and shutdown **Shut down** already checked `commit()`, but a failed durable enqueue returned silently. The user saw no actionable error and could mistake an unpersisted step for a completed one.
- All three paths now retain the current sheet, selected work, intention text and shutdown dispositions, and display an inline `role="alert"` storage/retry message. Successful retries clear the message. No new storage or network behavior.
- The morning plan and ritual document remain separate pre-existing actions; this change does not claim atomicity across the entire three-step flow.
- Regression assertions simulate a failed commit followed by a successful retry at each persistence boundary.

## Verification
- Isolated V8 execution of the complete `web/test/rituals_test.js` with the actual branch `rituals.js`: **42 assertions passed**. This is a custom test harness, not a full Node suite.
- [Web build, complete Node/v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41154187982), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41154192424) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41154192425) **passed** on final PR head `e3aa414`.
- Visually reviewed **12** failure-state screenshots from [the CI artifact](https://github.com/Mymayankyadav/carrel-app/actions/runs/41154192435/artifacts/13024910197): three save-failure steps at 390/1280 px in light/dark; errors are visible, controls remain reachable and the selected inputs remain present.
- [PR #167](https://github.com/Mymayankyadav/carrel-app/pull/167) squash-merged as [`439eef5`](https://github.com/Mymayankyadav/carrel-app/commit/439eef5bff7974f5dc4cf4d7636bbfa436e2c7cf). A prior CI attempt failed because Playwright auto-invoked a returned function during the new smoke test; corrected before the final green run.
- No Android code or production data changed. No physical-device acceptance is claimed.

## Boundaries
- Issue #90's true simultaneous-tab offline outbox atomicity remains open; no changes to the synchronization engine.
- L6 draft #44 remains blocked by physical-device Usage Access/privacy checks #52 and native QA #49.
