# QA — stale INITIAL_SESSION ordering

Owner: QA/ORC (frozen `web/auth.js`). Branch: `v2/qa-auth-initial-session-order`. Status: in review.

## Failure mode

Supabase's `INITIAL_SESSION` is a bootstrap snapshot, not proof of a new login. A delayed initial snapshot containing an older account could be processed after `SIGNED_IN` switched accounts, causing `openDb` to restore the outgoing user's cached documents and offline write queue. A delayed empty snapshot could instead call `showSignedOut()` while leaving an active adapter and subscriptions running.

## Fix

- `web/auth.js`: track whether an explicit `SIGNED_IN` or `SIGNED_OUT` event has been observed **at callback receipt time**. Ignore subsequent `INITIAL_SESSION` events, and also reject an initial snapshot if an active database adapter already exists. Explicit sign-in, sign-out, token refresh and profile-update handling remain unchanged.
- `web/test/auth_event_isolation_test.js`: regression cases for stale old-account and empty initial snapshots after an account switch, same-tick sign-in/bootstrap ordering, snapshots after sign-out, and a real sign-out followed immediately by sign-in to a different account.

## Acceptance and boundaries

- [x] No production document, schema, native permission, new destination, or destructive migration changes.
- [x] Only ORC-owned auth, QA test and handoff files changed; L6 and L8 remain untouched.
- [ ] Full Node/web build and v2 smoke CI passes on final head.
- [ ] Browser acceptance and navigation audit pass on final head.
- [ ] Review phone/desktop light/dark screenshots before merge.
- [ ] ORC merge and update board with verified commit and CI links.

L6 [PR #44](https://github.com/Mymayankyadav/carrel-app/pull/44) remains draft until physical Android privacy/Usage Access gate [#52](https://github.com/Mymayankyadav/carrel-app/issues/52) passes. Real-device QA [#49](https://github.com/Mymayankyadav/carrel-app/issues/49) remains open. No physical-device acceptance is claimed.
