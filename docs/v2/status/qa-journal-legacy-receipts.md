# QA/ORC — immutable receipts expose stale-view lost updates (#90)

Date: 2026-10-30 · Owner: QA/ORC · Branch: `v2/qa-legacy-immutable-receipt-audit`

## Scope
- Isolated `qaLegacyReceiptAudit` stores one immutable, session-scoped receipt **before** calling the existing experimental locked legacy writer. A receipt is not an authoritative production queue entry and is never sent or acknowledged by this helper.
- A read-only audit compares each receipt's uniquely tagged operations with the current legacy queue. Missing entries are reported, and the receipt is retained for explicit recovery. No auto-replay or auto-delete.
- Deterministic Node regression simulates two browser tabs with stale localStorage views. Both exclusive-lock appends report success, but the shared array retains only one operation. Both immutable receipts survive and the audit detects the missing action.
- Tests also cover coherent writes, multi-op batches, quota failure, collision, corrupt receipts and account isolation.

## Safety boundaries
- This module is **not registered** in `web/files.json`, not called from `web/core/sync.js`, and not activated for existing user data.
- The audit is diagnostic, not an atomicity guarantee. After a legitimate server acknowledgement, a receipt may appear missing until an explicitly designed acknowledgement/retirement protocol is introduced.
- This is evidence that Web Locks plus a shared localStorage array are insufficient if a tab observes a stale storage view. Production migration remains blocked until immutable records are the authority and ordered delivery/sign-out/legacy-tab semantics are proven.

## Verification
- [x] [Web build, full Node suite and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40989940209) passed on PR #123 head `6e1835d`.
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40989940224) passed on the same head.
- [x] [Navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40989940226) passed on the same head.
- [x] ORC reviewed the isolated diff and squash-merged [PR #123](https://github.com/Mymayankyadav/carrel-app/pull/123) as [`0824df4`](https://github.com/Mymayankyadav/carrel-app/commit/0824df453524f067c0fc6cd2c171f623a0b5af4a).
- No physical-device testing or production migration is claimed. These checks do **not** establish #90 production atomicity.

## Remaining
- Issue #90: design an authoritative immutable outbox and explicit receipt retirement, source migration, legacy-tab compatibility, sign-out and reconnect acceptance.
- L6 draft #44 remains gated by real-device privacy #52 and native QA #49.
