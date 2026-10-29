# QA/ORC: sign-out guard for other tabs' offline edits

- Owner: QA/ORC (frozen `web/auth.js`); branch `v2/qa-signout-multitab-pending`.
- Scope: a tab with no local `S.pending` can still share a durable session outbox with another Carrel tab. Read the current session's persisted outbox before sign-out and require explicit discard confirmation. Recheck identity after the asynchronous prompt.
- Files: `web/auth.js`, `web/test/auth_signout_multitab_pending_test.js`, `tools/v2_qa_signout_multitab_smoke.py`; no production SQL, new recipients, or native permissions.
- Regression cases: disk-only pending writes; decline/accept; clean queue; local drain leaving durable writes; account switch while confirmation is open.
- Verification: CI pending on the browser-smoke head. The previous head passed web build, all Node tests, v2 smoke, browser acceptance and navigation audit. New smoke generates 390/1280 light/dark sign-out confirmation screenshots for review. No physical-device verification claimed.
- Limits: this is **not** issue #90's atomic cross-tab outbox solution. Another tab can still enqueue after the last disk read. Browser/OS storage failures can obscure the count; multi-tab atomicity and coordinated sign-out remain separate work. L6 #44 / device #52 and #49 remain hard gated.
