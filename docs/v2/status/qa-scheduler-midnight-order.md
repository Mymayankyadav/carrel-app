# QA/ORC — midnight auto-plan ordering (2026-10-30)

Owner: QA/ORC, independent L3 regression. Branch: `v2/qa-scheduler-midnight-order`.

## Problem and change
- The scheduler sorted preview/persisted blocks lexicographically by local `HH:MM`, putting a 00:10 block before 23:00 when a study day spans midnight.
- Keep the actual scheduled epoch timestamp only while sorting, then remove it from returned block objects to preserve the existing Plan data contract.
- Add a regression with a 23:00 block followed by a 00:10 block and a 10-minute gap; assert chronological order and no internal timestamp field leaks.
- Pure local scheduling only; no existing user data, production sync, Supabase, native permissions or v1 features are changed.

## Ownership and release gates
- L3's original lane is merged. This is an independent QA/ORC regression; PR #123 owns issue #90 and the shared BOARD/DECISIONS docs, so this PR deliberately does not touch those files.
- L6 PR #44 remains draft pending physical Android acceptance in issues #52 and #49. No device verification is claimed.

## Evidence
- [PR #131](https://github.com/Mymayankyadav/carrel-app/pull/131) merged as [`54dd0aa`](https://github.com/Mymayankyadav/carrel-app/commit/54dd0aa1b76ce79cef50295a720b4f52e0a25235) after diff review and green final-head checks.
- [Web build, full Node tests and v2 smoke](https://github.com/Mymayankyadav/carrel-app/actions/runs/41012732324), [browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/41012732455), [navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/41012732435), and [push web run](https://github.com/Mymayankyadav/carrel-app/actions/runs/41012716771) all succeeded on `6bd7cd2`.
- No new UI surface; no screenshot review or physical-device test is claimed.

## Next
- Review and merge only with required green CI; separately continue #90's lossless cross-tab outbox and L6 physical-device acceptance.
