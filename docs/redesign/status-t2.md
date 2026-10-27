# T2 — Today sheets and focus mode

Branch: `redesign/t2-today-sheets`. Stacked on T3 PR #20 (`redesign/t3-log`), which itself is stacked on P1 PR #19.

## Resumed work and implementation

The interrupted branch already contained the five new sheet registrations and focus view. The continuation keeps those existing implementations instead of rewriting them:

- `SHEETS.start`: start offsets (Now / 5 / 15 / 30 minutes ago / After last within 12h), Pomodoro switch and three presets, using `startActivity(id, { at, pomoPreset })` or `pomoRaw:null`.
- `SHEETS.activities`: unarchived Study and Other activity rows, active state, long-press Start options, today's logged duration or Now, edit shortcut to `settings.activities`.
- `SHEETS.park`: escaped 140-character thought field, no primary action for blank text, counter only after 120; delegates to `parkAdd` and its existing undo path.
- `SHEETS.parked`: move to backlog / undoable discard, close on last item, delegates to the existing transactional actions.
- `SHEETS.fixstop`: existing guard time field / last-open shortcut, delegates to `guard-save` and `guard-seen`.
- `vDesk` in `focus.js`: always-black focus mode with Pomodoro bar, time, anti-burn-in drift, wake lock, icon-only actions, and existing Back/Escape behavior.

Additional fixes in the resumed branch:

- Activity totals aggregate **once per sheet render** rather than twice per activity row.
- Hidden focus actions are also `visibility:hidden`, keeping visually concealed actions out of keyboard focus order.
- `web/test/today_sheets_test.js` covers sheet registration, Start offsets/presets and off override, archived exclusions, parking, undoable action routing, guard-stop shortcuts, focus view states and hidden controls.

## Integration ownership

Only T2-owned `web/ui/today-sheets.{js,css}`, `web/ui/focus.{js,css}`, its test and this status file are in scope. Shared shell/core/state/storage/data contracts are unchanged. The existing T3 files in the branch come from its parent PR #20.

**T1 must wire** the Today buttons to `openSheet({type:'start' | 'activities' | 'park' | 'parked' | 'fixstop', ...})` and `enterDesk()`, and avoid resurrecting the old desk and guard inline controls. `UI.guardTime` must be initialized from the current timer before opening Fix stop (existing `guard-fix` behavior). T1 should ensure its activity chip uses `data-long="t2-start-opts"` and its direct tap uses `data-act="t2-start"`.

## Verification

- [x] Source checked against existing `startActivity`, `parkAdd`, `parkToBacklog`, `guard-save`, `guard-seen`, shell routing and kit contracts.
- [x] Focus keyboard-hidden regression addressed.
- [x] T2-focused Node unit test added.
- [ ] Complete web/Node CI run on this branch.
- [ ] 390px light/dark and desktop Chromium screenshots / tap, long-press and sheet actions.
- [ ] Physical Android wake lock, Back, keyboard, touch and notification interactions.

**Do not self-merge**. Merge in stacked order through P1 #19, T3 #20, then T2; retarget sequentially per the integrator instructions. This is not a production deployment.
