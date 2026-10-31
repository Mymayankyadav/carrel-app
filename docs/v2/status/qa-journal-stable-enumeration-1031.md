# QA/ORC — fail-closed journal enumeration under concurrent storage changes (#90)

Date: 2026-10-31 · Owner: QA/ORC (independent issue #90 prototype slice) · Branch: `v2/qa-journal-stable-enumeration-1031`

## Scope
- `web/logic/outbox-journal.js`: two complete localStorage key enumerations, duplicate-key detection, and a second byte-for-byte read of each immutable record before returning a journal snapshot.
- Concurrent insertion, deletion, shifting indices, duplicate keys, or changed record bytes observed during a scan now return an error rather than a partial apparently deliverable action set. Stable changes in enumeration order are accepted.
- `web/test/qa_outbox_journal_test.js`: deterministic regression for a new action inserted during first-pass reads, an immutable record replaced between reads, duplicate enumeration, and harmless key order variation.

## Safety and limits
- This is a **diagnostic/prototype** guard. It does **not** make localStorage enumeration transactional. An ABA race, an old tab outside Web Locks, or a mutation that occurs after the second pass still requires authoritative immutable journal ownership and the shared Web Lock.
- No changes to `web/core/sync.js`, `web/files.json`, live outbox, sign-out, Supabase, native code, production data or permissions. No journal authority cutover.
- #90 stays open. L6 #44 stays draft pending physical-device acceptance #52/#49.

## Verification and integration
- [x] [Web build, complete Node test suite and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41171777004) — success on exact PR head `1d88e68`. An independent [CI run](https://github.com/Mymayankyadav/carrel-app/actions/runs/41171768695) also passed.
- [x] [Browser redesign acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41171776930) — success.
- [x] [V2 navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41171776929) — success.
- [x] QA/ORC reviewed the implementation/test diff and squash-merged [PR #175](https://github.com/Mymayankyadav/carrel-app/pull/175) as [`95c78df`](https://github.com/Mymayankyadav/carrel-app/commit/95c78df38da99980c37968d401ef995c8f727bce).
- No local Node/browser execution or physical-device testing is claimed. No new UI surface was introduced; no new screenshots were generated.
- #90 remains open: this is an observable-race detection fence for a non-production journal, not an atomic cross-tab production outbox.
