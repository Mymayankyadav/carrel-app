# G1 — Settings root and Activities

Branch `redesign/g1-settings`, stacked on G2 PR #13 (then W1 PR #12).

## Delivered
- Replaced the old Setup sheet with the minimalist Settings home and three grouped lists. Linked all Settings subpages via existing `pushPage` API.
- Android Notifications row only on native; keyboard row only on fine-pointer devices.
- Registered `settings.activities` and `settings.activity` subpages with study/other groups, archived list, add/edit name, 12-palette colour choices, activity type, weekly goal, pin on Today, optional role and guard, and move/archive menu.
- All writes reuse `addActivity`, `saveAct`, `W().update`, `commit` or the existing `act-move` handler. No schema migrations.

## Checklist
- [x] No descriptive paragraphs; Settings root uses kit rows and a compact header.
- [x] Owned CSS has no hard-coded colors, font-family or shadows.
- [x] Icon-only actions have aria-label and title via kit; >=44px targets on touch.
- [x] Existing data writes preserved with bounded numeric controls.
- [ ] 390px light/dark, 1280px visual acceptance and authenticated native review.
- [ ] Integration/clean-up of old `ACT.setup` in frozen shell belongs to Phase 3 integrator.

## Requests
- **T1** link activity selection, pin state and first-run standalone state.
- **Integrator** remove dead Setup handlers and verify `goBack()` on Settings subpages.
- **R5** ensure Notifications page registration/bridge when native.
