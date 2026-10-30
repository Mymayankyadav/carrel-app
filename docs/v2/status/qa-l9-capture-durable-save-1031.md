# QA/ORC L9: retain Quick Capture drafts on failed offline saves

Date: 31 Oct 2026. Branch: `v2/qa-l9-capture-durable-save-1031`. Independent L9 QA/ORC slice.

## Defect
`l9CaptureSave()` dismissed the only editable Quick Capture sheet **before** calling `commit()`. When the device outbox was full, inaccessible, conflicted with another tab, or sign-in was no longer writable, `commit()` returned false and the unsaved text, selected date/time and type were lost from the editor.

## Change
- `web/ui/capture.js`: close only after `commit()` confirms durable enqueue; otherwise keep the sheet and all overrides, show a retryable `role="alert"` error through the existing sheet UI.
- `web/test/qa_l9_capture_durable_save_test.js`: VM regression covering failed saves and successful retry for task, deadline, scheduled block and Claude question, plus preservation of edited date/time/duration overrides.
- No new data recipients, migrations, storage formats, permissions, Android code or v1 feature removals. Existing write-set and undo behavior are unchanged.

## Verification
- [x] [Web build, full Node suite and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41137003346) passed on PR #158 head `b8bcec2`; [second web run](https://github.com/Mymayankyadav/carrel-app/actions/runs/41136982130) passed on rerun.
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41137003526) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41137003453) passed on the same head.
- [x] ORC reviewed the 3-file diff and squash-merged [PR #158](https://github.com/Mymayankyadav/carrel-app/pull/158) as [`ae0ad44`](https://github.com/Mymayankyadav/carrel-app/commit/ae0ad443c541ded2d6ebc92d0c14e4e7f3b1b81f).
- [x] [Post-merge GitHub Pages deployment](https://github.com/Mymayankyadav/carrel-app/actions/runs/41137541063) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41137541016) succeeded.
- [!] The first web run reproduced **unrelated, still-open #90** in `tools/v2_qa_legacy_writer_smoke.py`: expected `[2,2]`, observed `[1,1]`. Its retry passed, but that does **not** prove cross-tab atomicity. Evidence was posted on [issue #90](https://github.com/Mymayankyadav/carrel-app/issues/90#issuecomment-6534694577).
- No visual layout change; existing accessible error container is used. No new screenshots claimed.

## Ownership and boundaries
Shared `BOARD.md`/`DECISIONS.md`/`contracts.md` are ORC-frozen and not changed in this QA branch. #90's receipt audit was separately merged in #123 without activating production journal sync. L6 #44 remains draft until real-device privacy/Usage Access acceptance #52/#49.
