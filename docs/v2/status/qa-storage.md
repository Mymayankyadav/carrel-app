# QA-storage — local persistence failure handling

Owner: QA/ORC · Branch: `v2/qa-storage-atomic-queue` · Status: review

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
- [ ] Full web build, Node tests and v2 smoke on PR head.
- [ ] Browser acceptance, navigation audit and four screenshots reviewed.
- [ ] ORC merge only after required gates pass.
