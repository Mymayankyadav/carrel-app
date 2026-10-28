# Carrel v2: plan and agent protocol

Written 28 Oct 2026. This is the **only** active plan. Older plans are in git history; don't use them.
Carrel today is a clean, minimal study timer and planner (4 tabs: Today, Plan, Stats, Settings; kit components; Android live notification).
v2 turns it into a **study operating system**: it plans with you, protects focus, schedules revision, and explains your patterns.
It must still feel calmer than any competitor.

Part A is *what* to build and why. Part B is *how* agents work with almost no input from the user. Part C is the lanes.

---

# Part A: product

## A1. Problems with v1 (from screenshots of every tab, 28 Oct)
1. **Empty overview, deep details.** Today shows the timer, "Next" and chips. Deadlines, backlog, insights, patterns and goals are 2–3 taps away, behind icons with no preview.
2. **Nothing ties the day together.** You can't see in one glance how much of the day is done, what's planned, and whether you're on track for the goal.
3. **Planning is manual.** Blocks are placed by hand, there's no daily ritual, and estimates aren't corrected by history.
4. **Revision isn't modelled.** Subjects are just timer labels; there are no topics, no spaced review, no backward plan from an exam.
5. **Stats describe, they don't advise.** No "what to change next week".

## A2. How to present more without clutter (research, applied as rules)
- **Overview first, zoom and filter, details on demand** (Shneiderman 1996). Today must *summarise everything* in one screen; one tap shows details.
- **Information scent** (Pirolli & Card 1999). Every entry point shows a preview of what's behind it: a number, a sparkline, a due date. No bare "›" rows.
- **Calm, glanceable technology** (Weiser & Brown 1996). Information sits at the periphery (rings, strips, dots) and comes to the centre only when it needs action.
- **Smart stack, not a dashboard.** Show at most 3 context cards, ranked by relevance to *now*, like the iOS Smart Stack. Everything else stays reachable but hidden. Fewer visible choices means faster decisions (Hick–Hyman law).
- **Thumb zone** (Hoober 2013). Primary actions sit in the lower half; the header holds only status.
- **Rules that follow from these:**
  - Any feature is at most **2 taps** from Today.
  - Every screen has **one primary action**.
  - Text is ≤ 6 words outside user content.
  - The minimal look stays the same: kit tokens, icons, no paragraphs.

## A3. Competitors and what v2 takes from each, or goes beyond
| App | Strength | Carrel v2 |
|---|---|---|
| Sunsama | daily planning and shutdown rituals | 2-minute rituals with real data: planned vs done, carry-over, a fresh start |
| Motion / Reclaim | auto-scheduling around calendar | auto-plan for **study**: energy windows, estimates corrected by your history, backward plans from exams |
| Structured / Tiimo | visual timeline, low friction, ADHD-friendly | the day ribbon on Today; one-tap start; gentle prompts |
| Rize / Timing | auto tracking, focus score | Android usage-based drift detection, but transparent and opt-in, with no vague "score" |
| Forest / Opal / one sec | focus protection, friction before distraction | the "Noticed" system plus urge-surf and a friction pause, no gamified guilt |
| Anki / RemNote | spaced repetition | topic-level spacing inside the planner: reviews become timed blocks automatically |
| Toggl | clean time logs | already in v1; keep |

**Beyond them:**
- Plans that learn your **personal planning fallacy**.
- Revision that **schedules itself backwards from exams**.
- Breaks that **adapt to your flow** instead of a fixed timer.
- **Claude as coach** through the data it already reads.

## A4. v2 features
Each has an evidence base, where it shows in the UI, and its lane.

1. **Today v2: overview in one screen** (L1).
   - Header: date · **daily goal ring** (studied / goal) · quick add `+` · settings gear.
   - Hero card: timer (as now). When idle it shows the **next block with Start**, not a bare grid.
   - **Day ribbon:** a 24 h strip, logged (solid) vs planned (outline), with a now marker. Tap → Plan.
   - **Smart stack:** ≤ 3 ranked cards (deadline countdown, reviews due, ritual prompt, coach note, insight, drift summary). Swipe a card away to snooze it for today.
   - Switch chips as now.
2. **Rituals** (L2). Making concrete plans for unfinished goals removes their mental pull (Masicampo & Baumeister 2011), and attention residue drops when work is closed properly (Leroy 2009).
   - **Morning plan:** a card, or opens automatically on first launch after day start. 3 steps in one sheet: pick from backlog/reviews → auto-plan → one "if–then" intention.
   - **Shutdown:** a card after plan end. 3 steps: done vs planned, carry over or drop, choose tomorrow's first block. Replaces "Wrap up".
3. **Smart scheduler** (L3).
   - **Planning fallacy:** people underestimate durations (Buehler, Griffin & Ross 1994); reference-class forecasting fixes this (Kahneman & Tversky). Keep a per-subject **estimate multiplier** from planned vs actual and show "you usually need ×1.3".
   - **Energy windows** from your own focus ratings by hour (data already in Patterns). Hard subjects go in peak windows; a ≥ 10 % buffer keeps the plan realistic.
   - **Backward planning** from deadlines: hours needed ÷ days left, spread over the days. Interleave subjects across the day (Rohrer & Taylor 2007).
4. **Subjects and spaced review** (L4). Spacing improves retention, and the optimal gap grows with the time to the test (Cepeda et al. 2006, 2008). Retrieval practice is one of only two "high utility" techniques (Dunlosky et al. 2013).
   - A new **Subjects** tab: subject → topics, deadlines, backlog, time and goal (this absorbs the Tasks subscreen).
   - Each topic has a review schedule (SM-2-lite, §C-L4). Due reviews appear as a Today card and are auto-placed by L3.
   - Tapping a topic after a session marks it reviewed and rates recall in 3 icons.
5. **Focus v2** (L5).
   - **Start intention:** optional one line ("Finish problems 1–10") plus an if–then plan. Implementation intentions have a medium-to-large effect on goal attainment (Gollwitzer & Sheeran 2006, d≈0.65).
   - **Adaptive breaks:** a Flowtime mode where break length is proportional to focus length. Self-regulated breaks are at least as good as fixed Pomodoro (Biwer et al. 2023). Break suggestions favour movement and no phone.
   - **Session end:** focus rating (exists), plus an optional 30-second **recall note**, a blurt of what you learned (the generation effect), and topic tagging (feeds L4).
6. **Distraction v2** (L6).
   - Android **usage-based drift detection** (opt-in, `PACKAGE_USAGE_STATS`): an app opened during focus produces a suggestion such as "Instagram 6m during Physics · Log as drift?". All data is summarised on the device; only per-session totals are stored.
   - **Urge-surf:** pressing Noticed offers a 60-second breathing/wait ring (one sec–style friction).
   - A weekly distraction card with the trend.
7. **Insights v2** (L7). The Stats tab is renamed **Insights**.
   - A week summary with **3 concrete suggestions** generated from rules, for example: "Physics gets 29 % of its goal. Move it to your 9–11 am peak".
   - Estimate accuracy, focus by hour and subject, goal gradient (Kivetz et al. 2006: progress shown as % remaining near the end).
   - **Fresh-start** prompts on Mondays and at month start (Dai, Milkman & Riis 2014).
   - A **flexible streak**: a "minimum day" (25 min, set by the user) keeps the streak, and 1 freeze per week. This avoids the all-or-nothing "what-the-hell" effect.
8. **Android surfaces** (L8):
   - a home-screen widget (timer + today total + start/stop);
   - a Quick Settings tile (start last / stop);
   - app shortcuts (start subject, quick add);
   - an Android 16 promoted "Live Update" notification where supported.
9. **Quick capture** (L9):
   - one `+` everywhere, with natural-language parsing ("physics ch7 2h by fri !" → task, subject, estimate, due date, high priority);
   - an Android share target → backlog;
   - deadlines from text ("maths test 12 nov 9am").
10. **Claude coach bridge** (L10). Claude already reads and writes the log, plans and reviews through the database.
    - v2 adds a `coach/*` inbox (notes, plan proposals, weekly reviews). It shows as a Today card and an Insights section; a proposal can be **accepted in one tap**.
    - Settings › Claude prompts gets updated prompts that tell Claude about the new collections.

**Out of scope for v2:** social or body doubling, paid APIs, server-side AI, iOS, and new sign-in providers.

## A5. Information architecture v2
- Tabs: **Today · Plan · Subjects · Insights**. Settings becomes a gear on Today's header (and stays a page stack).
- Depth rule: every feature is reachable in ≤ 2 taps from Today, through a card, the ribbon, the ring, `+` or a tab.

| Need | Path |
|---|---|
| What now? | Today hero (0 taps) |
| How is my day? | ring + ribbon (0) → Plan (1) |
| Exam coming? | deadline card (0) → subject (1) |
| What to revise? | reviews card (0) → topic (1) |
| How am I doing? | insight card (0) → Insights (1) |
| Add anything | `+` (1) |
| Settings | gear (1) |

---

# Part B: agent protocol (minimum user input)

## B1. Roles
- **Orchestrator (ORC)**, one agent for the whole project. Owns `docs/v2/BOARD.md`, `docs/v2/DECISIONS.md`, `docs/v2/contracts.md` and the frozen files. Starts lanes, reviews and merges PRs, resolves conflicts, ships releases, writes digests to the user.
- **Lane agents (F1, L1–L10):** each owns one lane (Part C). They build, test and open a PR.
- **QA agent (QA)**, continuous: runs `tools/redesign_smoke.py`, `tools/shots.py` (light/dark, 390/1280) and the lane smoke scripts on `main` after every merge; files regressions as `BOARD.md` items, and fixes trivial ones in a `v2/qa-*` PR.
- **The user** is touched only per §B3.

## B2. Autonomy levels
1. **Decide:** the default for everything not listed in §B3. Pick the option that best fits Part A, and keep going.
2. **Record:** non-obvious decisions get one line in `docs/v2/DECISIONS.md` (`date · lane · decision · why`). No asking.
3. **Flag:** when unsure whether users want something, ship it behind a feature flag `CFG.labs.<name>`, default **on** if it's low-risk and **off** if it's intrusive, toggled in Settings › Labs. Don't block on it.
4. **Ask** (only §B3).

## B3. Ask the user only for
1. Destructive or irreversible production data operations: deleting or rewriting existing user documents, or a destructive SQL migration. Additive collections need no SQL (the `docs` table is generic) and need no permission.
2. Anything that costs money or needs new secrets, accounts or third-party services.
3. Sending user data anywhere new: any server other than Supabase or Google Calendar.
4. Removing a v1 feature without a replacement.

Batch the questions: ORC sends **at most one message per day**, a numbered list, each with a recommended default. With no reply in 24 h, ORC takes the default if it's reversible; otherwise the item waits while other work continues.

## B4. Workflow
1. **Claim:** a lane agent sets its row in `BOARD.md` to `doing` (branch `v2/<lane>`). One agent per lane.
2. **Build:**
   - Only in owned files (Part C). Shared contracts change only through ORC (`v2/contracts` PR, merged first).
   - Use the kit, icons and tokens; register views, pages, sheets and cards in the registries.
   - New data goes in **new collections or new optional fields** with `v:1` (§B6).
3. **Prove:**
   - Build, all `web/test/*_test.js`, `tools/shots.py` OK in 4 configurations.
   - A lane test file and a lane smoke script (`tools/v2_<lane>_smoke.py`) wired into `ci.yml`.
   - Screenshots of every new surface, attached to the PR.
   - Native lanes: the Android CI must pass, with an APK artifact.
4. **PR:** to `main`, titled `<lane>: <summary>`, with the §B7 checklist ticked and a `docs/v2/status/<lane>.md` handoff.
5. **Merge (ORC):**
   - Green CI + checklist + screenshot review → merge (squash). No user approval needed.
   - Conflicts: ORC rebases. A lane that's blocked twice gets de-scoped (recorded in DECISIONS) and the rest still merges.
6. **Release (ORC):**
   - Web: automatic through Pages.
   - Native: when native code changes, CI builds the signed APK. If web needs the new APK, raise `NATIVE_API` and feature-detect native methods.
   - After each phase, ORC tells the user once: "Install build N" (only if native changed) plus a digest.
7. **Digest:** after each phase, ORC posts one message with what shipped (≤ 8 bullets), 4 phone screenshots, open questions (§B3) and the next phase. That's the user's only regular touchpoint.

## B5. Phases (lanes inside a phase run in parallel)
- **Phase 0, F1 Foundations** (blocking, small): nav v2, card registry, ritual/sheet flow helper, labs flags, new-collection plumbing, contracts doc.
- **Phase 1:** L1 Today, L3 Scheduler, L4 Subjects, L5 Focus, L9 Capture, L8 Android surfaces.
- **Phase 2:** L2 Rituals (needs L3), L6 Distraction (needs L5 hooks), L7 Insights, L10 Coach.
- **Phase 3:** QA hardening, Labs flags flipped to their final defaults, removal of dead v1 code, final digest.

Lanes may start Phase-2 work early against the contracts, with stubs gated by the `PAGES`/`SHEETS`/`CARDS` registry checks.

## B6. Data rules
- Storage: the existing `docs` table through `S.db` (paths `coll/id`). New collections need ORC to add subscription plumbing (F1 does it once with `watchColl(name)`).
- **New collections:**

| Path | Shape |
|---|---|
| `topics/<id>` | `{v:1, subject, title, order, due:'YYYY-MM-DD', interval, ease, reps, last, archived}` |
| `rituals/<date>` | `{v:1, date, morning:{at, picks:[ids], intent}, shutdown:{at, done, carry:[ids], first}}` |
| `coach/<id>` | `{v:1, at, kind:'note'\|'plan'\|'review', title, body, proposal?, status:'new'\|'seen'\|'accepted'\|'dismissed'}` |
| `usage/<date>` (Android, opt-in) | `{v:1, date, sessions:{<entryId>:{apps:{<label>:{min, opens}}}}}`: labels only, never content |
| `config/settings.labs` | `{<flag>: bool}` |

- **New optional entry fields** (inside `days/*` entries): `intent`, `ifThen`, `energy` (1–3), `recall` (≤ 280 characters), `topics:[ids]`.
- Never rename or remove existing fields. Old app versions must ignore the new fields safely.
- Add a security-advisor check after any new SQL (none is expected).

## B7. PR checklist
- [ ] Only owned files changed (`git diff --stat main`).
- [ ] Build, all tests, `shots.py` OK at 390/1280 in light and dark; lane smoke passes in CI.
- [ ] Follows A2: ≤ 2 taps, preview on every entry point, one primary action, no paragraphs, kit tokens and icons only.
- [ ] Empty, loading and offline states checked.
- [ ] Accessibility: labels on icon buttons, ≥ 44 px targets, Back/Escape behaviour.
- [ ] Data: only additive, `v:1`, works with old data; works offline (write queue).
- [ ] Behind a Labs flag if intrusive; DECISIONS.md updated.
- [ ] Status file written.

## B8. Token and effort rules for agents
- `grep -n`, then read ranges. Never read whole large files or paste them.
- Reuse the existing helpers (`planModelFor`, `aggregate`, `patternsModel`, `insights`, `busyIv`, kit API) before writing new ones.
- Keep pure logic (scheduling, spacing, parsing, insights) in testable files without the DOM: `web/logic/*.js`, `module.exports` guarded.
- Time-box: when something fails twice, simplify the approach or de-scope; don't loop.

---

# Part C: lanes (ownership is exclusive)

The files listed are each lane's own. Everything else is read-only, except through ORC.
Frozen (ORC only): `web/core/*`, `web/ui/shell.js`, `web/ui/kit.*`, `web/ui/icons.js`, `web/files.json`, `web/build.py`, `web/supa.js`, `web/auth.js`, `web/config.js`, `.github/workflows/*` (lanes request CI wiring in their status file; ORC adds it).

### F1: Foundations (Phase 0)
- **Owns:** frozen files (temporarily), `docs/v2/*`.
- Nav v2: tabs `today plan subjects insights`, gear on Today → `openPage('settings', …)`. Keep the aliases `stats → insights` and `settings` as a page-stack root.
- `CARDS` registry: `CARDS[id] = { rank(now, ctx) → 0..100 (0 = hidden), render(ctx), snooze: true }`. Today shows the top 3; a swipe or `close` snoozes the card for the day (store `cardSnooze:<date>`).
- `watchColl(name)` adds live subscriptions for `topics`, `rituals`, `coach`, `usage` into `V`.
- `CFG.labs` read helper `lab(name, default)` and a Settings › Labs page (a list of switches built from a registry `LABS[name] = {label, def}`).
- `flowSheet(steps)`, a multi-step sheet helper (step dots, Next/Done) for rituals and onboarding.
- `web/logic/` folder in `files.json` (loaded before core), plus a `module.exports` pattern for tests.
- Write `docs/v2/contracts.md`: every registry, helper and collection path listed above.

### L1: Today v2
- **Owns:** `web/ui/today.*`, `web/ui/ribbon.js`, `web/test/today_v2_test.js`.
- Header with goal ring (SVG 28 px, accent arc; tap → Insights), `+` (opens L9's `SHEETS.capture`), gear.
- Idle hero: the next open block with **Start** (primary) and its time. With no plan: `Plan my day` (opens L2 morning) and a resume chip.
- The day ribbon (`ribbon.js`, reused by Plan's week header later): 24 h from day start, 8 px tall. Logged entries are solid colour, planned blocks are outline, busy time is hatched, now is a 2 px tick. Tap → Plan on today.
- The smart-stack host renders `CARDS`; L1 itself registers `deadline` (nearest ≤ 14 d: countdown + hours done / needed bar) and `insight` (one line from `insights()`).
- Remove the "Next" list once the ribbon and hero cover it. If screenshots show it's still needed, keep a 2-row version and record why in DECISIONS.

### L2: Rituals
- **Owns:** `web/ui/rituals.*`, `web/test/rituals_test.js`.
- `CARDS.morning`: from day start until 2 h in, until done. `CARDS.shutdown`: from 30 min before plan end, until done.
- The morning flow (`flowSheet`): 1) pick (backlog, reviews due, carry-over, with suggested items pre-ticked) → 2) preview of L3's `autoPlan` on the ribbon, Accept → 3) intention (one line + optional if–then). Writes `rituals/<date>.morning`.
- The shutdown flow: 1) done vs planned (2 numbers + a list) → 2) per unfinished item: tomorrow / backlog / drop → 3) tomorrow's first block. Writes `rituals/<date>.shutdown`; replaces P2's Wrap up sheet (keep `wrapUp()` as the writer).

### L3: Smart scheduler (pure logic + Plan integration)
- **Owns:** `web/logic/sched.js`, `web/test/sched_test.js`, plus `Plan › ⋮ › Auto-plan` in `web/ui/plan-sheets.js`.
- `estimateFactor(subject)`: median of actual / planned over the last 30 completed blocks, clamped to 0.8–2.0, defaulting to 1.
- `energyWindows()`: hours ranked by average focus rating and minutes (from `patternsModel`).
- `autoPlan(dayKey, items, opts)`: places items in free time (respecting busy, fixed blocks, `gap`, plan end, and a 10 % buffer). Hard or high-priority items go in the top windows; consecutive subjects are interleaved; returns blocks without writing them.
- `backwardPlan(deadline, hoursNeeded)`: a sessions-per-day proposal up to the deadline (the last day lighter), feeding the morning picks.
- UI: blocks created by the scheduler get `from:'auto'`; the block sheet shows "Estimated ×1.3 from your history" as a sub-line.

### L4: Subjects and spaced review
- **Owns:** `web/ui/subjects.*`, `web/logic/spacing.js`, `web/test/spacing_test.js`, `web/test/subjects_test.js`; P3's `web/ui/tasks.*` moves here (ORC transfers ownership).
- `VIEWS.subjects`: one row per study subject: dot, name, week time / goal bar, next deadline chip, and "3 reviews due". Tap → `PAGES.subject`.
- `PAGES.subject`: header with the week total; sections Deadlines, Topics, Backlog, and a Recent sessions preview, each ≤ 5 rows with "All ›".
- Topics: add, rename, reorder. **Spacing:** start interval 1 d. On recall rating good/ok/poor: `interval = max(1, round(interval × (2.5 / 1.8 / 0.5)))`; due = today + interval; if an exam deadline for that subject is closer than the due date, pull the review forward (Cepeda: gap ≈ 10–20 % of the time to the test).
- `CARDS.reviews`: count due + the first 2 topic names → tap opens a reviews sheet with a 3-icon rating per topic.
- Expose `dueTopics(dayKey)` for L3 and L2.

### L5: Focus v2
- **Owns:** `web/ui/today-sheets.*`, `web/ui/focus.*`, `web/logic/breaks.js`, tests.
- Start options get an optional intent line and if–then (a collapsible). They're stored on the running entry (`intent`, `ifThen`) and shown on the timer card's second line.
- Labs flag `flowtime` (default on): when the Pomodoro switch is off, the break suggestion = `clamp(round(focusMin / 5), 5, 20)` min, offered as a quiet chip when the elapsed time passes 25 min.
- Break sheet suggestions: walk, water, stretch (icons); never "check phone".
- End-of-session sheet (after stopping a study entry; replaces the 3-icon card prompt when Labs `recall` is on): focus rating icons, topic chips (from L4) and an optional recall textarea. One primary `Save`, skippable.
- Energy check (Labs `energy`, default off): 3 icons at start.

### L6: Distraction v2
- **Owns:** `web/ui/distraction.*`, Android `live/Usage*.kt` (new files), tests.
- Android: a `UsageStatsManager` reader (opt-in through Settings › Notifications › "Detect drift"; it opens the system usage-access screen). For each finished focus session it sums foreground minutes per app label for apps on a user-editable list (default: social and video categories). Writes `usage/<date>`.
- Web: after a session with detected usage ≥ 2 min, a toast "Instagram 6m during Physics · Log". Log = cut it as a drift (reuse the existing drift writer).
- Urge-surf: Labs `urgesurf` (default on). Noticed → a 60-second ring "Wait it out" with `Back to work` / `Log drift`.
- `CARDS.distraction`: shown on Sundays, or when the week's drift exceeds 2× last week; one line plus a sparkline.

### L7: Insights v2 (rename Stats)
- **Owns:** `web/ui/stats.*`, `web/ui/stats-pages.*`, `web/logic/advice.js`, tests.
- Top: week total + ring vs weekly goal, then **3 suggestions** from `advice.js` rules. Each is one sentence with an action button (`Plan it`, `Set goal`, `Review`) that deep-links. Rules use the deficit vs goal, estimate factor (L3), peak window, review backlog (L4), drift trend (L6) and streak risk.
- Sections, each with a preview number: Subjects; Focus (by hour, by subject); Estimates (accuracy %); Patterns (heatmap); Streak (flexible: a minimum day set in Settings › Day, default 25 min; 1 freeze per week).
- Fresh-start banner (a card) on Monday or the 1st: "New week. Set one goal?" → goal sheet.

### L8: Android surfaces
- **Owns:** `android/**` (except `live/Usage*.kt`), `web/native.js`.
- Home widget (2×1 and 4×1): current activity + elapsed (Chronometer) + stop/start-last button, and today's total. It updates from the live engine.
- Quick Settings tile: start last / stop. App shortcuts: top 3 subjects + "Quick add" (deep link `app.carrel.study://capture`).
- Promoted Live Update (Android 16 `ProgressStyle` / promoted ongoing) behind an API check; otherwise the current notification.
- Share target: `text/plain` → `SHEETS.capture` with the text prefilled (through the deep link).

### L9: Quick capture
- **Owns:** `web/ui/capture.*`, `web/logic/parse.js`, tests (≥ 30 parse cases).
- `SHEETS.capture`: one text field, live chips that preview the parse (subject, duration, date, priority, type), and type tabs (Task / Deadline / Block / Note-to-coach). Enter = save.
- Parser: subject by prefix or fuzzy match to activities; durations `2h`, `90m`, `1.5h`; dates `today`, `tmr`, `fri`, `12 nov`, `in 3 days`; time `9am`, `14:30`; `!` = high priority; words `test`, `exam`, `due` → deadline.
- Global `+` placement: Today header (L1), Plan FAB (switch it to `capture` with the Block tab), Subjects header.

### L10: Claude coach bridge
- **Owns:** `web/ui/coach.*`, `web/ui/settings-pages.js` (only the Claude prompts page), `docs/v2/claude-protocol.md`.
- `CARDS.coach`: the newest `coach/*` with status `new`: title + 1 line. Tap → a coach sheet (body, plus a proposal preview on the ribbon) with `Accept` (writes the proposed blocks or goal), `Dismiss`.
- An Insights section "From Claude" (the last 5).
- `claude-protocol.md`: the exact collection shapes and examples Claude must read and write (plans, coach notes, reviews, topics). The prompts page gets 4 prompts updated to reference it: plan my day, plan my week, weekly review, exam plan.

### QA (continuous)
- **Owns:** `tools/v2_*_smoke.py` (shared with lanes, by file), `web/test/v2_regression_test.js`.
- After each merge: the full matrix plus a **2-tap audit**: a script that walks every registered page and card and asserts it's reachable from Today in ≤ 2 actions.
- Files `BOARD.md` items, and fixes trivial regressions in `v2/qa-*` PRs.

---

## Board template (`docs/v2/BOARD.md`, created by F1)
| Lane | Phase | Status | Branch | PR | Notes |
|---|---|---|---|---|---|
| F1 | 0 | todo | v2/f1 | | |
| L1 … L10, QA | 1–3 | todo | v2/<lane> | | |
Status values: `todo · doing · review · merged · descoped`.
