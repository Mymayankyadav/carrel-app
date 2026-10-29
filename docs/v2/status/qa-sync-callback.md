# QA — cross-account subscription and historical fetch callback fencing

Owner: QA/ORC (frozen `web/core/sync.js`). Branch: `v2/qa-sync-callback-account-fence`. Status: in review; no merge or device acceptance claimed.

## Failure mode

Closing an adapter and clearing `S.base` on account switch does not cancel already-queued `onSnapshot` callbacks or historical `ensureRange()` promises. The old account's callback could write its private `days`, `topics`, `planning`, `reviews` or other documents into the new account's view, while a stale error could downgrade its connection or schedule an unrelated resubscription. A late range-fetch failure could also delete the new account's matching `S.fetched` marker.

## Change

- Capture the adapter identity for every subscription and historical range fetch; ignore results and errors when it is no longer the active `S.db`.
- Capture the `S.fetched` set alongside `S.db`, so old successful/failing historical reads neither populate another account nor mutate its fetch deduplication state.
- Add `web/test/sync_account_callback_test.js` covering stale document/error callbacks, live callbacks on the new adapter, old range-fetch success/failure and new-account range completion.
- No new collection, SQL, third-party destination, permission, Android change, or destructive data migration.

## Evidence and acceptance

- [ ] Full web build, Node tests and v2 smoke CI on final head.
- [ ] Browser acceptance and two-tap navigation CI on final head.
- [ ] Light/dark phone and desktop screenshots reviewed (no visual change expected).
- [ ] ORC squash merge after all checks; board and handoff updated.

L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) remains draft pending physical Android Usage Access and privacy checks [#52](https://github.com/Mymayankyadav/carrel-app/issues/52); device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) is still open.
