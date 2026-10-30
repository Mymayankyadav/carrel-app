# QA/ORC L4: retain topic drafts on durable-write failure (31 Oct 2026)

Owner: independent QA/ORC L4 storage-safety slice. Branch: `v2/qa-l4-topic-durable-write-1031`. Based on fresh `main` `ccd07cac`.

## Defect
L4 topic Save and Archive dismissed the sheet before `commit()` had durably queued the write. When storage was full, inaccessible, or another tab changed the outbox, the operation returned false but the user's only typed draft was discarded from the UI. Review ratings also returned success despite a failed commit.

## Change
- Only close topic Save/Archive sheets **after** a successful `commit()`; retain the typed form and show an accessible `role="alert"` error on failure.
- Propagate failed review commits as false so the review action cannot claim success.
- Fail closed if a topic disappeared or was archived while its editor was open, or its study subject became archived; do not accidentally create a replacement.
- Add VM regression coverage and extend the existing four-viewport L4 smoke with a forced offline-queue failure, draft retention, screenshot, and successful retry.

## Safety / coordination
No data migration, new recipient, Supabase or native permission change. All writes still use `W()` and `commit()`, preserving Undo and v1 compatibility. No frozen file, BOARD or DECISIONS edit: #90 PR #123 owns those shared docs. L7 PR #155 is independently merged; L6 draft PR #44 still owns its native files. Physical-device gates #52/#49 remain open.

## Verification and merge
- [x] Preflight JavaScript evaluation of patched L4 source and failed-save preservation.
- [x] Exact-head PR #156 [web build, all Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41130493125), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41130493319), and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41130493300) all succeeded.
- [x] Downloaded browser artifact 13012803103 and visually reviewed four failed-save screenshots (390/1280 light/dark). The typed draft and Save action remain visible, error alert is readable, and browser smoke successfully retries the save.
- [x] ORC reviewed the code and test patches; [PR #156](https://github.com/Mymayankyadav/carrel-app/pull/156) squash-merged as [`3159c3b`](https://github.com/Mymayankyadav/carrel-app/commit/3159c3be20db1ad920de50b2403dbf0c13e356ee).
- [ ] Post-merge GitHub Pages/browser/navigation checks were still running at this status update; no success is claimed.
