# QA scheduler interval and deadline hardening

Branch: `v2/qa-scheduler-interval-safety`. Status: merged to main via [PR #58](https://github.com/Mymayankyadav/carrel-app/pull/58), squash commit `265652de4e5b425177df94ec933406299ad2057e`. Scope: post-L3 QA, no UI or database changes.

## Reproduced failure

Overlapping free windows [08:00,09:00] and [08:30,09:30] previously produced overlapping auto-plan blocks at 08:00 and 08:30 and double-counted free capacity. A non-finite `maxPerDay` (e.g. `Infinity` in imported or malformed deadline data) previously made `backwardPlan` enter an unbounded allocation loop. The date guard also accepted impossible calendar keys like 2026-02-31.

## Fix

- Merge overlapping or touching intervals, then apply the 25-minute minimum and 90% capacity budget to their union.
- Validate actual Gregorian dates, reject non-finite planning quantities and zero daily capacity, and cap the requested daily budget to the physical 24-hour limit.
- Preserve deterministic offline behavior, preview/Accept flow, and existing data format; no writes, migrations, new permissions or network destinations.

## Evidence and handoff

The existing scheduler test cases plus nine additional assertions passed in an isolated V8 JavaScript execution using the patched module. GitHub CI on the final PR head passed web build and full Node suite, all v2 smoke checks, Redesign acceptance, and two-tap navigation audit. The generated L3 preview/accepted screenshots were reviewed in phone (390px) and desktop (1280px), light and dark, with no observed visual regression. No new visual surface was introduced; existing L3 smoke screenshots are the visual acceptance evidence. No Android device validation is claimed or needed for this web-only pure-logic fix. L6 PR #44 remains draft until physical-device gate #52 is satisfied.
