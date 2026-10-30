# QA L9 — impossible yearless dates must not save undated tasks (2026-10-30)

Owner: independent QA/ORC L9 regression slice. Base: `43d09434e7bb61bff36f640bc76552470ead8588`.
Branch: `v2/qa-l9-invalid-yearless-date-20261030`.

## Finding
Quick Capture recognized phrases such as `31 feb`, `31/02`, and `31 apr` as date candidates, but when no valid calendar occurrence existed it silently left `date:null` and `invalidDate:false`. An ordinary task could then be saved without the intended due date, escaping the existing date guard.

## Fix
Mark a recognized, impossible yearless day/month as `invalidDate:true`. The existing accessible `Choose a valid date.` warning blocks task/deadline/block writes until the user explicitly selects a valid date. Valid yearless leap days still resolve to their next actual occurrence; Ask Claude remains unrestricted free text. No new storage fields, permissions, external recipients or production migration.

## Evidence and gates
- Parser regressions: invalid day/month in both numeric and named forms.
- VM capture write-path regressions: reject invalid yearless tasks before constructing any write; accept an explicit valid date override.
- Full web build/Node/v2 smoke, browser acceptance and navigation audit: **pending GitHub CI**.
- No UI surface changed; the pre-existing `role="alert"` date warning is reused, so no new screenshots claimed.
- PR #123 owns issue #90 and the shared BOARD/DECISIONS files. This PR does not modify them.
- L6 PR #44 stays draft until physical-device acceptance issues #52 and #49 are completed. No physical-device QA claimed.
