# QA — same-account realtime resubscription generation fencing

Owner: QA/ORC (frozen `web/core/sync.js`). Branch: `v2/qa-sync-resubscribe-generation`. Status: merged via [PR #76](https://github.com/Mymayankyadav/carrel-app/pull/76), squash commit `d8987971d8df2ca460d8488f22e7d91ba6feb088`; no physical-device acceptance claimed. L6 device gate remains separate.

## Failure mode

The existing adapter identity guard rejects callbacks from a previous *account*, but a reconnect or explicit resubscribe reuses the same adapter. Already-queued callbacks and error handlers from unsubscribed listeners could overwrite newer data, set the active connection read-only or schedule an extra retry. An old 5-second retry callback that had already entered the event queue could also tear down a newer subscription.

## Change

- Increment a subscription epoch before removing old listeners, and check the epoch and adapter on all snapshot and error callbacks (including additive v2 collections).
- Clear old retry timers on resubscribe. Bind each retry closure to the originating epoch and adapter so an already-queued timer is harmless.
- Deduplicate concurrent errors into one bounded 5-second reconnect timer.
- Add `web/test/sync_resubscribe_generation_test.js` with stale same-adapter snapshots, unsubscribe-time callback, stale permission error, concurrent retry errors, canceled timer, live reconnect and fresh callbacks.
- No new SQL, permissions, data destinations, Android changes, migrations or v1 feature removals.

## Evidence and gates

- [x] [Full web build, Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40816316274) passed on final head `f685f32` (including `SYNC RESUBSCRIBE GENERATION TESTS PASSED`).
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40816316430) and [two-tap navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40816316315) passed.
- [x] Reviewed four `v2-f1-shots` Today screenshots (390/1280, light/dark) from final-head CI; no new visual regression identified.
- [x] ORC squash merged `d898797` after required checks and screenshot review.

L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) remains draft until physical Android privacy checks [#52](https://github.com/Mymayankyadav/carrel-app/issues/52). Device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) remains open.
