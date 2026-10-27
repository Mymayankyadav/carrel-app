# S2 — Stats subject, patterns and insights pages

Branch `redesign/s2-stats-pages`, stacked on G1 PR #14.

## Delivered
- `PAGES['stats.subject']`: subject weekly bars, weekly total/goal and eight most recent logged sessions; edit opens the activity editor.
- `PAGES['stats.patterns']`: 4/12 week selector, 7x24 weekday-hour heatmap from real `patternsModel`, median study stretch, current goal streak and counted urge/drift notices.
- `PAGES['stats.insights']`: up to five plain insights from existing `insights()` with one-line empty state.
- Uses real saved log; no example data or data mutations. No changes to `logic.js` or the shell.

## Acceptance
- [x] Detail pages and actions registered; unit tests for chart dimensions and data binding.
- [x] No explanatory paragraphs, no hard-coded colours/font/shadow in S2 CSS.
- [x] Subject edit icon label and accessibility; kit Back handles page popping.
- [ ] Real browser screenshots at 390px light/dark and 1280px.
- [ ] S1 links these detail pages from the new Stats tab.

## Requests
- **S1:** Use `pushPage('stats.subject',{id})`, `pushPage('stats.patterns')` and `pushPage('stats.insights')` from Stats root; keep `UI.weekOff` consistent.
- **Integrator:** Validate tap targets and colour contrast on Android.
