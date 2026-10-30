# QA/ORC — Quick Capture calendar write validation (2026-10-30)

Owner: QA/ORC, independent L9 regression. Branch: `v2/qa-capture-calendar-write-guard`.

## Scope
- Fix a write-time data integrity hole in `web/ui/capture.js`: a date matching `YYYY-MM-DD` but impossible on the calendar (e.g. `2026-02-31`) was accepted and could create an invisible `plans/<date>` document or invalid backlog/deadline due date.
- Validate calendar dates by UTC-noon ISO round-trip, including leap days, and reject malformed optional deadline clocks rather than persisting them.
- Reject an unexpected capture type instead of falling through to the Ask-Claude write path.
- Keep all valid capture types, existing Undo/offline queue semantics, v1 compatibility and user documents unchanged. No migration, new recipient, permissions, or production data edits.
- Regression test `web/test/qa_capture_calendar_write_guard_test.js` exercises write rejection (no `W()` or `commit()`) and valid leap-day block, deadline, task and Ask writes.

## Coordination
- The active issue #90 PR #123 owns the immutable receipt work and edits `docs/v2/BOARD.md` and `docs/v2/DECISIONS.md`. This independent L9 QA branch deliberately does not touch those shared files to avoid simultaneous ORC conflicts. Final ORC board/decision evidence should be recorded after #123 lands.
- L6 PR #44 remains a separate draft physical-device privacy gate; #52 and #49 are not satisfied by this work.

## Verification
- [ ] Node regression and full web test suite in GitHub CI
- [ ] v2 smoke, browser acceptance, navigation audit in GitHub CI
- [ ] Review CI results before merging; no screenshots claimed (existing error message only, no new UI surface)
