# QA — preserve failed offline writes

Owner: QA/ORC (frozen `web/core/sync.js`). Branch: `v2/qa-preserve-failed-offline-writes`. Status: merged via [PR #80](https://github.com/Mymayankyadav/carrel-app/pull/80), squash `197ed75fff2509797e90dd918e776221fa1a8631`.

## Failure mode

The write pump removed an offline edit after ten transient failures, and also discarded edits on validation, transformation or quota errors. The local optimistic view and persisted `pending:<uid>` queue lost those edits even though the remote server never confirmed them.

## Change

- Remove the ten-attempt discard path: retain account-scoped pending operations until a confirmed remote success or a deliberately superseded conditional write.
- Preserve failed validation/quota operations locally rather than deleting them; keep bounded exponential *delay* and a single warning on prolonged failures.
- Keep authorization errors in the queue while the connection is read-only; resume through the existing auth recovery.
- Add `web/test/sync_pending_retention_test.js` covering 12+ failed attempts, restart recovery, quota/validation errors, read-only recovery and per-path FIFO.
- No production SQL, remote data migration, new recipient, native change or v1 feature removal.

## Verification

- [x] [Final-head web build, Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40827907616), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40827907618) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40827907651) all passed on `03ec96b`.
- [x] Reviewed four final-head Today screenshots (390/1280, light/dark) from the CI `v2-f1-shots` artifact; no new visual regression found.
- [x] ORC verified main SHA, ownership/diff and open PRs; squash merged `197ed75` after all checks.

L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) remains draft pending physical-device Usage Access/privacy acceptance [#52](https://github.com/Mymayankyadav/carrel-app/issues/52); device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) remains open.
