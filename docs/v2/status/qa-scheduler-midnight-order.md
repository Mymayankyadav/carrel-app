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
- GitHub CI and browser acceptance: pending on the PR head. No new UI surface; existing screenshots suffice and no new visual review is claimed.

## Next
- Review and merge only with required green CI; separately continue #90's lossless cross-tab outbox and L6 physical-device acceptance.
