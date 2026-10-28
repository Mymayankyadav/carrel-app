# QA — IndexedDB transaction abort and realtime reconnect recovery

Branch: `v2/qa-idb-abort-recovery`; [PR #64](https://github.com/Mymayankyadav/carrel-app/pull/64) (merged, squash commit `5b3a0b84952e4e3ca125094cd87a4bf1a99fc493`). Owner: QA/ORC; `web/supa.js` is ORC-frozen under the active v2 plan. This is independent of L6 and does **not** change Android usage access.

## Failure mode and fix

IndexedDB request callbacks can run before the containing transaction commits or aborts. The previous adapter resolved its per-account queue on `q.onerror` or `tx.onerror`, potentially before the transaction's final abort, and silently abandoned failed cache writes/deletes. On an interrupted sign-out deletion, stale disk cache could survive.

The adapter now waits for `tx.oncomplete` or `tx.onabort` before releasing the per-account queue, treats a request error as a failed transaction even if a synthetic backend reports completion, and retries write/delete failures up to three attempts. `clear()` returns `true` only after a committed IDB delete and `false` if all attempts fail. Reads fail closed after one attempt. No production documents, schema, network destinations, or native code are changed.

## Deterministic regressions

`web/test/supa_idb_fault_test.js` injects request success followed by transaction error/abort, verifies a second write and deletion commit without overlapping transactions, checks bounded persistent deletion failure and later recovery, and verifies a realtime disconnect/resubscribe refetches changes missed while offline.

## Acceptance

- [x] New Node fault-injection regression included by the existing `web/test/*_test.js` CI glob
- [x] Full web/Node and v2 smoke CI green on final PR head `262e4af`
- [x] Browser acceptance and two-tap navigation CI green on final PR head `262e4af`
- [x] Light/dark phone/desktop screenshot matrix reviewed (Today/Plan at 390/1280; no UI changes)
- [x] ORC squash merge after all acceptance checks: `5b3a0b84952e4e3ca125094cd87a4bf1a99fc493`

L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) remains draft pending physical-device privacy acceptance [issue #52](https://github.com/Mymayankyadav/carrel-app/issues/52); native device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) remains open. No physical Android verification is claimed.

## Final CI and visual evidence

- [Web build, all Node suites and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/40778778888) — success
- [Redesign browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40778778847) — success; screenshot artifact `redesign-acceptance` inspected
- [Two-tap real-click navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40778778829) — success
- [Additional web/Node check](https://github.com/Mymayankyadav/carrel-app/actions/runs/40778771141) — success

Eight Today/Plan screenshots were reviewed (390/1280 px, light/dark); no new clipping or overflow was observed. The fault-injection suite also passed in a separate isolated JavaScript execution before CI. This remains **web/adapter QA only**, not real-device verification.
