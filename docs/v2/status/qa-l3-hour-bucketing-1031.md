# QA/ORC L3 — focus-hour evidence attribution (31 Oct 2026)

**Branch:** `v2/qa-l3-hour-bucketing-1031`  
**Owner:** independent QA/ORC L3 follow-up; no active L3 PR at claim time.  
**Scope:** `web/logic/sched.js`, `web/ui/plan-sheets.js`, `web/test/sched_test.js`. No frozen core files, database, Android or Supabase changes.

## Problem and fix
Previously, `l3HourStats()` attributed an entire completed session to the hour it started. A 09:30–11:30 study session therefore counted 120 minutes at 09:00 and none at 10:00 or 11:00, distorting the best-focus-hour estimate used by Auto-plan.

A pure `l3HourStatsFromEntries(entries)` helper now apportions each session by actual elapsed minutes in each **device-local clock hour**, weighting focus by overlap. This handles midnight boundaries and repeated daylight-saving hours without assuming 60 wall-clock minutes per displayed hour. Missing or invalid focus ratings contribute neutral focus 2; malformed/non-finite hour statistics cannot outrank valid evidence. Implausibly long (>24h) or invalid sessions are excluded **from peak-hour evidence only**, not from stored history or time logs, to bound processing.

## Verification
- Local isolated V8 execution of the complete scheduler test source: **76 assertions passed** (original plus seven new checks); this is not a full Node/build or browser run.
- GitHub CI web build, full Node tests, v2 smoke, browser acceptance and navigation audit: **pending PR checks** at initial handoff.
- No new UI surface, CSS, data collection or native API. No screenshot review claimed.
- Old user data and offline write paths unchanged; no production migration or permissions.

## Integration and gates
- PR #123 retains exclusive ownership of #90 offline outbox work, including shared BOARD/DECISIONS. This branch does not edit those files or `web/core/*`.
- L6 PR #44 remains draft until real-device privacy/Usage Access acceptance in #52/#49. This L3 change does not affect that gate.
- QA/ORC should inspect final CI and merge only when required checks pass; record the resulting commit and any browser evidence.
