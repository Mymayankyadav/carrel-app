# L6 Android usage detection — physical-device acceptance

**Status:** pending OEM/device acceptance. This is a release gate for PR #44, not a user preference question. The feature is **off by default**. No usage scan occurs without both the Detect drift switch and Android's Usage Access special grant.

## Device and installation safety

Run on a spare/test Android device or a separately isolated test installation. Pull-request CI attaches a **debug-signed APK** in the `native-qa` check under the PR's Checks tab; it **cannot upgrade** the signed Carrel release because its signature differs. **Do not uninstall the normal signed app to install the debug APK:** uninstalling may destroy device-local data and an offline write queue. The signed release should only be published after the lane merges.

On the test installation, use a disposable test account/data; never grant Usage Access to a build you cannot identify. Android grants visibility into **all application usage at OS level**. The app itself queries only the selected allowlisted packages and synchronizes their labels, minute totals and open counts—no URLs, message content or notification text. Turning Detect drift off stops new scans; it does not automatically delete previously synchronized usage summaries. Deletion of production history is a separate, approval-gated operation.

## Acceptance matrix

| Gate | Procedure | Expected evidence |
|---|---|---|
| Default-off and old APK | Open Settings → Notifications on a freshly installed QA build; compare to build 10 on a separate installation. | New build shows **Detect drift = off**; old build hides unsupported controls. Neither prompts for Usage Access at startup. |
| Deny access | Turn on Detect drift, decline the Android Usage Access grant, return to Carrel. Complete a study timer of at least 10 minutes with YouTube in foreground for at least 2 minutes. | Settings still shows **Usage access required**; no usage summary/toast, no new `usage/<date>` write. |
| Grant and selection | In Android's Usage Access screen, explicitly grant Carrel. In Carrel, choose only **YouTube**. Run a 10+ minute study session and foreground YouTube for 2+ minutes, then stop the timer. | The toast summarizes YouTube only; no other apps, URLs or content are retained. `usage/<date>.sessions[entryId].apps.YouTube` has minutes/opens. Study minutes remain unchanged until **Log** is tapped. |
| Explicit Log and undo | Tap **Log** within the two-minute window on a disposable session. Inspect Log, then Undo. | Confirmed minutes are marked as drift with the approximation note; the original study entry is trimmed once. Undo restores the previous entries. |
| Expiry | Stop a qualifying session, then leave the usage toast untouched for two minutes. | No permanently actionable Log toast remains. |
| Revoke OS grant | Re-enable detection, revoke Usage Access in Android Settings, return to app, complete another qualifying study session. | Access state refreshes; no new usage query/write. The stale Log offer disappears. |
| Edit allowlist | Remove YouTube from the selected list, repeat the session with YouTube open. | No YouTube summary; allowlist changes discard in-flight responses. |
| Sign out and back in | Disable or sign out immediately after a qualifying session, then sign in to the same or another disposable account. | Opt-in resets off and no previous account's private package selection or pending Log toast leaks to the new session. |
| Offline and reconnect | After explicitly granting permission, put the test device into airplane mode, complete a qualifying study session, then reconnect. | The local `usage/<date>` write queues and syncs once; the stop and Undo flows continue to work offline. No duplicate drift entries. |
| Foreground clipping | Start a study timer while YouTube is already foreground, then switch apps during the session, and stop after 10+ minutes. | Only foreground time overlapping the study interval is counted; totals remain bounded by the interval. |
| Privacy and OEM behaviour | Confirm on the device's Android build (manufacturer, version, battery restrictions) that system permission can be revoked and the app stops collecting. | Record OEM/model, Android version, build ID, permission screen screenshots and any failure, without screenshots of private app data. |

## Android instrumentation already automated

The API-35 emulator job `L6 Android Usage Access emulator` runs `:app:connectedDebugAndroidTest` and verifies system AppOps grant/deny, rejected unapproved packages, empty allowlist and sign-out preference cleanup. It cannot prove OEM-specific behaviour, real YouTube foreground events or full offline/reconnect through an authenticated device.

**Handoff:** record each matrix row as pass/fail with reproducible evidence in the device QA issue linked from PR #44. Keep #44 a draft while the physical-device gate remains unchecked.
