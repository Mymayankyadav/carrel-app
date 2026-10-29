# QA — historical range fetch vs realtime ordering

Owner: QA/ORC (frozen `web/core/sync.js`). Branch: `v2/qa-historical-range-realtime-fence`. Status: merged via [PR #78](https://github.com/Mymayankyadav/carrel-app/pull/78), squash `4c15a47c3c695cfcbfc8b0a094a6b6934903df39`; physical-device L6 gate is separate.

## Failure mode

`ensureRange()` used to merge every successful historical query directly into `S.base`, even after a newer live snapshot deleted or changed the same date. Concurrent overlapping historical requests could also finish out of order, restoring older values and deleted days/plans/distractions.

## Change

- Scope per-document revision fences and completed-range coverage to the account's `S.fetched` Set (a new account gets a new Set).
- Mark both present and removed live-snapshot rows as newer than historical reads already in flight.
- Merge historical results only when the date is outside the currently live-managed window and no newer live or overlapping range result owns that date.
- Treat missing documents in an authoritative historical query as deletions, with the same revision checks.
- Add `web/test/sync_historical_range_fence_test.js` for live-update/deletion after window changes, overlapping reads resolving in both orders, and deleted-row recovery.
- No migrations, new data recipients, production writes, native changes or v1 feature removal.

## Evidence and gates

- [x] [Full web build, Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40822186377) passed on final PR head `200c9a2` (including the new historical range test).
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40822186378) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40822186373) passed on the same head.
- [x] Reviewed four final-head `v2-f1-shots/l1/*-today.png` screenshots (390/1280, light/dark); no new visual regression identified.
- [x] ORC squash merged `4c15a47` after final-head checks and screenshot review.

L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) stays draft pending physical Android privacy acceptance [#52](https://github.com/Mymayankyadav/carrel-app/issues/52); device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) remains open. No physical-device verification claimed.
