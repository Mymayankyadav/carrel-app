# QA/ORC: parked-thought durable-write safety (2026-10-31)

Owner: QA/ORC, independent L1/T2 parked-thought follow-up. Base: `23566d74e0cd110820cf7541270bce59a6855b4b`. No active PR owns these files; L6 #44 is a separate physical-device gate and #90's synchronization prototype is not modified.

## Regression and change
- `parkAdd()` previously cleared `UI.parkText` and rendered even if the offline `commit()` failed. The Park sheet also closed before that commit returned. A quota, security or cross-tab storage failure could lose a thought without a durable queue receipt.
- `parkToBacklog()` previously returned no success indication. The parked list closed after an attempted move even when the atomic backlog + moved-marker write set failed.
- Both helpers now report durable enqueue success; the Park editor and parked list remain open with `role="alert"` error and a retry path on failure. The Park draft is only cleared after success; the move remains one write set. Read-only/unknown-item attempts fail closed.

## Verification
- `web/test/qa_park_durable_test.js` tests the actual `today.js` helper definitions in a VM under failed/successful commits, read-only state, and an unknown item.
- `web/test/today_sheets_test.js` covers failure/retry UI state for both actions.
- Exact-head [web build, full Node and v2 smoke CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/41158970879) passed on rerun; first run exposed the separately tracked #90 two-tab lost-update race. [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41158970834) and [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41158970812) passed. ORC reviewed eight Park/Backlog failure-state screenshots at 390/1280 in light/dark from rerun artifact `13029572104`. Squash-merged [#169](https://github.com/Mymayankyadav/carrel-app/pull/169) as [`196e266`](https://github.com/Mymayankyadav/carrel-app/commit/196e2663438569bf2642792867da49079b260dea).
- New CSS uses existing kit `--danger` and text tokens; no new permissions, network destinations, production data migrations or v1 feature removals.

## Release boundaries
- This is a local durable-enqueue UI guard, **not** a fix for issue #90's simultaneous-tab atomicity. The journal remains non-production.
- L6 PR #44 remains draft pending issue #52's physical-device privacy and Usage Access acceptance; #49 native QA also remains open.
