# QA/ORC L9 — relative Quick Capture date horizon (30 Oct 2026)

## Ownership and scope
Independent, task-scoped QA slice after inspecting fresh `main` at `da00e117`, PLAN-v2 Parts B/D, BOARD, DECISIONS, contracts, open PRs (#123 and draft #44), issues (#90/#49/#52), branches, recent commits and workflows. L9 is merged and no open L9 PR owns these two files. Do not touch PR #123's offline-sync code or shared BOARD/DECISIONS edits.

## Reproduction and fix
`in 522 weeks` previously passed a `n <= 3650` check applied to **weeks**, scheduling more than ten years ahead. `in 4000 days` was not recognized by the three-digit regex and could silently save an undated task. The parser now recognizes arbitrarily long digit sequences and validates the converted total **days** against a 3,650-day horizon; invalid requests set `invalidDate`, which the existing `web/ui/capture.js` write guard rejects for normal captures. The free-text Ask Claude path remains unchanged.

## Verification
- Existing and new `web/test/capture_parse_test.js`: **175 assertions passed** against the branch code in an isolated V8 execution (not a full Node or browser CI run).
- Added valid boundary cases (3,650 days and 521 weeks), invalid boundaries (3,651 days and 522 weeks), four-digit and very large day counts, and zero days.
- Production data, Supabase, Android permissions, shared queue and native code untouched. No screenshots claimed because there is no UI layout change.
- GitHub web/Node/v2 smoke, browser acceptance and navigation CI: pending PR checks at initial handoff. Never infer these from local V8 checks.

## Integration and remaining gates
ORC decision: explicit relative dates beyond ten years must fail visibly rather than create an unintended undated task; the limit is applied in days, independent of units. Shared BOARD/DECISIONS changes intentionally deferred to the #123 owner/ORC integration to avoid conflicting edits.
Issue #90 and PR #123 retain exclusive offline-sync ownership; no production journal authority switch. L6 PR #44 stays draft until physical-device acceptance in #52/#49.
