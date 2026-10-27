# T1 — minimalist Today implementation (in progress)

Branch: `redesign/t1-today`, stacked on T2 PR #21 (now including the corrected-stop and modal visual fixes, validated independently by T2 QA #40560093385).

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
- Obsolete Today renderers are deleted. The remaining helpers implement real timer/distraction/parking writes and are still needed by the shell or T1/T2. Legacy CSS is left intact for a separate reference and visual audit. **No frozen core/shell edits**.
- `buildActs` currently drops the optional per-activity `today` pinned flag. Until the integrator threads it through, the view defaults to all Study + Break + Sleep; Settings Activities needs to persist and expose the optional `today` value if pinning is to be user-configurable.
- Default Settings Pomodoro preference remains `UI.pomoOn`; the advanced preset UI lives in T2.
- Post-study Focus? rating controls (Scattered, Okay, Deep) now write through the existing W().day commit contract, remain available for up to 60s and clear after selection.
- Obsolete Today JavaScript renderers were deleted after checking every other loaded UI module for consumers. Legacy CSS still requires integrator reference sweep and screenshot approval.

## Checks
- [x] Initial implementation and unit assertions committed.
- [x] Full web build and Node tests passed at [CI #40558843115](https://github.com/Mymayankyadav/carrel-app/actions/runs/40558843115), including the rewritten Today regression suite.
- [x] Chromium browser interactions passed at [run #40559015243](https://github.com/Mymayankyadav/carrel-app/actions/runs/40559015243) across 390px/1280px light/dark. Screenshots (24 images) uploaded in artifact [#12757618637](https://github.com/Mymayankyadav/carrel-app/actions/runs/40559015243/artifacts/12757618637). Manually inspected phone and desktop running/idle and Activities compositions; no horizontal overflow, page errors or icon misalignment observed. Browser tests are mock-only; hardware interaction remains pending.
- [ ] Physical Android notification, system Back, keyboard, Wake Lock and long press acceptance.

**Do not merge/deploy** until upstream PRs land in the required order and T1 acceptance is complete.
