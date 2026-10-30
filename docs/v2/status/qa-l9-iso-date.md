# QA L9: explicit ISO capture dates (2026-10-30)

Owner: independent QA/ORC L9 correctness slice. Branch: `v2/qa-l9-iso-date-20261030`.
Base: `de7abaee9a37839dc3ea0d2a4bce032da2de6887`.

## Problem
Quick Capture's yearless numeric matcher could extract `11-12` from `2026-11-12`, interpreting it as December 11 rather than November 12, and leaving `2026` in the title. An impossible ISO date could similarly turn into a different valid date or an undated task.

## Change
- Give explicit `YYYY-MM-DD` priority over yearless dates, using the existing strict local-calendar validator.
- Invalid explicit dates never fall through to the `MM-DD` matcher; task, deadline and block saves fail with the existing accessible date error until the date is manually corrected.
- Keep free-text `Ask Claude` capture unchanged; a date-looking phrase in a question is not interpreted as a required deadline.
- Add parser and VM write-path regressions. Existing v1 records, data, sync, permissions and external recipients are untouched.

## Verification
- Local V8 execution of the changed parser: 11 ISO/yearless calendar cases passed.
- Local V8 execution of the changed capture save path: five invalid/valid/manual-override/Ask cases passed.
- [Web build, full Node suite and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41031541934): **success** on PR #135 final head `470d5a8`.
- [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41031542007): **success**.
- [Navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41031541927): **success**.
- [Implementation PR #135](https://github.com/Mymayankyadav/carrel-app/pull/135) squash-merged as [`9845ebd`](https://github.com/Mymayankyadav/carrel-app/commit/9845ebd06387f1096a3a9f41565a5fea785ac6fd).
- No new visual surface; existing inline `role="alert"` date error reused. No screenshot review claimed.

## Coordination
PR #123 owns the #90 offline receipt investigation and shared BOARD/DECISIONS files; neither is touched here. L6 #44 remains draft behind physical-device issues #52 and #49. No production migration or destructive action.
