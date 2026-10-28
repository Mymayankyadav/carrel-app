# QA — account-switch and offline queue isolation

Branch: `v2/qa-account-switch-isolation`. Status: merged to `main` via [PR #60](https://github.com/Mymayankyadav/carrel-app/pull/60), squash commit `96180b422f1ab570937cc4b3f8d5e6b315d86e3c`. Scope: ORC/QA-owned sync/auth hardening; no schema, native code, new permissions or network destinations; one conditional Account recovery row is added.

## Failure mode

A `SIGNED_IN` event can switch users without `SIGNED_OUT`. Previously `openDb` called `teardownDb(false)`, which retained `S.base`, `S.loaded`, `S.pending`, `S.inflight` and pending retry timers. `pumpAll()` then risked replaying the previous account's queued writes through the newly authenticated Supabase client, while cached documents and open page parameters remained visible. The offline queue also used a single global `carrel.pending` localStorage key without ownership metadata.

## Fix

- Queue persistence uses `carrel.pending:<uid>` and is restored only after a verified account is known. Unowned legacy `carrel.pending` is quarantined until the user explicitly chooses **Account → Older unsaved edits → Restore here**. The confirmation warns that the old queue has no owner label. Declining preserves the old queue; successful import persists the current user's queue before removing the legacy key.
- Account changes archive the outgoing user's pending queue, reset the cached view, subscriptions, inflight bookkeeping, retries, Undo and account-specific navigation; returning to that account restores only its own pending queue. Initial URL-selected tab is preserved on first sign-in.
- Explicit sign-out discards only the signed-out account's queued work, consistent with the existing confirmation dialog.
- Late success or failure from an outgoing account's RPC is ignored by the new account's pump/connection state. Delayed auth-refresh and timezone initialization callbacks are also fenced to their originating adapter/UID.
- Node regression `web/test/account_switch_test.js` covers cross-account writes, cached data, stale auth errors and successes, timezone timer isolation, legacy quarantine, explicit opt-in recovery, cancellation, return to previous account and sign-out. `web/test/settings_pages_test.js` asserts the recovery row is conditional. `tools/v2_qa_account_smoke.py` captures the recovery row and confirmation dialog at 390/1280 px in light/dark.

## Acceptance

- [x] Full web build and Node suite, v2 smoke scripts, browser acceptance and two-tap navigation audit on final PR head `87fe9e61` (four green GitHub Actions runs)
- [x] Eight conditional Account recovery and confirmation screenshots reviewed at 390/1280 px, light/dark, with no overflow or visual defect
- [x] `tools/v2_qa_account_smoke.py` passed in CI and generated eight screenshots in the `v2-f1-shots` artifact
- [x] No native device acceptance claimed; L6 PR #44 remains draft until physical-device gate #52

No production documents were modified.

## CI links

- [Full web/Node/v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40762423074)
- [Web/Node/v2 smoke (PR)](https://github.com/Mymayankyadav/carrel-app/actions/runs/40762431124)
- [Redesign browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40762431156)
- [Two-tap navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40762431127)

L6 physical Android privacy/device acceptance is still unverified. No claim of device testing.
