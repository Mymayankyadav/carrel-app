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
- GitHub PR CI is required for Node tests, web build, v2 smoke, browser acceptance and navigation. No physical-device testing or production migration is claimed.

## Remaining
- Issue #90: design an authoritative immutable outbox and explicit receipt retirement, source migration, legacy-tab compatibility, sign-out and reconnect acceptance.
- L6 draft #44 remains gated by real-device privacy #52 and native QA #49.
