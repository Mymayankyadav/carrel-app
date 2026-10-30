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
- GitHub CI and screenshots: pending at branch creation; record actual final-head results before merge.
