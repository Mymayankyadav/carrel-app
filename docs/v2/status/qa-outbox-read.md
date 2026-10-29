# QA/ORC — fail-closed offline outbox reads

Date: 2026-10-29 · Owner: QA/ORC · Branch: `v2/qa-outbox-unreadable-read-guard`.

## Scope
- `web/core/sync.js` now uses checked localStorage reads when restoring, enqueuing or removing remotely acknowledged offline operations. JSON parse errors, blocked reads and valid JSON with the wrong shape are **unknown**, not empty.
- An unreadable startup queue fences subsequent writes until a fresh successful restore, even if storage becomes readable in the meantime. Existing bytes are left untouched. The normal UI uses the existing multi-tab conflict warning to avoid claiming the edit was saved.
- The existing in-memory mock adapter remains supported; production uses the real `store.getChecked` in `web/core/state.js`.
- No migration, production data operation, new recipient, Android permission or v1 removal.

## Verification
- `web/test/sync_outbox_checked_read_test.js`: blocked reads after enqueue, recovery, remote-ack cleanup, corrupt JSON, wrong-shape JSON, and startup read failures. Uses the actual checked storage adapter.
- Run web build, complete Node test suite and all v2 smoke scripts in PR CI. No new visual surface; existing conflict warning is reused.
- No physical Android verification claimed. L6 PR #44 remains draft, physical-device gate #52 and native QA #49 remain open.
- **Separate issue #90 remains open:** this change is not atomic across simultaneous tabs, does not eliminate duplicate remote delivery and does not claim server-side exactly-once semantics.

## Handoff
Implementation PR pending CI. ORC should inspect final-head checks and only merge when required gates are demonstrated.