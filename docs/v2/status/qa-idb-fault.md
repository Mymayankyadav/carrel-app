# QA — IndexedDB transaction abort and realtime reconnect recovery

Branch: `v2/qa-idb-abort-recovery`; [PR #64](https://github.com/Mymayankyadav/carrel-app/pull/64) (review pending CI). Owner: QA/ORC; `web/supa.js` is ORC-frozen under the active v2 plan. This is independent of L6 and does **not** change Android usage access.

## Failure mode and fix

IndexedDB request callbacks can run before the containing transaction commits or aborts. The previous adapter resolved its per-account queue on `q.onerror` or `tx.onerror`, potentially before the transaction's final abort, and silently abandoned failed cache writes/deletes. On an interrupted sign-out deletion, stale disk cache could survive.

The adapter now waits for `tx.oncomplete` or `tx.onabort` before releasing the per-account queue, treats a request error as a failed transaction even if a synthetic backend reports completion, and retries write/delete failures up to three attempts. `clear()` returns `true` only after a committed IDB delete and `false` if all attempts fail. Reads fail closed after one attempt. No production documents, schema, network destinations, or native code are changed.

## Deterministic regressions

`web/test/supa_idb_fault_test.js` injects request success followed by transaction error/abort, verifies a second write and deletion commit without overlapping transactions, checks bounded persistent deletion failure and later recovery, and verifies a realtime disconnect/resubscribe refetches changes missed while offline.

## Acceptance

- [x] New Node fault-injection regression included by the existing `web/test/*_test.js` CI glob
- [ ] Full web/Node and v2 smoke CI green on final PR head
- [ ] Browser acceptance and two-tap navigation CI green on final PR head
- [ ] Light/dark phone/desktop screenshot matrix reviewed (no UI changes)
- [ ] ORC merge after all acceptance checks

L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) remains draft pending physical-device privacy acceptance [issue #52](https://github.com/Mymayankyadav/carrel-app/issues/52); native device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) remains open. No physical Android verification is claimed.
