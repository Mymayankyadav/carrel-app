# QA/ORC — L10 durable coach actions (2026-10-31)

## Ownership and scope
- Independent QA/ORC follow-up to merged L10; no open L10 PR or overlapping owner at claim time. Branch: `v2/qa-l10-durable-coach-actions-1031`.
- `web/ui/coach.js`: accept-plan and dismiss previously closed the sheet before `commit()`. If the offline queue rejected a write (quota, inaccessible storage, stale tab), the message disappeared from view despite no durable action. Both now close only after `commit()` succeeds.
- `web/test/coach_test.js`: simulate failed offline enqueue for both actions, assert the same sheet remains open, then retry successfully. Plan plus coach acknowledgement remains a single `W()` write set; no new recipients or network calls.

## Safety
- No production data, Supabase, native permissions, authentication, offline queue or v1 format changed.
- Existing `commit()` handles the accessible error toast and renders the still-open sheet on failure. This change only guards UI dismissal; it does not claim to resolve cross-tab atomicity issue #90.
- L6 physical-device privacy gate #52 and native QA #49 remain independent and unsatisfied.

## Verification
- [x] Isolated V8 execution of the actual branch `coach.js` passed accept/dismiss failure and retry checks, including the two-op atomic plan/coach write set.
- [x] [PR #161 final-head web build, full Node suite and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41143506243) passed.
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41143506356) passed.
- [x] [V2 navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41143506288) passed.
- [x] Reviewed four existing Today screenshots (390/1280 px, light/dark) from the acceptance artifact. No coach-sheet visual changes were made; the new failure/retry behavior was checked in VM tests, not claimed as a visual acceptance test.
- [x] ORC inspected the three-file diff and squash-merged [PR #161](https://github.com/Mymayankyadav/carrel-app/pull/161) as [`0812053`](https://github.com/Mymayankyadav/carrel-app/commit/081205339111b33679fa707111925257ed0f561c).
