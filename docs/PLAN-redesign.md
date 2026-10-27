# Carrel: minimalist redesign plan (parallel agents)

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
