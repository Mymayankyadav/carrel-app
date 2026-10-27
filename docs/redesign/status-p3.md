# P3 — Tasks page and editors

Branch: `redesign/p3-tasks`, stacked on S1 PR #16.

## Delivered
- `PAGES.tasks` with Deadlines, Backlog and Weekly tabs, contextual Add, due countdown, Done section, subject and priority indicators, Plan all, and one-tap scheduling via the existing `findDayFor` and `scheduleTask` helpers.
- Reworked `SHEETS.deadline`, `SHEETS.task`, and `SHEETS.busy` to use the kit anatomy, preserving existing data structures and save/delete/complete actions. Added new weekly item creation and accessible day toggles.
- Preserved legacy `vDeadlineChips`, `vDeadlinesPanel`, `vBacklogPanel`, `vTimetablePanel` because Today/Plan still use them until T1/P1 replaces those surfaces.
- Reused stored `UI.sheet` fields, `W().update`, `scheduleTask`, `commit`, and plan blocks; no storage migrations.

## Acceptance
- [x] Three tabs and three corresponding editors implemented.
- [x] Kit tokens only; no hard-coded CSS colour, shadows or font families.
- [x] Existing save, mark-done, archive/delete and scheduling contracts preserved.
- [x] No explanatory paragraphs or old "Schedule it" copy in new sheets.
- [x] In-source unit tests for tab selection, contextual add, repeated days and scheduling.
- [x] 390px light/dark and desktop screenshot review.
- [ ] Native Android Back/keyboard validation.
- [ ] Exact scheduled clock in toast: current `scheduleTask` places auto-fit blocks without a fixed time; existing commit provides an undo toast but no guaranteed clock until Plan has fitted the block.

## Requests
- **P1** link the Plan toolbar's Tasks button to `pushPage('tasks')`. Keep these legacy panel helpers until the new Plan removes them.
- **Integrator** merge PR #12 through #16 before P3; keep `SHEETS.deadline/task/busy` identifiers intact. Validate one-tap scheduling on device.

## Follow-up QA and fixes (27 Oct 2026)
- Corrected Deadline icon mappings to use bundled `exam`, `due`, `other`; confirmed each name exists in `web/ui/icons.js`.
- Added compact deadline labels (Today, Tomorrow, in 3d), subject-colour tint for type icons, chevrons and high-priority accessibility text.
- Kept weekly day controls on one 44px-high row at 390px. Narrower mobile widths allow scrolling that chip row rather than causing document overflow.
- P3 latest web tests: [CI run #40540304698](https://github.com/Mymayankyadav/carrel-app/actions/runs/40540304698) — passed.
- Stacked mock Chromium QA: [run #40540473365](https://github.com/Mymayankyadav/carrel-app/actions/runs/40540473365) — passed; archived mobile/desktop light/dark screenshots. Scenarios: three tabs, open/close editors, deadline save/mark done, task save/one-click schedule, weekly save, Escape/Back, no settled-state overflow, and seven weekdays aligned at 390px.
- Browser QA harness remains isolated on `redesign/p3-visual-final` to preserve strict P3 file ownership; it is not part of PR #17. It uses mock state and no production credentials.
