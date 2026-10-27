# Carrel: bug-fix and UI/UX plan (parallel agents)

Written 27 Oct 2026 by Opus after inspecting `main` @ `7d523db` (tests pass, mock build renders, no JS errors).
Built for **7 agents working at the same time**. Each agent owns a fixed set of files or code sections and
never edits anything outside it. Any capable model (Sonnet / Haiku) can execute it; tasks say exactly
where to change what and how to check it.

---

## 0. Rules every agent follows (read first, every session)

### 0.1 Setup
```bash
git checkout main && git pull
git checkout -b fix/<agent-id>          # e.g. fix/a3-today
python3 web/build.py                     # builds www/index.html and web/test/carrel-test.html
for f in web/test/*_test.js; do TZ=Asia/Kolkata node "$f" || exit 1; done
python3 tools/shots.py /tmp/shots-before # phone screenshots of every view (needs Playwright, already installed)
```
- The shell cannot reach npm, Google Maven or `*.supabase.co`. Don't try to work around it. npm and Android builds run only in GitHub Actions.
- Save tokens: `grep -n` a section header, then read only that range. Never paste whole files into chat.

### 0.2 Ownership (the most important rule)
- **Edit only what your agent card lists under "You own".** Everything else is read-only for you.
- `web/app.js`, `web/style.css` and `web/logic.js` are shared files, so they are split **by section**.
  Find your section by its header comment (e.g. `/* ---------- views: plan ---------- */`), **not by line number**;
  line numbers drift as others edit.
- A section runs from its header comment to the next header comment.
- **New action handlers** (`data-act="..."`): never edit the big `const ACT = {` / `Object.assign(ACT, …)` blocks in
  the `actions` section. Add yours in **your own section or file** with
  `Object.assign(ACT, { 'a3-thing'() { … } });` — `web/auth.js` already does this. Prefix new action names with your agent id (`a3-…`).
- **New CSS**: append it at the **end of your own CSS section**. Don't edit `:root` tokens unless you are A6.
- **New icons**: don't edit the icon map `P` in `small helpers`. Reuse an existing icon or use text.
- **New tests**: put them in a new file you own (`web/test/<area>_test.js`). Only A5 edits `web/test/logic_test.js`.
- **Need a change in someone else's area?** Don't make it. Write it in your status file under "Requests for other agents"
  (see 0.4) and carry on. The integrator passes it on.

### 0.3 Definition of done for every task
1. `python3 web/build.py` prints `built … bytes`.
2. All `web/test/*_test.js` pass (`ALL PASSED` / `SUPA TESTS PASSED`).
3. `python3 tools/shots.py /tmp/shots-after` prints `OK`, and the screenshot of your view shows the fix (look at it with your image Read tool).
4. For UI work, also run `python3 tools/shots.py /tmp/shots-dark --dark` once and check dark mode.
5. One commit per task: `<agent-id>: <task-id> <short summary>` (e.g. `a2: P1 sort plan rows by time`).

### 0.4 Status file and hand-off
- Keep `docs/fix-status/<agent-id>.md` (you own it; create it). Format:
  ```
  # <agent-id> status
  - [x] P1 sort plan rows by time — commit abc123
  - [ ] P2 …
  ## Notes / things I could not do
  ## Requests for other agents
  - to A6: …
  ```
- When done: push the branch, open a PR titled `<agent-id>: <area> fixes` with your checklist and before/after screenshots
  of the views you changed (attach `/tmp/shots-after/*.png` or describe them).
- Don't merge your own PR. The integrator (section 9) merges.

### 0.5 Don'ts
- Don't reformat, rename or reorder code you aren't changing (it creates merge conflicts).
- Don't change stored data shapes (`days/*`, `plans/*`, `state/current`, `config/*`, `distractions/*`). Other devices and the Android app read them.
- Don't run any SQL or Supabase migration unless your card says so, and then **ask the user first**.
- If a task turns out bigger than described, or needs a data-shape change, stop that task, note it in your status file, move to the next.

---

## 1. Ownership map (one line per agent)

| Agent | Area | Owns (edit only these) |
|---|---|---|
| **A1** | Sync, auth, native bridge | `web/supa.js`, `web/auth.js`, `web/native.js`, `web/test/supa_test.js`; in `app.js`: section `local view of the database`, plus function `vNotices` (in `views: shell`) |
| **A2** | Plan engine + plan UI | in `logic.js`: `planCompute`, `projectPlan`, `busyFor`, `mergeIntervals`, `dayCapacity`; in `app.js`: sections `plan actions`, `views: plan`; in `style.css`: section `plan`; new `web/test/plan_test.js` |
| **A3** | Today: timer, switcher, distractions | in `app.js`: sections `timer actions`, `views: Today`, `distractions: noticed, drifted, parked`; in `style.css`: sections `day header…`, `Today grid`, `timer card`, `switcher` |
| **A4** | Calendar + Google Calendar | `web/cal.js`, `web/gcal.js`; in `logic.js`: `layoutOverlaps`; in `style.css`: section `calendar` (to end of file) |
| **A5** | Log, Week, Patterns, insights | in `app.js`: sections `views: log`, `views: Week`, `views: Patterns`, `example data…`; in `logic.js`: `aggregate`, `pomodoroByDay`, `studySessions`, `patternsModel`, `insights`, `distractionStats`; in `style.css`: sections `log: timeline`, `log: list`, `day breakdown`, `week + patterns`; `web/test/logic_test.js`; new `web/test/patterns_test.js` |
| **A6** | Shell, sheets, setup, a11y, theme | in `app.js`: section `views: shell` **except** `vNotices`, sections `views: sheets`, `desk view`, `toast`, `rendering…`, `sheets helpers`, `desk view helpers`, `entry editing`, `activities and settings`; in `style.css`: top of file to end of `section heads`, plus `sheets`, `toast`, `desk view` |
| **A7** | Platform: build, CI, Supabase, Android | `web/build.py`, `package.json`, `capacitor.config.json`, `.github/**`, `supabase/**`, `android/**`, `tools/**` (except `tools/shots.py` stays as is unless broken) |

**Frozen for everyone** (no agent edits these; raise a request if truly needed): `web/config.js`, `web/boot.js`,
`app.js` sections `small helpers`, `derived state`, `write sets, commit and undo`, `copy`, `export`, `actions`, `events`, `boot`;
`logic.js` top helpers (before `planCompute`), `exampleEntries`, `mulberry32`, the token/live/mark functions (`b64urlEnc` … `localNoOffset`).

Exception that's allowed: A1 may add listeners in `web/auth.js` (its own file) instead of editing `events`.

---

## 2. A1 — Sync, auth, native bridge

You own: `web/supa.js`, `web/auth.js`, `web/native.js`, `web/test/supa_test.js`, `app.js` section `local view of the database`, function `vNotices`.

**S1. Flush the write queue when the network comes back.** (bug)
- `web/auth.js`, last lines: the `online` listener only calls `S.db.refresh()`. Pending writes then wait for their backoff timer (up to 60 s).
- Change it to also call `pumpAll()`:
  `window.addEventListener('online', () => { if (S.db && S.db.refresh) S.db.refresh(); pumpAll(); });`
- Check: in `web/test/supa_test.js` there is no browser; just confirm by reading. Build + tests pass.

**S2. Don't silently throw away unsaved changes on sign-out.** (bug, data loss)
- `teardownDb(true)` sets `S.pending = []`. `ACT.signout` in `auth.js` calls `sb.auth.signOut()` with no warning.
- In `ACT.signout`: if `S.pending.length > 0`, first call `pumpAll()`, wait up to 3 s (poll every 250 ms) for `S.pending.length === 0`.
  If still pending, `if (!confirm(S.pending.length + ' change(s) are not saved yet. Sign out and lose them?')) return;`
- Check: read the code path; build passes.

**S3. Recover from "View only" without a reload.** (bug)
- In `pump()` (section `local view of the database`), an auth error (`not_granted`, etc.) sets `S.conn = 'readonly'` forever until an auth event arrives.
- Add in `auth.js` a function `recoverAuth()`:
  ```js
  let recoverT = 0;
  function recoverAuth() {
    if (!sb || recoverT) return;
    recoverT = setTimeout(async () => {
      recoverT = 0;
      try { const r = await sb.auth.refreshSession(); if (!r.error && r.data && r.data.session) { S.conn = 'live'; pumpAll(); changed(); return; } } catch (e) { /* offline */ }
      if (S.conn === 'readonly') recoverAuth();   // try again later
    }, 30000);
  }
  ```
- In `pump()`, right after `S.conn = 'readonly';` add `if (typeof recoverAuth === 'function') recoverAuth();`
- Also call `recoverAuth()` from the `visibilitychange` listener in `auth.js` when `S.conn === 'readonly'`.
- In `vNotices`, change the readonly banner text to: *"Can't save right now. Carrel will retry automatically."* and add a button
  `<button type="button" class="btn sm" data-act="a1-reconnect">Try again</button>`. Define it in `auth.js`:
  `Object.assign(ACT, { 'a1-reconnect'() { clearTimeout(recoverT); recoverT = 0; S.conn = 'live'; pumpAll(); if (S.db && S.db.refresh) S.db.refresh(); changed(); } });`
  (Declare `recoverT` before both uses.)

**S4. Realtime deletes from other devices may never arrive.** (bug, verify first)
- `supa.js` `connect()` subscribes with `filter: 'owner=eq.' + uid` for `event: '*'`. Supabase Realtime docs say **DELETE events can't be filtered**.
  Use WebFetch on `https://supabase.com/docs/guides/realtime/postgres-changes` and search for "delete" to confirm.
- If confirmed: keep the existing `.on(...)` but change its `event` to handle only INSERT/UPDATE (two `.on` calls, `event: 'INSERT'` and `event: 'UPDATE'`, same filter),
  and add a third `.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'docs' }, p => { … })` **without** filter that ignores rows where `p.old && p.old.owner && p.old.owner !== uid`.
  The table has `replica identity full` and primary key `(owner, path)`, so `p.old.owner` and `p.old.path` are present.
- Add a test in `supa_test.js` that the mock channel receives a DELETE and removes the doc from cache (follow the existing test style in that file).

**S5. Unknown database errors drop writes.** (bug, data loss)
- `supa.js` `mapErr()` ends with `return { code: 'invalid_argument' … }`, so any unrecognised Postgres error makes `pump()` **drop** the write.
- Change: map only these to `invalid_argument`: `P0002`, codes starting `22` (data exception), `23` (constraint), `42P01`, `42883`. Everything else unknown → `{ code: 'unavailable' }` (retried).
- In `pump()`, to avoid infinite retries: if `retry && op.tries >= 10`, drop it instead and toast *"One change kept failing and was dropped."* (`console.warn` the op).
- Add test cases for `mapErr` in `supa_test.js` (export `mapErr` only if needed through the existing `module.exports` line; don't change the public `makeDb` API).

**S6. Native panel copy check.** (UX, small)
- In `native.js` `vPhonePanel()`, read the labels. Make each toggle row's button have `aria-label="<label>: On|Off"`. No other changes.

---

## 3. A2 — Plan engine and plan view

You own: `logic.js` functions `planCompute`, `projectPlan`, `busyFor`, `mergeIntervals`, `dayCapacity`; `app.js` sections `plan actions`, `views: plan`; `style.css` section `plan`; new `web/test/plan_test.js`.

Observed on the Today screen (mock data): rows show times **out of order** (4:53 pm row above the "now" row; 8:30 pm row above 7:10 pm),
names truncate to `Mathemat…`, the busy line wraps in the middle of a time range (`5:30 pm–` / `7:00 pm`), and the badge `50/10` is unexplained.

**P1. Show plan rows in time order.** (UX bug)
- Add in section `views: plan` a helper:
  ```js
  function planDisplayRows(pm) {
    const done = pm.rows.filter(r => !(r.remaining > 0));
    const live = pm.rows.filter(r => r.remaining > 0);
    const t = r => r.st === 'active' ? -1 : (r.pieces && r.pieces.length ? r.pieces[0][0] : Infinity);
    live.sort((a, b) => (t(a) - t(b)) || (a.order - b.order));
    return done.concat(live);
  }
  ```
  (Check the real field names in `planCompute`: `remaining`, `pieces`, `st`, `order`. Adjust if different.)
- In `vPlan`, iterate `planDisplayRows(pm)` instead of `pm.rows` when rendering block rows.
- In `planReorder` (section `plan actions`), build `ids` from `planDisplayRows(pm)` instead of `pm.rows`, and only swap with a neighbour that has **no fixed time** (`!r.at`) and is not done. If the neighbour is fixed or done, skip past it; if none, return.
- In `vBlk`, hide the up/down buttons on rows that have a fixed time (`r.at`) and on done rows.
- Check: screenshot of Today → Plan list times read top-to-bottom in increasing order; done rows on top.

**P2. Don't truncate subject names; move badges under the name on phones.** (UX)
- In CSS section `plan`, find the row-title rule (the element that holds the activity name and badges inside a block row; grep `blk` in that section).
  Allow wrapping: `flex-wrap: wrap; min-width: 0;` on the title row, and remove `white-space: nowrap`/`text-overflow: ellipsis` from the **name** (keep ellipsis on the note line).
- Check: at 390 px, "Mathematics" shows in full in every row.

**P3. Explain the pomodoro badge.** (UX)
- In `vBlk`, where a block's `pomo` preset is printed (e.g. `50/10`), render it as `50/10 pomo` and add `title` and `aria-label` = `"50-minute focus, 10-minute breaks"` built from the numbers.

**P4. Busy line: keep each item on one line.** (UX bug)
- In `vPlan`, the `Busy:` paragraph joins items with ` · `. Wrap each item in `<span class="busy-it">…</span>` and add CSS `.busy-it{white-space:nowrap}` in section `plan`.

**P5. Say what a fixed block overlaps.** (UX)
- Rows with `r.clash` show the badge `OVERLAP`. In `projectPlan`, when setting `r.clash = true`, also store the first clashing busy interval's index: `r.clashWith = <index into bz>`.
  `busy` items are `[start, end]` arrays here, so titles aren't available in `projectPlan`. Instead, in `vBlk` find the title by matching times against `busyOf(k)` (each item has `s`, `e`, `title`) and render the badge as `Clashes with <title>` (escape with `esc`).
- Add a test in `web/test/plan_test.js`: a fixed block 20:30–21:15 with busy 21:00–21:30 → `clash === true`. Copy the minimal setup (CTX, acts) from `logic_test.js`.

**P6. Plan header controls on phones.** (UX, small)
- The `UNTIL [10:30 PM]` input, calendar icon and `…` button sit on one row. Give the icon buttons `aria-label`s if missing (grep the markup in `vPlan`).

---

## 4. A3 — Today: timer card, switcher, distractions

You own: `app.js` sections `timer actions`, `views: Today`, `distractions: noticed, drifted, parked`; `style.css` sections `day header with the date-due stamp`, `Today grid`, `timer card (the hero)`, `switcher`.

Observed: Today is ~4,000 px tall on a phone; the "Noticed X" button looks like a close button on touch screens; the block title appears twice on the timer card; three deadline chips stack into three rows above the timer.

**T1. "Noticed X" looks like a close button on phones.** (UX bug)
- In `vNoticeBar` (distractions section) the button is `Noticed <kbd>X</kbd>`. Change to `Noticed <kbd class="kbd">X</kbd>`.
  The `.kbd` class is only shown on desktop (`@media (pointer:fine) and (min-width:860px)`), so phones see just "Noticed".
- Add `aria-label="Noticed an urge (shortcut X)"`.
- Check the same pattern anywhere else in your sections (`grep -n "<kbd>"`), fix the same way.

**T2. Don't repeat the block title on the timer card.** (UX bug)
- In `vTimer`, the meta line shows `<block title> · 19m of 2h` and the note line below shows the same title.
  If the note text equals the block title, don't render the note line (compare trimmed strings).

**T3. Deadline chips: one row.** (UX)
- In `vToday` (or the day-header function it calls; grep `in 3 days` / `deadline` in your sections), render deadlines as one horizontally scrollable row:
  CSS in section `day header…`: `display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; flex-wrap:nowrap;` and `flex:none` on each chip.
- Check: the three chips take one row on the Today screenshot.

**T4. Make Today shorter: collapsible lower sections.** (UX)
- In `vToday`, wrap the **Log** and the **day breakdown** blocks (whatever `vToday` calls for them — `vLog(...)`, `vBreakdown(...)`) in
  `<details class="fold" data-fold="log" open>` / `<summary>` with the existing section title. Don't edit `vLog`/`vBreakdown` themselves (A5 owns them).
- Remember open/closed per fold in `store` (`store.get('fold:log')` / `store.set(...)`; `store` is the existing local-storage helper — grep `const store` to confirm its API).
  Use a `toggle` listener added in your section: `document.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.fold')) store.set('fold:' + d.dataset.fold, d.open ? 1 : 0); }, true);`
- Rendering uses DOM morphing; make sure the `open` attribute comes from the stored value so a re-render doesn't flip it.
- CSS for `.fold > summary` goes in your `Today grid` section: no default marker (`list-style:none`, `::-webkit-details-marker{display:none}`), a chevron via text `▸`/`▾` is fine.
- Check: Today screenshot is noticeably shorter when folds are closed; reopening works after switching tabs.

**T5. Timer ring accessibility.** (a11y)
- In `vRing` / `vTimer`, give the ring SVG wrapper `role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<percent at render>" aria-label="Pomodoro progress"`.
  Don't try to update it every second; render-time value is fine.

**T6. Switcher: show the running activity clearly.** (UX, small)
- In `vSwitcher`, the card of the currently running activity should carry `aria-pressed="true"` and the class it already uses for the highlighted state. Add `aria-pressed="false"` to the others.

---

## 5. A4 — Calendar and Google Calendar

You own: `web/cal.js`, `web/gcal.js`, `logic.js` `layoutOverlaps`, `style.css` section `calendar` to end of file.

Observed at 390 px in the 3-day view: titles cut to `Chemi`, `Phy`, `Call ho`; overlapping events split into 3 thin lanes; the round `+` button covers events at the bottom right.

**C1. Default to Day view on narrow screens.** (UX)
- Find where the calendar range mode is initialised (grep `'3 days'`/`days: 3`/`UI.cal` in `cal.js`).
- If the user hasn't chosen a mode yet (nothing stored) and `window.innerWidth < 480`, start in Day view. Store the choice when the user taps Day/3 days/Week so it sticks.
- Check: fresh mock load → Calendar tab opens in Day view at 390 px.

**C2. Readable event blocks in narrow lanes.** (UX)
- In the event block renderer (`ce` class, grep `class="ce `), add a size class when the lane is narrow (e.g. lane width < 33% of the column or `layoutOverlaps` reports ≥ 3 lanes): `ce-narrow`.
- CSS: `.ce-narrow .t{writing-mode:horizontal-tb; font-size:11px; line-height:1.15; white-space:normal; word-break:break-word}` and hide `.m` (the time line) in `.ce-narrow`.
- Always keep the full title in `aria-label` (it already is for busy items; add it for plan/log items if missing).

**C3. Floating "+" must not cover content.** (UX bug)
- Find the FAB (grep `fab` in `cal.js` and the `calendar` CSS section). Add bottom padding to the scroll container equal to FAB size + 24 px so the last hour can scroll above it,
  and position the FAB with `bottom: calc(<nav height> + 16px + env(safe-area-inset-bottom, 0px))`.
- Check: scroll the calendar to the bottom in the screenshot; the 11 pm row isn't hidden under the button.

**C4. Clear wording in the day header.** (UX, small)
- The column header shows `21m too much` in red. Change the text to `21m over` and give it a `title` like `Planned 21m more than the free time today`.

**C5. Google Calendar panel.** (UX, small)
- In `gcal.js`, the panel text `Updated 3:02 pm` should say `Updated 3:02 pm · tap Refresh to sync` only when the last update is older than 30 min. Otherwise unchanged.

---

## 6. A5 — Log, Week, Patterns and insights

You own: `app.js` sections `views: log`, `views: Week`, `views: Patterns`, `example data…`; `logic.js` `aggregate`, `pomodoroByDay`, `studySessions`, `patternsModel`, `insights`, `distractionStats`;
`style.css` sections `log: timeline`, `log: list`, `day breakdown`, `week + patterns`; `web/test/logic_test.js`; new `web/test/patterns_test.js`.

Observed: the test run prints `undefined takes 1h 7m on the days you log it.`; `Phone & scrolli…` is truncated on Week; the Today timeline starts at 4 am and an 8-hour sleep block fills the first screen.

**W1. Insights must never print `undefined`.** (bug)
- `insights()` in `logic.js` uses `a.name` directly. Use `nameOf.act ? … :` — simplest: `(a.name || String(id))`.
- Also check `planStats.carried` in the `plan` insight is a **name**, not an id: find `planStatsRange` (section `views: Week`) and make it return the activity name (`act(id).name`).
- In `web/test/logic_test.js`, give every activity in the `acts` fixture (line ~6) a `name` (e.g. `name: 'Phone'`), and add an assertion that no insight text contains `undefined`.

**W2. Don't truncate life-activity names on Week.** (UX)
- In `vLifeWeek` and its CSS (section `week + patterns`), allow the name to wrap (remove `white-space:nowrap`/ellipsis on the name cell, keep `min-width:0`).

**W3. Today timeline: start where the day's activity starts.** (UX)
- In `vTimeline`, if the first logged entry of the day is a sleep-role activity (`act(en.a).role === 'sleep'`) that ends after the day start, collapse it to a compact one-line band
  (`Sleep 10:40 pm–7:05 am · 8h 25m`, height ~28 px) and start the hour grid at that entry's end hour. Keep the full entry tappable for editing (same `data-act` as now).
- If that's too invasive, do the simpler version: render the timeline scrolled so the current hour (or the first non-sleep entry) is at the top. Note which one you did.

**W4. Weekly review card copy.** (UX, small)
- `vReview`: the card tells people to "ask Claude in chat". Keep it, but only show it from Friday onward of the current week or when viewing a past week, and change the button label `Copy` → `Copy prompt`.

**W5. Patterns: empty and small-data states.** (UX)
- With fewer than 7 study days in range, each Patterns card should say how many more days are needed (e.g. `Needs 4 more days of logs`) instead of drawing a sparse chart.
  Use the existing count `pm.days` or similar (grep in `patternsModel`). Add a `patterns_test.js` check that `patternsModel` on 2 days of entries reports the count you use.

**W6. Charts accessibility.** (a11y)
- Every chart SVG/`div` in Week and Patterns (`vWeekBars`, `vWeekRibbons`, `vHeat`, `vCal`, `vHist`, `vMix`, `vSpans`, `vFocusHours`) gets `role="img"` and an `aria-label`
  that summarises it in one sentence (e.g. `Study by day: Mon 5h 48m, Tue 2h 58m`).

---

## 7. A6 — Shell, sheets, setup, accessibility, theme

You own: `app.js` sections `views: shell` (except `vNotices`), `views: sheets`, `desk view`, `toast`, `rendering…`, `sheets helpers`, `desk view helpers`, `entry editing`, `activities and settings`;
`style.css` from the top through section `section heads`, plus sections `sheets`, `toast`, `desk view`.

**U1. Bottom sheets don't take focus on phones.** (a11y bug)
- `focusSheet()` (section `sheets helpers`): on touch devices it does `sh.focus && sh.setAttribute('tabindex','-1')` and never focuses.
  Change the else branch to `{ sh.setAttribute('tabindex', '-1'); sh.focus({ preventScroll: true }); }`.
- Add a simple focus trap: in the same section, a `keydown` listener for `Tab` while `UI.sheet` is set that keeps focus inside `#sheet .sheet` (first/last focusable wrap-around).

**U2. Toast must sit above the bottom nav.** (UX bug, verify)
- Open a sheet-less view, trigger a toast (e.g. in the mock, stop the timer) and screenshot. If the toast overlaps the bottom tab bar, set its `bottom` in section `toast`
  to `calc(64px + env(safe-area-inset-bottom, 0px) + 12px)` on screens < 860 px (match the real nav height; measure with `document.getElementById('nav').offsetHeight` in Playwright).

**U3. Setup sheet is long: add a jump bar.** (UX)
- In the setup sheet renderer (section `views: sheets`, grep `type === 'setup'` or `sSetup`), add a sticky row of small buttons under the title:
  `Activities · Timer · Day · Phone · Data` (use the real section headings you find). Each scrolls its `<h3>` into view (`scrollIntoView({block:'start'})`).
  Define the action via `Object.assign(ACT, { 'a6-jump'(el) { … } })` in your section (check how other handlers receive the element/dataset — grep `data-act="view"` handler).
- Check: the setup screenshot shows the jump row.

**U4. Sign-out and destructive actions ask once.** (UX)
- In setup, any button that deletes data (archive activity is fine — it's reversible; look for delete/clear/reset/sign out) must show a confirm step.
  Sign-out confirmation is handled by A1 (S2); don't duplicate it.

**U5. Touch targets.** (a11y)
- In section `controls`, ensure `.icon-btn` and `.btn.sm` have `min-width:40px; min-height:40px` on `(pointer:coarse)`. Don't change desktop sizes.

**U6. Header crowding.** (UX)
- At 390 px the header shows logo + running pill + "Saved". When the running pill is shown, hide the `Saved` text and keep only its dot (keep the `role="status"` text for screen readers via a visually-hidden span).

---

## 8. A7 — Platform: build, CI, Supabase, Android

You own: `web/build.py`, `package.json`, `capacitor.config.json`, `.github/**`, `supabase/**`, `android/**`, `tools/**`.

**X1. Run tests on every pull request.** (do this first; other agents' PRs depend on it)
- New workflow `.github/workflows/ci.yml`: on `pull_request` (all branches) and `push` to non-main branches.
  Steps: checkout, setup-node 22, `npm install --no-audit --no-fund`, `npm run build:web`,
  `for f in web/test/*_test.js; do TZ=Asia/Kolkata node "$f" || exit 1; done`.
- In `web.yml`, replace the two explicit test lines with the same loop so new test files run automatically.

**X2. Dark-mode status bar colour.** (UX bug)
- `build.py` sets one `<meta name="theme-color">` from `--paper` (light). Parse the dark `--paper` too (the second `--paper:` in `style.css`, inside `@media (prefers-color-scheme: dark)`)
  and emit two metas: `<meta name="theme-color" media="(prefers-color-scheme: light)" content="…">` and the dark one.
- Check: `grep theme-color www/index.html` shows both.

**X3. Apply the pending migration 004.** (ask the user first)
- The last commit says `distraction_items view (not applied)`. Show the user `supabase/migrations/004_distraction_items.sql` (19 lines) and ask before running.
- After approval: Supabase MCP `apply_migration` with name `004_distraction_items` and that SQL. Then `get_advisors` (security) and report any findings in your status file. Don't fix advisor findings without asking.

**X4. Offline fonts.** (UX, investigate; time-box 30 min)
- Fonts load from Google Fonts at runtime, so the Android app shows fallback fonts offline. Investigate bundling woff2 files into `www/fonts/` during `build:web`
  (e.g. fontsource packages, installed in CI only). If you do it, change the `<link>` in `build.py` to local `@font-face` rules.
  You cannot test npm installs locally — make it CI-only and verify from the CI run (`gh run view <id> --log`). If it's not clean, write findings and skip.

**X5. Remove Capacitor template leftovers.** (cleanup)
- Delete `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java` and `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java` if nothing references them (`grep -r myapp android/`).
- Check the Android workflow still passes on your PR.

**X6. Android exact-alarm fallback check.** (verify)
- `Alarms.kt` falls back when `canScheduleExactAlarms()` is false. Confirm the fallback still schedules an inexact alarm (`setAndAllowWhileIdle`) and that `CarrelLivePlugin` reports `exactAlarms:false` to the web panel.
  Only note findings; change code only for an obvious bug.

---

## 9. Integrator (the user, or one extra agent after the others)

1. Merge order (fewest conflicts first): **A7 → A1 → A2 → A5 → A3 → A4 → A6**.
2. For each PR: CI green, read the status file, glance at screenshots, merge with "Rebase and merge".
3. If a rebase conflicts, the conflict is almost always in a section boundary or the end of a CSS section: keep both sides.
4. After all merges: `python3 web/build.py`, all tests, `python3 tools/shots.py /tmp/final` and `--dark`; check every view once.
5. Collect "Requests for other agents" from all `docs/fix-status/*.md` and turn them into a short follow-up list at the bottom of this file.

---

## 10. Inspection notes (evidence behind the tasks)

- Tests: `logic_test.js` and `supa_test.js` pass; `logic_test` output contains `undefined takes 1h 7m…` (fixture activities have no names → W1).
- Mock build renders all views with no JS errors and no horizontal overflow at 390 px.
- Today at 390 px: ~4,080 px tall; plan rows out of time order; `Mathemat…` truncated; busy line breaks inside `5:30 pm–7:00 pm`; `Noticed X` reads as a close button.
- Calendar 3-day at 390 px: titles cut to 4–5 letters; FAB over events.
- Week: `Phone & scrolli…` truncated; review card refers to chat.
- Sync: `online` doesn't flush the queue; readonly is sticky; sign-out wipes unsaved writes; realtime DELETE uses a filter; unknown DB errors drop writes.
- Build: single light `theme-color`; fonts come from the network.
- DB: migration `004` not applied (per last commit message).

---

## 11. Integration result (27 Oct 2026)

All 7 PRs (#1–#7) merged into `main` by fast-forward to `fix/a6-shell` (branches were stacked in merge order, so there were no conflicts).
Build passes, all 7 test files pass, mock screenshots at 390 px show no console errors and no horizontal overflow in light and dark mode.
Migration 004 was applied by A7 with the user's approval.

### Follow-ups (not yet done)
1. **Real-device checks (user):** Google sign-in recovery after "View only", two-device realtime deletes, dark status-bar colour, offline fonts in the APK, fold toggles while the timer re-renders.
2. **A1:** a write that fails 10 times is still dropped. Consider keeping failed writes in a list the user can export or retry instead of dropping them.
3. **A7:** fonts are downloaded from Google during each CI build. Pin them (vendor the files with checksums) so the look doesn't change between builds.
4. **A7 / user:** Supabase advisor warns that leaked-password protection is off (WARN). `carrel_owner` has RLS with no policy (INFO, looks intentional). Decide whether to change either.
5. **A4:** in Day view, a running log entry and its plan block for the same subject draw side by side with the same title (e.g. two "Chemistry" boxes at 6 pm). Consider hiding the plan block's remaining piece behind the running entry, or labelling it "planned".
6. **A3:** the Log fold's summary shows the text "Expand or collapse". A chevron alone (with that text kept for screen readers) would look cleaner.
