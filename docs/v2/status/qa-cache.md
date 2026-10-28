# QA — offline cache and realtime race fencing

Branch: `v2/qa-idb-realtime-fencing`. Status: in review. Scope: ORC-owned `web/supa.js` adapter hardening, a Node regression suite, and QA handoff. No schema changes, remote destinations, new permissions, native code or UI changes.

## Reproduced failure modes

- The IndexedDB debounced saver skipped empty snapshots, so deleting the last document left the previous nonempty snapshot on disk; it could reappear after reopening while offline.
- An older Supabase fetch or paginated collection refresh could finish after a realtime UPDATE/DELETE (or newer fetch), silently replacing a newer document or resurrecting a deleted one.
- A DELETE arriving before IndexedDB hydration could be undone by a delayed cached snapshot.
- Sign-out called `close()` and then asynchronous `clear()`; a newly opened adapter could hydrate from disk before the old account's deletion was queued.

## Fix

- Always persist empty snapshots, and serialize IndexedDB operations per account **across adapters**. Wait for transaction completion and close the IDB connection. Queue sign-out deletion synchronously before another adapter can hydrate.
- Preserve a path-level revision/tombstone while network reads are in flight. Stage collection pages and apply only if no later realtime event, write or fetch changed that path. Suppress stale fetch errors/emissions from superseded listener generations.
- Fence closed adapters' realtime callbacks, in-flight fetches, write echoes and authentication retries. Keep pre-hydration DELETE tombstones so disk snapshots cannot resurrect them.
- `web/test/supa_cache_test.js` covers out-of-order fetch/realtime UPDATE and DELETE, overlapping refreshes, last-document deletion persistence, pre-hydration DELETE immediate reauthentication after sign-out, and late JWT retry suppression after account teardown.

## Acceptance

- [ ] `node web/test/supa_cache_test.js` and existing `supa_test.js` / `account_switch_test.js` green in CI
- [ ] Full web build and Node suite green
- [ ] Browser acceptance, navigation and v2 smoke green
- [ ] No UI changes; existing 390/1280 light/dark visual matrix remains valid
- [ ] No real Android testing claimed; L6 PR #44 remains draft pending issue #52

No production documents were modified. This fix is strictly local cache and realtime sequencing.
