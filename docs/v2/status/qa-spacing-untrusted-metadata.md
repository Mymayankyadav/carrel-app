# QA/ORC — spaced-review metadata and calendar overflow guard (2026-10-30)

Owner: independent QA/ORC L4 regression; branch: `v2/qa-spacing-untrusted-metadata-guard`.

## Problem and fix
- `l4PlusDays` previously returned `NaN-NaN-NaN` for a finite but unrepresentably large offset, or a five-digit year after `9999-12-31`.
- `nextReview` could persist that invalid date when an existing topic had a corrupt/oversized interval; malformed `reps` could also be incremented to `NaN`. These fields can originate in older or external topic documents, so treat them as untrusted.
- Reject unrepresentable dates; default invalid intervals to one day, cap valid computed review gaps at 3650 days (ten years), and reset malformed/unsafe repetition counts to zero before incrementing. Preserve normal 1–3 ratings, exam adjustment, and existing topic fields.
- `l4ReviewTopic` already rejects a null `nextReview` result without writing; no new UI, data migration or permissions.

## Ownership and boundaries
- PR #123 currently owns #90 and edits `BOARD.md` / `DECISIONS.md`; this independent QA slice deliberately does not edit those shared ORC files. Finalize board/decision evidence only after coordinating their ownership.
- L6 PR #44 remains draft; issues #52 and #49 require physical-device acceptance and are unaffected.
- No existing production data is rewritten; no new recipient, Android permission, Supabase change, or offline synchronization cutover.

## Evidence
- Added `web/test/qa_spacing_untrusted_metadata_test.js` for large offsets, year overflow, malformed and unsafe counters, interval cap, and unchanged normal review behaviour.
- Locally executed the isolated new Node regression suite: passed.
- GitHub PR #129 head `1723ec8` passed [web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41007247598), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41007247693), and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41007247539) — all **success**. Squash-merged to `main` as [`0c89f1f`](https://github.com/Mymayankyadav/carrel-app/commit/0c89f1f074957819a18a84f0f452e8de0b40aac7) on 2026-10-30.
- No screenshot review is claimed; this is a pure-logic change without a UI surface.

## Next
- Preserve the passing QA evidence; the implementation is merged.
- Continue #90's immutable authoritative outbox and safe sign-out handoff independently.
