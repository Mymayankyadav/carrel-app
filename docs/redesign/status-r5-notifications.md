# R5 / Notifications — parallel sub-lane

Branch: `redesign/r5-notification-ui-astra` from `main`. This is **one part of R5**, not the entire Android redesign.

## Delivered
- Standard system `NotificationCompat` layout, no custom RemoteViews, large icon, subtext, or distraction tally.
- Running/focus/break-due/break models with proper chronometer anchors and Stop / Break actions.
- Quiet, privacy-respecting 10-second Undo with prior activity and readable duration.
- Urge, Drifted, Park are **opt-in** using persistent `notifDistractions=false` by default, exposed through `CarrelLivePlugin.getPrefs/setPrefs`.
- New concise Notifications page with switches and a collapsed Troubleshoot section; legacy shell fallback, registry registration when R0a lands.
- Removed unused custom notification resources.
- JVM notification model tests; separate PR-triggered unsigned Android debug build (no release signing keys).

## Compatibility and coordination
- Touches only notification-related R5-owned native files, `web/native.js`, and new R5 tests / CI / status files.
- Do not self-merge. Integrate **R0b → R0a → this R5 sub-lane**; coordinate with the separate `redesign/r5-android` branch.
- R0a supplies `PAGES`, `kRow`, `kSwitch`, `kCollapse`; until then the fallback panel renders on legacy main.
- G1 needs to add a Settings root row that opens `settings.notifications`; G2 owns update/version rows in About.
- `carrel.RESUME` action is intentionally **not** introduced: current Engine has no native resume RPC. Break notification remains actionable via Stop and can return to the app for Resume.
- No stored Supabase data shapes changed. This change does **not** bump `NATIVE_API`: it changes the native notification presentation and optional prefs only.
- R5 owner still needs edge-to-edge system bars, DayNight drift dialog, updater restart, and Android Back/minimize work. Do not claim those are complete.

## Validation
- [x] Source inspected against `Models.kt`, `Engine.kt`, `Receivers.kt`, `Store.kt`, kit and R0a shell contracts.
- [x] Pure model unit tests added (running, focus, due, break, Undo).
- [ ] GitHub Actions Android debug + JVM workflow green; check after opening PR.
- [ ] Physical Android 16 and lock-screen notification check (privacy and DND).
- [ ] New Settings page screenshots at phone light / dark and desktop width after R0 integration.

## §20.2 acceptance checklist
- [ ] Wireframe checked at 390 px light/dark and 1280 px (blocked on R0a integration)
- [x] Notification has no explanatory paragraphs
- [x] Standard Android system typography and no custom notification layout
- [x] No icon-only notification actions without labels
- [x] Stop remains accessible
- [ ] Back/overflow check on an Android device
- [ ] Empty state and horizontal overflow screenshot check after integration
- [ ] All native tests pass in GitHub Actions
- [x] Only isolated native / test / status / CI files edited

## Requests
- R0a / G1: expose the Notifications entry in the Settings root; do not duplicate the page.
- R5 owner: decide whether to add a *verified* native resume endpoint; only then show Resume in break notification.
- Integrator: maintain merge order and do not deploy a signed APK until the new native build has been tested.
