# QA — authentication-event identity fencing

Owner: QA/ORC (frozen `web/auth.js`). Branch: `v2/qa-auth-event-uid-fence`. Status: merged via [PR #68](https://github.com/Mymayankyadav/carrel-app/pull/68), squash commit `646e3a5ed67725f256ea33700344c337d613c585`.

## Failure mode

The Supabase auth callback previously treated **every** non-null session event as proof that a read-only database connection had recovered, regardless of the event's user ID. A delayed `TOKEN_REFRESHED` or `USER_UPDATED` notification for an outgoing account could update native credentials and set `S.conn = 'live'`, causing `pumpAll()` to replay the active account's offline queue under an unrelated auth session. `USER_UPDATED` also incorrectly restored write access without demonstrating a token refresh.

## Fix

- `web/auth.js`: only `INITIAL_SESSION` and `SIGNED_IN` may establish or switch the active account. Other session events are ignored unless `S.db` exists and `S.uid === session.user.id`.
- A matching `TOKEN_REFRESHED` may restore a read-only connection; a matching `USER_UPDATED` may refresh native session metadata but cannot restore write access.
- `SIGNED_OUT` retains the existing teardown, durable local-cache cleanup, and native credential removal; malformed identity events are ignored.
- `web/test/auth_event_isolation_test.js`: deterministic Node VM harness for foreign-account refresh/profile events, matching refresh recovery, delayed old-user refresh after an explicit account switch, stale refresh after sign-out, and malformed identity events.

## Boundaries and verification

- [x] No production data, schema, native permission, new destination or destructive migration changes.
- [x] Only ORC-frozen auth and QA test/docs files modified; no L6 or L8 lane files touched.
- [x] Full Node/web build and v2 smoke CI on final PR head `8fe410b2` — [success](https://github.com/Mymayankyadav/carrel-app/actions/runs/40792625419).
- [x] [Browser acceptance](https://github.com/Mymayankyadav/carrel-app/actions/runs/40792625466) and [two-tap navigation audit](https://github.com/Mymayankyadav/carrel-app/actions/runs/40792625512) succeeded on final PR head; [additional web CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/40792619631) succeeded.
- [x] Reviewed CI artifact Today screenshots at 390px/1280px in both themes; no new layout regression observed. Squash merged after all four final-head checks were green.

L6 draft [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) remains gated on physical Android Usage Access and privacy acceptance [#52](https://github.com/Mymayankyadav/carrel-app/issues/52), with native device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) still open. This change does not claim real-device verification.
