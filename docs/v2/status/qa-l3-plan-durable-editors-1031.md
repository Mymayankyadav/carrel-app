# QA/ORC L3 — retain Plan editors on failed durable enqueue (2026-10-31)

Owner: independent L3 QA/ORC slice. Base `90a5efa4022bf5c12a484c4b1100fbc704776426`. Branch `v2/qa-l3-plan-durable-editors-1031`.

## Defect and fix
Plan's new block, one-time/weekly busy event, block edit/move/delete, auto-plan acceptance, and plan-end editor previously closed before `commit()` returned. A quota, storage-security, or cross-tab conflict could therefore discard unsaved inputs while the write was not queued.

A shared local Plan-sheet guard now waits for a successful durable `commit()` before closing; failures preserve the exact sheet and draft fields, render an accessible `role="alert"` message and allow retry. The last-used activity changes only after successful enqueue. Auto-plan retains its complete preview and backlog adjustment as one existing write set. No schema or behavior changes to successful writes.

## Verification and boundaries
- `web/test/plan_sheets_test.js` now exercises failure followed by success for new blocks, one-time and weekly busy events, existing block edits and moves, block deletion, auto-plan and plan end.
- Full Node/web/v2 smoke, browser acceptance and navigation CI: pending at PR creation; no green CI or screenshots claimed.
- Existing L6 PR #44 stays draft pending physical-device privacy acceptance #52/#49. Offline cross-tab atomicity issue #90 remains open; this patch only preserves drafts when a conflict is detected.
- No changes to production data, sync engine, Supabase, Android permissions, v1 functionality, frozen files, BOARD or DECISIONS. Reconcile shared docs only after ORC review/CI.

## Final-head verification and integration
- PR [#163](https://github.com/Mymayankyadav/carrel-app/pull/163) squash-merged as [`6563ea8`](https://github.com/Mymayankyadav/carrel-app/commit/6563ea8c2ad7b2d7f19c66d66647228833459495).
- Final PR head `bf9bcfe715ff2789e783a757d1fcc61b92cf4b59`: [web build, all JavaScript tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41148726366) **success**; [browser mock acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41148726404) **success**; [navigation reachability](https://github.com/Mymayankyadav/carrel-app/actions/runs/41148726390) **success**.
- Downloaded browser-acceptance screenshot artifact `redesign-acceptance`; visually reviewed Plan New and Block sheets in light/dark at 390px and 1280px (eight screenshots). Existing visual presentation remains intact; failure/retry is exercised by Node tests, not claimed as a browser screenshot.
- The independent cross-tab lost-update issue #90 remains open; successful CI does not prove its atomicity. L6 #44 still needs real-device acceptance #49/#52.
- No APK required; no native, SQL, Supabase or production data changes. Post-merge Pages deployment not yet asserted here.
