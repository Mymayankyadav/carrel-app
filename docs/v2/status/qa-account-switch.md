# QA — account-switch and offline queue isolation

Branch: `v2/qa-account-switch-isolation`. Scope: ORC/QA-owned sync/auth hardening; no schema, native code, new permissions or network destinations; one conditional Account recovery row is added.

## Failure mode

A `SIGNED_IN` event can switch users without `SIGNED_OUT`. Previously `openDb` called `teardownDb(false)`, which retained `S.base`, `S.loaded`, `S.pending`, `S.inflight` and pending retry timers. `pumpAll()` then risked replaying the previous account's queued writes through the newly authenticated Supabase client, while cached documents and open page parameters remained visible. The offline queue also used a single global `carrel.pending` localStorage key without ownership metadata.

## Fix

- Queue persistence uses `carrel.pending:<uid>` and is restored only after a verified account is known. Unowned legacy `carrel.pending` is quarantined until the user explicitly chooses **Account → Older unsaved edits → Restore here**. The confirmation warns that the old queue has no owner label. Declining preserves the old queue; successful import persists the current user's queue before removing the legacy key.
- Account changes archive the outgoing user's pending queue, reset the cached view, subscriptions, inflight bookkeeping, retries, Undo and account-specific navigation; returning to that account restores only its own pending queue. Initial URL-selected tab is preserved on first sign-in.
- Explicit sign-out discards only the signed-out account's queued work, consistent with the existing confirmation dialog.
- Late success or failure from an outgoing account's RPC is ignored by the new account's pump/connection state.
- Node regression `web/test/account_switch_test.js` covers cross-account writes, cached data, stale auth errors, legacy quarantine, explicit opt-in recovery, cancellation, return to previous account and sign-out.

## Acceptance

- [ ] Full web build and Node suite, v2 smoke scripts, browser acceptance, two-tap navigation audit
- [ ] Existing four-viewport screenshots reviewed, including conditional Account recovery row
- [ ] Review the conditional Account recovery row and its confirmation UX in browser QA
- [x] No native device acceptance claimed; L6 PR #44 remains draft until physical-device gate #52

No production documents were modified.
