# G2 — Settings subpages

Branch `redesign/g2-settings-pages`, stacked atop W1 PR #12.

## Delivered
- Registered all eight settings pages: timer, day, calendar, Claude prompts, export, account, about, keyboard.
- Timer reuses current Pomodoro toggle; presets and custom settings save to the existing `CFG.pomodoro` data shape. Day adjustments reuse the existing day setting keys, with bounded increments.
- Calendar shows connector availability, status and upcoming events. Existing connector methods `gcConnect`, `gcWatch` and actions remain untouched.
- Copy/export/signout/update actions reuse the existing `ACT` contracts.
- No modifications to the data model, the shell, or `web/gcal.js`; old Calendar panel remains until P1 removes it.

## Checklist
- [x] Eight pages registered with correct keys and test coverage.
- [x] No explanatory paragraphs; no hard-coded CSS colours, font-family or shadows.
- [x] Icon-only controls have accessible labels; numeric actions ≥40px (44 on touch).
- [x] No new destructive data actions; existing signout and export reused.
- [ ] Screenshot visual acceptance at 390px light/dark and desktop.
- [ ] Browser/Android Back interactions with these pages; shell already owns Back.
- [ ] G1 Settings root must link to these eight pages; G2 cannot edit G1-owned `web/ui/settings.js`.

## Requests
- **G1** connect root rows to `openPage('settings', 'settings.timer')`, etc.
- **P1** delete old Google Calendar side panel; G2 leaves compatibility renderer in place.
- **R5** supply `upd-restart` when appropriate; About safely falls back to `upd-check` until it exists.
- **Integrator** verify calendar connector, app update and exports in their native environments.
