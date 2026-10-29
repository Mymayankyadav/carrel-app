# QA — same-account realtime resubscription generation fencing

Owner: QA/ORC (frozen `web/core/sync.js`). Branch: `v2/qa-sync-resubscribe-generation`. Status: review, pending CI and visual acceptance. L6 device gate remains separate.

## Failure mode

The existing adapter identity guard rejects callbacks from a previous *account*, but a reconnect or explicit resubscribe reuses the same adapter. Already-queued callbacks and error handlers from unsubscribed listeners could overwrite newer data, set the active connection read-only or schedule an extra retry. An old 5-second retry callback that had already entered the event queue could also tear down a newer subscription.

## Change

- Increment a subscription epoch before removing old listeners, and check the epoch and adapter on all snapshot and error callbacks (including additive v2 collections).
- Clear old retry timers on resubscribe. Bind each retry closure to the originating epoch and adapter so an already-queued timer is harmless.
- Deduplicate concurrent errors into one bounded 5-second reconnect timer.
- Add `web/test/sync_resubscribe_generation_test.js` with stale same-adapter snapshots, unsubscribe-time callback, stale permission error, concurrent retry errors, canceled timer, live reconnect and fresh callbacks.
- No new SQL, permissions, data destinations, Android changes, migrations or v1 feature removals.

## Evidence and gates

- [ ] Full web build, Node tests and v2 smoke on final PR head.
- [ ] Browser acceptance and two-tap navigation audit.
- [ ] Review 390/1280 light/dark screenshots from CI.
- [ ] ORC merge only after required checks and visual acceptance.

L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) remains draft until physical Android privacy checks [#52](https://github.com/Mymayankyadav/carrel-app/issues/52). Device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) remains open.
