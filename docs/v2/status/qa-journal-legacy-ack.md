# QA/ORC — legacy acknowledgement lock prototype (#90)

Date: 2026-10-30 · Owner: QA/ORC · Branch: `v2/qa-legacy-writer-ack-guard`

## Scope
- Added `acknowledgePrefix(expectedRaw, acknowledgedOps)` to the isolated `qaLegacyLockedWriter` prototype. It takes the **same session-scoped exclusive Web Lock** as append and journal staging/delivery.
- Acknowledgements require a byte-exact durable source snapshot and an exact FIFO prefix. Stale tabs, mismatched prefixes, corrupt/unreadable storage, changed identity, staging markers and unavailable locks fail closed.
- Storage write or read-back uncertainty is surfaced explicitly. No automatic retry, no source deletion, and no server-side exactly-once claim.
- Added `web/test/qa_journal_legacy_ack_test.js` (partial/full acknowledgements, concurrent append, stale ack, marker, quota, identity and corruption) and expanded the real two-tab Playwright smoke.
- **Not production-wired**: `web/core/sync.js`, existing user outboxes, Supabase and v1 compatibility remain unchanged. Old tabs do not hold the lock; this prototype cannot authorize a cutover or guarantee against old-tab ABA races.

## Verification
- Final-head GitHub CI passed for build, Node suite, all v2 Playwright smoke, browser acceptance and navigation audit. No physical-device tests or production sync integration claimed.
- No new UI surface; screenshots not applicable.

## Remaining
- Issue #90: production legacy producer and ack ownership, old-tab compatibility, crash-safe authority promotion, sign-out fencing, end-to-end offline/reconnect acceptance.
- L6 PR #44 remains draft pending physical-device privacy gate #52 and native QA #49.

## Final-head merge evidence
- [PR #121](https://github.com/Mymayankyadav/carrel-app/pull/121) squash-merged as [`bc7474e`](https://github.com/Mymayankyadav/carrel-app/commit/bc7474e5385acffabe7dd774fd8e9810268e0f32).
- [Web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40984441389) — success. Logs explicitly include `QA LEGACY ACK LOCK TESTS PASSED`, `QA LEGACY LOCKED WRITER TESTS PASSED` and `QA LEGACY WRITER TWO-TAB SMOKE PASSED`.
- [Second final-head web CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/40984425520) — success.
- [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40984441333) — success.
- [Navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40984441343) — success.
- No physical-device testing or production sync cutover performed.
