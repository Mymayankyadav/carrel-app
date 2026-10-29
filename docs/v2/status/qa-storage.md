# QA-storage — local persistence failure handling

Owner: QA/ORC · Branch: `v2/qa-storage-atomic-queue` · Status: merged

## Risk
`store.set()` previously swallowed quota, security and disabled-storage exceptions. `enqueue()` accepted optimistic writes and `commit()` displayed success even when `pending:<uid>` was not saved. Reloading while offline could lose those edits.

## Change
- Return a verified success/failure result from the device-local storage adapter, including read-back validation.
- Queue all writes of one `commit()`/Undo action together; only dispatch to Supabase after the complete account-scoped queue has been persisted. On failure, remove the attempted batch from memory without modifying existing durable pending writes.
- Display an accessible Today warning and explicit toast that the last action was **not saved**; clear the warning only after a later successful action.
- Keep account isolation: sign-out/account switch clears the previous account's transient warning.
- Add `web/test/sync_storage_failure_test.js` for quota, security, silent failures, multi-write atomicity, queue preservation and recovery.

No production data or schema changes, native permissions, new recipients, secrets, money or v1 feature removals. L6 PR #44 stays draft; physical Android privacy gate #52 and native QA #49 remain mandatory.

## Evidence
- [x] [Final-head web build, Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40834830740) passed on `8c2f7e1`, including `tools/v2_qa_storage_smoke.py`.
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40834830796) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40834830741) passed; reviewed four final-head 390/1280 light/dark storage-warning screenshots from artifact 12880501502.
- [x] ORC verified ownership, PR diff, final-head CI and screenshots; [PR #82](https://github.com/Mymayankyadav/carrel-app/pull/82) squash-merged as [`4c6f876`](https://github.com/Mymayankyadav/carrel-app/commit/4c6f876aef00d0c1f4629aac4f9b0f1e8db8a063).
