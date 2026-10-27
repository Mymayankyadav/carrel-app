# W1 — Welcome and subject onboarding

Branch: `redesign/w1-welcome` (based on integrated R0a).

## Delivered
- Minimal, vertically centred Google sign-in and private-tracker sign-out.
- First-run subject editor: single input, Enter/+ via existing `onb-add` handler, removable chips, deduplicated suggestions via `onb-chip`, and a disabled Continue button until a study subject exists.
- The existing `onb-done` action persists `CFG.onboarded`; `w1-remove` archives selected study activity using the existing atomic write path. No Supabase contract changes.
- `VIEWS.welcome`, `w1FirstRun()`, `w1NeedsSetup()` registered in `welcome.js`.
- Kept `vOnboard` and `vNoActs` as compatibility functions temporarily: old `ui/today.js` still calls both. T1 must remove those calls before these wrappers are deleted.

## Acceptance checklist
- [x] Follows §16.1 and §16.2 content/controls, no explanatory paragraphs or footers.
- [x] No hard-coded colours, font-family or box-shadow in W1 CSS; light/dark handled by kit.
- [x] Icon-only add/remove controls have aria-label and title; coarse pointer targets ≥44px.
- [x] One primary action on each W1 surface; disabled Continue until a study subject exists.
- [ ] Full-screen first-run route: T1 must render `w1FirstRun()` instead of the old timer/plan/log around `vOnboard()`. W1 cannot edit the frozen shell or T1-owned screen.
- [ ] Screenshot acceptance at 390px light/dark and 1280px with a first-run state.
- [ ] Real OAuth test requires auth; mock and unit tests cover rendering.

## Requests
- **T1** replace `vOnboard`/ `vNoActs` references and render the first-run standalone; remove compatibility functions after grep verifies no consumers.
- **Integrator** verify sign-in and non-owner screens on an authenticated device. No changes to other agents' owned files.
