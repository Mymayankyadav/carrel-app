# QA L7 — defer current-day streak freeze (30 Oct 2026)

Owner: independent QA/ORC L7 regression slice on `v2/qa-l7-unfinished-today-freeze-1030`. Base: `579af14df2ecacf95a2a6df575d677941bc58716`.

## Reproduction

With a completed Monday (40m) and an unfinished Tuesday (0m), `flexibleStreak(days,25,1,'2026-10-27')` previously returned a **2-day streak** and marked Tuesday as `freeze` before Tuesday ended. This both inflated the live streak and consumed the week's single freeze prematurely. The v2 plan D9 explicitly defines the streak as ending yesterday plus today **only if today already counts**.

## Fix

In `web/logic/advice.js`, an unfinished current day remains `miss` for the current calculation and is not allocated a freeze. Once the day rolls over, the existing first-miss-after-study rule can allocate the freeze normally. Today still joins the streak immediately if its actual study reaches the configured minimum. No persisted data or legacy fields are changed.

## Verification

- Added seven regression assertions in `web/test/advice_test.js` for unfinished Tuesday, midnight rollover, second missed day, completed today, and ISO-week Sunday/Monday boundaries.
- Verified the actual branch source and complete L7 test file in an isolated JavaScript V8 harness: **46 assertions passed**. This is **not** a local Node, full build, Playwright or physical-device run.
- GitHub CI and final-head integration evidence: pending at PR creation. No UI markup or CSS changes; no new screenshots claimed.

## Coordination and safety

The original L7 lane is merged and has no active PR. PR #123 separately owns issue #90, its offline synchronization files and shared BOARD/DECISIONS; those are untouched. L6 PR #44 remains draft pending real-device Usage Access/privacy acceptance under #52/#49. No production data, Supabase, Android permissions, offline queue or new recipients were changed.
