# QA L9 — fractional and signed relative capture dates (30 Oct 2026)

Owner: independent QA/ORC L9 slice on `v2/qa-capture-fractional-relative-1030`. Base: main `9a00285dc73321cb80fb94c2823ae71a850d4caa`. L9's original lane is merged; PR #123 exclusively owns the unrelated issue #90 offline journal work and shared BOARD/DECISIONS edits.

## Reproduction and fix

Before: `in 1.5 days`, `in .5 days`, `in 0.5 weeks`, and `in -2 days` were not recognized as relative dates, so Quick Capture could silently save them without the requested due date. Exponential notation was similarly unrecognized. This is a data-integrity regression in the date-only capture path.

After: positive fractional day/week offsets round **up** to the next whole calendar day (never earlier than requested); nonnegative integral offsets retain their original behavior. Negative, non-finite, or >3650-day requests mark `invalidDate` and use the existing save-time validation, rather than falling through to an undated task. Explicit date formats, subject recognition, v1 write semantics and the no-network parser remain unchanged.

## Evidence and gates

- Unit tests: `web/test/capture_parse_test.js` now covers fractional days/weeks, leading-dot fractions, scientific notation, explicit plus/minus, zero and 3650-day boundary rounding.
- The existing `web/ui/capture.js` save path rejects `invalidDate` before creating a write set; no production data or permissions were modified.
- CI: pending PR checks. No local full Node/build/Playwright run or screenshot review is claimed; the GitHub connector environment does not expose a local repository checkout.
- No UI surface changes; screenshots not required for this pure parser change.
- L6 PR #44 remains draft until physical-device Usage Access/privacy acceptance under issues #52/#49. Issue #90 offline lost-update and production journal cutover remain separate and unresolved.

## Integration

Squash-merge only after the current-head web build, Node suite, v2 smoke, browser acceptance and navigation checks actually pass. Shared `docs/v2/BOARD.md` and `docs/v2/DECISIONS.md` are intentionally untouched while active PR #123 owns them. Record the date-only rounding decision in the integration handoff if ORC later consolidates shared decisions.
