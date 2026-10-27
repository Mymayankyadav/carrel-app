# Redesign integration — 28 October 2026

The Phase 1/2 implementation PRs are merged through R5 #25. This final pass completes §20.1 cleanup and adds repeatable acceptance for the combined app. The current design is `docs/PLAN-redesign.md` Part 2; individual lane status files are historical checkpoints.

## Final integration

- Retired the old Today, Plan list, timeline/list Log, breakdown, Calendar side panels/mini month, Tasks panels, week-target renderer and Google Calendar panel. Kept shared date/gap, scheduling, timer, sync and write contracts.
- Deleted `ui/legacy.css`, obsolete screen styles, temporary theme-token aliases, unused shell/calendar handlers and root view registry aliases. Old bookmarked hashes still migrate to the current four destinations.
- Added a small shared reset/layout stylesheet. Preserved modal-over-navigation stacking, responsive sheet width, safe-area padding and calendar drag/resize geometry.
- Fixed duplicate Today sync-error output. Keyboard C/W/P opens Plan/Stats/Patterns, and arrows page the actual Week/Month range instead of obsolete handlers.
- Sign-out with unsaved changes now uses the app dialog. Cancelling preserves the session and pending writes; successful flushing skips the discard question. Tab stays inside sheets and confirmation dialogs.
- Existing activity pinning is wired end-to-end (`saveAct` → `buildActs` → Today picks) and checked through the actual rendered control.
- Fixed the lockfile's missing updater dependency. All workflows use `npm ci` so dependency drift fails explicitly.
- Android release now runs every JS suite and `testDebugUnitTest` before signing. Native/build-input changes merged to main produce an APK with the existing signing secrets; ordinary web-only pushes keep the web update path. A new higher-version APK is necessary for R5 Kotlin/resources.

## Verification

| Check | Evidence |
|---|---|
| Clean dependency install | `npm ci --no-audit --no-fund` passed |
| Production and mock builds | `npm run build:web` passed |
| JS regression suites | All 20 `web/test/*_test.js` passed |
| Combined browser acceptance | `tools/redesign_smoke.py`: Chromium, 390/1280px, light/dark |
| Routes and subscreens | Four tabs, all 15 web subscreens, no missing rendered action handlers |
| Editors and actions | Running Entry, Start, Activities, Park/Parked, Fix stop, New Block/Busy, Block, Wrap, Fit, Plan end, Tasks tabs/editors |
| State and navigation | Stop/rating/Undo, break/resume, Today→Plan, activity pin persistence, Focus/Escape, browser Back, modal hit-testing, dialog Tab trap |
| Calendar interaction | Real desktop pointer drag and resize of tomorrow's block, each restored through Undo |
| Empty states | Today, Plan and Stats checked with empty mock logs/plans |
| Visual QA | Phone/desktop light/dark screenshots inspected; no page/console errors or document horizontal overflow |
| Native bridge | Existing native preference/model/source-contract suites retained; Android build runs in Actions |

The uncompressed generated HTML decreased from 422,285 bytes at the integration base to about 333 KB (roughly 21%).

`Redesign acceptance` CI repeats the mock-only browser matrix on PRs and main, retaining screenshots as `redesign-acceptance`. The optional `CARREL_CHROMIUM` environment variable lets local checks use an installed Chromium. No production account is used by these checks.

## Device and release boundary

The user reported device verification before approving the R5 merge. This pass does not claim an additional physical-device test. Release signing and signature verification use the existing APK workflow; the final APK must be installed once over the release-signed app. Thereafter compatible web updates continue normally. The existing `NATIVE_API` remains appropriate because the new optional bridge calls are capability-checked.

Native notification Resume remains intentionally unavailable until there is a server-backed native resume operation, as documented in the R5 handoff; web Break/Resume remains working. No database/schema changes were made.

## Published delivery

- Merged [PR #26](https://github.com/Mymayankyadav/carrel-app/pull/26), code commit `c88d5eaab9b51e5b8aa325f3114c10b37aa08978`.
- [PR browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40569532210) and [Android QA](https://github.com/Mymayankyadav/carrel-app/actions/runs/40569532047) passed. Screenshot artifact: `redesign-acceptance` (ID `12765016711`).
- [Main browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40569898655) and [Pages deployment](https://github.com/Mymayankyadav/carrel-app/actions/runs/40569898470) passed. Published web update `1.0.29`; checksum manifest read back successfully from Pages.
- [Signed Android release build](https://github.com/Mymayankyadav/carrel-app/actions/runs/40569898727): [build-9 / Carrel.apk](https://github.com/Mymayankyadav/carrel-app/releases/download/build-9/Carrel.apk), version code `100009`. APK signature verification passed before upload.
- APK SHA-256: `a0f8d9ecafe751230420f7e2a2e4aafd8a2e682aa12d2d226e43e885e9beb7ce` (also published in `SHA256SUMS.txt`).
- Remaining user action: install this signed APK once. Actual installation of build-9 has not been performed by the integrator.
