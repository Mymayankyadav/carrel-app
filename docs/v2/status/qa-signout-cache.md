# QA — durable sign-out cache cleanup and recovery

Owner: QA/ORC. Branch: `v2/qa-signout-cache-recovery`. Status: merged to `main` via [PR #66](https://github.com/Mymayankyadav/carrel-app/pull/66), squash commit `f40620de1dc9221d49cd40ff7e0f53810dfd5630`.

## Failure mode

The Supabase adapter's `clear()` correctly reports whether IndexedDB deletion committed, but `teardownDb(true)` previously ignored the promise. A sign-out could therefore appear complete even if an aborted or blocked transaction left private offline documents on the device. Reloading the app erased any visible indication that local data remained.

## Changes

- `web/auth.js`: record a device-local `carrel.cacheClearPending` cleanup obligation **before** starting deletion; only remove it on confirmed transaction success. Failed and rejected clears remain pending across reloads. A version guard prevents an old completion from acknowledging a later sign-out for the same account.
- `web/ui/welcome.js` and `welcome.css`: signed-out users see an accessible, persistent cache warning grouped with sign-in and a 44px retry action; the in-progress state disables duplicate retries. No document content or user identifiers appear in the UI. `web/ui/shell.js` hides unavailable navigation while signed out.
- `web/supa.js`: a disk-only `clearOnly` adapter can retry IndexedDB deletion without hydrating private data, requiring an authenticated Supabase client, or subscribing to realtime. Re-signing into an account with a pending cleanup skips the old disk snapshot while preserving IndexedDB for subsequent durable deletion.
- `web/test/signout_cache_clear_test.js`: sign-out failure, persisted warning, same-user stale hydration guard, no retry during active sign-in, repeated sign-out race, manual retry failure/success and account isolation.
- `web/test/supa_idb_fault_test.js`: disk-only cleanup with no Supabase session or hydration, and skip-hydration followed by durable deletion.

## Boundaries and acceptance

- [x] Full web build and Node suite, v2 smoke, browser acceptance and navigation audit passed on final PR head `cce7f0ab`.
- [x] Signed-out warning layout reviewed at 390/1280 px in light and dark; first review caught a large vertical gap and unnecessary signed-out nav, both corrected before final review.
- [x] ORC squash merge after green CI and final screenshot review: `f40620de`.
- [x] No production data or schema, Android permissions, new network destinations or secrets changed.
- [x] L6 PR #44 stays draft pending physical Android Usage Access/privacy acceptance in issue #52; real-device QA issue #49 remains open.

If browser storage itself is disabled, the in-memory warning remains for the current page but cannot survive a reload. Retry is allowed only while signed out; the app does not silently delete the currently signed-in account's cache.

## Final verification (29 Oct 2026)

- [Web build, all Node suites and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40786978329) — success
- [PR web/Node/v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40786968782) — success; `v2-f1-shots` artifact inspected
- [Integrated browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40786978259) — success
- [Two-tap navigation reachability audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40786978265) — success

The signed-out warning was visually reviewed in four generated screenshots (390/1280 px, light/dark) and the Playwright smoke exercised successful retry and verified that the warning and local cleanup marker disappeared. No physical Android device was tested.
