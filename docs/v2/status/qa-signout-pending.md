# QA/ORC — sign-out pending queue session fence

Date: 2026-10-29. Issue: #86. Branch: `v2/qa-signout-pending-session-fence`.
Ownership: ORC (frozen `web/auth.js`, `web/core/sync.js`), QA regression and smoke.

## Risk and implementation
An explicitly discarded offline outbox could survive failed `localStorage.removeItem` and replay after sign-in. The account queue is now stored under `pending:<uid>:<JWT session_id>`, rather than only `pending:<uid>`. A fresh Supabase sign-in uses a new session ID, so it never automatically replays a prior signed-out session's outbox, even if deletion failed. When a trustworthy session ID is unavailable, an ephemeral key fails closed on reload; the edits remain on disk for manual recovery. Legacy `pending:<uid>` and unscoped `pending` queues are quarantined for explicit account-level recovery instead of silently replaying after an upgrade.

Sign-out attempts both legacy and active-session deletion, records failed keys as a best-effort local cleanup obligation, shows an accessible signed-out warning, and offers Retry clearing. Other accounts' queues are untouched. This does not add a server, permission, or production data mutation.

## Verified on final implementation head `8a8960ea`
- [x] Node regression `signout_pending_fence_test.js` passed, including failed deletion, reload, account isolation and explicit recovery.
- [x] Full web build and all Node tests passed; all v2 smoke scripts passed, including `tools/v2_qa_signout_pending_smoke.py`.
- [x] Four warning screenshots (390/1280, light/dark) downloaded and visually reviewed: legible, no clipping or overlap, retry action visible.
- [x] [Web/Node/v2 smoke CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/40849254853) and [second web CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/40849262884) succeeded.
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40849262495) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40849262863) succeeded.
- [x] Empty/signed-out, failed cleanup, retry, legacy queue recovery, and account isolation covered; no new Android permission or native code.
- [ ] Merge only after documentation-only final-head CI reconfirms these checks.

## Caveats
The device can reject both the queue deletion and the cleanup-marker write. In that case a warning cannot be guaranteed to persist across a process restart, but the old outbox cannot be automatically replayed under a *new* session ID. The bytes may remain until storage recovers. Old account-scoped outboxes require explicit recovery after upgrade, protecting data rather than silently dropping it. Do not claim exactly-once server delivery or physical Android QA.

L6 PR #44 remains draft pending issue #52 physical-device Usage Access/privacy checks; native QA #49 remains open.
