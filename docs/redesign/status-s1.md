# S1 — Stats root

Branch `redesign/s1-stats`, stacked on S2 PR #15.

## Delivered
- Replaced complex old Week/Patterns rendering with a compact Week/Month Stats overview, paged periods, total/daily average, goal line and stacked study bars.
- Real logged entries only; no preview/example data. Subject rows show actual totals/goals and link to S2 detail pages.
- Insights/Patterns links open S2 pages. Keeps the existing `vTargetsPanel` helper because Plan still uses it.
- Removed old KPI grid, ribbons, review card, redundant charts and demo examples from Stats.
- Updated `patterns_test.js` to test the new UI while preserving the substantive math regression checks.

## Acceptance
- [x] Matches §16.11 content and hierarchy; all colors token-driven.
- [x] No UI paragraphs, verbose helper copy, old preview mode or old CSS panels.
- [x] Week/Month period controls and page links tested.
- [ ] Visual screenshots at 390px light/dark and 1280px.
- [ ] Physical Android interaction/colour contrast review.
- [ ] When P1 integrates, replace the `cal-open` fallback with `planFocus` for bar taps.

## Requests
- **P1:** supply `planFocus(k,id)` for opening the selected day from the chart; S1 falls back to the existing `cal-open`.
- **Integrator:** remove legacy `VIEWS.patterns` aliases and old `vTargetsPanel` when P1 moves week targets; preserve math logic functions used by S2.
