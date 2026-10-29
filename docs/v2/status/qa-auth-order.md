# QA — deferred Supabase auth event ordering

Owner: QA/ORC (frozen `web/auth.js`). Branch: `v2/qa-auth-deferred-event-order`. Status: merged via [PR #72](https://github.com/Mymayankyadav/carrel-app/pull/72), squash commit `43e116a27b42a63e541f1ec60bb02911b4c95364`.

## Failure mode

Supabase auth events are received synchronously but processed with independent zero-delay timers. Rapid `SIGNED_IN` transitions could briefly open a superseded account and replay its pending offline writes before the final identity was processed. A bootstrap snapshot received before an explicit sign-in could likewise hydrate an outgoing identity before the newer sign-in. Merely skipping older sign-out callbacks would be unsafe because a real sign-out must delete the previous account's offline cache.

## Fix

- `web/auth.js`: buffer events and drain them once per deferred batch in receipt order, outside the Supabase callback. Ignore superseded sign-ins and metadata, and ignore bootstrap snapshots after explicit authentication. Always execute each `SIGNED_OUT` in order. When the signed-out UID was coalesced before opening, preserve the previously active account's pending queue and clear only the signed-out UID's offline queue and IndexedDB cache through a disk-only adapter. Never open or pump that coalesced account.
- `web/test/auth_event_isolation_test.js`: verify same-tick multiple sign-ins, stale refreshes, sign-out followed by sign-in, sign-in followed by sign-out, stale initial snapshot preceding a newer sign-in, and no transient adapter or queue replay.
- No new server, production document, migration, permission, native API, or v1 removal. The previous account's explicit sign-out semantics remain unchanged.

## Evidence and boundaries

- [x] [Full web/Node and v2 smoke CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/40805322611) green on final PR head `470700ec`.
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40805322662) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40805322619) green on final PR head.
- [x] Reviewed final-head CI `v2-f1-shots` Today screenshots at 390px/1280px in light and dark; no visual regression observed.
- [x] ORC squash merged `43e116a`; board and status updated in follow-up.

L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) remains draft until physical Android privacy acceptance [#52](https://github.com/Mymayankyadav/carrel-app/issues/52). Device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) remains open; no physical-device verification is claimed.
