# R0b — Design kit status

Branch: `redesign/r0b-kit` · Base: `main` · Date: 27 October 2026

## Delivered

- Bundled icon map in `web/ui/icons.js`: Lucide SVG paths, each local and using the inherited `currentColor`, plus backwards-compatible aliases from the old `P` icon registry.
- Reproducible `tools/icons.py` generator: prefers installed `lucide-static` assets and otherwise retrieves the upstream SVG. The checked-in bundle does **not** require a network request at runtime.
- System-font design tokens, old-token aliases, neutral/accent light and dark themes, responsive screen/nav/sheet/menu/toast styling and visible keyboard focus in `web/ui/kit.css`.
- `web/ui/kit.js` implements the §18.1 component API: icon/button/row/group/field, switches, segmented controls, chips, numeric/time/date/duration fields, text/textarea, activity picker, colour swatches, collapsibles, empty state, sheet/page headers and footer, nav, menu, dialog, page stack and back, long-press and a component gallery page.
- `web/test/kit_test.js` independently tests component semantics, escaping, registration and back-navigation priority.

## Integration notes

These files are intentionally **not** loaded by the old monolithic `web/build.py`. Loading and validation of the newly split sources is assigned to **R0a**. Existing app behaviour and stored data have not been touched.

1. R0a must declare `ACT`, `VIEWS`, `SHEETS`, `PAGES` and preserve the pre-existing `P` before `icons.js` / `kit.js` are loaded.
2. R0a must add `#pop` for the menu and dialog and wire Escape/history/Android back through `goBack()`.
3. R0a should delete old `:root` declarations from the moved legacy CSS so the kit token declarations take precedence. Keep temporary old aliases until Phase 3.
4. R0a should use `kNav(UI.view)` as the four-tab navigation and `k-page` / `k-sheet` wrappers when rendering registered pages and sheets.
5. To regenerate the exact bundled icon set offline, install `lucide-static` (or run `tools/icons.py` with GitHub access), commit its output, and verify old aliases. Fallbacks used because source names were unavailable on the upstream branch: `trash` for `trash-2`, `clock-3` for `history`, and `archive-x` for `archive-restore`.

## Requests

- **R0a:** Preserve the existing `icon(name,cls)` wrapper and its `P` map; load the local icon and kit scripts in the order §18.4 specifies.
- **Integrator:** Check and refine the Settings/Today screen kit usage after R0a lands; do not merge this PR automatically.
- **R0a/device validation:** Verify long-press cancellation on move, touch targets, native Android back, sheet focus and wide-screen placement after `#pop` and page/sheet rendering exist.

## Acceptance checklist (§20.2)

- [ ] 390px light/dark and 1280px screenshot match — *blocked until R0a wires the kit into the app*.
- [x] New kit components contain no help paragraphs; UI strings are short.
- [x] Kit component typography uses system-font tokens; no serif or monospace.
- [x] Icon buttons include matching `aria-label` and `title`; CSS gives 40px, 44px on touch.
- [x] Kit primitives support a single primary action.
- [x] `goBack()` handles dialog/menu → sheet → page → Today in that order in the unit test.
- [ ] Full empty-state visual check — *requires R0a*.
- [ ] No sideways scroll — *requires Playwright/screenshots after R0a*.
- [ ] CI tests passed — *pending PR Actions result*.
- [x] Only R0b-owned code and required status file changed.
