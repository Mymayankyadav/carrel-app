# R0a — Modular app and four-tab shell

Branch: `redesign/r0a-shell` · Date: 27 October 2026
Dependency: `redesign/r0b-kit`, PR #8. **Do not merge R0a before R0b. Do not self-merge.**

## Delivered

- Split the old monolithic app and CSS into `core/` and `ui/` modules. `web/files.json` determines script/style order, and `web/build.py` assembles the same standalone web bundle and test page.
- Retained all existing stored-state and write contracts; no database migrations.
- Registered screens via `VIEWS`, sheets via `SHEETS`, and subscreens via `PAGES`, preserving legacy view aliases while Phase-2 screens are unfinished.
- Kit-backed four-tab bottom navigation, independent screen headings, subscreen headers, sheet overlay, popup root and sync-problem line on Today. The old global app bar is removed.
- Unified system-font themes, removed Google Fonts bundling, enabled mobile keyboard-resizing viewport.
- Shell toast supports Undo or one custom action, with a persistent mode for update-ready prompts.
- Subscreen and sheet navigation push browser-history entries; explicit back consumes the entry, and popstate does not double-pop the UI.
- Modernized `tools/shots.py`: Today/Plan/Stats/Settings, `--dark`, `--width`, repeatable `--js`, non-zero failure on errors or overflow.
- Reworked old monolith-oriented JS tests to load extracted view functions and added shell, build-registry, snackbar and browser-back regression tests.

## Phase-2 integration contracts

The original global function signatures remain available across the ordered, concatenated scripts:

| Module | Functions and registrations Phase 2 can build upon |
| --- | --- |
| `core/state.js` | `W`, `commit`, `recompute`, `act`, `lastEntry`, `pomoState`, `guardInfo`, global `ACT` / `VIEWS` / `SHEETS` / `PAGES` |
| `core/actions.js` | `startActivity`, `stopTimer`, `takeBreak`, `backFromBreak`, `openEntrySheet`, `saveSetting`, `saveAct`, plan actions |
| `ui/today.js`, `ui/focus.js` | `VIEWS.today`, notices/parking, desk/focus helpers |
| `ui/log.js` | Log renderers, `SHEETS.entry` and `SHEETS.split` |
| `ui/plan.js`, `cal.js`, `ui/plan-sheets.js`, `ui/tasks.js` | `VIEWS.plan`, calendar/timeline, plan sheets, task/deadline/busy compatibility |
| `ui/stats.js` | `VIEWS.stats`, legacy `week` and `patterns` aliases |
| `ui/settings.js` | `VIEWS.settings`, `SHEETS.setup` until G1/G2 replace it |
| `ui/shell.js` | `vMain`, `vSheet`, `vSyncLine`, `render`, `openSheet`, `closeSheet`, `toast` and all preexisting `ACT` handlers |
| `ui/kit.js` | `pushPage`, `popPage`, `openPage`, `goBack`, generic kit actions |

## Verification

- GitHub Actions web build and all `web/test/*_test.js` tests: **passed** at commit `0fe88c2500288b12fdedd8bab3269c12b2063d26` (run 40522496225).
- The local environment cannot clone GitHub or run browser screenshots; screenshot captures and visual acceptance remain pending. No claim of on-device Android testing.
- The old screen bodies remain deliberately untouched for Phase 2, so the final minimalist wireframes are **not yet achieved**.

## Requests and known follow-ups

1. **Integrator:** Merge R0b first, then R0a. Run `python3 web/build.py`, all Node tests, and `tools/shots.py` at 390px light/dark and 1280px. Inspect any page/console errors and horizontal overflow before merging.
2. **R5:** Wire native Android back through `goBack()`, verify modal behavior on a device, and perform the notification redesign separately.
3. **W1/T1/P1/S1/G1/G2:** Replace legacy screen content and help text as specified in §16 of the redesign plan. Do not delete old aliases until Phase 3.
4. **R0a integration:** Browser back when a dialog/menu is open on top of a page needs a full device/browser interaction test; the history entries are currently created for pages and sheets, not for ephemeral menus.
5. **Integrator:** Test opening a sheet while an existing sheet is visible, then using browser and Android back.

## Acceptance checklist (§20.2)

- [ ] Screen wireframes match §16 at 390px light/dark and 1280px — Phase 2 and screenshot review pending.
- [ ] No explanatory paragraphs remain — Phase 2 screen owners.
- [ ] No ALL CAPS, serif or monospace in old screens — Phase 2 and Phase 3 cleanup.
- [x] New kit icon-only buttons expose labels and titles; ≥40px base controls and ≥44px touch targets.
- [x] Kit allows one primary action for newly built screens.
- [x] `goBack()` handles menu/dialog → sheet → page → Today, with browser/in-app history regression tests.
- [ ] Empty-state visual acceptance — Phase 2.
- [ ] No horizontal overflow — screenshot script updated but not executed yet.
- [x] Build and all JavaScript tests pass in CI.
- [x] R0a touches only the modularization, shell integration, regression tests, screenshot tool, build/workflow and status documentation; no data model changes.
