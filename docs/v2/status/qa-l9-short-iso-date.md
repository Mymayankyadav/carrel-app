# QA L9 — short ISO-style dates cannot silently become different deadlines (2026-10-30)

Owner: independent QA/ORC L9 correctness slice. Branch: `v2/qa-l9-short-iso-date-20261030`.
Base: `a7299abeaa2a64debf7ecaad83e4508d23525a2f`.

## Reproduction
Quick Capture interpreted `essay due 2026-11-2` as **2027-02-11** and kept `2026` in the title. Likewise `2026-1-12` became **2026-12-01**, and `2026-13-2` became a plausible but wrong date. The original strict `YYYY-MM-DD` regex skipped single-digit components, allowing the yearless `DD-MM` fallback to consume the suffix. A user could therefore save a task/deadline for the wrong calendar day without any warning.

## Change
- Recognize year-first `YYYY-M-D`, `YYYY-MM-D` and `YYYY-M-DD`, normalize valid dates to `YYYY-MM-DD`.
- Recognize malformed 3-digit fields only to reject them, and reject invalid months/leap days instead of falling through to a different yearless date.
- Extend parser and VM capture write-path regressions. Existing yearless `DD-MM` behaviour, explicit padded ISO, manual correction, Ask Claude, v1 documents and offline sync remain unchanged.
- No UI markup, new permissions, Supabase writes, external recipients or production migration.

## Verification
- Before patch, isolated V8 reproduced the wrong dates above.
- After patch, isolated V8 passed ten targeted cases, including valid short dates, invalid short dates, three-digit invalid fields and legacy yearless dates.
- Full Node suite, web build and v2 smoke: [PR #143 CI](https://github.com/Mymayankyadav/carrel-app/actions/runs/41061753052) **success**.
- Browser acceptance: [run 41061753141](https://github.com/Mymayankyadav/carrel-app/actions/runs/41061753141) **success**.
- Two-tap navigation audit: [run 41061753139](https://github.com/Mymayankyadav/carrel-app/actions/runs/41061753139) **success**.
- Push-branch full CI: [run 41061727660](https://github.com/Mymayankyadav/carrel-app/actions/runs/41061727660) **success**.
- Entire parser test source executed in isolated V8: **161 assertions passed**; capture save path additionally checked four invalid/valid short-date cases.
- [Implementation PR #143](https://github.com/Mymayankyadav/carrel-app/pull/143) squash-merged into main as [`a5937df`](https://github.com/Mymayankyadav/carrel-app/commit/a5937df7ce4220acc16824e37b178ccc93a985d4).
- No new UI surface; existing `role="alert"` date warning is reused. No screenshot review claimed.

## Coordination
PR #123 separately owns offline issue #90 and shared BOARD/DECISIONS files, so those files are intentionally untouched. L6 PR #44 remains draft behind real-device issues #52 and #49; no physical-device acceptance claimed.
