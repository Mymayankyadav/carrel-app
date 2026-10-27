# Carrel: minimalist redesign plan (parallel agents)

> **Read Part 2 (section 12 onward) first.** It was added later and replaces Part 1 wherever they differ: icons first,
> subscreens, every screen and modal specified, and 14 agents instead of 6. Part 1's design rules (section 1) still apply.

Written 27 Oct 2026 by Opus for smaller models. The user's brief, in their words: *"minimalist UI… I see a lot of irrelevant
text spread across the UI… the notification is the ugliest thing… lots of buttons, not simple. Redesign the whole UI with
minimalism and simplicity in mind."* Plus: the app header "blocks the view" like no normal Android app does.

Before screenshots: `docs/redesign/before-today-phone.jpg`, `docs/redesign/before-notification.jpg`.

**Phases.** Phase 1: **R0** (restructure + design system + shell) and **R5** (Android) run in parallel.
Phase 2 starts only after R0 is merged to `main`: **R1, R2, R3, R4** in parallel (R5 may continue). Phase 3: integrator.
R0 is the riskiest job. If you can choose, give it the strongest model you have; the others are fine on smaller models.

---

## 1. Design rules (every agent applies these to everything it touches)

1. **One primary action per screen.** Everything else is a quiet text button or lives in a sheet.
2. **No text that explains the UI.** Delete helper paragraphs, hints ("Drag blocks to move…", "Counts often rise at first…"),
   "From Claude" banners on main screens, and repeated labels. Button labels ≤ 2 words. Empty states: one short line, no paragraph.
3. **Show only numbers the user acts on.** No "untracked since…" counters, no "vs same point last week", no catch-rate KPIs on main screens.
4. **Secondary things go behind one tap** (a sheet or the Settings tab), never on the main surface.
5. **No top app bar.** No brand/logo row, no "Saved" text. Content starts under the status bar.
   Sync state appears **only when something is wrong** (offline with waiting changes, can't save), as one small line at the top of Today.
6. **Colour:** neutral greys + one accent. Activity colours appear only as an 8 px dot or a thin 3 px bar, never as fills or tinted cards.
7. **One typeface:** the system font (`system-ui`, Roboto on Android). Timers use `font-variant-numeric: tabular-nums`.
   No serif, no monospace, no rubber-stamp date, no Google Fonts.
8. **Few borders, few cards.** Separate with spacing. At most one card per screen (Today's timer). Lists are plain rows with 1 px dividers.
9. **Touch targets ≥ 44 px.** Text ≥ 13 px. Contrast ≥ 4.5:1 for text.
10. **Remove, don't hide.** When a feature leaves the UI, delete its render function and CSS (keep data/logic functions other code still uses). Smaller is the goal.

### 1.1 Tokens (R0 puts these in `web/ui/base.css`; everyone else uses only these)
```css
:root{
  --bg:#FAFAF9; --surface:#FFFFFF; --text:#18181B; --text-2:#71717A; --line:#E7E5E4;
  --accent:#0F766E; --on-accent:#FFFFFF; --danger:#B91C1C; --scrim:rgba(0,0,0,.4);
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px;
  --r:12px; --r-sm:8px;
  --t-xs:13px; --t-sm:15px; --t-md:17px; --t-lg:22px; --t-xl:34px; --t-timer:64px;
  --font:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
/* dark: same names */  --bg:#0C0C0D; --surface:#17171A; --text:#F4F4F5; --text-2:#A1A1AA; --line:#27272A;
                        --accent:#2DD4BF; --on-accent:#042F2E; --danger:#F87171; --scrim:rgba(0,0,0,.6);
```
Dark values go under `@media (prefers-color-scheme: dark)`. Desk view (full-screen focus) is always dark.

### 1.2 Components (R0 builds them; class names are fixed so Phase 2 can code against them)
| Class | What it is |
|---|---|
| `.screen` | page container: `padding: calc(env(safe-area-inset-top) + 16px) 16px calc(72px + env(safe-area-inset-bottom))`; max-width 640px, centred |
| `.h1` / `.h2` | 22px/600 screen title; 13px/600 uppercase-free section label in `--text-2` |
| `.btn` / `.btn.primary` / `.btn.text` | 44px tall; primary = accent fill; `.text` = no border, accent text |
| `.row` | list row: 52px min height, flex, label left / value right, 1px `--line` bottom border; `.row .sub` = 13px `--text-2` |
| `.dot` | 8px circle; colour from inline `--c` |
| `.seg` | segmented control (2–3 options) |
| `.chip` | 36px pill for activity quick-picks |
| `.sheet` | bottom sheet with drag handle, title row (title + close icon), content; max-height 90vh, scrolls |
| `.toast` | one line, above the nav, auto-hide 4s, optional `Undo` |
| `.empty` | one centred line in `--text-2` |
| `.nav` | bottom nav, 4 items, icon + 12px label, accent for current |

---

## 2. Target screens (what each Phase-2 agent builds)

### Navigation (R0)
Bottom nav, 4 tabs: **Today · Plan · Stats · Settings** (Calendar → Plan; Week + Patterns → Stats; Setup sheet → Settings tab). No top bar.

### Today (R1)
```
Tue 27 Oct                               2h 54m      ← --t-sm, --text-2; studied today. Nothing else up here.
                                                       (only if sync problem: "Offline · 3 waiting" in --danger, one line)
┌──────────────────────────────────────────────┐
│ ● Physics                                    │    ← running: --t-md, dot = activity colour
│ 1:24:05                                      │    ← --t-timer, tabular
│ Focus · 12 min left                          │    ← only with pomodoro; --text-2
│ [   Stop   ]   Break                         │    ← Stop = .btn.primary full width-ish; Break = .btn.text
└──────────────────────────────────────────────┘
Noticed                                               ← .btn.text, only while studying; opens sheet: "Urge" / "Drifted… min" / park text field
Up next                                               ← .h2
● Mathematics            4:50 pm        1h 30m        ← .row, max 3 rows; tap → opens Plan tab on that block
● Physics                8:30 pm          45m
Switch                                                ← .h2
[● Physics] [● Maths] [● Chemistry] [Break] [More]    ← .chip row, horizontal scroll, study first; "More" opens sheet with all activities
```
Idle (nothing running): the card shows `Not tracking` (--text-2, --t-md) and **no counter**. Under it, study activities as a 2-column grid of
large buttons (tap = start now). If the last study ended < 3 h ago, show one `.btn.text` "Resume Physics". Then the Up next rows.
**Long-press** an activity (chip or grid button) → sheet: "Start at" (now / 5 / 10 / 15 / 30 min ago / after last entry) and Pomodoro on/off + preset.
**Removed from Today:** date stamp and day arrows, deadline chips, pomodoro toggle row + preset select + "Starting now" select,
park-thought input, plan header/controls, "From Claude" note, yesterday-carry banner (moves to Plan), log, day breakdown, life-activity chip wall.

### Plan (R2) — was Calendar
```
‹  Tue 27 Oct  ›                    [Today] [≡]       ← [Today] only when not on today; [≡] opens the Tasks sheet
[ Day | Week ]                                         ← .seg; default Day on phones. "3 days" removed. Plan/Log filter removed.
| timeline: logged entries solid (thin colour bar + name), planned blocks outlined dashed, busy events grey hatched |
| one line under the header when needed:  "45m doesn't fit · Fix"  → sheet with Shrink / Move to tomorrow / Work later |
                                                      (+) FAB, clear of the nav
```
- Tasks sheet `[≡]`: three plain lists — Deadlines, Backlog, Timetable — each with a `+`. No explanatory text.
- Yesterday's unfinished plan: one row at top of today's Day view, `1h 12m left from yesterday · Add`; dismiss with ×.
- Block, entry, split and wrap-up sheets: keep their function, strip helper text, use `.row`/`.btn`.
- The old Today "Plan" list (blocks with progress bars) goes away; blocks are edited on the timeline (tap → sheet).
- Week targets → Stats. Google Calendar panel → Settings. "Where the day went" breakdown → deleted.

### Stats (R3) — Week + Patterns merged
```
[ Week | Month ]                                       ← .seg. Week = this week (‹ › to page); Month = last 4 weeks
8h 46m                                                 ← --t-xl
4h 23m a day                                           ← --text-2
| stacked bars by day, goal line, no y-axis labels except the goal |
Subjects                                               ← .h2
● Mathematics   4h 15m / 9h  ▬▬▬▬───                   ← .row with thin progress bar (this replaces "Week targets")
● Physics       2h 54m / 10h ▬▬──────
Insights                                               ← .h2, max 3 one-line sentences
When you study                                         ← hour × weekday heatmap (Month only)
```
**Deleted:** KPI grid (days studied, pomodoros, plan followed), day ribbons, life-around-study, weekly review card,
distractions block, consistency squares, stretch histogram, subjects-by-week, study-hours spans, focus-by-hour, example-data mode banner.
(Keep the logic functions in `logic.js` only if something still calls them; otherwise R3 deletes them and their tests.)

### Settings (R4) — Android-style list, no paragraphs
Sections (each a `.h2` + `.row`s; a row shows its current value on the right; tap → small sheet):
**Activities** (list, tap = edit name/colour/kind/goal, `+ Add`) · **Timer** (Pomodoro default on/off, focus/short/long/every, max timer hours) ·
**Day** (day starts at, week starts on, 12/24 h, plan ends at) · **Phone** (R5's panel rendered as rows) · **Google Calendar** (connect / refresh) ·
**Data** (export) · **Account** (email, Sign out) · **About** (app build, web version, Check for updates).

### Notification (R5)
Standard Android notification only. Collapsed and expanded look the same:
```
⏱ Carrel                                      ← system header (small icon tinted --accent). No subtext, no "0 caught".
Physics                                        ← title
Focus · ends 6:45 pm                           ← text; chronometer counts in the header time (setUsesChronometer)
STOP                                           ← one action. Break due → "BREAK" + "STOP". On break → "BACK TO PHYSICS".
```
No custom layout, no coloured dot, no Urge/Drifted/Park (they become an opt-in setting, default **off**).
Undo after stop: `Stopped Physics · 45m` with one `UNDO` action, disappears after 10 s. No "A moment to change your mind", no "Saving…".

---

## 3. Rules for all agents

### 3.1 Setup and checks
```bash
git checkout main && git pull && git checkout -b redesign/<id>      # e.g. redesign/r1-today
python3 web/build.py
for f in web/test/*_test.js; do TZ=Asia/Kolkata node "$f" || exit 1; done
python3 tools/shots.py /tmp/s && python3 tools/shots.py /tmp/s-dark --dark   # look at the PNGs of YOUR screen
```
Done = build OK, all tests pass, `shots.py` prints `OK`, your screen matches section 2 in light and dark at 390 px.
The shell can't reach npm, Maven or Supabase; Android builds only run in GitHub Actions (`gh run list`, `gh run view <id> --log-failed`).
Save tokens: `grep -n` then read ranges; never paste whole files.

### 3.2 Ownership (after R0 lands)
| Agent | Owns (edit only these) |
|---|---|
| R0 | `web/core/*`, `web/ui/shell.js`, `web/ui/base.css`, `web/files.json`, `web/build.py`, `web/test/src.js`, `web/test/shell_test.js`, `tools/shots.py` |
| R1 Today | `web/ui/today.js`, `web/ui/today.css`, `web/test/today_test.js` |
| R2 Plan | `web/ui/plan.js`, `web/ui/plan.css`, `web/cal.js`, `web/test/plan_test.js`, `web/test/calendar_test.js`; in `logic.js`: `planCompute`, `projectPlan`, `busyFor`, `mergeIntervals`, `dayCapacity`, `layoutOverlaps` |
| R3 Stats | `web/ui/stats.js`, `web/ui/stats.css`, `web/test/patterns_test.js`, `web/test/logic_test.js`; in `logic.js`: `aggregate`, `pomodoroByDay`, `studySessions`, `patternsModel`, `insights`, `distractionStats`, `exampleEntries`, `mulberry32` |
| R4 Settings | `web/ui/settings.js`, `web/ui/settings.css`, `web/gcal.js`, new `web/test/settings_test.js` |
| R5 Android | `android/**`, `web/native.js`, `capacitor.config.json`, `package.json`, `.github/workflows/android.yml`, `tools/patch_android.py` |
| Frozen in Phase 2 | `web/core/*`, `web/ui/shell.js`, `web/ui/base.css`, `web/supa.js`, `web/auth.js`, `web/config.js`, `web/boot.js`, rest of `logic.js` |

- Register things, don't edit shared switch statements: `VIEWS.today = vToday`, `SHEETS.entry = sEntry`, `Object.assign(ACT, { 'r1-x'() {…} })`.
  Prefix new action names and new CSS classes that aren't components with your id (`r1-…`).
- Need something in a frozen file (a new token, a core action change)? Don't edit it. Write it under "Requests" in
  `docs/redesign/status-<id>.md`; the integrator does it. Meanwhile use a local workaround in your own file.
- Don't change stored data shapes (`days/*`, `plans/*`, `state/current`, `config/*`, `distractions/*`).
- Tests that assert old UI in your area: rewrite or delete them; keep tests of logic.
- One commit per task: `<id>: <task> <summary>`. Open a PR to `main` with before/after screenshots. Don't merge it yourself.

---

## 4. R0 — Restructure, design system, shell (Phase 1, blocking)

Goal: split the 2,300-line `app.js` and `style.css` into per-screen files **without changing behaviour**, then add tokens,
components and the new shell. Do R0.1–R0.3 as **pure moves** in separate commits, so mistakes are easy to see.

**R0.1 Build manifest.** Create `web/files.json`:
```json
{ "js": ["config.js","supa.js","core/state.js","core/sync.js","core/actions.js","ui/today.js","ui/plan.js","cal.js",
         "ui/stats.js","ui/settings.js","gcal.js","native.js","ui/shell.js","auth.js","boot.js"],
  "css": ["ui/base.css","ui/today.css","ui/plan.css","ui/stats.css","ui/settings.css"] }
```
Change `build.py` to read it (replace the hard-coded `['config.js', …]` list and the `style.css` read; CSS = the files joined with `\n`).
`theme-color` and font bundling code: read `--bg` instead of `--paper`; delete the Google Fonts `<link>`s and the `CARREL_BUNDLE_FONTS` font-bundling code (rule 7), and remove that env line from `.github/workflows/web.yml`.
Create `web/test/src.js` that exports `{ app, css }` = all `files.json` js (except config/supa/auth/boot/native) and all css joined.
In every test, replace `readFileSync(… '../app.js')` with `require('./src').app` and `'../style.css'` with `require('./src').css`.

**R0.2 Split `app.js` by its section headers** (`/* ---------- name ---------- */`). Write a small Python script in the scratchpad (not committed) that cuts by header and appends to:
| Target | Sections of `app.js` |
|---|---|
| `core/state.js` | file top (before `small helpers`), `small helpers`, `derived state`, `write sets, commit and undo` |
| `core/sync.js` | `local view of the database` |
| `core/actions.js` | `timer actions`, `entry editing`, `plan actions`, `activities and settings`, `copy`, `export` |
| `ui/today.js` | `views: Today`, `distractions: noticed, drifted, parked`, `desk view`, `desk view helpers` |
| `ui/plan.js` | `views: plan`, `views: log`, and functions `sEntry`, `sSplit`, `sBlock`, `sWrap` from `views: sheets` |
| `ui/stats.js` | `example data for empty Week and Patterns pages`, `views: Week`, `views: Patterns` |
| `ui/settings.js` | function `sSetup` from `views: sheets` |
| `ui/shell.js` | `views: shell`, `vSheet` and `actPick` from `views: sheets`, `toast`, `rendering…`, `sheets helpers`, `actions`, `events`, `boot` |
Then delete `app.js`. Load-order trap: top-level code that runs immediately must not use a `const` defined in a later file.
So at the very top of `core/state.js` add `const ACT = {}, VIEWS = {}, SHEETS = {};` and change the `actions` section's
`const ACT = {` into `Object.assign(ACT, {` (closing `});`). If the page shows `PAGEERROR … before initialization`, move that definition into `core/state.js`.
Check: build, all tests, `shots.py` → `OK` and screenshots identical to `main`.

**R0.3 Split `style.css`** by its section headers: `ui/base.css` = top through `section heads` + `sheets` + `toast`;
`ui/today.css` = `day header…`, `Today grid`, `timer card`, `switcher`, `desk view`; `ui/plan.css` = `plan`, `log: timeline`, `log: list`, `day breakdown`, `calendar`;
`ui/stats.css` = `week + patterns`; `ui/settings.css` = empty with a header comment. Delete `style.css`. Check screenshots identical.

**R0.4 Registries.** In `vMain` use `VIEWS[UI.view]`; in `vSheet` use `SHEETS[sh.type]`. Each view file registers its own
(`VIEWS.today = vToday`, `SHEETS.entry = sEntry`, … and `cal.js` registers `qnew`, `busy`, `deadline`, `task`). View names: `today`, `plan`, `stats`, `settings`;
keep the old `calendar`/`week`/`patterns` names working as aliases until Phase 2 (`VIEWS.calendar = VIEWS.plan` etc.).

**R0.5 Tokens + components.** Rewrite `ui/base.css` top: tokens from 1.1 (replace old token names; add temporary aliases
`--paper:var(--bg); --ink:var(--text); --ink-2:var(--text-2); --ink-3:var(--text-2); --rule:var(--line); --lamp:var(--accent); …` so old screen CSS keeps working until Phase 2 rewrites it — list every old token you alias),
base typography (`--font`, 15px body), and every component in 1.2.

**R0.6 Shell.** Delete `vHeader` and the `#hdr` element (and `body::before` status-bar filler). Bottom nav = 4 tabs (section 2).
Settings becomes a tab (`UI.view = 'settings'`, rendering `SHEETS.setup` content full-screen until R4 replaces it).
Sync problems: export `vSyncLine()` from shell (returns '' when fine, else one `.r0-sync` line) for R1 to place on Today.
Running-timer pill in the old header: delete (Today owns the timer; other tabs don't show it).
Toast: `.toast` above the nav.

**R0.7 Tests + tools.** Update `shell_test.js` for the new shell. `tools/shots.py`: views are `today, plan, stats, settings` (click `#nav [data-v=…]`).
Merge R0 before Phase 2 starts. Post in `docs/redesign/status-r0.md`: the final list of functions each Phase-2 file exports and any old CSS token aliases.

---

## 5. R1 — Today (Phase 2)
Owns `web/ui/today.js`, `web/ui/today.css`, `web/test/today_test.js`. Build the Today screen exactly as in section 2.
1. Rewrite `vToday`: header line (date left, studied-today right), `vSyncLine()` under it, timer card, Noticed, Up next, Switch.
2. Timer card running/idle as specified. **No untracked counter.** Delete the date stamp, day navigation, deadline chips, folds, plan list, log, breakdown, onboarding paragraphs.
3. Up next: from `planModelFor(todayKey())` rows that are not done, first 3 by time (`r.pieces[0][0]`); tap → `UI.view='plan'` and `UI.cal` focused on that block (set the same `UI.cal` fields `cal.js` uses for date; read, don't edit `cal.js`).
4. Switch chips: study activities first, then Break, then `More` (sheet `r1-more` listing all non-archived activities as `.row`s with dots).
5. Long-press (500 ms, cancel on move > 8 px) on chips/grid → sheet `r1-start` with start-at and pomodoro options; call existing `startActivity(id, { at, pomoPreset })`.
6. Noticed sheet `r1-notice`: buttons `Urge`, `Drifted` (then 5/10/15/30 min), text field `Park a thought` + `Save`. Reuse the existing distraction actions.
7. Desk view (full-screen focus): keep, restyle with tokens: name, timer, Stop. Nothing else.
8. Copy pass: no sentence longer than 6 words anywhere on Today.

## 6. R2 — Plan (Phase 2)
Owns `web/ui/plan.js`, `web/ui/plan.css`, `web/cal.js`, plan tests, plan/layout functions in `logic.js`.
1. `vCalendar` → `VIEWS.plan`: header (‹ date › / Today / ≡), `.seg` Day|Week, timeline, FAB. Delete 3-day mode, the Plan/Log/Plan+log filter, the mini-month, and every side panel from the main screen.
2. Timeline styling: entries = surface + 3 px left colour bar + name (one line, ellipsis) + time only if height ≥ 40 px; planned = dashed `--line` outline, `--text-2` name; busy = `--line` hatch, no icon. Now-line in `--danger` 1 px.
3. Tasks sheet `r2-tasks` with Deadlines / Backlog / Timetable lists (move `vDeadlinesPanel`, `vBacklogPanel`, `vTimetablePanel` content in, strip text). "Find time for all" stays as a `.btn.text` in Backlog.
4. Overflow line + fix sheet (`planShrink`, `planOverflow`, plan-end time) replaces the old overflow card. Yesterday-carry as one dismissible row.
5. Restyle entry/split/block/wrap/qnew/busy/deadline/task sheets with components; delete helper paragraphs.
6. Delete `vPlan`, `vBlk`, `vAddBlock`, `vLog`, `vList`, `vBreakdown`, `vTargetsPanel` (targets move to Stats — tell R3 nothing; R3 rebuilds from `aggregate`), ribbons, and their CSS.
7. Drag/resize must still work (touch long-press). Check in the mock page with Playwright `page.mouse` drag.

## 7. R3 — Stats (Phase 2)
Owns `web/ui/stats.js`, `web/ui/stats.css`, stats tests, stats functions in `logic.js`.
1. `VIEWS.stats`: `.seg` Week|Month, big total, per-day average, stacked day bars with goal line (SVG, no axis text except goal), Subjects rows with goal progress (goals from activity `goal`), Insights (max 3 from `insights()`), heatmap in Month.
2. Delete everything listed under "Deleted" in section 2 (render functions + CSS). Delete logic functions only nothing else uses (`grep -rn name web/`), with their tests.
3. Empty state: `.empty` "Log a few days to see stats." No example-data mode (delete `exampleMode`, `exEntries`, `vExBar` and `exampleEntries` if unused).
4. Charts: `role="img"` + one-sentence `aria-label`.

## 8. R4 — Settings (Phase 2)
Owns `web/ui/settings.js`, `web/ui/settings.css`, `web/gcal.js`, `web/test/settings_test.js`.
1. `VIEWS.settings`: sections from section 2 as `.row`s, value on the right; each opens a small sheet (`r4-…`). Delete the old `sSetup` long form.
2. Activities: list with dot + name + kind; tap → edit sheet (name, colour swatches, Study/Life `.seg`, weekly goal, Archive). Drag-reorder not needed: `↑ ↓` in the edit sheet.
3. Phone: call `vPhonePanel()` from `native.js` (R5 restyles it as rows). Google Calendar: move the panel from `cal.js`'s side panel here (copy the needed markup; R2 deletes theirs).
4. About: app build + web version from `UPDI` (native.js) and `Check for updates` button (`data-act="upd-check"`).
5. Sign out: `.btn.text` in `--danger`; existing `ACT.signout` already confirms unsaved changes.
6. Zero explanatory paragraphs. A row may have one `.sub` line (≤ 6 words) only when the value needs context.

## 9. R5 — Android: notification, edge-to-edge, updates (Phase 1, parallel with R0)
Owns `android/**`, `web/native.js`, `capacitor.config.json`, `package.json`, `android.yml`, `tools/patch_android.py`.
1. **Notification** (`live/Notifications.kt`, `live/NotificationModel.kt`): remove `RemoteViews`, `DecoratedCustomViewStyle`, `setCustomBigContentView`, `setLargeIcon(dot…)`, `setSubText`. Delete `res/layout/notification_expanded.xml` (and `res/drawable/notification_chip.xml` if unused — `grep -rn notification_chip android/`).
   Model: title = activity name (break: `Break`); text = `Focus · ends <h:mm a>` when pomodoro focus, `Break due` when due, break: `Back to <name>`, else null.
   Actions: always `Stop`; `Break` only when break is due; on break `Back to <name>` (needs a `carrel.RESUME` action → Engine resumes the `returnTo` activity; look at how `carrel.BREAK` is handled in `Receivers.kt`/`Engine.kt` and mirror it; if the engine has no resume path, skip this action and note it).
   `setColor(accent)` `#0F766E`, `setColorized(false)`. Keep chronometer, channel, privacy/public version.
   Distraction actions (Urge/Drifted/Park): only when new store flag `notifDistractions` is true (default false). Expose it through the plugin like the existing prefs (see `CarrelLivePlugin.prefs()`), and a toggle row in `vPhonePanel()`.
   Undo notification: title `Stopped <name> · <duration>`, no text, no subtext, action `Undo`.
   Update `NotificationModel` unit tests if any exist (`grep -rn notificationModel android/app/src/test`); add a small JVM test for the model text if a test source set exists.
2. **Edge-to-edge, no action bar**: app theme parent must be a `DayNight.NoActionBar` theme (check `AndroidManifest.xml` `android:theme` and `res/values/styles.xml`).
   In `MainActivity.onCreate` after `super.onCreate`: `WindowCompat.setDecorFitsSystemWindows(getWindow(), false)`; transparent status and navigation bars;
   status-bar icon colour follows night mode (`WindowCompat.getInsetsController(...).setAppearanceLightStatusBars(!night)`).
   The web side already pads with `env(safe-area-inset-*)`; confirm on the APK that content isn't under the status bar. If the WebView reports 0 insets, inject them as CSS variables `--sat`/`--sab` from Java via `bridge.getWebView().evaluateJavascript` on `ViewCompat.setOnApplyWindowInsetsListener` and post to R0's status file asking `.screen` to use `max(env(safe-area-inset-top), var(--sat, 0px))`.
3. **`vPhonePanel()` restyle** to `.row`s with right-side `On/Off`; remove explanatory text.
4. **Update path visible**: Settings → About shows `web 1.0.N` (from `UPD.current()`) so the user can tell whether an update applied. After downloading an update, show the toast `Update ready · Restart` with a button calling `UPD.reload()` (check the Capgo updater API name in `node_modules/@capgo/capacitor-updater/dist/docs.json` in CI or its README; if `reload` exists use it, else keep the "Reopen Carrel" toast).
5. Icon/splash: keep. Verify every change through the Android CI run and attach the APK link in the PR.

---

## 10. Integrator (Phase 3)
1. Merge R0 first (Phase 1), plus R5 when green. Then R4 → R3 → R2 → R1.
2. After each merge: build, all tests, `shots.py` light + dark, look at all 4 screens.
3. Do the requests in `docs/redesign/status-*.md` that touch frozen files. Then delete R0's temporary token aliases (`grep -rn "var(--paper\|--ink\|--lamp\|--rule" web/`) and any CSS no selector uses.
4. Final check against section 1, rule by rule, on every screen. Count visible text: no screen should have a paragraph.
5. Ask the user to install the new APK once (native changes), then confirm web updates land.

## 11. Backlog (not part of this redesign)
- Writes that fail 10 times are dropped (`core/sync.js` `pump`). Keep them in an exportable "failed changes" list instead.
- Supabase advisor: leaked-password protection is off (WARN). Ask the user.
- Real-device checks still pending: auth recovery after "can't save", realtime deletes across two devices.

---
---

# Part 2: Redesign v2. Every screen, icons first, subscreens

Added 27 Oct 2026 (evening) after reviewing every screen, sheet and notification in the current build.
The user asked for: more minimalism, **icons wherever possible**, **collapsible controls or subscreens** (above all in Settings),
the same philosophy applied to every screen and modal, and a plan that many agents can run in parallel.

**Precedence.** Part 2 replaces Part 1 where they differ.
- Agents: R0 becomes **R0a + R0b**. R1–R4 become **W1, T1–T3, P1–P3, S1–S2, G1–G2**. R5 stays, with the additions in §16.15–16.16 and §19.
- Files: Part 1's `ui/base.css` becomes `ui/kit.css` (R0b) plus `ui/legacy.css` (R0a).
- Class names: component classes from §1.2 get a `k-` prefix (`.k-btn`, `.k-row`, `.k-sheet` …), because old markup already uses `.btn`, `.row` and `.sheet`.
- Keep Part 1 for: design rules §1, tokens §1.1, setup and checks §3.1, R5's notification work §9.

---

## 12. Philosophy v2: the container ladder

Every piece of UI goes in the **lowest** container that fits. Move it up a step only when the rule in the right column says so.

| Container | Use it for | Rules |
|---|---|---|
| **Screen** (tab) | Today, Plan, Stats, Settings | 48 px header row, no title bar, bottom nav |
| **Subscreen** (pushed page) | lists; groups of settings; anything with more than 5 controls or its own navigation | back arrow + title; system back pops it; slides in from the right; the tab stays highlighted |
| **Sheet** (bottom) | create or edit **one** thing, ≤ 6 visible controls | handle, title, ≤ 3 icon actions, one primary button, **no Cancel button** |
| **Collapsible** | optional or advanced controls inside a sheet or subscreen | closed by default; the summary row shows the current value; chevron turns when open |
| **Menu** (⋮ popover) | rare actions on the current thing, ≤ 5 items | icon + label per item; a danger item goes last, in red |
| **Dialog** | irreversible actions that have no undo | title, one line, `Cancel` and the action |
| **Toast** | the result of an action, with Undo when possible | one line; 4 s, or 8 s when it has Undo |

Decision rules:
1. **Undo beats confirm.** Delete, archive, discard and clear happen at once and show `Undo`. The only dialog left in the app is "sign out with unsaved changes".
2. **Settings save themselves.** Every control in a Settings subscreen saves on change; no Save buttons there. Sheets save with their primary button.
3. **Progressive disclosure.** Show the 1–3 controls people use most; put the rest in a `More` collapsible.
4. **Icons first.** Use an icon instead of a word whenever the icon can't be misread (§13). Keep the word when it could be: `Resume`, `Wrap up`.
5. **No labels on self-evident groups** (switch chips, the timeline, the nav). Use a small section label only when two lists share a screen.
6. **One primary button per screen or sheet** (accent fill). Everything else is tonal, text or icon.
7. **If it can't be acted on or understood at a glance, remove it.**

---

## 13. Icons

**Library:** Lucide (ISC licence), 24 px viewBox, stroke width 1.75, round caps and joins, `stroke="currentColor"`, no fill.
**R0b** writes `tools/icons.py`. It reads each SVG from `node_modules/lucide-static/icons/<lucide>.svg`; if npm is blocked it fetches
`https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/<lucide>.svg` instead. It then writes `web/ui/icons.js` as
`Object.assign(P, { name: '<inner svg markup>', … });` (`P` is the existing icon map; `icon(name)` already reads it).
Commit the generated file. If a Lucide name doesn't exist, use the closest icon and record the substitution in `docs/redesign/status-r0b.md`.

**Sizes:** 20 px inside 40 px icon buttons (sheet headers, rows), 24 px in the nav and in 48 px buttons, 16 px next to text.
**Colours:** `--text-2` by default, `--text` when active or pressed, `--accent` for the current tab and for text buttons, `--danger` for delete.
**Rules:** every icon-only button has `aria-label` and `title` with the same text. Hit area is at least 40 px (44 px on touch).
No decorative icons, except the leading icons on Settings rows.

| `icon('…')` | Lucide | Used for |
|---|---|---|
| `today` | `timer` | Today tab |
| `plan` | `calendar-days` | Plan tab |
| `stats` | `chart-column` | Stats tab |
| `settings` | `settings` | Settings tab |
| `back` | `arrow-left` | subscreen back |
| `close` | `x` | close a sheet, dismiss a row |
| `prev` / `next` | `chevron-left` / `chevron-right` | day / week paging |
| `open` | `chevron-right` | row that opens a subscreen (16 px) |
| `expand` | `chevron-down` | collapsible (rotates 180° when open) |
| `add` | `plus` | add anything, FAB |
| `minus` | `minus` | stepper down, time nudge −5 min |
| `more` | `ellipsis-vertical` | ⋮ menu |
| `edit` | `pencil` | edit |
| `delete` | `trash-2` | delete, discard |
| `start` | `play` | start, resume |
| `stop` | `square` | stop timer |
| `break` | `coffee` | break |
| `focus` / `unfocus` | `maximize-2` / `minimize-2` | enter / leave focus mode |
| `pomodoro` | `hourglass` | pomodoro status |
| `urge` | `zap` | Noticed (urge) |
| `drift` | `wind` | drifted |
| `park` | `bookmark` | park a thought |
| `tasks` | `list-todo` | Tasks subscreen |
| `week` / `day` | `calendar-range` / `calendar-1` | Plan: switch to week / day view |
| `jump` | `locate-fixed` | Plan: back to today |
| `deadline` | `flag` | deadline |
| `backlog` | `inbox` | backlog, send to backlog |
| `weekly` | `calendar-clock` | weekly timetable item |
| `busy` | `briefcase` | busy time |
| `schedule` | `calendar-plus` | find time for one task |
| `autoplan` | `wand-sparkles` | plan all backlog |
| `fit` | `shrink` | shrink to fit |
| `tomorrow` | `arrow-right` | move to tomorrow |
| `later` | `clock` | plan end time, work later |
| `carry` | `history` | yesterday's unfinished plan |
| `pin` / `unpin` | `pin` / `pin-off` | fixed time |
| `split` | `split` | split an entry |
| `dup` | `copy-plus` | duplicate |
| `copy` | `copy` | copy text |
| `wrap` | `moon` | wrap up the day |
| `note` | `sparkles` | Claude's plan note, Claude prompts |
| `done` | `check` | mark done |
| `undo` | `undo-2` | undo |
| `rate1` / `rate2` / `rate3` | `battery-low` / `battery-medium` / `battery-full` | focus: scattered / okay / deep |
| `offline` | `cloud-off` | sync line |
| `warn` | `triangle-alert` | can't save; doesn't fit; running too long |
| `refresh` | `refresh-cw` | refresh, check for updates |
| `activities` | `shapes` | Settings › Activities |
| `timer` | `timer-reset` | Settings › Timer |
| `daycfg` | `sunrise` | Settings › Day |
| `bell` | `bell` | Settings › Notifications |
| `gcal` | `calendar-sync` | Settings › Google Calendar |
| `export` | `download` | Settings › Export |
| `user` | `circle-user` | Settings › Account |
| `info` | `info` | Settings › About |
| `keys` | `keyboard` | Settings › Keyboard (desktop only) |
| `signin` / `signout` | `log-in` / `log-out` | account |
| `archive` / `unarchive` | `archive` / `archive-restore` | archive an activity |
| `up` / `down` | `arrow-up` / `arrow-down` | move in order |
| `insights` | `lightbulb` | Stats › Insights |
| `patterns` | `grid-3x3` | Stats › Patterns |
| `exam` / `due` / `other` | `graduation-cap` / `file-text` / `flag` | deadline type |
| `high` / `normal` / `low` | `chevrons-up` / `equal` / `chevrons-down` | task priority |
| `repeat` | `repeat` | weekly repeat |

Old names already in `P` (`clock`, `cal`, `bars`, `grid`, `sliders`, `stop`, `x`, `copy`, …) stay as aliases of the new drawings, so old markup keeps rendering until its owner rewrites it.

---

## 14. Micro-design rules (every screen, sheet and state)

**Type** (system font only):

| Role | Size / weight | Colour |
|---|---|---|
| Live timer | 64 / 300, `tabular-nums`, letter-spacing −0.02em (focus mode 96 / 200) | `--text` |
| Hero number (Stats) | 34 / 600, tabular | `--text` |
| Settings title, onboarding question | 22 / 600 | `--text` |
| Header row, sheet title, subscreen title | 17 / 600 | `--text` |
| Body, row label, input | 15 / 400 | `--text` |
| Row value, sub-line, section label | 13 / 400 (section label 13 / 600) | `--text-2` |
| Nav label | 12 / 500 | `--text-2`, current tab `--accent` |
| Timeline hour labels | 12 / 400, tabular | `--text-2` |

- Sentence case everywhere. No ALL-CAPS or letter-spaced labels (`UNTIL`, `FOCUS 2 OF 4`, `STUDY`, `LOGGED`, `PLAN AHEAD` all go). No bold inside sentences, no italics, no serif, no monospace.
- **Durations:** `1h 5m`, `45m`, `<1m`. Never seconds, except on the live timer.
- **Clock times:** follow the device's 12/24 h setting, lowercase `am/pm`. Ranges use an en dash with one am/pm when both match: `2:00–4:00 pm`.
- **Dates:** `Tue 27 Oct`. Relative words where shorter: `Today`, `Tomorrow`, `in 3d`.
- **Truncation:** user text is one line with an ellipsis everywhere, except sheet titles (they wrap to 2 lines).
- **Space:** 4-pt grid. Screen gutters 16. Section gap 24. Rows 52 tall (56 with a sub-line). Card padding 20. Sheet padding 16. Gap between stacked fields 12.
- **Shape:**
  - Radius 12 on cards; radius 16 on the top corners of sheets only; 8 on inputs and buttons; chips fully round.
  - Shadows only on sheets (`0 -8px 24px rgba(0,0,0,.12)`), the FAB and menus.
- **Colour use:**
  - Backgrounds are only `--bg` and `--surface`; cards get a 1 px `--line` border.
  - Accent only on the primary button, current tab, progress, text buttons and the focus ring.
  - Activity colour only as an 8 px dot, a 3 px bar, or a timeline block (12 % tint + 3 px bar).
  - `--danger` only for destructive actions, overrun and the now-line.
- **States:**
  - Pressed = `--line` overlay at 40 %.
  - Disabled = 40 % opacity and no pointer events.
  - Focus = 2 px `--accent` ring with 2 px offset, on `:focus-visible` only.
  - A selected chip is inverted (`--text` background, `--bg` text).
- **Motion:**
  - Sheet: 220 ms slide-up, `cubic-bezier(.2,.8,.2,1)`. Subscreen: 200 ms slide-in from the right; back reverses it.
  - Collapsible: 150 ms. Toast: 150 ms.
  - All of it is instant under `prefers-reduced-motion`.
- **Touch:**
  - `-webkit-tap-highlight-color: transparent`, and `user-select: none` on buttons, chips and nav.
  - Long-press = 450 ms with 8 px movement tolerance, plus `navigator.vibrate(8)` when available.
  - Swiping down on a sheet's handle closes it.
- **Inputs:**
  - Native `type=time` and `type=date`, shown as the value on the right of a field row; tapping the row calls `input.showPicker()`.
  - Number inputs use `inputmode="numeric"`; text inputs use `enterkeyhint="done"`.
  - The viewport meta gets `interactive-widget=resizes-content`, so the keyboard never covers a sheet's primary button.
- **Empty states:** one centred line in `--text-2`, plus at most one text button. No illustrations, no paragraphs.
- **Loading:** no spinners. Show cached data; if there's nothing to show after 300 ms, run a 2 px indeterminate accent bar along the top edge.
- **Errors:** one line where the problem is: a field error under its field (13 px `--danger`); sync problems in the sync line (§15.9).
- **Wide screens** (≥ 960 px, the web app):
  - Content max-width 640, centred (Plan 1180). The bottom nav becomes a 72 px left rail (icon above label).
  - Sheets become centred 480 px panels. Hover = `--line` overlay at 25 %.

---

## 15. Shell v2 (R0b builds the parts, R0a wires them)

15.1 **Root header row** (48 px; each tab renders its own): Today = date + studied total; Plan = date pager + icons; Stats = range pager + Week/Month; Settings = the title `Settings`.
15.2 **Nav:** 4 items, 64 px plus the bottom safe area, `--surface` background, 1 px `--line` on top. Current item = accent icon + label. No badges, no Setup button.
15.3 **Subscreen header** (56 px): `back` icon button, title 17/600 (ellipsis), up to 2 icon buttons on the right. The bottom nav stays visible under subscreens.
15.4 **Back order** (Android back, Escape, browser back): close menu or dialog → close sheet → pop subscreen → switch to the Today tab → minimise the app.
- R0b implements `goBack()`, which returns `true` when it handled the event.
- R5 wires the Android back button: `if (!goBack()) CAP.App.minimizeApp()`.
- R0a pushes a `history` state for each sheet and subscreen, so browser back works on the web.

15.5 **Sheet anatomy:** handle (36×4, `--line`, 8 px from the top) → header 48 px (title on the left, up to 3 icon actions, `close` always last) → body (scrolls) → sticky footer holding the primary button (full width, 48 px), or one tonal + one primary side by side.
- Max height 92 vh.
- Closing a sheet with changes discards them silently.

15.6 **Menu:** popover under the ⋮ button, 220 px wide, 44 px rows with a 20 px icon and a label; a danger item goes last in `--danger`; tapping outside closes it.
15.7 **Dialog:** centred 320 px card; title 17/600, one line 15 `--text-2`; right-aligned text buttons `Cancel` and the action (red when destructive).
15.8 **Toast:**
- Snackbar style: `#27272A` background with `#FAFAFA` text in both themes, 48 px tall, radius 8, sitting 16 px above the nav.
- One line, plus at most one action (`Undo` in `#5EEAD4`). A new toast replaces the old one.
- `toast(msg, {rate})` no longer shows rating buttons. The shell stores `UI.lastRate = rate` for Today (§16.4).

15.9 **Sync line** (top of Today only; hidden when everything is fine):
- `offline` icon + `Offline · 3 waiting`.
- Or `warn` icon + `Can't save` + text button `Retry` (`a1-reconnect`).

15.10 **Update ready:** a toast with no timeout: `Update ready` + action `Restart` (R5's `upd-restart`).

---

## 16. Screen and modal specs

Wireframes are 390 px wide. `[ ]` = button, `( )` = switch, `▸` = collapsible, `⌄` = expandable value, `›` = opens a subscreen. Owners are in brackets.

### 16.1 Sign-in [W1]
```
                ●                      ← 12 px accent dot
              Carrel                   ← 34/600
   [  ⇥  Continue with Google  ]      ← primary, max 320 wide, icon `signin`
```
- Centred vertically. Nothing else: no tagline, no footer.
- Errors show as a toast.
- Signed in but not the owner: same layout, with the line `This tracker is private` and a text button `Sign out`.

### 16.2 First run [W1] (signed in, no study activities yet)
```
What do you study?                            ← 22/600
[ Add a subject                       ]  [+]  ← Enter or + adds; commas split into several
(Physics ×) (Calculus ×)                       ← added subjects, removable chips
(+ Biology) (+ History) (+ Economics) …        ← suggestions from SUGGEST, max 8, no label
[               Continue               ]      ← primary; disabled until ≥ 1 subject; sets onboarded
```
- No explanatory paragraph.
- Life activities already exist; don't mention them.
- Reuse `onb-add`, `onb-chip` and `onb-done`.

### 16.3 Today, running [T1]
```
Tue 27 Oct                               2h 54m ›   ← date 15 text-2 | total 15/600 + open icon → Today's log (§16.7)
☁̸ Offline · 3 waiting                               ← sync line, only when needed (§15.9)
┌─────────────────────────────────────────────┐
│ ● Chemistry                        ✎    ⤢   │   ← dot + name 17/600; edit → entry sheet (running); focus mode
│ Organic: reaction mechanisms                │   ← block title or note, 15 text-2, 1 line; omitted if empty
│                                             │
│ 5:58                                        │   ← 64/300; pomodoro focus = countdown, otherwise elapsed
│ ⧗ Focus 2 of 4 · 19m in                     │   ← pomodoro only, 13 text-2
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬──────────                    │   ← 3 px accent progress, pomodoro only
│ [ ■ Stop          ]  [ ☕ Break          ]   │   ← two 48 px buttons, equal width; Stop primary, Break tonal
└─────────────────────────────────────────────┘
Back to: Organic mechanisms                         ← 13 accent, 8 s, after a break or drift (existing UI.back)
⚡ Noticed                                           ← text button; only while a study activity runs
   ↳ after a tap, for 8 s:  ≋ (1m) (5m) (15m)   🔖  ← drift chips + park icon (opens the Park sheet)
Next                                                ← 13/600 text-2
● Mathematics · Integration by parts      7:10 pm   ← ≤ 3 rows; tap → planFocus(k, id)
● Physics · Formula sheet            📌    8:30 pm   ← pin icon on fixed-time blocks
⚠ 1h 10m won't fit                            Fix   ← only when over; Fix → Doesn't-fit sheet
(● Physics) (● Maths) (☕ Break) (● Sleep)  (⋯)      ← chips: pinned activities minus the running one; ⋯ = All activities
```
- Chips: tap switches (`startActivity(id)`); long-press opens Start options (§16.5).
- Pinned = the activity field `today: true`. When the field is missing, study activities and the break-role activity count as pinned. This is a new optional field; old code ignores it.
- **Removed from Today:**
  - The date stamp and day arrows.
  - Deadline chips.
  - The pomodoro toggle, preset select and "Starting now" select.
  - The park-thought input.
  - The pomodoro ring.
  - The `19m 01s logged since 2:43 pm` line.
  - The whole plan list, the plan controls, the "From Claude" note and the carry banner (all move to Plan).
  - The log and the day breakdown.
  - The life-activity chip wall.
  - The "Start" / "Switch to" labels.

### 16.4 Today: idle, break, break due, running too long, after stopping [T1]
**Idle**
```
┌─────────────────────────────────────────────┐
│ Not tracking                                │   ← 17/400 text-2. NO counter.
│ [ ▶ Resume Physics                       ]  │   ← primary; only when the last study ended < 3 h ago (resumeLast)
└─────────────────────────────────────────────┘
┌──────────────────┐ ┌──────────────────┐
│ ● Physics        │ │ ● Mathematics    │          ← study activities, 2-col grid, 56 px tiles, radius 12, 1 px line
└──────────────────┘ └──────────────────┘          ← tap = start now; long-press = Start options
Next …                                             ← as when running
(☕ Break) (● Sleep) (⋯)                            ← pinned non-study chips
```
**After stopping a study entry** (for 60 s, while `UI.lastRate` is set): the card's first line becomes `Focus?` (15 text-2) followed by three 40 px icon buttons `rate1` `rate2` `rate3` (aria `Scattered`, `Okay`, `Deep`).
- A tap writes the rating the way `ACT.rate` does: `W().day(day, {[id]: {focus: v}})`, then `commit(null, w, {undo:false})`.
- Then show a `done` check for 1 s and clear `UI.lastRate`.

**Break**
- Row 1: `break` icon + `Break` 17/600, with `focus` on the right.
- Timer: countdown to the pomodoro break end, otherwise elapsed.
- Status line: `Back to Chemistry` 13 text-2 (from `c.ret`).
- Buttons: primary `▶ Resume` (`backFromBreak`), tonal `■ Stop`.
- When the break time runs out, the status line becomes `Break's over` in accent.

**Break due** (pomodoro focus ended, timer still running):
- Status line: `hourglass` + `Break time` in accent.
- Timer shows the overtime as `+2:13`.
- Buttons swap: primary `☕ Break`, tonal `■ Stop`.

**Running too long** (`guardInfo(now)` returns a value):
- Status line: `warn` + `Running 6h 12m` in `--danger`.
- Buttons: primary `Still going` (`guard-keep`), tonal `Fix stop` → Fix stop time sheet (§16.5).

### 16.5 Today sheets [T2]
**Start options** — `SHEETS.start {act}`
```
● Physics                                     ✕
Start        (Now) (5m ago) (15m ago) (30m ago) (After last)   ← single-select chips, wrap
Pomodoro                                    ( )               ← default = Settings › Timer default
Length       (25/5) (50/10) (90/20)                           ← only when the switch is on
[                  ▶ Start                   ]
```
- `After last` uses `lastEntry().e`; hide it if there's no last entry or it's older than 12 h.
- The button calls `startActivity(id, { at, pomoPreset })`, or `pomoRaw: null` when the switch is off.

**All activities** — `SHEETS.activities`
```
Activities                                 ✎  ✕   ← edit → openPage('settings', 'settings.activities')
Study                                              ← 13/600 text-2
● Physics                                1h 34m    ← today's total, 13 text-2; the running one shows `Now`
● Mathematics                            1h 45m
Other
● Break …
```
Tap = start/switch and close. Long-press = Start options.

**Park** — `SHEETS.park`: title `Park a thought`.
- Textarea, 3 rows, autofocus, maxlength 140; the counter appears only above 120 characters.
- Primary `Park`, disabled while empty. It calls `parkAdd(text)` and shows the toast `Parked · Undo`.

**Parked** — `SHEETS.parked {k}`:
- Opened from a row on Today that appears only during a break when parked items exist: `bookmark` icon + `2 parked` + `open`.
- Sheet rows: the text (wraps to 2 lines), then icon buttons `backlog` (`parkToBacklog`) and `delete` (`park-drop`).
- The sheet closes itself when the last item is gone.

**Fix stop time** — `SHEETS.fixstop`: title `When did you stop?`.
- A time field bound to `UI.guardTime`.
- A chip `Last open 6:14 pm` when `store.get('seen')` is a usable time (`guard-seen`).
- Primary `Save` (`guard-save`).

### 16.6 Focus mode [T2] (was "desk view")
```
                 Chemistry                  ← 15/500 #A1A1AA
                   5:58                     ← 96/200 #F4F4F5 tabular
              ──────▬▬▬▬▬▬──────            ← 2 px bar, 200 px, #2DD4BF at 60 %; pomodoro only
               Focus 2 of 4                 ← 13 #71717A
   (tap anywhere → for 4 s:)  (☕) (■) (⤡)   ← 56 px round icon buttons on #17171A: break, stop, unfocus
```
- Always black (`#000`). Keep the anti-burn-in drift (`UI.deskShift`) and the wake lock.
- Leave with `unfocus`, Android back or Escape.
- Remove the text buttons "Take a break" / "Stop" / "Exit".

### 16.7 Today's log [T3] — `PAGES.log {k}`, plus Entry and Split sheets
```
←  Tue 27 Oct                          ‹  ›  +   ← prev/next day; add → openEntrySheet('add')
2h 54m studied · 9h 40m logged                    ← 13 text-2, one line
6:29 pm  ● Chemistry                     Now      ← newest first; start time column 56 px, 13 tabular text-2
4:20 pm  ● Physics                        45m
         Formula sheet revision                   ← note as a 13 text-2 sub-line, if any
3:55 pm  Untracked                    25m   +     ← gaps ≥ 5 min, text-2; + → openEntrySheet('add', {s, e})
…
```
- Tap a row → `openEntrySheet('edit', {id})`. Empty day: `Nothing logged`.
- This page replaces the old Today log with its Timeline/List switch.

**Entry sheet** — `SHEETS.entry`, modes running / edit / add:
```
Edit entry                            ⑂   🗑   ✕   ← split (edit only); delete (edit) / discard (running)
Activity                         ● Chemistry   ⌄   ← kActPick, collapsed until tapped
Start                       −   2:43 pm   +        ← −/+ are 40 px icon buttons, ±5 min
End                         −   3:22 pm   +        ← running: `Now` in text-2, no nudges
Date                                Tue 27 Oct     ← add mode only
                                          39m      ← 13 text-2, right-aligned
⚠ Overlaps Physics by 10m          Trim  ( )       ← only when there's an overlap; binds sheet.trim
▸ More                                             ← Note (textarea) · Focus: three icon toggles rate1–3
[                    Save                    ]
```
- Titles: `Running`, `Edit entry`, `New entry`.
- Delete and discard use the same actions the old footer used, with an undo toast.
- Removed: the chip wall, the Cancel button, and the "Focus: Deep / Okay / Scattered" text control (it's now icons).

**Split sheet** — `SHEETS.split`:
```
Split                                         ✕
Chemistry · 3:22–4:20 pm                          ← 13 text-2
Split at                    −   3:51 pm   +
Second part                       ● Physics   ⌄
[                   Split                    ]
```
Removed: the explanatory sentence and the Cancel button.

### 16.8 Plan [P1] — `VIEWS.plan`
```
‹  Tue 27 Oct  ›                   ⌖   ▦   ☰   ⋮   ← prev/date/next | jump (only when not today) | week/day toggle | tasks | menu
✦ Physics test on Tuesday, so the problem…      ⌄  ← Claude's plan note: 1 line, expands; only if there is a note
⟲ 1h 12m left from yesterday           Add    ✕   ← carry row (carry-y / carry-n); only when relevant
⚠ 1h 10m won't fit                          Fix   ← only when over; Fix → SHEETS.fit
 7a ┤ ▌Sleep 10:40 pm–7:05 am                      ← compact sleep band (keep A5's behaviour)
 8a ┤ ▌Meals
 9a ┤ ▌Physics
10a ┤ ┆ Mathematics ┆                               ← planned = dashed outline
 6p ┼──●────────────────────────  now               ← 1 px --danger line + 6 px dot
                                             (+)    ← FAB
```
- **Header:** the date label opens the native date picker (a hidden `<input type=date>` + `showPicker()`).
  - `jump` → today.
  - `week`/`day` toggles the view (store the choice per device).
  - `tasks` → `pushPage('tasks')`.
  - `more` → the menu in §16.9.
- **Timeline (Day):**
  - 44 px gutter with hour labels 12 text-2 (`7a`, `12p`; on a 24 h clock `07`, `12`).
  - 1 px `--line` hour lines, no half-hour lines; 56 px per hour.
  - Scroll to an hour before now (today) or to the first item (other days).
- **Items:**
  - Logged: 12 % activity-colour tint, 3 px bar, name 13/600, time 12 text-2 only when the block is ≥ 44 px tall. Under 24 px: name only, at 11 px.
  - Planned: transparent with a 1 px dashed `--text-2` border at 50 %; name 13/500 text-2; `pin` 12 px top-right when fixed.
  - Busy: `--line` 50 % fill with a 45° hatch; name 12 text-2; no icon.
  - Missed planned blocks aren't drawn (the Fix row covers them).
  - With 3 or more overlap lanes, hide the time text.
- **Gestures:**
  - Tap an empty spot → `SHEETS.qnew` at the tapped 15-minute slot, 1 h long.
  - Tap an item → its sheet.
  - Long-press an item → drag (keep the existing drag code). Drag the bottom edge → resize.
- **FAB:** 56 px accent circle with `add`; 16 px from the right edge, 16 px above the nav; opens qnew at the next 15-minute slot.
- **Week view:**
  - 7 columns and a 28 px gutter labelled every 3 h.
  - Column header 40 px: weekday initial (12 text-2) above the date (15/600); today's date in a 28 px accent circle.
  - Under 600 px wide, items are colour bars without text.
  - Tapping a column header or an empty spot opens that day in Day view.
- **Removed:**
  - The 3-day view and the Plan / Log / Plan+log filter.
  - The mini month.
  - The "Drag blocks to move…" text.
  - The day-header texts `21m too much` / `8h spare`.
  - The old Today plan list and its rows (`vPlan`, `vBlk`, `vAddBlock`).
  - Every panel below the calendar: Google Calendar, Deadlines, Backlog, Week targets, Weekly timetable.
- **Contract:** `planFocus(k, id)` sets `UI.view='plan'`, shows day `k` in Day view and scrolls block `id` into view. T1 calls it.

### 16.9 Plan sheets and menu [P2]
**New** — `SHEETS.qnew`:
```
New                                           ✕
[ ▤ Block | 💼 Busy ]                              ← seg with icons `plan` / `busy`
Activity                         ● Physics    ⌄
[ Title (optional)                         ]
Start                       −   7:45 pm   +
Length     (25m) (50m) (1h) (1h 30m) (2h)          ← kDur; custom length is inside More
📌 Fixed time                              ( )     ← off = Carrel fits it into free time
▸ More                                             ← Pomodoro: (Default)(Off)(25/5)(50/10)(90/20) · custom length stepper
[                     Add                    ]
```
- The Busy tab has a Title field (required), Start, End, and `repeat` `Weekly ( )`. When Weekly is on, add day toggles `M T W T F S S` (see the Weekly sheet in §16.10).
- Removed: the chip wall, the "Keep it at this time. Untick to let Carrel fit it…" sentence, and the Cancel button.

**Block** — `SHEETS.block {k, id}`:
```
Integration by parts                ⧉   ⇩   🗑   ✕   ← title wraps 2 lines | dup | backlog | delete
45m of 1h 30m  ▬▬▬▬▬▬──────────                    ← 13 text-2 + 3 px bar; only once some time is done
Activity · Title · Start (`Auto` when not fixed, clear ✕) · Length · 📌 Fixed · ▸ More (Pomodoro, Day)
[ ▶ Start now ]  [            Save             ]   ← tonal + primary; Start now only for today's undone blocks
```

**Wrap up** — `SHEETS.wrap`:
```
Wrap up                                       ✕
4h 36m studied · 63% of plan                       ← 15
Move to tomorrow                                   ← 13/600 text-2
☑ Chemistry · Organic mechanisms            43m
☑ Physics · Formula sheet                   45m
Stop timer                                 ( )     ← only while a timer runs
[                   Wrap up                  ]
```

**Doesn't fit** — `SHEETS.fit {k}`: no primary button; the rows are the actions.
```
Doesn't fit                                   ✕
1h 10m over · ends 11:40 pm                        ← 13 text-2
⇲  Shrink blocks                                   ← planShrink(k); closes; toast with Undo
→  Move the rest to tomorrow                       ← planOverflow(k)
◷  Work until 11:45 pm                             ← plan-extend with data-t
```
**Plan menu** (⋮), built with `openMenu`:
- `copy` Copy to tomorrow (`plan-copy`)
- `wrap` Wrap up (opens `SHEETS.wrap`)
- `later` Plan ends at… (opens `SHEETS.planend`)
- `delete` Clear plan, in danger red (`plan-clear` with an undo toast; drop the old two-tap "armed" confirmation)

**Plan ends at** — `SHEETS.planend {k}`: one time field + primary `Save` (writes what `plan-extend` writes).

### 16.10 Tasks [P3] — `PAGES.tasks {tab}`, plus Deadline, Task and Weekly sheets
```
←  Tasks                                         +   ← add, for the current tab's kind
[ Deadlines | Backlog | Weekly ]
⚑ Physics unit test                         in 3d    ← leading type icon (exam/due/other) tinted by subject colour
   Fri 30 Oct · 9:00 am                               ← sub 13 text-2; `in 2d` and sooner in --danger; `Today`, `Tomorrow`
▸ Done (3)                                            ← collapsible at the bottom
```
- **Backlog tab:**
  - A right-aligned text button above the list: `autoplan` + `Plan all` (`bl-auto`).
  - Rows: title, sub `Physics · 1h 30m · due 30 Oct`, a `high` icon in danger only for high priority.
  - Right side: a `schedule` icon button (`task-sched`) → toast `Planned Fri 9:00 am · Undo`.
- **Weekly tab:** rows with title, sub `Mon, Wed, Fri`, and `10:00–11:30 am` on the right.
- **Empty lines:** `No deadlines`, `Backlog is empty`, `No weekly items`.
- **Tap targets:** a row opens its sheet. Old sheets keep their type names: `deadline`, `task`, `busy`.

**Deadline** — `SHEETS.deadline {id}`:
```
Deadline                                ✓   🗑   ✕   ← done toggle and delete only when editing
[ Title                                     ]
Type          [ 🎓 Exam | 📄 Due | ⚑ Other ]
Date                                  Tue 3 Nov
Time                                  Optional ⌄
Subject                                  None  ⌄     ← kActPick, study activities + None
[                     Save                   ]
```
Removed: the `Tuesday, November 3, in 7 days.` line and the Cancel button.

**Task** — `SHEETS.task {id}`:
```
Task                                         🗑  ✕
[ Task                                      ]
Subject                          ● Physics    ⌄
Length       (30m) (1h) (1h 30m) (2h) (3h)
▸ More                                              ← Due date · Priority [ ⇈ | = | ⇊ ] · Plan on a day (date)
[ ✦ Find time ]  [             Save            ]    ← Find time = save + schedule now
```
Removed: the "Schedule it" block (Today / Tomorrow / date + "Add to that day"), the explanatory sentence, and Cancel.

**Weekly / Busy** — `SHEETS.busy {k, id, rec}`:
```
Weekly item                                 🗑  ✕   ← title `Busy` for a one-off
[ Title                                     ]
Days        (M) (T) (W) (T) (F) (S) (S)              ← 36 px round toggles; one-off shows a Date row instead
Start                                   2:00 pm
End                                     4:00 pm
[                     Save                   ]
```

### 16.11 Stats [S1] — `VIEWS.stats`
```
‹  This week  ›                    [ Week | Month ]  ← label returns to the current week; › disabled on it
8h 46m                                               ← 34/600
4h 23m a day · goal 4h                               ← 13 text-2; goal only when set
▇                                                    ← stacked bars by subject colour, 140 px tall, bars 24 px wide
▇ ▅                      ┄┄┄┄┄┄┄┄ 4h                 ← dashed goal line, 11 px label at the right end
M T W T F S S                                        ← 12 text-2; today's initial in accent; tap a bar → planFocus(day)
Subjects                                             ← 13/600 text-2
● Mathematics                              4h 15m
  ▬▬▬▬▬▬▬▬──────────────                    of 9h   ← 3 px goal bar + 13 text-2; tap row → PAGES['stats.subject']
● Physics                                  2h 54m
💡 Insights                                    3 ›   ← PAGES['stats.insights']
▦ Patterns                                       ›   ← PAGES['stats.patterns']
```
- Month = the last 4 weeks, one bar per week (labels `12 Oct`, …).
- No y-axis, no gridlines, no values on bars.
- Empty: `No study logged this week`.
- **Removed:**
  - The KPI grid.
  - `vs same point last week`.
  - Day ribbons and Life around study.
  - The weekly review card.
  - Example-data mode.
  - The distractions block and consistency squares.
  - The stretch histogram, subjects by week, study-hours spans and focus by hour.

### 16.12 Stats subscreens [S2]
**Subject** — `PAGES['stats.subject'] {id}`:
- Header `← Physics` with `edit` on the right → `openPage('settings', 'settings.activity', {id})`.
- Hero `2h 54m` + `of 10h goal`.
- 7 single-colour bars for the week shown on the Stats tab.
- Label `Recent`, then the last 8 sessions as rows: date and time on the left, note as a sub-line, duration on the right.

**Patterns** — `PAGES['stats.patterns']`:
- Seg `4 weeks | 12 weeks`.
- Label `When you study`; heatmap 7 rows × 24 columns with 10 px cells, radius 2, accent ramp from 15 % to 100 %.
  - Weekday initials on the left; hour labels every 6 h underneath.
  - `less · more` in 11 text-2.
- Then 3 number tiles in a row (no cards; value 22/600 over a 13 text-2 label): `1h 5m` typical session · `3` day streak · `12` noticed.

**Insights** — `PAGES['stats.insights']`: up to 5 sentences from `insights()`, plain 15/400 rows with dividers. Empty: `Not enough data yet`.

### 16.13 Settings root and Activities [G1]
```
Settings                                             ← 22/600, in the 48 px header row
⬡  Activities                       4 study    ›     ← leading icon 24 text-2 · label 15 · value 13 text-2 · open
⧗  Timer                               25/5    ›
☀  Day                              4:00 am    ›
🔔  Notifications                         On    ›     ← only in the Android app
                                                     ← 24 px gap between groups, no group labels
📅  Google Calendar                Connected    ›
✦  Claude prompts                              ›
⬇  Export                                      ›
                                                     ←
👤  Account               mayank@…              ›
ⓘ  About                       1.0.13 •       ›     ← accent dot when an update is ready
⌨  Keyboard                                    ›     ← only with (pointer:fine)
```
- Rows are 56 px. Dividers between rows in the same group are inset 56 px. No dividers between groups.
- This replaces the old Setup sheet, including its jump bar and every paragraph.

**Activities** — `PAGES['settings.activities']`:
```
←  Activities                                    +
Study
●  Physics                               10h    ›     ← weekly goal as the value
●  Mathematics                            9h    ›
Other
●  Break                                        ›
▸ Archived (2)
```
**Activity editor** — `PAGES['settings.activity'] {id | null}`. Every change saves itself (`saveAct`).
```
←  Physics                                       ⋮   ← menu: ↑ Move up · ↓ Move down · Archive / Restore
[ Physics                                    ]       ← name; saves on blur or Enter
Colour     ● ● ● ● ● ● ● ● ● ● ● ●                    ← 12 PALETTE swatches, 28 px; selected = 2 px --text ring
Type       [ Study | Other ]
Weekly goal                       −   10h   +        ← study only; 0 shows `—`
On Today                                  ( )        ← the `today` pin field (§16.3)
▸ More                                               ← Role [None|Break|Sleep|Drift] (other only) · Ask after − 4h +
```
- New activity: `pushPage('settings.activity', {id: null})` focuses the name field and creates the activity with `addActivity(name, kind)` on the first Enter or blur that has a name.
- Changing the role: only if `saveAct` accepts a `role` patch; otherwise show the role read-only and note it in your status file.

### 16.14 Settings subscreens [G2]
**Timer** — `PAGES['settings.timer']`:
```
←  Timer
Pomodoro by default                       ( )    ← same effect as ACT['pomo-toggle'] (read it first)
Length                              25/5   ⌄    ← collapsible radio rows: 25/5 · 50/10 · 90/20 · Custom (preset-apply)
   Focus − 25m + · Short break − 5m + · Long break − 15m + · Long break every − 4 +   ← Custom only
Ask if running longer than        −  4h  +      ← guardHours
```
**Day** — `PAGES['settings.day']`. Use the same setting keys the old `sSetup` writes; read it for the names.
```
←  Day
Day starts at                          4:00 am
Plans start at                         8:00 am
Plans end by                          10:30 pm
Gap between blocks               −  10m  +
Daily goal                        −  4h  +        ← step 0.5 h
Week starts on                      Monday  ⌄    ← collapsible radio list of 7 days
Clock                       [ Auto | 12h | 24h ]
```
**Google Calendar** — `PAGES['settings.calendar']`:
- Header right: `refresh` (`gc-refresh`).
- Rows: `Status` (Connected / Not connected) · `Events` (`3 upcoming`) · `Permissions ›` (`gc-perms`).
- When not connected: a `Connect` row in accent (`gc-connect`).
- When the connector isn't available here: one empty line `Not available here`.

**Claude prompts** — `PAGES['settings.claude']`: one row per prompt (text 15, wraps 2 lines) with a `copy` icon button (`copy`, `data-t`) → toast `Copied`. No descriptions.
**Export** — `PAGES['settings.data']`: rows `Entries` (value `187`), `CSV` and `JSON backup`, each with an `export` icon (`export`, `data-f`).
**Account** — `PAGES['settings.account']`: row `Signed in as` (email), then row `signout` + `Sign out` in danger, with no chevron (`signout`).
**About** — `PAGES['settings.about']`:
- `Version` with the value `web 1.0.13 · app 100008` (from `UPDI`).
- `refresh` `Check for updates`: the value is a short status (`Up to date`, `Downloading`, `Update ready`, `Failed`); tap → `upd-check`. When an update is ready, the value is `Restart` in accent (`upd-restart`, from R5).
- A `New app version` row in accent when `UPDI.apk` is set (`upd-apk`).

**Keyboard** — `PAGES['settings.keys']` (desktop only): rows of shortcut + action, copied from the old Setup sheet's list.

### 16.15 Notifications subscreen [R5] — `PAGES['settings.notifications']`, registered in `native.js`
```
←  Notifications
Notifications blocked                     Allow  ← only when NP.notifications === false (np-notif)
Vibrate when focus ends                    ( )
Vibrate when a break ends                  ( )
Quiet in Do Not Disturb                    ( )
Hide on lock screen                        ( )
Noticed buttons                            ( )   ← new pref notifDistractions, default off
▸ Troubleshoot
   Exact alarms                 Allowed  ›       ← np-exact
   Background activity                   ›       ← np-battery
   Test vibration          Last 6:12 pm  ▷       ← np-test; value = NP.lastNudge
```
Removed: every explanatory sentence, and the update rows (they move to About).

### 16.16 Android notification, dialogs, system bars [R5]
| State | Title | Text | Header chronometer | Actions |
|---|---|---|---|---|
| Running, no pomodoro | `Physics` | — | counts up from the start | `Stop` |
| Pomodoro focus | `Physics` | `Focus 2 of 4` (just `Focus` if the native state has no cycle count) | counts down to focus end | `Stop` |
| Focus over | `Break time` | `Physics` | counts up from focus end | `Break`, `Stop` |
| Break | `Break` | `Back to Physics` | counts down to break end (up if no pomodoro) | `Resume` (only if the engine can resume; see Part 1 §9), `Stop` |
| Stopped (10 s) | `Stopped Physics · 45m` | — | — | `Undo` |
| Lock screen, privacy on | `Carrel` | `Studying` | — | — |

- Small icon `ic_carrel` tinted `#0F766E`. No large icon, no subtext, no custom layout, not colorized.
- Urge / Drifted / Park appear only when `notifDistractions` is on.
- **Drifted dialog** (`DriftActivity`, only when those buttons are on): title `Drifted for`, items `1 min`, `5 min`, `15 min`, `Cancel`. Switch its theme to a DayNight dialog theme so it follows dark mode.
- **System bars:** edge-to-edge with a transparent status bar and navigation bar; icon colour follows the theme.
- **No white flash on launch:** window/splash background `#FAFAF9`, and `#0C0C0D` in `values-night`.
- **Focus mode:** optionally add a plugin method `setImmersive(on)` that hides the system bars; T2 calls it only if `CL.setImmersive` exists.
- **Back button:** `CAP.App.addListener('backButton', () => { if (!goBack()) CAP.App.minimizeApp(); })`.
- **Restart after update:** `upd-restart` calls the Capgo updater's reload method (check its API name). Show the `Update ready · Restart` toast after a download.

---

## 17. Agents v2: roster, phases, file ownership

**Phase 1** (in parallel): **R0b** Kit → merge first (it only adds files). **R0a** Restructure → rebase on R0b, then merge. **R5** Android, any time.
**Phase 2** (in parallel, after R0a is merged): **W1, T1, T2, T3, P1, P2, P3, S1, S2, G1, G2**. R5 can keep going.
**Phase 3:** integrator (§20).

| Agent | Job | Owns (edit only these) |
|---|---|---|
| **R0b** Kit | icons, tokens, components, navigation pieces | `tools/icons.py`, `web/ui/icons.js`, `web/ui/kit.js`, `web/ui/kit.css`, new `web/test/kit_test.js` |
| **R0a** Restructure | split files, wire kit, shell, nav, back, tools | `web/core/*`, `web/ui/shell.js`, `web/ui/legacy.css`, `web/files.json`, `web/build.py`, `web/test/src.js`, `web/test/shell_test.js`, `tools/shots.py`, `.github/workflows/web.yml` |
| **R5** Android | notification, bars, back button, updates, Notifications page | `android/**`, `web/native.js`, `capacitor.config.json`, `package.json`, `.github/workflows/android.yml`, `tools/patch_android.py` |
| **W1** Welcome | §16.1–16.2, error/empty app states | `web/ui/welcome.js`, `web/ui/welcome.css`, new `web/test/welcome_test.js` |
| **T1** Today | §16.3–16.4 | `web/ui/today.js`, `web/ui/today.css`, `web/test/today_test.js` |
| **T2** Today sheets | §16.5–16.6 | `web/ui/today-sheets.js`, `web/ui/today-sheets.css`, `web/ui/focus.js`, `web/ui/focus.css`, new `web/test/today_sheets_test.js` |
| **T3** Log | §16.7 | `web/ui/log.js`, `web/ui/log.css`, new `web/test/log_test.js` |
| **P1** Plan | §16.8 | `web/cal.js`, `web/ui/plan.js`, `web/ui/plan.css`, `web/test/plan_test.js`, `web/test/calendar_test.js`; in `logic.js`: `planCompute`, `projectPlan`, `busyFor`, `mergeIntervals`, `dayCapacity`, `layoutOverlaps` |
| **P2** Plan sheets | §16.9 | `web/ui/plan-sheets.js`, `web/ui/plan-sheets.css`, new `web/test/plan_sheets_test.js` |
| **P3** Tasks | §16.10 | `web/ui/tasks.js`, `web/ui/tasks.css`, new `web/test/tasks_test.js` |
| **S1** Stats | §16.11 | `web/ui/stats.js`, `web/ui/stats.css`, `web/test/patterns_test.js`, `web/test/logic_test.js`; in `logic.js`: `aggregate`, `pomodoroByDay`, `studySessions`, `patternsModel`, `insights`, `distractionStats`, `exampleEntries`, `mulberry32` |
| **S2** Stats pages | §16.12 | `web/ui/stats-pages.js`, `web/ui/stats-pages.css`, new `web/test/stats_pages_test.js` |
| **G1** Settings + Activities | §16.13 | `web/ui/settings.js`, `web/ui/settings.css`, `web/ui/settings-activities.js`, new `web/test/settings_test.js` |
| **G2** Settings pages | §16.14 | `web/ui/settings-pages.js`, `web/ui/settings-pages.css`, `web/gcal.js`, new `web/test/settings_pages_test.js` |
| *frozen in Phase 2* | integrator only | `web/core/*`, `web/ui/shell.js`, `web/ui/kit.*`, `web/ui/icons.js`, `web/ui/legacy.css`, `web/files.json`, `web/build.py`, `web/supa.js`, `web/auth.js`, `web/config.js`, `web/boot.js`, the rest of `logic.js`, `web/test/supa_test.js` |

**Rules for every Phase-2 agent** (in addition to Part 1 §3):
- Register what you build: `VIEWS.x = …`, `PAGES['x.y'] = {…}`, `SHEETS.x = …`, `Object.assign(ACT, {'t2-…'() {…}})`. Never edit another file's switch or map.
- New CSS classes and action names start with your agent id (`t2-…`, `.t2-…`). Component classes come from the kit (`.k-…`). Use only tokens: no hex colours, `font-family` or `box-shadow` in your CSS.
- **Contract functions** (§18.3) keep their names and signatures. Before deleting any function, run `grep -rn "<name>" web/`. If anything outside your files uses it, leave it in place and list it in your status file.
- Leave old `ACT` handlers in `ui/shell.js` alone even when your new UI no longer uses them; the integrator removes dead ones.
- Calling something another agent hasn't merged yet is fine: `openSheet({type})` and `pushPage(id)` do nothing (and log a warning) until it is registered. Never stub another agent's sheet or page yourself.
- Status file: `docs/redesign/status-<id>.md`, with the checklist from §20.2 and a "Requests" section.

---

## 18. Contracts

### 18.1 R0b kit API (`web/ui/kit.js`). Everything returns an HTML string unless stated.
```
icon(name, cls)                                  existing; R0b fills P (§13)
kIconBtn(name, label, attrs)                     40 px; attrs = extra attributes, e.g. 'data-act="x" data-id="3"'
kBtn(label, attrs, {icon, kind})                 kind: 'primary' | 'tonal' | 'text' | 'danger'; 48 px (text: 40 px)
kRow({icon, dot, label, sub, value, open, right, attrs})   list row; right = custom html (e.g. a switch)
kGroup(label, rowsHtml)                          optional 13/600 label + rows
kField(label, controlHtml)                       label-left row for sheets
kSwitch({bind | act, on, label})                 role="switch", aria-checked
kSeg({bind | act, value, options:[{v, label, icon}]})
kChips({bind | act, value, options:[{v, label, dot, icon}], multi})
kStepper({bind | act, value, min, max, step, fmt})
kTime({bind, hm, nudge}) · kDate({bind, key}) · kDur({bind, minutes, presets})
kText({bind, value, placeholder, attrs}) · kArea({bind, value, placeholder, rows})
kActPick({bind, id, study, life, none})          collapsible activity picker (selected row; opens a chip list)
kSwatches({bind | act, color, palette})
kCollapse(id, summaryHtml, bodyHtml)             open state in UI.open[id]
kEmpty(text, actionHtml)
kSheetHead(title, actionsHtml) · kSheetFoot(html)      close button is added by kSheetHead
kPageHead(title, actionsHtml)                    back button added
pushPage(id, params) · popPage() · openPage(tab, id, params) · goBack() → boolean
PAGES[id] = { title: params => string, render: params => html, actions: params => html }   (registry object)
openMenu(anchorEl, items:[{icon, label, act, attrs, danger}])
confirmDialog({title, text, ok, danger}) → Promise<boolean>
data-long="actName"                              long-press on any element calls ACT[actName](el)
```
- `bind` controls write through the existing `data-bind` / `setBind` mechanism (`sheet.x` and `d.x` paths go to `UI.sheet`; anything else goes to `UI`).
- `act` controls call `ACT[act](el)` with `data-v` set to the chosen value. Settings use `act`, so they save immediately.
- Generic actions: `k-set` (bind + value, then render), `k-collapse`, `k-back`, `k-menu-close`.

### 18.2 Registry names
| Kind | Name | Owner |
|---|---|---|
| View | `today` · `plan` · `stats` · `settings` · `welcome` | T1 · P1 · S1 · G1 · W1 |
| Page | `log` | T3 |
| Page | `tasks` | P3 |
| Page | `stats.subject` · `stats.patterns` · `stats.insights` | S2 |
| Page | `settings.activities` · `settings.activity` | G1 |
| Page | `settings.timer` · `.day` · `.calendar` · `.claude` · `.data` · `.account` · `.about` · `.keys` | G2 |
| Page | `settings.notifications` | R5 |
| Sheet | `start` · `activities` · `park` · `parked` · `fixstop` | T2 |
| Sheet | `entry` · `split` | T3 |
| Sheet | `qnew` · `block` · `wrap` · `fit` · `planend` | P2 |
| Sheet | `deadline` · `task` · `busy` | P3 |

### 18.3 Contract functions (don't rename or change signatures)
- `core/actions.js` (frozen): `startActivity`, `stopTimer`, `takeBreak`, `backFromBreak`, `resumeLast`, `lastStudy`, `lastEntry`, `openEntrySheet`, `planModelFor`, `planShrink`, `planOverflow`, `planCarryYesterday`, `wrapUp`, `saveSetting`, `saveAct`, `addActivity`, `exportData`, `copyText`.
- `ui/today.js` (T1): `noticeNow`, `noticeDrift`, `parkAdd`, `parkedItems`, `parkToBacklog`, `vDistractionPatterns`, `applyPhoneDrifts`.
- `ui/focus.js` (T2): `enterDesk`, `exitDesk`.
- `cal.js` (P1): `busyOf`, `busyIv`, `deadlineList`, `backlogList`, `scheduleTask`, `autoPlanAll`, plus the new `planFocus(k, id)`.
- `logic.js`: `aggregate`, `patternsModel`, `insights`, `distractionStats`.
- `gcal.js` (G2): `gcConnect`, `gcWatch`.
- `native.js` (R5): `checkUpdates`, `vPhonePanel` (may be emptied once the Notifications page exists), `UPDI`, `NP`.
- Shell: `UI.lastRate` (set from `toast(…, {rate})`).

### 18.4 R0a file map
Where everything goes when `app.js` and `style.css` are split. Pure moves first; a commit for each row group.

| Target | From |
|---|---|
| `core/state.js` | top of `app.js`, sections `small helpers`, `derived state`, `write sets, commit and undo`; add `const ACT = {}, VIEWS = {}, SHEETS = {}, PAGES = {};` at the very top and turn the `actions` section's `const ACT = {` into `Object.assign(ACT, {` |
| `core/sync.js` | `local view of the database` |
| `core/actions.js` | `timer actions`, `entry editing`, `plan actions`, `activities and settings`, `copy`, `export` |
| `ui/welcome.js` | `vOnboard`, `vNoActs` (from `views: Today`) |
| `ui/today.js` | rest of `views: Today`, all of `distractions: noticed, drifted, parked` |
| `ui/focus.js` | `desk view`, `desk view helpers` |
| `ui/log.js` | `views: log`, plus `sEntry`, `sSplit` from `views: sheets` |
| `ui/plan.js` | `views: plan` |
| `ui/plan-sheets.js` | `sBlock`, `sWrap` from `views: sheets`; from `cal.js`: `openQnew`, `sQnew`, `saveQnew`, `openBlockSheet`, `saveBlockSheet` |
| `ui/tasks.js` | from `cal.js`: `vDeadlinesPanel`, `vBacklogPanel`, `vTimetablePanel`, `vDeadlineChips`, `openBusySheet`, `sBusy`, `openDeadlineSheet`, `sDeadline`, `openTaskSheet`, `sTask`, `taskFromSheet` |
| `ui/stats.js` | `example data for empty Week and Patterns pages`, `views: Week`, `views: Patterns`; from `cal.js`: `vTargetsPanel` |
| `ui/settings.js` | `sSetup` |
| `ui/shell.js` | `views: shell`, `vSheet` + `actPick`, `toast`, `rendering…`, `sheets helpers`, `actions`, `events`, `boot` |
| new, empty (header comment only) | `ui/today-sheets.js`, `ui/stats-pages.js`, `ui/settings-activities.js`, `ui/settings-pages.js`, and a `.css` file for every `ui/*.js` that has none |
| CSS | `legacy.css` = old top of file → `section heads`, `sheets`, `toast`; `today.css` = `day header…`, `Today grid`, `timer card`, `switcher`; `focus.css` = `desk view`; `log.css` = `log: timeline`, `log: list`, `day breakdown`; `plan.css` = `plan`, `calendar`; `stats.css` = `week + patterns` |

`web/files.json` order:
- **js:** `config`, `supa`, `core/state`, `ui/icons`, `ui/kit`, `core/sync`, `core/actions`, `ui/welcome`, `ui/today`, `ui/today-sheets`, `ui/focus`, `ui/log`, `ui/plan`, `cal`, `ui/plan-sheets`, `ui/tasks`, `ui/stats`, `ui/stats-pages`, `ui/settings`, `ui/settings-activities`, `ui/settings-pages`, `gcal`, `native`, `ui/shell`, `auth`, `boot` (`.js` added).
- **css:** `ui/kit`, `ui/legacy`, then every screen `.css` in the same order as the js.

`logic.js` stays included before them, as `build.py` already does.

---

## 19. Per-agent task lists

Every task ends with Part 1 §3.1's checks plus `python3 tools/shots.py OUT --js "<expr>"` screenshots of your own sheets and pages (§19 R0a.7 adds `--js`).

**R0b — Kit** (Phase 1; start now, merge first)
1. `tools/icons.py` and the generated `web/ui/icons.js` (§13), including the aliases for old names.
2. `web/ui/kit.css`:
   - Tokens from Part 1 §1.1, with dark values.
   - Aliases for every old token so old screens recolour at once: `--paper:var(--bg)`, `--surface`, `--raised:var(--surface)`, `--sunk:var(--bg)`, `--ink:var(--text)`, `--ink-2`/`--ink-3:var(--text-2)`, `--rule`/`--rule-2`/`--hatch:var(--line)`, `--lamp`/`--lamp-strong:var(--accent)`, `--on-lamp:var(--on-accent)`, `--brass:var(--accent)`, `--rust:var(--danger)`, `--f-display`/`--f-ui`/`--f-num:var(--font)`, `--r-card:var(--r)`, `--r-ctl:var(--r-sm)`.
   - Every `.k-*` class (§14, §15).
3. `web/ui/kit.js` with the whole API in §18.1, including the page stack (`UI.pages`), `goBack`, menu, dialog, long-press and `k-*` generic actions. Kit renders the menu and dialog into `#pop`, which R0a adds.
4. A gallery: `PAGES.kit` that shows every component in every state. It's reachable in the test page with `openPage('settings','kit')`.
5. `web/test/kit_test.js`: icon-only buttons have `aria-label`; `kSwitch` has `role="switch"`; `goBack()` order matches §15.4.

**R0a — Restructure and shell** (Phase 1)
1. Pure moves per §18.4: `files.json`, the `build.py` changes, `test/src.js`, tests switched to `require('./src')`. Screenshots must be identical to `main`.
2. Remove the Google Fonts links and `CARREL_BUNDLE_FONTS` (from `build.py` and `web.yml`). `theme-color` reads `--bg`. The viewport meta gets `interactive-widget=resizes-content`.
3. After R0b merges: `vMain` renders `PAGES[top of UI.pages]` when the stack isn't empty, otherwise `VIEWS[UI.view]`. `vSheet` renders `SHEETS[type]` inside the kit sheet frame. Add the `#pop` container. Unknown names → `console.warn` and render nothing.
4. Delete `vHeader`, `#hdr` and `body::before`. New nav (§15.2) with `UI.view` values `today | plan | stats | settings`. Keep `calendar → plan` and `week | patterns → stats` aliases until Phase 3.
5. Toast per §15.8 (`UI.lastRate`), sync line `vSyncLine()` per §15.9, and the Escape and browser-history wiring for `goBack()`.
6. While nobody is signed in, render `VIEWS.welcome` if it exists (fallback: the old `vNotices`).
7. `tools/shots.py`: views `today plan stats settings`; repeatable `--js "<expr>"` saves `js-<n>.png` after running the expression on Today; `--width 1280` for desktop.
8. Update `shell_test.js`.

**R5 — Android** (Phase 1 and 2): Part 1 §9 as amended by §16.15–16.16.
- Register `PAGES['settings.notifications']` in `native.js` using kit components (after R0b merges).
- Add the `notifDistractions` pref and `upd-restart`.
- Any web code that calls a new native method must check it exists first. If the web bundle needs the new APK, tell the integrator the new build number so they can raise `NATIVE_API` in `config.js`.

**W1 — Welcome** (Phase 2)
1. `VIEWS.welcome` per §16.1. First run per §16.2, shown when `!ACTS.some(a => a.kind === 'study')` or `!CFG.onboarded`.
2. Delete `vOnboard` and `vNoActs`; T1 no longer calls them. Check with grep.

**T1 — Today** (Phase 2): build §16.3–16.4 exactly.
1. Header row and sync line; timer card in every state (running / pomodoro / break / break due / too long / idle / after stop); Noticed row; parked row; Next; Fix row; chips. Use the `data-tk` ticking that exists.
2. Delete everything §16.3 lists as removed, with its CSS. Delete `vSwitcher`, `vTimerIdle`, `vRing`, `vGuardFix`, `vNoticeBar`, `vParking` once nothing else uses them; check with grep.
3. Rewrite `today_test.js` for the new markup: no counter when idle, chips exclude the running activity, rating appears after stop.

**T2 — Today sheets and focus mode** (Phase 2): §16.5–16.6. Register the 5 sheets and restyle focus mode.
- Define the action `t2-start-opts` (opens `SHEETS.start` for `data-id`). T1 puts `data-long="t2-start-opts" data-id="…"` on its chips and tiles.

**T3 — Log** (Phase 2): §16.7.
- Build `PAGES.log` with gap rows (reuse `gapsOf`), the Entry sheet in 3 modes and the Split sheet.
- Delete `vTimeline`, `vList`, `vBreakdown`, `ribbonSegs`, `futMask`, `ribbonAxis` and `vLog` once unused.

**P1 — Plan** (Phase 2): §16.8.
- New header, note, carry and fit rows, timeline styles, week view, `planFocus`.
- Delete the 3-day mode, filters, mini month, side panels, `vPlan`, `vBlk`, `vAddBlock`, `vCarry` (check each with grep).
- Keep drag and resize working: test with Playwright `page.mouse` in the mock.

**P2 — Plan sheets** (Phase 2): §16.9. Five sheets plus the ⋮ menu items; the old `UI.planMenu` dropdown goes.
**P3 — Tasks** (Phase 2): §16.10. `PAGES.tasks` with 3 tabs and the 3 sheets.
**S1 — Stats** (Phase 2): §16.11. Delete the removed charts and every logic function only they used, with their tests.
**S2 — Stats pages** (Phase 2): §16.12. Three pages; reuse `patternsModel`, `insights` and `distractionStats`, read-only.
**G1 — Settings and Activities** (Phase 2): §16.13. Root list, Activities page, Activity editor. Delete `sSetup` and the `a6-jump` jump bar.
**G2 — Settings pages** (Phase 2): §16.14. Eight pages. Move the Google Calendar panel markup out of `cal.js`'s side panel; P1 deletes theirs.

---

## 20. Integrator v2 and acceptance

### 20.1 Merge order
1. Phase 1: R0b → R0a → R5 (whenever it's green).
2. Phase 2 goes leaves first, screens last: W1 → G2 → G1 → S2 → S1 → P3 → P2 → T3 → T2 → P1 → T1.
3. After each merge: build, all tests, `shots.py` in light and dark, open every tab.
4. Phase 3 cleanup:
   - Delete `ui/legacy.css` and the old-token aliases (`grep -rn "var(--paper\|var(--ink\|var(--lamp\|var(--rule" web/` must be empty first).
   - Delete `ACT` handlers that no `data-act`, `data-long` or code references.
   - Replace `window.confirm` in `auth.js` with `confirmDialog`.
   - Remove the view aliases.
   - Raise `NATIVE_API` if R5 says so.
5. Ask the user to install the new APK once (native changes); after that, web updates arrive by themselves.

### 20.2 Acceptance checklist (every PR pastes this, ticked, into its status file)
- [ ] Matches its §16 wireframe at 390 px in light and dark, and at 1280 px.
- [ ] No paragraph anywhere. Outside user content, no sentence is longer than 6 words.
- [ ] No ALL CAPS; no serif or monospace; only tokens (`grep -nE "#[0-9a-fA-F]{3,6}|font-family|box-shadow" web/ui/<mine>.css` is empty).
- [ ] Every icon-only button has `aria-label` and `title`; every hit area is ≥ 40 px (44 on touch).
- [ ] At most one primary button visible.
- [ ] `goBack()` closes my sheets and pops my pages in the right order; so do Escape and Android back.
- [ ] Empty state checked, e.g. `--js "S.base.days={}; S.base.plans={}; recompute(); render()"`.
- [ ] Nothing scrolls sideways except chip rows (`shots.py` prints `OK`).
- [ ] Tests pass; tests of removed UI are deleted, not skipped.
- [ ] Nothing outside my files was edited (`git diff --stat main` shows only my files).
