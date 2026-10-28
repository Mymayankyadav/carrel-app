# QA — durable sign-out cache cleanup and recovery

Owner: QA/ORC. Branch: `v2/qa-signout-cache-recovery`. Status: PR acceptance pending.

## Failure mode

The Supabase adapter's `clear()` correctly reports whether IndexedDB deletion committed, but `teardownDb(true)` previously ignored the promise. A sign-out could therefore appear complete even if an aborted or blocked transaction left private offline documents on the device. Reloading the app erased any visible indication that local data remained.

## Changes

- `web/auth.js`: record a device-local `carrel.cacheClearPending` cleanup obligation **before** starting deletion; only remove it on confirmed transaction success. Failed and rejected clears remain pending across reloads. A version guard prevents an old completion from acknowledging a later sign-out for the same account.
- `web/ui/welcome.js` and `welcome.css`: signed-out users see an accessible, persistent cache warning with a 44px retry action; the in-progress state disables duplicate retries. No document content or user identifiers appear in the UI.
- `web/supa.js`: a disk-only `clearOnly` adapter can retry IndexedDB deletion without hydrating private data, requiring an authenticated Supabase client, or subscribing to realtime. Re-signing into an account with a pending cleanup skips the old disk snapshot while preserving IndexedDB for subsequent durable deletion.
- `web/test/signout_cache_clear_test.js`: sign-out failure, persisted warning, same-user stale hydration guard, no retry during active sign-in, repeated sign-out race, manual retry failure/success and account isolation.
- `web/test/supa_idb_fault_test.js`: disk-only cleanup with no Supabase session or hydration, and skip-hydration followed by durable deletion.

## Boundaries and acceptance

- [ ] Full web build and Node suite, v2 smoke, browser acceptance and navigation audit pass on final PR head.
- [ ] Signed-out warning layout reviewed at 390/1280 px in light and dark.
- [ ] ORC merge after CI and visual review.
- [x] No production data or schema, Android permissions, new network destinations or secrets changed.
- [x] L6 PR #44 stays draft pending physical Android Usage Access/privacy acceptance in issue #52; real-device QA issue #49 remains open.

If browser storage itself is disabled, the in-memory warning remains for the current page but cannot survive a reload. Retry is allowed only while signed out; the app does not silently delete the currently signed-in account's cache.
