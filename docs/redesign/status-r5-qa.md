# R5 QA — independent verification lane

**Base:** `redesign/r5-android` (another agent owns implementation). This branch changes only *new tests, workflow and this handoff document*.

## Work completed
- Pure JVM regression suite for native notification state (idle, elapsed, focus, due, break, countdown boundaries, privacy-safe absence of feedback/tally, and vibration deadline/DND).
- Node VM test for native/web bridge registry, Android-only Notifications page, five settings toggles, persisted `notifDistractions` default off, optimistic save rollback, unknown-key rejection, and no explanatory paragraphs.
- Standalone GitHub Actions unsigned Android workflow that does not use the release signing secrets: dependency installation, bridge tests, Capacitor sync, patches, `testDebugUnitTest`, `assembleDebug`, upload of a debug APK.

## Integration rules
- Do not self-merge.
- Let R5 own `android/**` and `web/native.js`; this branch does not edit them.
- Merge this PR **into `redesign/r5-android`** for agent-owned code coverage, then integrate R0b → R0a → R5 to main per the plan.
- The earlier draft #10 separately attempted notification implementation. Its overlapping code is superseded by R5 owner's branch; carry forward only this independent test/CI lane.
- Debug APK is unsigned as a *release* but debug-signed by Android tooling; it may not install over an existing signed Carrel release.
- Passing tests do not prove real device notification shade, lock screen privacy, haptics, background stop or edge-to-edge status bar behavior.

## Validation
- [x] Bridge checks green — [Android QA run 40527422756](https://github.com/Mymayankyadav/carrel-app/actions/runs/40527422756).
- [x] Gradle `testDebugUnitTest` and `assembleDebug` green in the same run.
- [x] Debug APK artifact `Carrel-R5-QA-debug` (artifact ID 12744067982; 5.85 MB).
- [ ] Android device/manual screenshot checks (native owner).
- [x] No source implementation files touched; no Supabase or production app mutations.
- [x] Web CI green — [run 40527423063](https://github.com/Mymayankyadav/carrel-app/actions/runs/40527423063).

## Requests
- R5 owner: use unsigned QA artifact and run device checks before requesting integration; keep it draft if tests fail.
- Integrator: merge R0b/R0a before any R5 native release; coordinate signed release separately.
