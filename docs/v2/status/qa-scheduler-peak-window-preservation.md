# QA/ORC — preserve pre-peak scheduling capacity (2026-10-30)

Owner: QA/ORC, independent L3 scheduling correctness slice. Branch: `v2/qa-scheduler-peak-window-preservation`.

## Problem
The scheduler selected an energy-peak start inside a free window and then moved the window start past the new session, silently throwing away all free minutes *before* the peak. A hard 10:00 task could leave an 08:00–09:50 window unusable even when other subjects were waiting. The proposal was also returned in priority-allocation order, not clock order, which affected preview and persisted Plan ordering.

## Change
- Split a free window when a peak session begins after its start. Preserve only a usable >=25-minute prefix, ending before the peak by the configured gap.
- Keep the existing 90% total-time budget, gap after each scheduled block, 25-minute minimum and explicit preview/Accept flow.
- Sort returned blocks chronologically so the preview and persisted Plan order agree with their clock times.
- Extend the existing L3 Node tests with a 50-minute hard task at 10:00 and 140 minutes of ordinary work, asserting 08:00/10:00/11:00 placement, ten-minute separation, complete allocation and budget limits. Cover too-small prefixes.

## Coordination
PR #123 owns #90 immutable receipt diagnostics and edits BOARD.md/DECISIONS.md; this branch intentionally avoids both ORC-shared files. ORC should reconcile the QA board and decision record after #123 merges. L6 PR #44 and real-device gates #52/#49 remain separate and untouched.

## Safety
Pure deterministic scheduling logic and tests only. No new collections, production document rewrites, migration, secrets, permissions, Android changes or changes to the v1 timer. All plan writes still require explicit user acceptance.

## Verification
Pending GitHub PR CI: web build, all Node tests, all v2 smoke (including L3 screenshots), browser acceptance and navigation audit. No CI pass or screenshot review is claimed before the runs complete.
