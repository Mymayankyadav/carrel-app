# P1 — Plan Day/Week timeline

Branch: \`redesign/p1-plan\`; stacked above P2 PR #18 and P3 PR #17.

## Delivered
- \`VIEWS.plan\` now uses a compact 48px date header with previous/next date, today, Tasks and Plan menu icons; Day/Week mode selector; one-line note, yesterday-carry row, overflow Fix row and a floating New action.
- Removed three-day navigation, filter switches, side panels, mini month, verbose legend/hint, day free/spare labels and date-strip deadline chips from the rendered Plan screen.
- Removed missed blocks from the displayed timeline; the overflow Fix row opens \`SHEETS.fit\` from P2.
- Timeline grid retains \`vCalGrid\`, \`vCalCol\`, \`layoutOverlaps\`, \`calItem\` and existing pointer/drag/resize/schedule logic. Reworked item display as quiet logged, planned, busy and now-line elements; day 56 px per hour, week 7 columns and 3-hour gutter labels.
- Added \`planFocus(k,id)\` contract: activates Plan, goes to day \`k\`, sets Day mode, and centres matching block. T1 and S1 can call it directly.
- \`ACT['p1-open-tasks']\` opens P3 Tasks; \`ACT['p1-day']\` drills from Week into Day; header menu uses P2 \`p2-plan-menu\`.
- P1 CSS overlays old selectors because **Today still calls \`vPlan\`** and old plan CSS supports that legacy Today content. T1/Phase 3 integrator can remove \`vPlan\`, \`vBlk\`, \`vAddBlock\`, \`vCalSide\`, \`vMiniMonth\` and their CSS after verifying they have no consumers.
- No schema migration and no modifications to \`web/ui/kit.js\`, \`web/ui/shell.js\`, Android or other agents' files.

## Verification
- [x] Full web build/Node suite passes.
- [x] Calendar regression tests migrated to two view modes, basic item accessibility, no day-header copy and preserved overlap routines.
- [ ] Browser screenshot and action checks at 390px light/dark, 1280px light/dark; automated on \`redesign/p1-visual-qa\`.
- [ ] Real Android drag/resize, keyboard and Back acceptance.

## Handoff
- **T1** use \`planFocus(k,id)\` for Next and Fix.
- **T3** remove legacy Log rendering helpers once the new Log page is integrated.
- **P2** P1 has wired menu and fit sheet; remove old shell aliases when safe.
- **Integrator** remove unused legacy Calendar side-panel, month, 3-day, and plan-row code after T1/T3, preserving raw functions still used by drag/scheduling.
