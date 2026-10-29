# QA/ORC — sign-out storage-read and cross-tab consent fence

Date: 2026-10-29 · Owner: QA/ORC · Branch: `v2/qa-signout-storage-race`.

## Scope
- A missing local outbox and an unreadable/corrupt local outbox are different. `store.getChecked` reports storage errors without changing the existing forgiving `store.get` API.
- Sign-out asks for explicit consent when device storage cannot establish whether unsent edits exist.
- After the asynchronous discard confirmation, re-read the outbox and reject consent if another tab changed its contents, grew its queue, or storage became unreadable. If the queue emptied normally, allow sign-out.
- No server changes, data migration, additional recipients, Android permissions, or v1 feature removal.

## Evidence and limitations
- Node regression: `web/test/auth_signout_storage_race_test.js` covers unreadable/corrupt storage, approval/decline, appended/replaced edits, normal drain, new read failure, and identity switch.
- Existing `auth_signout_multitab_pending_test.js` remains in the suite.
- **Not an atomic multi-tab transaction:** another tab can still enqueue after the final read and before Supabase sign-out. Issue #90 remains open for per-tab durable queues or cross-tab coordination.
- Final implementation head `a11eeac4`: [web build, Node tests and all v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40871985599), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40871985493), and [navigation](https://github.com/Mymayankyadav/carrel-app/actions/runs/40871985716) passed. The [v2 smoke artifact](https://github.com/Mymayankyadav/carrel-app/actions/runs/40871976379) was downloaded; all four unreadable-storage confirmation screenshots (390/1280, light/dark) were visually inspected, with readable buttons and no clipping. [PR #94](https://github.com/Mymayankyadav/carrel-app/pull/94) squash-merged as [`45f7aa4`](https://github.com/Mymayankyadav/carrel-app/commit/45f7aa4b47c362f7f86d7da8f2f8122fc5d3d04a). No physical Android device verification claimed; L6 #44 / #52 / #49 stay gated.
