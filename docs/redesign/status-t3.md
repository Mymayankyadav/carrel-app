# T3 — Today's Log and Entry/Split sheets

Branch: `redesign/t3-log`, stacked on P1 PR #19.

## Delivered
- `PAGES.log {k}` with date navigation and Add, summary of study and total time, newest-first log entries, and gap rows when >=5 minutes. Rows open Entry editing; gap rows prefill a new entry.
- `SHEETS.entry` for running, edit and add with a collapsed activity picker, start/end ±5 minute controls, date for add, duration, overlap/Trim, More for note and focus, and Save.
- `SHEETS.split` with a time nudge, second activity picker, and Save.
- Existing write contracts remain authoritative (`openEntrySheet`, `sheetTimes`, `saveEntrySheet`, `saveSplit`, `deleteEntrySheet`). The delete action marks the sheet armed and immediately invokes existing undoable deletion instead of requiring a second tap.
- Legacy `vLog`, `vTimeline`, `vList`, ribbons and breakdown left intact until T1 removes its calls. Do not remove these merely because the new page is available.

## Acceptance
- [x] New page/three entry modes/split registered; focused unit assertions.
- [x] Kit tokens and no unneeded explanatory paragraphs or Cancel buttons in new editors.
- [ ] Chromium 390px light/dark and 1280px screenshots/action tests.
- [ ] Physical Android keyboard/Back and sheet touch acceptance.

## Handoff
- **T1** from Today's studied total call `pushPage('log',{k:todayKey()})`.
- **Integrator** remove legacy vLog/Timeline/List/Breakdown and unused CSS only after no other references remain.
