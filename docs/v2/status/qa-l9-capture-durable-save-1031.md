# QA/ORC L9: retain Quick Capture drafts on failed offline saves

Date: 31 Oct 2026. Branch: `v2/qa-l9-capture-durable-save-1031`. Independent L9 QA/ORC slice.

## Defect
`l9CaptureSave()` dismissed the only editable Quick Capture sheet **before** calling `commit()`. When the device outbox was full, inaccessible, conflicted with another tab, or sign-in was no longer writable, `commit()` returned false and the unsaved text, selected date/time and type were lost from the editor.

## Change
- `web/ui/capture.js`: close only after `commit()` confirms durable enqueue; otherwise keep the sheet and all overrides, show a retryable `role="alert"` error through the existing sheet UI.
- `web/test/qa_l9_capture_durable_save_test.js`: VM regression covering failed saves and successful retry for task, deadline, scheduled block and Claude question, plus preservation of edited date/time/duration overrides.
- No new data recipients, migrations, storage formats, permissions, Android code or v1 feature removals. Existing write-set and undo behavior are unchanged.

## Verification
- [ ] GitHub web build, full Node suite and v2 smoke (await CI).
- [ ] Browser acceptance and navigation audit (await CI).
- [ ] ORC review and squash merge after required gates.
- No visual layout change; existing accessible error container is used. No new screenshots claimed.

## Ownership and boundaries
Shared `BOARD.md`/`DECISIONS.md`/`contracts.md` are ORC-frozen and not changed in this QA branch. #90's receipt audit was separately merged in #123 without activating production journal sync. L6 #44 remains draft until real-device privacy/Usage Access acceptance #52/#49.
