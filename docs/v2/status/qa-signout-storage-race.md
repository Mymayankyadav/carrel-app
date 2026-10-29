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
- Pending: final-head CI, browser acceptance, navigation and any required visual evidence. No physical Android device verification claimed; L6 #44 / #52 / #49 stay gated.
