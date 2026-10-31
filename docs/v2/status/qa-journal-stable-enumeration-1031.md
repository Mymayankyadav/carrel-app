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

## Verification
- GitHub CI is the required build, full Node suite and v2 smoke source of truth for this branch. Do not claim local Node/browser/screenshot passes: the connector runtime has no checked-out executable repository.
- No new UI surface; no screenshot change is expected. Check CI before merging.
