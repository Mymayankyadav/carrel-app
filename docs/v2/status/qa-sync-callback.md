# QA — cross-account subscription and historical fetch callback fencing

Owner: QA/ORC (frozen `web/core/sync.js`). Branch: `v2/qa-sync-callback-account-fence`. Status: merged via [PR #74](https://github.com/Mymayankyadav/carrel-app/pull/74), squash commit `df1d0f98452785d9587cf80d1490cad49d412e80`; no physical-device acceptance claimed.

## Failure mode

Closing an adapter and clearing `S.base` on account switch does not cancel already-queued `onSnapshot` callbacks or historical `ensureRange()` promises. The old account's callback could write its private `days`, `topics`, `planning`, `reviews` or other documents into the new account's view, while a stale error could downgrade its connection or schedule an unrelated resubscription. A late range-fetch failure could also delete the new account's matching `S.fetched` marker.

## Change

- Capture the adapter identity for every subscription and historical range fetch; ignore results and errors when it is no longer the active `S.db`.
- Capture the `S.fetched` set alongside `S.db`, so old successful/failing historical reads neither populate another account nor mutate its fetch deduplication state.
- Add `web/test/sync_account_callback_test.js` covering stale document/error callbacks, live callbacks on the new adapter, old range-fetch success/failure and new-account range completion.
- No new collection, SQL, third-party destination, permission, Android change, or destructive data migration.

## Evidence and acceptance

- [x] [Full web build, Node tests and v2 smoke CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/40811065808) passed on final head `94796aa` (including `SYNC ACCOUNT CALLBACK ISOLATION TESTS PASSED`).
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40811065370) and [two-tap navigation](https://github.com/Mymayankyadav/carrel-app/actions/runs/40811065338) passed.
- [x] Reviewed `v2-f1-shots` Today screenshots at 390px and 1280px in light and dark; no new visual regression.
- [x] ORC squash merged `df1d0f9` after final-head checks and screenshot review; board and handoff updated.

L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) remains draft pending physical Android Usage Access and privacy checks [#52](https://github.com/Mymayankyadav/carrel-app/issues/52); device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) is still open.
