# QA/ORC — fail-closed offline outbox reads

Date: 2026-10-29 · Owner: QA/ORC · Branch: `v2/qa-outbox-unreadable-read-guard`.

## Scope
- `web/core/sync.js` now uses checked localStorage reads when restoring, enqueuing or removing remotely acknowledged offline operations. JSON parse errors, blocked reads and valid JSON with the wrong shape are **unknown**, not empty.
- An unreadable startup queue fences subsequent writes until a fresh successful restore, even if storage becomes readable in the meantime. Existing bytes are left untouched. The normal UI uses the existing multi-tab conflict warning to avoid claiming the edit was saved.
- The existing in-memory mock adapter remains supported; production uses the real `store.getChecked` in `web/core/state.js`.
- No migration, production data operation, new recipient, Android permission or v1 removal.

## Verification
- `web/test/sync_outbox_checked_read_test.js`: blocked reads after enqueue, recovery, remote-ack cleanup, corrupt JSON, wrong-shape JSON, and startup read failures. Uses the actual checked storage adapter.
- Final-head `b0e933e` [web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40880845324), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40880845349), and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40880845305) all passed.
- The final-head v2 smoke artifact was downloaded and four existing multi-tab conflict-warning screenshots at 390/1280 in light/dark were visually reviewed: legible, no clipping; an existing transient toast briefly overlaps lower content. No new UI surface was introduced.
- No physical Android verification claimed. L6 PR #44 remains draft, physical-device gate #52 and native QA #49 remain open.
- **Separate issue #90 remains open:** this change is not atomic across simultaneous tabs, does not eliminate duplicate remote delivery and does not claim server-side exactly-once semantics.

## Handoff
ORC reviewed the five-file QA/ORC diff and squash-merged [PR #96](https://github.com/Mymayankyadav/carrel-app/pull/96) as [`1c4a4af`](https://github.com/Mymayankyadav/carrel-app/commit/1c4a4af56933bed08e8a9fa4ed066b85410e9ca8) after green final-head checks. Issue #90 remains open for truly atomic multi-tab outboxes; client delivery remains at least once. No Android release or physical-device acceptance was claimed.
