# T1 — minimalist Today implementation (in progress)

Branch: `redesign/t1-today`, stacked on T2 PR #21.

## Implemented initial integration
- Today is registered to the new `t1Today()` renderer: date and studied total → T3 Log, one minimal timer card, progressive Pomodoro bar, note, running/edit/Focus controls, idle state and three-hour resume shortcut.
- Running/break-due/break/long-running timer cases use the existing `stop`, `break`, `back`, `guard-keep` actions; Fix stop opens T2's `fixstop` sheet.
- Noticed reuses existing urge/drift write actions and opens T2 Park; the last 3 drift-minute buttons stay compact.
- Up to three upcoming plan rows use P1 `planFocus(k,id)` and overflow uses the P2 `fit` sheet.
- Pinned/default activities use T2's `t2-start` and `t2-start-opts` touch/long-press actions; all activities opens T2's picker.
- Main Today no longer renders the legacy date stamp/day controls, deadline strip, long-form switcher, timeline/list, plan list and breakdown.
- New scoped `t1-` CSS for 390px phones through desktop and `web/test/t1_today_test.js` regression checks.

## Integration boundaries
- T1-owned files only: `web/ui/today.js`, `web/ui/today.css`, `web/test/t1_today_test.js`, and this status file.
- The old helper functions and styles still exist in the same file during transition to protect other modules' calls. Phase-3 integrator should remove only after a global reference sweep. **No frozen core/shell edits**.
- `buildActs` currently drops the optional per-activity `today` pinned flag. Until the integrator threads it through, the view defaults to all Study + Break + Sleep; Settings Activities needs to persist and expose the optional `today` value if pinning is to be user-configurable.
- Default Settings Pomodoro preference remains `UI.pomoOn`; the advanced preset UI lives in T2.
- Focus feedback buttons after stopping and final UX cleanup remain to be completed in T1; do not claim final Phase-2 acceptance.

## Checks
- [x] Initial implementation and unit assertions committed.
- [ ] Complete CI web build and all JavaScript tests.
- [ ] Four viewport browser screenshots, interaction and accessibility checks.
- [ ] Physical Android notification, system Back, keyboard, Wake Lock and long press acceptance.

**Do not merge/deploy** until upstream PRs land in the required order and T1 acceptance is complete.
