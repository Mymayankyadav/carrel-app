# QA/ORC L4 — untrusted review metadata (2026-10-31)

Owner: independent QA/ORC L4 slice. Base main: `23566d74e0cd110820cf7541270bce59a6855b4b`.
Only `web/logic/spacing.js`, `web/test/qa_spacing_untrusted_metadata_test.js` and this status file are owned here. PR #169 owns parked-thought UI; issue #90 owns cross-tab outbox investigation. L6 #44 remains gated.

## Regression
A synced topic or exam date containing a JSON array such as `["2026-10-30"]` stringified to a valid date in `l4KeyValid`, but `.split()` then threw because the original value was not a string. Malformed JSON objects with shadowed `toString`/`valueOf` also caused `Number(...)` or `String(...)` to throw while rendering due topics or rating a review.

## Change
Require actual string date keys, convert only primitive string/number review metadata, and render invalid title/subject fields as empty/null rather than throwing. Preserve valid local dates, numeric-string intervals, existing spacing rules, and additive topic storage. Do not alter user documents or sync state.

## Verification
- New regression assertions in `qa_spacing_untrusted_metadata_test.js` cover array-shaped dates, uncoercible JSON metadata, malformed title/subject, and normal due ordering.
- Merged [PR #170](https://github.com/Mymayankyadav/carrel-app/pull/170) as [`10a0a05`](https://github.com/Mymayankyadav/carrel-app/commit/10a0a05ff484d3d718b76051298c92bdffd21e01).
- Fetched branch source and executed 9 focused V8 assertions successfully.
- Both full web/Node/v2 smoke workflows passed: [41159419523](https://github.com/Mymayankyadav/carrel-app/actions/runs/41159419523) and [41159428847](https://github.com/Mymayankyadav/carrel-app/actions/runs/41159428847). Browser acceptance [41159428815](https://github.com/Mymayankyadav/carrel-app/actions/runs/41159428815) and navigation [41159428845](https://github.com/Mymayankyadav/carrel-app/actions/runs/41159428845) also passed.
- Downloaded CI screenshot artifact `v2-f1-shots` from run 41159428847 and visually reviewed four L4 Subjects/Reviews views at 390/1280, light/dark. No new visual surface or malformed-data screenshot acceptance is claimed.
- No new files registered in the manifest, no native changes, new data recipients, secrets, or destructive migration.

## Boundaries
This is not a fix for #90's real simultaneous-tab lost-update race and does not authorize journal production cutover. PR #44 stays draft until physical-device Usage Access/privacy acceptance under #52/#49.
