# QA L7 — missing actual duration must not distort estimate accuracy

Date: 2026-10-30. Branch: `v2/qa-l7-accuracy-missing-actual-1030`.

## Ownership and scope
Fresh `main` was `33a68c6105e9113dcedde2622647f6cf8b0e9200`. Read active PLAN-v2 Parts B/D, BOARD, DECISIONS, contracts, L7 status, open PRs/issues, recent commits and workflow. L7 is merged with no competing L7 PR. #123 owns offline issue #90 and shared BOARD/DECISIONS; #44 remains draft behind physical Android acceptance #52/#49. This QA slice touches only L7-owned pure logic/tests and this new status document.

## Bug and change
`l7Accuracy` previously coerced `null`, empty strings and booleans to numeric zero. Legacy/incomplete estimate rows with unknown actual duration therefore reduced reported accuracy (for example a missing actual plus one accurate 60-minute session displayed 50% rather than 100%). The function now counts only finite, present numeric minutes, retains numeric-string compatibility, accepts genuine numeric zero, and returns `null` when no valid completed samples exist. The Insights display already renders `null` as an em dash. No persisted documents are rewritten.

## Verification and gates
- `web/test/advice_test.js` adds regression assertions for missing, blank, boolean, explicit zero, numeric-string and non-array histories.
- Isolated Node execution of the exact patched `l7Accuracy` body: 10 representative cases passed (not the complete repository suite).
- [Final-head web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41069257638): **success**.
- [Final-head browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41069257647): **success**.
- [Final-head navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41069257573): **success**.
- [PR #145](https://github.com/Mymayankyadav/carrel-app/pull/145) squash-merged as [`090d81d`](https://github.com/Mymayankyadav/carrel-app/commit/090d81da4896baae14c580e2018c7f93ecff085a) after the required checks passed and the three-file diff was inspected.
- Pure-logic change only; no UI surface, screenshots or Android changes.
- No production synchronization migration, user data mutation, Supabase change, permissions or new recipients.
- Issue #90 cross-tab lost updates remain open; L6 #44 must not merge without physical-device privacy/Usage Access acceptance under #52/#49.
