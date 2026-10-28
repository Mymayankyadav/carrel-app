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
10. **Claude coach bridge** (L10). **Claude reaches Carrel only through Supabase** (SQL through the Supabase connector, in a chat the user starts). There are no API calls in either direction: the app never calls an AI service, and Claude never calls the app.
    - Claude reads the `docs` table and writes with the existing `doc_set` / `doc_merge` functions. `carrel_uid()` already maps postgres-role SQL to the owner.
    - v2 adds a `coach/*` inbox (notes, plan proposals, weekly reviews) that Claude writes. Realtime delivers it to the app, where it shows as a Today card and an Insights section; a proposal can be **accepted in one tap**.
    - The app works fully without Claude. Every v2 feature (scheduler, advice, spacing, parsing) runs **on the device with deterministic rules**; Claude is an optional extra.
    - Settings › Claude prompts gets updated prompts that point Claude to the guide doc.

**Out of scope for v2:** social or body doubling, any AI or LLM API call from the app or from edge functions, paid APIs, iOS, and new sign-in providers.

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
| `coach/<id>` | `{v:1, at, kind:'note'\|'plan'\|'review'\|'ask', from:'claude'\|'me', title, body, proposal?, status:'new'\|'seen'\|'accepted'\|'dismissed'}`. `ask` = a question the user typed in Quick capture, which Claude answers in the next chat |
| `usage/<date>` (Android, opt-in) | `{v:1, date, sessions:{<entryId>:{apps:{<label>:{min, opens}}}}}`: labels only, never content |
| `config/settings.labs` | `{<flag>: bool}` |

- **New optional entry fields** (inside `days/*` entries): `intent`, `ifThen`, `energy` (1–3), `recall` (≤ 280 characters), `topics:[ids]`.
- Never rename or remove existing fields. Old app versions must ignore the new fields safely.
- Claude-written documents are **untrusted input**. The app validates each shape (`v`, kinds, lengths, dates) and ignores invalid fields; it never runs anything from them.
- Allowed additive SQL (no user approval needed): **read-only views** that make the new collections easy for Claude to query (e.g. `coach_inbox`, `topics_due`, `rituals_week`), on the `distraction_items` pattern (`security_invoker`, `carrel_uid()` filter, select-only grant). Run the security advisor after any new SQL.

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
Frozen (ORC only): `web/ui/cards.js`, `web/ui/labs.js`, `web/core/*`, `web/ui/shell.js`, `web/ui/kit.*`, `web/ui/icons.js`, `web/files.json`, `web/build.py`, `web/supa.js`, `web/auth.js`, `web/config.js`, `.github/workflows/*` (lanes request CI wiring in their status file; ORC adds it).

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

### L10: Claude coach bridge (through Supabase only)
- **Owns:** `web/ui/coach.*`, `web/ui/settings-pages.js` (only the Claude prompts page), `supabase/migrations/005_v2_views.sql`, `docs/v2/claude-protocol.md`.
- **No API.** Claude works only in a chat the user opens, using the Supabase connector. Everything below is plain SQL on `public.docs` plus documents.
- **Guide doc:** update `meta/guide`, the doc Claude is told to read first (see the `docs` table comment in `001_core.sql`). It lists every collection and shape (§B6), how to write (`select doc_merge('coach/<id>', '<json>'::jsonb, null, 'claude')`), and rules: write only `coach/*`, `plans/*` proposals and `topics/*`; never edit `days/*` entries; `updated_by = 'claude'`.
  - L10 writes the guide content as a JSON file in the repo (`docs/v2/guide.json`). ORC loads it with one `doc_set` (allowed: it overwrites only the guide doc).
- **Views** (`005_v2_views.sql`, additive, select-only): `coach_inbox`, `topics_due`, `week_summary` (per-subject minutes vs goal, estimate factor and drift for the current week), so Claude needs a single query to get context.
- **App side:**
  - `CARDS.coach`: the newest `coach/*` with status `new`, showing the title and 1 line. Tap → a coach sheet (body, plus a proposal preview on the ribbon) with `Accept` (validated, then written through the normal write queue, so Undo works) and `Dismiss`.
  - Status changes are written back, so Claude can see what was accepted.
  - An Insights section "From Claude" (the last 5). When there are no coach docs, nothing shows (no empty state).
- **Prompts page:** 4 copy-ready prompts: plan my day, plan my week, weekly review, exam plan. Each starts with "Use the Supabase connector. Read `meta/guide` in `public.docs`, then …".
- `claude-protocol.md`: the same content for humans, with 3 worked SQL examples (read week context, write a plan proposal, write a review).
- **Test:** `coach_test.js` feeds malformed coach docs and asserts the app ignores them and never crashes.

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

---

# Part D: implementation details (read before coding)

Part D removes guesswork. If Part D and Parts A–C disagree, **Part D wins**. If something is still unclear, choose the simplest option that satisfies Part A, record it in `docs/v2/DECISIONS.md`, and continue.

## D0. Facts about the current code (verified 28 Oct 2026)

### D0.1 Build and files
- `web/build.py` concatenates the files listed in `web/files.json` (`js` and `css` arrays, in order) into `www/index.html`, plus a mock test page `web/test/carrel-test.html`. `web/logic.js` is included before them.
- Every new `.js`/`.css` file must be added to `web/files.json`. Only ORC edits that file: list your new files in your status file under "Files to register", and ORC registers them in a tiny PR before you start (or you start, and the build includes them after ORC merges). **Recommended:** F1 pre-registers *all* v2 files listed in Part C as empty stubs, so lanes never wait.
- All code runs in one global script scope. Function names must be unique across the app, so **prefix every new top-level name with your lane id** (`l4DueTopics`) unless the plan gives an exact name (contract names in D0.4 and Part C are used as written).

### D0.2 Stored data (Supabase `public.docs`; path = `collection/id`, `data` = JSON)
| Path | Shape (fields you may rely on) |
|---|---|
| `days/<YYYY-MM-DD>` | `{date, entries:{<entryId>:{activity, start, end, note, focus(1–3\|null), block, pomo}}}`. `start`/`end` are ISO local strings (`isoLocal(ms)`) |
| `plans/<YYYY-MM-DD>` | `{date, source, end?('HH:MM'), note?, blocks:{<blockId>:{activity, title, minutes, orig, order, at('HH:MM'\|null), status('open'\|'skipped'\|…), pomo, from}}}` |
| `state/current` | the running timer `{running, id, activity, start, note, block, pomo, ret, ack}` |
| `config/activities` | `{items:{<actId>:{name, color, kind('study'\|'life'), order, goal(hours/week\|null), archived, role('break'\|'sleep'\|'drift'\|null), guard, today}}}` |
| `config/settings` | `DEFAULTS` in `web/core/state.js`: `dayStart`, `planStart`, `planEnd`, `gap`(min), `dailyGoal`(**minutes**), `weekStart`(0–6), `guardHours`, `clock`, `pomodoro{focus,short,long,every}`, `onboarded`, `tz` |
| `planning/backlog` | `{items:{<id>:{title, activity, minutes, due, prio(1 high, 2 normal, 3 low), order, created}}}` |
| `planning/deadlines` | `{items:{<id>:{title, date, time, activity, kind('exam'\|'due'\|'other'), done}}}` |
| `planning/commitments` | weekly busy items (read through `busyOf(k)`) |
| `distractions/<date>` | `{date, items:{<id>:{type('urge'\|'drift'\|'park'), at, driftMin, text, activity, entry, …}}}` |

### D0.3 Reading data in the app
- `V` is the current view of all data, with pending writes applied (`V.days`, `V.plans`, `V.settings`, `V.activities`, `V.planning`, `V.distractions`).
- `CFG` holds the merged settings; `ACTS` is the activity list; `ACTMAP[id]`; `act(id)`.
- `ENTRIES` are normalised entries `{id, day, a, s, e, note, focus, block, pomo, running?}` (`s`/`e` in ms; `e` is null while running); `CUR` is the running timer or null.
- **Helpers:** `todayKey()`, `dayKeyOf(ms)`, `addDaysKey(k, n)`, `dayStartMs(k)`, `dayEndMs(k)`, `hmOnDay(k, 'HH:MM')`, `isoLocal(ms)`, `parseT(v)`, `fmtDur(ms)`, `fmtT(ms)`, `fmtHM('HH:MM')`, `uid(prefix)`, `esc(s)`, `clamp(v, a, b)`, `MIN`, `HOUR`, `DAY`.
- **Domain helpers:** `planModelFor(k)` (rows with `id, activity, title, target, done, remaining, st, at, pieces:[[s,e]], order`), `busyOf(k)` / `busyIv(k)`, `deadlineList()`, `backlogList()`, `aggregate(entries, now, fromK, toK)`, `patternsModel(entries, now, weeks)`, `insights(...)`, `distractionStats(...)`, `lastEntry()`, `lastStudy()`.

### D0.4 Writing data
```js
const w = W();                                   // a write set
w.update('planning/backlog', { items: { [id]: { title } } }, { items: {} });  // deep merge; 3rd arg = initial doc if missing
w.set('coach/' + id, doc);                       // replace whole doc
w.day(k, { [entryId]: { focus: 3 } });           // merge into days/<k>.entries
w.plan(k, { blocks: { [blockId]: blockDoc } });  // merge into plans/<k>
commit('Message shown in toast.', w);            // queues the writes offline-safe; adds Undo; re-renders
commit(null, w, { undo: false });                // silent, no undo
```
- Deleting a map key = setting it to `null` in an `update`.
- Never write directly with `S.db`; always use `W()` + `commit()`.

### D0.5 UI framework
- **Registries:** `VIEWS[name] = () => html` (tabs), `PAGES[id] = { title, render(params), actions?(params) }` (subscreens; `pushPage(id, params)`, `openPage(tab, id, params)`), `SHEETS[type] = sh => html` (`openSheet({type, ...})`, `closeSheet()`), `ACT[name] = el => {}` (clicks on `data-act="name"`; long-press via `data-long`).
- `render()` re-renders everything (DOM morphing keeps focus). Call `changed()` after changing `UI` state.
- **Kit (use these, don't invent new controls):** `kIconBtn kBtn kRow kGroup kField kSwitch kSeg kChips kStepper kTime kDate kDur kText kArea kActPick kSwatches kCollapse kEmpty kSheetHead kSheetFoot kPageHead openMenu confirmDialog`, plus `icon(name)` and `toast(msg, opts)`. Read their signatures in `web/ui/kit.js` (`grep -n "^function k" web/ui/kit.js`).
- **Local per-device storage:** `store.get(key)`, `store.set(key, value)` (JSON; prefix `carrel.` is added).

### D0.6 Tests and evidence
- **Unit test template** (Node, no DOM), `web/test/<lane>_test.js`:
```js
'use strict';
const assert = require('assert');
const L = require('../logic/sched.js');          // pure module under test
assert.strictEqual(L.estimateFactor([]), 1);     // one assert per rule
console.log('SCHED TESTS PASSED');
```
- **Pure modules** (`web/logic/*.js`) end with: `if (typeof module !== 'undefined' && module.exports) module.exports = { fnA, fnB };`. They take every input as a parameter (no `V`, `CFG`, `Date.now()` inside; pass `now`).
- **UI tests:** follow the existing `web/test/t1_today_test.js` pattern (load `require('./src')`, eval in a VM with stubs).
- **Smoke script** `tools/v2_<lane>_smoke.py`: copy the structure of `tools/redesign_smoke.py`. Open the mock page at 390×844 and 1280×800 in light and dark, perform each user action in your lane, assert the expected DOM text or stored value, and save screenshots under `v2-shots/<lane>/` (never committed; it's in `.gitignore`, which ORC adds).
- **Evidence commands:**
```bash
python3 web/build.py && for f in web/test/*_test.js; do TZ=Asia/Kolkata node "$f" || exit 1; done
python3 tools/shots.py /tmp/s && python3 tools/shots.py /tmp/sd --dark && python3 tools/shots.py /tmp/sw --width 1280
python3 tools/shots.py /tmp/x --js "openSheet({type:'capture'})"     # one --js per run: an open sheet blocks later clicks
python3 tools/v2_<lane>_smoke.py
```

## D1. F1 Foundations: steps
1. **Stubs:** create every file named in Part C (each lane later fills its own stub; `cards.js` and `labs.js` are ORC's) (js + css) with a one-line header comment and register them in `files.json` in this order, after `ui/settings-pages`:
   - **JS:** `logic/sched.js`, `logic/spacing.js`, `logic/breaks.js`, `logic/parse.js`, `logic/advice.js`, `ui/ribbon.js`, `ui/cards.js`, `ui/rituals.js`, `ui/subjects.js`, `ui/distraction.js`, `ui/capture.js`, `ui/coach.js`, `ui/labs.js`.
   - **CSS:** `ui/ribbon.css`, `ui/rituals.css`, `ui/subjects.css`, `ui/distraction.css`, `ui/capture.css`, `ui/coach.css`.
   - Put `logic/*.js` **before** `core/state.js` in the `js` array.
2. **Collections:** in `web/core/sync.js` `subscribe()`, add live subscriptions:
   - `topics` and `coach`: all docs (`db.collection(name).onSnapshot`).
   - `rituals` and `usage`: `where('date','>=',from)`.
   - Store them in `S.base.topics/coach/rituals/usage` (maps id → data), add them to `S.loaded`, and copy them into `V` in `computeView()` (same pattern as `planning`).
   - Also add them to `teardownDb` resets. Export nothing new; lanes read `V.topics` etc.
3. **Cards:** `web/ui/cards.js`:
```js
const CARDS = {};                                 // id -> { rank(ctx) -> 0..100, render(ctx) -> html, label }
function cardCtx() { return { now: Date.now(), k: todayKey() }; }
function topCards(max) {                          // used by L1
  const ctx = cardCtx(), snoozed = store.get('cardSnooze:' + ctx.k) || [];
  return Object.keys(CARDS).filter(id => !snoozed.includes(id))
    .map(id => ({ id, r: +CARDS[id].rank(ctx) || 0 })).filter(x => x.r > 0)
    .sort((a, b) => b.r - a.r || (a.id < b.id ? -1 : 1)).slice(0, max || 3);
}
// ACT 'card-snooze' (data-id) adds the id to the snooze list for today, then render().
```
   - **Card frame markup:** `<section class="k-card f1-card" data-card="<id>">` + `kIconBtn('close','Hide for today','data-act="card-snooze" data-id="<id>"')` + body. CSS in `kit.css`.
4. **Labs:** `web/ui/labs.js`:
   - `const LABS = {}` (name → `{label, def}`).
   - `function lab(name) { const v = CFG.labs && CFG.labs[name]; return v == null ? !!(LABS[name] && LABS[name].def) : !!v; }`
   - `PAGES['settings.labs']` lists `kSwitch` rows; toggling writes `saveSetting({ labs: { [name]: bool } })`.
   - Add a Settings root row `Labs` (icon `note`) in the 3rd group, through ORC's edit of `ui/settings.js`.
5. **Flow sheet:** in `kit.js`, `kFlow(sh, steps)`.
   - `steps` = array of `{ title, body: () => html, next: 'Next'|'Done', canNext: () => bool }`.
   - The current step lives in `sh.step` (0-based). It renders `kSheetHead(title)`, step dots (`.k-dots` with `aria-label="Step 2 of 3"`), the body, and `kSheetFoot(kBtn(next, 'data-act="k-flow-next"', {kind:'primary'}))`.
   - `ACT['k-flow-next']` increments `sh.step`, or calls `sh.done()` on the last step. Back (`goBack`) on step > 0 goes back one step instead of closing.
6. **Nav v2:**
   - In `kNav`, tabs become `[['today','Today'],['plan','Plan'],['subjects','Subjects'],['insights','Insights']]`, with icons `today`, `plan`, `subjects` (Lucide `book-open`), `stats`.
   - Map `UI.view` `stats` → `insights` (alias), and `VIEWS.insights = VIEWS.stats` until L7 replaces it.
   - Settings is no longer a tab: `UI.view='settings'` is still valid, but it's reached through the Today header gear (`data-act="open-settings"` → `UI.view='settings'; UI.pages=[]; render()`), and Back from settings root returns to Today.
   - Add the icons `subjects`, `ring`, `ribbon` and `quickadd` (`plus`) to `icons.js` with `tools/icons.py`.
7. **Docs:** create `docs/v2/BOARD.md` (the table at the end of Part C), `docs/v2/DECISIONS.md` (header only), `docs/v2/contracts.md` (copy D0.4, D0.5, the `CARDS`/`LABS`/`kFlow`/collection APIs above, and Part C's contract names).
8. **CI:** in `ci.yml`, run every `tools/v2_*_smoke.py` if any exist (`for f in tools/v2_*_smoke.py; do [ -e "$f" ] && python3 "$f"; done`), after installing Playwright the way `redesign-qa.yml` does. Add `v2-shots/` to `.gitignore`.
9. **Done when:** the build has no visual change except the nav (Subjects tab shows `kEmpty('Coming soon')` until L4), the gear on Today works, and all tests and shots pass.

## D2. Card ranks (exact; all lanes use these numbers)
| Card id (owner) | Shows when | Rank |
|---|---|---|
| `morning` (L2) | now ≥ dayStart and < dayStart + 4 h, and `rituals/<k>.morning` missing, and the plan has 0 open blocks or the user hasn't opened it | 95 |
| `shutdown` (L2) | now ≥ planEnd − 30 min, and `rituals/<k>.shutdown` missing, and ≥ 1 entry today | 95 |
| `freshstart` (L7) | Monday (or `weekStart` day) or the 1st of the month; until tapped or snoozed | 85 |
| `coach` (L10) | ≥ 1 `coach/*` with `status:'new'` and `from:'claude'` | 80 |
| `deadline` (L1) | nearest undone deadline within 14 d | 90 if ≤ 2 d · 70 if ≤ 7 d · 40 if ≤ 14 d |
| `reviews` (L4) | ≥ 1 topic due on or before today | 60 + min(20, 5 × dueCount) |
| `distraction` (L6) | Sunday, or week drift minutes > 2 × last week's (and > 30) | 50 |
| `insight` (L1) | `insights()` returns ≥ 1 sentence | 20 |

## D3. L1 Today v2: steps
1. **Header** (48 px; `t1-head`):
   - Left: the date (`Tue 27 Oct`).
   - Right: `ring` button (SVG 28×28: track `--line`, arc `--accent`; arc fraction = `min(1, studiedTodayMs / (CFG.dailyGoal × MIN))`; `aria-label="2h 54m of 2h goal"`; click → `UI.view='insights'`), `kIconBtn('quickadd','Quick add','data-act="open-capture"')` (`openSheet({type:'capture'})` once L9 exists; until then a toast `Coming soon`), `kIconBtn('settings','Settings','data-act="open-settings"')`.
   - The studied total moves under the ring as 13 px text-2 (`2h 54m`), and it still opens the Log page.
2. **Ribbon:** `web/ui/ribbon.js` exports `ribbon(k, opts) → html`.
   - Width 100 %, height 8 px, radius 4. x = (t − dayStartMs(k)) / DAY.
   - Segments: entries (fill activity colour), planned open blocks' `pieces` (1 px outline in the activity colour, transparent), busy (`--line` hatch). Now marker: 2 px × 14 px `--text` tick centred vertically.
   - Under it, 3 labels (12 px text-2): the day start, noon and the day end (`4a 12p 4a`). Click → `UI.view='plan'` on `todayKey()`.
   - Placement: under the hero card.
3. **Idle hero:**
   - If `planModelFor(todayKey())` has an open block with a piece starting ≥ now − 15 min: line 1 `● <activity> · <title>`, line 2 `<start time> · <minutes>`, primary `Start` (`startActivity(block.activity, {block: block.id})`).
   - Else, if there are no blocks: primary `Plan my day` (opens `SHEETS.morning` if L2 is registered, else `UI.view='plan'`).
   - The "Resume <last>" chip stays if the last study ended < 3 h ago.
   - The study grid moves below the cards (still shown when idle).
4. **Cards host:** `topCards(3).map(c => CARDS[c.id].render(cardCtx()))` between the ribbon and the chips.
5. **Your cards:** register `CARDS.deadline` and `CARDS.insight` per D2.
   - Deadline body: `flag` icon, title, `in 2d` (danger if ≤ 2 d), and a 3 px bar = hours studied for that subject since the deadline was created ÷ the estimate. Use 10 h if the deadline has no estimate. If the deadline has no subject, show no bar.
   - Insight body: `insights` icon + the first sentence.
6. **"Next" list:** remove it. The hero shows the next block, and the ribbon shows the rest.
7. **Tests** (`today_v2_test.js`):
   - ring fraction 0, 0.5, 1 (capped);
   - ribbon segment x positions for a 9:00–10:00 entry with dayStart 04:00 → left 20.83 %;
   - hero picks the earliest future open block;
   - `topCards` respects snooze and the max of 3.
8. **Hooks for other lanes** (put these in `today.js`):
   - The Noticed button calls `(typeof l6OnNoticed === 'function' && lab('urgesurf')) ? l6OnNoticed() : noticeNow()`.
   - The `Focus?` rating prompt after a stop is hidden when `lab('recall') && SHEETS.sessionEnd` (L5 shows its own sheet).
   - The hero's second line shows `rituals/<today>.morning.intent` when idle and present.
9. **Smoke:** tap ring → Insights; tap ribbon → Plan; snooze a card → it disappears until the next day (fake the date by stubbing `todayKey`).

## D4. L2 Rituals: steps
1. Register `CARDS.morning` and `CARDS.shutdown` (D2). The card body is one line plus a primary button `Plan my day` / `Shut down`.
2. **`SHEETS.morning`** uses `kFlow` with 3 steps.
   - **Step 1 "Pick":** a checkbox list (rows) of candidates:
     - (a) carry-over: open blocks from yesterday's plan with `remaining > 0`;
     - (b) reviews due (`l4DueTopics(k)` if defined) as 30-minute items;
     - (c) backlog sorted by `prio`, then `due`;
     - (d) `backwardPlan` sessions for today (L3) if defined.
     - Pre-tick (a), (b), (d), and backlog items with `prio === 1` or due ≤ 2 days.
     - Sum the ticked minutes and show `3h 40m picked · 4h free` (free = `dayCapacity`). Next is enabled when ≥ 1 item is ticked.
   - **Step 2 "Plan":** call `sched.autoPlan(...)` (L3) with the ticked items and show the result as a `ribbon()` preview plus a list `time · title`. If L3 isn't merged, place items sequentially from max(now, planStart) with `gap`. Buttons: primary `Accept` (writes the blocks with `from:'auto'` through one `W()` + `commit('Day planned.', w)`).
   - **Step 3 "Intention":** `kText` "One thing that matters today" + an optional collapsible "If… then…" with two `kText`s. Done writes `rituals/<k>`: `{v:1, date:k, morning:{at: isoLocal(now), picks:[ids], intent, ifThen}}`.
   - The intent appears as the hero's second line until a timer starts.
3. **`SHEETS.shutdown`** uses `kFlow` with 3 steps.
   - **Step 1 "Today":** two numbers (`Studied 4h 36m`, `Plan 63 %`) and the list of done blocks with a `done` icon.
   - **Step 2 "Leftovers":** each open block has a 3-way `kSeg` (`Tomorrow` · `Backlog` · `Drop`), default `Tomorrow`.
     - Tomorrow = `carryTo` the next day.
     - Backlog = add a `planning/backlog` item with the remaining minutes.
     - Drop = set the block's `status:'skipped'`.
   - **Step 3 "Tomorrow":** pick the first block for tomorrow (from the carried items plus backlog; one select). Done writes `rituals/<k>.shutdown {at, done: studiedMin, carry:[ids], first: id}`.
     - Then, if the timer is running, offer the toast `Stop timer?` with action `Stop`.
4. Replace the Plan menu's "Wrap up" item: `ACT['plan-wrap']` opens `SHEETS.shutdown` (ORC changes the menu item in `plan-sheets.js` on L2's request).
5. **Tests:**
   - pre-tick rules;
   - minutes sum;
   - shutdown writes for each of the 3 choices (check the `W()` writes);
   - no card after the ritual doc exists.

## D5. L3 Scheduler: algorithms (pure, `web/logic/sched.js`)
```text
estimateFactor(history):            // history = [{planned:min, actual:min}] for one subject, newest first
  use the first 30 items where planned >= 10 and actual > 0
  if count < 5: return 1
  r = median(actual / planned); return clamp(round(r, 1 decimal), 0.8, 2.0)

energyWindows(hourStats):           // hourStats[h] = {min: studied minutes, focus: avg rating 1..3 or null}, h = 0..23
  score[h] = (focus ?? 2) * sqrt(min); rank hours by score desc; ignore hours with min < 30 total
  return list of hours (top first)

autoPlan({k, items, free, now, gapMin, windows, factor}):
  items: [{id, activity, title, minutes, prio(1..3), hard:boolean}]
  free: [[s,e], ...] free intervals today (from day capacity minus busy and fixed blocks), sorted
  1. minutes' = ceil5(minutes * factor(activity))
  2. order items: prio asc, hard first, longer first; then interleave so the same activity is never twice in a row if avoidable
  3. buffer: total free * 0.10 is reserved; stop placing when placed > total free * 0.90
  4. for each item: prefer the earliest free slot that starts in a top-3 energy hour if hard or prio 1; else the earliest slot
     place max(25, min(minutes', slot length)); a remainder ≥ 25 min continues in the next slot; < 25 is dropped into `unplaced`
     after each placement, insert gapMin before the next start
  return {blocks:[{itemId, activity, title, at:'HH:MM', minutes}], unplaced:[itemId]}

backwardPlan({today, deadline, hoursNeeded, hoursDone, maxPerDay=3}):
  days = dates from today to deadline - 1 (exclude the deadline day); if none: return []
  remaining = max(0, hoursNeeded - hoursDone); per = remaining / days.length
  weights: linear 1.0 → 1.4 towards the deadline, last day 0.6 (lighter, review only); normalise to remaining
  return [{date, minutes: round5(min(maxPerDay*60, w*60))}] (drop days < 25 min)
```
- **UI:** `Plan › ⋮ › Auto-plan` runs `autoPlan` on today's unplaced backlog items and opens a confirm sheet (the same preview as the L2 step 2). The block sheet shows `Usually takes ×1.3` (13 px text-2) when the factor is ≠ 1.
- **Tests** (≥ 15): median, the clamps, history < 5 → 1; no overlap with busy; gap respected; buffer respected; hard items land in top windows; interleaving; remainder split; `backwardPlan` sums ≈ remaining (±5 min), never on the deadline day, and caps per day.

## D6. L4 Subjects and spacing: steps
1. **`VIEWS.subjects`:** a header `Subjects` with `quickadd` → capture (Task tab).
   - Rows for each non-archived study activity: dot · name · right `4h 15m / 9h`, with a sub-line combining `next: Physics test in 3d` and `3 due`.
   - Under the row, a thin 3 px goal bar. Tap → `pushPage('subject', {id})`.
2. **`PAGES.subject`:** the title is the activity name; the action `edit` → `openPage('settings','settings.activity',{id})`. Sections (each `kGroup`, max 5 rows, then `All (n) ›`):
   - Deadlines: from `deadlineList()` filtered by `activity`.
   - Topics: due ones first, with the due label `today` / `in 3d` / `overdue 2d` in danger. Tap → topic sheet.
   - Backlog: filtered by `activity`.
   - Recent: the last 5 entries of this activity.
   - Empty sections are hidden, except Topics, which shows `kEmpty('No topics yet', kBtn('Add topic', …))`.
3. **Topic sheet `SHEETS.topic`:**
   - Title field and a subject picker.
   - A recall `kSeg` with icons `rate1`/`rate2`/`rate3` (poor/ok/good) and the label `How well did you recall it?`.
   - Info line `Next review in 6d`.
   - Buttons: primary `Save`; delete in the header.
4. **Spacing** (`web/logic/spacing.js`):
```text
nextReview(topic, rating, todayKey, examKey|null):
  base = topic.interval || 1
  mult = {3: 2.5, 2: 1.8, 1: 0.5}[rating]
  interval = max(1, round(base * mult)); if rating == 1: interval = 1
  due = addDays(todayKey, interval)
  if examKey and due >= examKey: due = max(addDays(todayKey,1), addDays(examKey, -max(1, round(daysBetween(todayKey, examKey) * 0.15))))
  return {interval, due, reps: (topic.reps||0)+1, last: todayKey}
dueTopics(topics, dayKey) = topics where !archived and due <= dayKey, sorted by due asc
```
   - The exam for a topic = the nearest undone deadline of kind `exam` with the same `activity`.
5. A new topic gets `{v:1, subject, title, order, due: today+1, interval: 1, ease: 2.5, reps: 0, last: null, archived: false}`, written with `w.set('topics/'+uid('tp'), doc)`.
6. **`CARDS.reviews`** (D2): body `3 reviews due · Kinematics, Optics`; tap → `SHEETS.reviews` with a list where each topic has the 3 rating icons. Rating a topic writes `nextReview` immediately (with Undo).
7. **Contract:** define the global `l4DueTopics(k)` (returns `[{id, subject, title, due}]`) for L2 and L3.
8. **Move Tasks:** the `PAGES.tasks` content stays reachable from Plan's tasks icon. In addition, the subject page lists that subject's tasks and deadlines. Don't delete `ui/tasks.js`.
9. **Tests:** `nextReview` for each rating; the exam pull-forward; `dueTopics` order; the subject list sums match `aggregate`.

## D7. L5 Focus v2: steps
1. **Start options sheet:** add a collapsible `Intention` with `kText` (`What will you finish?`, max 80) and two `kText`s (`If…`, `then…`).
   - Pass them through `startActivity(id, {at, pomoPreset})`, then write `w.update('state/current', {intent, ifThen})`. Stop writes them into the entry (`entryFromCur` copies `note`; add `intent`/`ifThen` to the entry through `w.day(k, {[id]: {intent, ifThen}})` right after stop).
   - Ask ORC to add the 2 fields to `entryFromCur` in `core` if needed; until then, write them after stop yourself.
2. **Timer card:** if `CUR.intent`, show it as the second line (it replaces the block title only when the block title is empty).
3. **Flowtime** (`lab('flowtime')`, default on), in `web/logic/breaks.js`: `suggestBreak(focusMin) = clamp(round(focusMin / 5), 5, 20)`.
   - When there's no pomodoro and elapsed ≥ 25 min, show a quiet chip under the buttons: `Break 9m` (`coffee` icon). Tap = `takeBreak()`, and store `UI.breakTarget = minutes`.
   - During that break, the timer shows a countdown to the target.
4. **Break sheet suggestions:** when a break starts, show for 10 s 3 chips (`Walk`, `Water`, `Stretch`, with icons `footprints`, `glass-water`, `stretch-horizontal` added through ORC). Tapping one sets the break note.
5. **End-of-session sheet** (`lab('recall')`, default on): after `stopTimer` of a study entry ≥ 10 min, open `SHEETS.sessionEnd`:
   - focus rating (3 icons, required for Save);
   - topic chips of that subject (multi-select; from `V.topics`);
   - `kArea` "What did you learn?" (optional, 280).
   - Save writes `w.day(k, {[id]: {focus, topics, recall}})`. If topics are tagged, also set their `last` to today (don't change `due`; that needs a rating, in L4).
   - Skip = close. This replaces the inline `Focus?` card prompt when the lab is on.
6. **Energy** (`lab('energy')`, default off): 3 icons (`battery-low`/`battery-medium`/`battery-full`) in the start options, stored as the entry `energy`.
7. **Tests:** `suggestBreak` bounds; the session-end write shape; intent shown on the card.

## D8. L6 Distraction v2: steps
1. **Android** (`live/UsageReader.kt`, `live/UsagePlugin` methods on `CarrelLivePlugin` through ORC review):
   - `hasUsageAccess(): boolean` (AppOpsManager `OPSTR_GET_USAGE_STATS`).
   - `openUsageAccess()` (`Settings.ACTION_USAGE_ACCESS_SETTINGS`).
   - `sessionUsage(startMs, endMs, packages:[String]) → [{label, pkg, min, opens}]`, using `UsageStatsManager.queryEvents` and summing time between `ACTIVITY_RESUMED` and `ACTIVITY_PAUSED` for each package in the list, clipped to the window. `label` = `PackageManager.getApplicationLabel`.
   - Default package list: `com.instagram.android, com.google.android.youtube, com.whatsapp, com.twitter.android, com.zhiliaoapp.musically, com.reddit.frontpage, com.snapchat.android, com.facebook.katana, in.startv.hotstar, com.netflix.mediaclient`.
2. **Web:**
   - L6 defines `l6DriftRow() → html` (a `kRow` with a switch `Detect drift`; on → if no access, call `openUsageAccess()`, then re-check on resume). ORC adds one call to it inside the Notifications page in `native.js` (L8's file) on L6's request.
   - After a study entry stops (≥ 10 min) and access is granted: call `sessionUsage(s, e, list)`. If the total ≥ 2 min, write `usage/<k>` `{v:1, date:k, sessions:{[entryId]:{apps:{[label]:{min, opens}}}}}` and show the toast `Instagram 6m during Physics` with action `Log`. `Log` = the existing drift writer (`noticeDrift`-equivalent writing a drift with `driftMin = total`).
   - Feature-detect the plugin method (old APKs have none): no method → hide the row.
3. **Urge-surf** (`lab('urgesurf')`, default on): Noticed opens `SHEETS.urge`, a 60 s ring (SVG, countdown, `aria-live` off) with the text `Wait it out`. When the timer ends, or on tap: buttons `Back to work` (close) / `Log drift` (opens the existing drift chips). The urge itself is still recorded on open (existing `noticeNow()`).
4. **`CARDS.distraction`** (D2): `Drift 1h 10m this week · ↑ 2×` plus a 7-bar sparkline (SVG 56×16).
5. **Tests:** `web/test/distraction_test.js` with a stubbed plugin, covering the toast threshold (≥ 2 min), the `usage/<k>` write shape, and the card rule. The JVM test `UsageReaderTest.kt` covers clipping events to the session window.

## D9. L7 Insights v2: steps
1. **`VIEWS.insights`:**
   - Header `‹ This week ›` + `Week|Month` (keep S1's).
   - Hero: total + a ring vs the weekly goal (sum of activity goals in hours, or `dailyGoal × 7` if there are none).
   - Then **Suggestions** (≤ 3 rows from `advice.js`), then rows with previews: `Subjects ›` (n), `Focus ›` (best hour), `Estimates ›` (accuracy %), `Patterns ›`, `Streak ›` (days).
2. **`advice.js`:** `advise(ctx) → [{id, text, action:{label, act, args}}]`. `ctx` is computed in the view from `aggregate`, the goals, `estimateFactor`, `energyWindows`, `l4DueTopics` and the drift totals. Rules are checked in this order; keep the first 3 that match:

| id | Condition | Text | Action |
|---|---|---|---|
| `behind` | a subject < 50 % of its weekly goal and ≥ 3 days left | `Physics is at 29% of goal. Plan 2 sessions?` | `Plan it` → `SHEETS.morning` (or the auto-plan preview with that subject) |
| `peak` | top energy hour ≠ the hour with most study minutes | `You focus best at 9 am. Start there tomorrow?` | `Set` → writes `planStart` = that hour |
| `estimate` | any subject factor ≥ 1.3 | `Maths takes 1.4× your estimate. Plans now adjust.` | `OK` (dismiss) |
| `reviews` | ≥ 5 topics overdue | `7 reviews overdue. Add a 30m review block?` | `Add` → a block for today |
| `drift` | drift this week > last × 1.5 and > 30 min | `Drift is up to 1h 10m. Try urge-surf?` | `Turn on` → lab `urgesurf` |
| `streak` | today < minimum day and now > planEnd − 2 h | `25 min keeps your 6-day streak.` | `Start` → resume the last study |

   - Dismissed suggestion ids are stored per week in `store` (`advice:<weekKey>`).
3. **Pages:**
   - `stats.focus`: average rating by hour (bars) and by subject (rows).
   - `stats.estimates`: per-subject factor rows plus overall accuracy = `1 − mean(|actual − planned| / planned)`.
   - `stats.streak`: the flexible streak.
4. **Streak rules:**
   - Minimum day = `CFG.minDay` (minutes, default 25). ORC adds a `Minimum day` stepper (5–120, step 5) to `settings.day` on L7's request.
   - A day counts if study ≥ minDay. One freeze is allowed per ISO week: the first missed day in a week is frozen if the user had ≥ 1 counted day that week before it.
   - The streak = consecutive counted-or-frozen days ending yesterday (plus today if it already counts).
5. **`CARDS.freshstart`** (D2): `New week. Set one goal?` → opens a sheet with one `kStepper` (weekly hours for the top subject) → `saveAct`.
6. **Tests:** each advice rule (true and false cases); streak with a freeze; accuracy maths.

## D10. L8 Android surfaces: steps
1. **Widget** (`live/widget/CarrelWidget.kt`, `res/layout/widget_*.xml`, `res/xml/widget_info.xml`): sizes 2×1 and 4×1.
   - Content: a dot, the activity name or `Not tracking`, a Chronometer (counting up from the start), today's total, and an icon button (stop if running, else start last).
   - Updates on every engine state change (call `AppWidgetManager.updateAppWidget` from the place the notification is posted). Colours come from the DayNight resources (`#FAFAF9` / `#0C0C0D`, accent `#0F766E` / `#2DD4BF`).
2. **Quick Settings tile** (`live/TimerTile.kt`, `TileService`): label `Carrel`, subtitle = the activity or `Start last`; tap = stop or start last. Use the existing `ActionReceiver` intents.
3. **Shortcuts:** dynamic shortcuts for the top 3 study activities by minutes in the last 14 days (`app.carrel.study://start?act=<id>`), plus a static `Quick add` (`app.carrel.study://capture`). The web side handles the URLs in `native.js` `appUrlOpen` (start → `startActivity`; capture → `openSheet({type:'capture', text})`).
4. **Share target:** an `intent-filter` for `ACTION_SEND` `text/plain` on `MainActivity` → forward as `app.carrel.study://capture?text=<urlencoded>`.
5. **Live Update:** when `Build.VERSION.SDK_INT >= 36`, set `setRequestPromotedOngoing(true)` and a short critical text (`25:00`); otherwise unchanged.
6. **Tests:** JVM unit tests for the URL building and parsing; Android CI build; a manual check list in the status file (widget, tile, shortcut, share).

## D11. L9 Quick capture: parser spec (`web/logic/parse.js`)
`parse(text, {now, acts:[{id,name}], weekStart}) → {type, title, activity, minutes, date, time, prio, kind}`

1. **Tokens** (case-insensitive), each removed from the title once matched:
   - **Priority:** `!` or `!!` → `prio: 1`.
   - **Duration:** `(\d+(\.\d+)?)\s*(h|hr|hrs|hours?)` → minutes = n × 60; `(\d+)\s*(m|min|mins|minutes?)` → minutes; `1h30`, `1h 30m` → 90.
   - **Time:** `(\d{1,2})(:(\d{2}))?\s*(am|pm)` or `(\d{1,2}):(\d{2})` (24 h).
   - **Date:**
     - `today` / `tod`, `tomorrow` / `tmr` / `tmrw`;
     - weekday names and 3-letter forms → the next occurrence (today counts only if the time is still ahead);
     - `in (\d+) (day|days|week|weeks)`;
     - `(\d{1,2}) (jan…dec)` and `(jan…dec) (\d{1,2})` → this year, or next year if the date has passed;
     - `(\d{1,2})/(\d{1,2})` = day/month.
     - `by <date>` sets `due` for tasks.
   - **Kind:** the words `exam`, `test`, `quiz`, `midterm`, `final` → deadline kind `exam`; `due`, `submit`, `assignment` → `due`.
   - **Subject:** a leading word or words that fuzzily match an activity name (case-insensitive prefix ≥ 3 characters, or a known alias such as `maths` ↔ `mathematics` / `math`, `phy` ↔ `physics`, `chem` ↔ `chemistry`). Tie-break: longest match.
2. **Type:**
   - an explicit tab wins;
   - otherwise kind present → `deadline`;
   - otherwise a time and date present with a duration → `block`;
   - otherwise → `task`.
3. **Title:** the remaining text, trimmed and with whitespace collapsed; capitalise the first letter. Empty → the subject name.
4. **Sheet:**
   - One `kText`, autofocus.
   - The chip row under it previews the parse: subject dot, `2h`, `Fri 30`, `!`, the type. Each chip opens its own small editor (fallback: tapping a chip clears that token).
   - A `kSeg` with `Task | Deadline | Block | Ask Claude`. Enter = Save.
   - **Saving:**
     - task → `planning/backlog`;
     - deadline → `planning/deadlines`;
     - block → `plans/<date>` with `at`;
     - ask → `coach/<id>` `{v:1, at, kind:'ask', from:'me', title:text, body:'', status:'new'}`.
   - After saving: toast `Added to backlog · Undo`.
5. **Tests:** ≥ 30 cases, including:
   - `physics ch7 2h by fri !`
   - `maths test 12 nov 9am`
   - `chem revise in 3 days 45m`
   - `read paper tmr 14:30 1h`
   - `!! essay due 3/11`
   - `bio` (an unknown subject stays in the title)
   - an empty string
   - a past date rolling to next year
   - `today 25m`
   - `1h30 optics`

## D12. L10 Claude bridge: exact artefacts
1. **`docs/v2/guide.json`** (loaded into `meta/guide` by ORC):
   - `{v:1, read_first:true, collections:{…shapes from D0.2 and B6…}, write_rules:[…], examples:{…}}`.
   - The write rules say:
     - "Use `select public.doc_merge('<path>', '<json>'::jsonb, null, 'claude')` or `doc_set`."
     - "Only write `coach/*`, `plans/*` (blocks with `from:'claude'`), `topics/*`."
     - "Never modify `days/*`, `config/*`, `state/*`."
     - "Dates are local `YYYY-MM-DD`; times `HH:MM`."
2. **`005_v2_views.sql`** (security_invoker views, `revoke all … from anon, public; grant select … to authenticated`):
   - `coach_inbox(id, at, kind, from, title, status)`.
   - `topics_due(id, subject, title, due, interval, reps)` where `due <= current_date + 7`.
   - `week_summary(activity, minutes, goal_minutes)` for the current ISO week, from `days` entries (reuse the `jsonb_each` pattern in `001_core.sql` line ~96).
   - Apply with the Supabase MCP `apply_migration` (allowed per B6), then run the advisors.
3. **Proposal format** that Claude writes and the app accepts: `coach/<id>.proposal = {date:'YYYY-MM-DD', blocks:[{activity, title, minutes, at|null}]}`.
   - Validation: the date is within −1…+14 days; ≤ 12 blocks; `minutes` 5–240; the activity exists; strings ≤ 120.
   - Invalid → hide the Accept button.
4. **Prompts** (exact text for Settings › Claude prompts):
   - `Use the Supabase connector for Carrel. Read meta/guide in public.docs, then plan my day: read week_summary and topics_due and write one coach plan proposal for today.`
   - The same opener + `plan my week …`, `write my weekly review as a coach review …`, `make an exam plan for <subject> …`.

## D13. ORC runbook (the orchestrator follows this loop)
1. **Start:** read this file, create the F1 branch, do D1 yourself (F1 is ORC's lane), merge it.
2. **Launch** the Phase 1 lanes (L1, L3, L4, L5, L8, L9) and QA in parallel. Give each agent only: "You are lane Lx. Read `docs/PLAN-v2.md` Parts B, C (your lane) and D (D0 + your section). Follow §B4 and §B7."
3. **Every PR:**
   - check `git diff --stat` against ownership;
   - run the evidence commands (D0.6);
   - look at the screenshots (do they match Part A's rules?);
   - squash-merge with `gh api -X PUT repos/<owner>/<repo>/pulls/<n>/merge -f merge_method=squash`. Mark draft PRs ready first (`gh api -X POST repos/<owner>/<repo>/pulls/<n>/ccr/ready_for_review`).
   - If GitHub blocks approval (same account), merging is enough.
4. **Requests** in status files that touch frozen files: do them in a `v2/orc-*` PR within the same day.
5. **Phase end:** QA runs the full matrix on `main`; fix or de-scope; flip the final Labs defaults (§B5 Phase 3); send the digest (template below); start the next phase.
6. **User questions:** use the template below, at most once a day.
7. **Native:** after merging any `android/**` change, confirm the Android CI built the signed APK, then raise `NATIVE_API` in `config.js` only if web code *requires* the new native methods (prefer feature detection; normally no raise).

**Digest template** (one message):
```
Carrel v2 · Phase N done
Shipped: • … (≤ 8 bullets, user-facing words)
Install: <APK link or "no install needed, restart the app">
Decide (optional, defaults apply in 24 h): 1) … [default: …]
Next: Phase N+1: …
```

## D14. QA runbook
- After every merge to `main`: build, all tests, `shots.py` × 4 configurations, `redesign_smoke.py`, and every `v2_*_smoke.py`.
- **2-tap audit** (`tools/v2_reach_smoke.py`): from Today, for each `PAGES` id and `CARDS` id, find a path of ≤ 2 clicks (BFS over clickable `[data-act]` elements, max depth 2, resetting to Today between tries). Fail with the list of unreachable ids, except the allow-list (`kit`, `settings.keys`).
- **Visual rules check:** grep the built `www/index.html` CSS for hex colours outside `kit.css`, and for `font-family` / `text-transform: uppercase` outside the kit; fail on new ones.
- File regressions as rows in `BOARD.md` (`QA-<n>`), and fix trivial ones yourself in `v2/qa-<n>` PRs (≤ 30 changed lines, inside a lane's file only with a note to that lane).
