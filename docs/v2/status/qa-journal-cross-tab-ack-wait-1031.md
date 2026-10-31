# QA/ORC #90 — wait for cross-tab journal acknowledgement visibility (2026-10-31)

Owner: QA/ORC, isolated browser-smoke reliability slice; base `84d736e619a138bed18e93bfdb696320e86dded3`.

## Reproduced failure
Post-merge main CI [run 41149012533](https://github.com/Mymayankyadav/carrel-app/actions/runs/41149012533) failed `tools/v2_qa_journal_batch_smoke.py` at the final cross-tab zero-record assertion. The prior assertion waits for the one-record condition, but the last acknowledgement was immediately read in the *other* tab without waiting for the storage event. All JavaScript tests, including the new Plan editor tests, passed in that run.

## Fix
After tab B durably acknowledges the final immutable journal record, wait (up to 10 seconds) until tab A independently observes `journal.list().ok && journal.list().records.length === 0`, then retain the exact zero-record assertion. This mirrors the existing two-record and one-record waits. It neither weakens the assertion nor changes journal logic or production sync.

## Boundaries
- No production synchronization cutover, data migration, server change, permissions or new recipient.
- Issue #90 remains open: Web Locks, legacy authority handoff and sign-out acceptance are separate gates.
- L6 #44 remains draft pending real-device #52/#49.
- Full CI and two-tab browser smoke pending at PR creation; no passing result claimed.
