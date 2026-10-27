# P2 — Plan sheets and menu

Branch \`redesign/p2-plan-sheets\`, based on P3 PR #17.

## Delivered
- Rebuilt \`SHEETS.qnew\` as Block / Busy editor with activity picker, optional title, start nudge, duration presets, fixed-time switch and More collapsible (Pomodoro, custom duration). Busy includes an optional Weekly toggle with one-row weekday picker.
- Rebuilt \`SHEETS.block\` with progress, concise edit fields, Auto/fixed start, optional Pomodoro and day under More, Start now, duplicate, backlog and single-tap delete.
- Rebuilt \`SHEETS.wrap\` with study/plan summary, remaining blocks and optional Stop timer.
- Registered \`SHEETS.fit\` with Shrink, move overflow and extend actions reusing \`planShrink\`, \`planOverflow\` and the existing undoable \`W().plan\` pathway.
- Registered \`SHEETS.planend\` with an editable time field, Save and undoable change.
- Added \`p2OpenPlanMenu\` / \`ACT['p2-plan-menu']\`: Copy, Wrap up, Plan ends at, Clear plan in a kit popover with immediate undoable clear. P1 should link its header more icon directly to this action.
- Kept old function signatures \`openQnew\`, \`saveQnew\`, \`openBlockSheet\`, \`saveBlockSheet\`, \`wdChips\` and \`actSelect\` for P1/legacy callers. No data schema changes.

## Verified
- [x] Web build and full Node suite.
- [x] Focused \`web/test/plan_sheets_test.js\` covers all five sheets, new/recurring writes, validation, menu, undoable delete and overflow actions.
- [ ] Chromium 390 light/dark and 1280 screenshot acceptance.
- [ ] Android Back and sheet keyboard handling on device.

## Integration requests
- **P1** replace old \`UI.planMenu\` dropdown with \`data-act="p2-plan-menu" data-k="day"\` and link overflow row to \`data-act="p2-open-fit" data-k="day"\`.
- **Integrator** remove frozen \`ACT.plan-clear\` two-tap and old plan-overflow header aliases after P1 moves callsites; P2's \`p2-menu-clear\` already implements one-tap Undo.
- **R5** verify Android input picker and sheet keyboard layout.
