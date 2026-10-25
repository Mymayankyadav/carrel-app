# Carrel ⇄ Carrel Live: implementation plan (Carrel side)

Written by Opus for a Sonnet implementer in this same session. Follow it in order. Do not change the data contract.
The Android app is done; its repo is unpacked at `/home/claude/carrel-live-src/carrel-live`. Treat it as read-only reference.
Live artifact: https://claude.ai/artifact/GPbHEVpi3YYoRM7UcpZxT6 (version 3). Source: `/home/claude/carrel/*.js`, `style.css`, `build.py`.

## 0. Ground rules for the implementer
- The user is short on usage. Read only the line ranges you need, using `grep -n` first. Never re-read whole files.
- Build: `cd /home/claude/carrel && python3 build.py`. Logic tests: `TZ=Asia/Kolkata node test/logic_test.js`.
- Visual check: copy one of the scratchpad `look*.py` scripts and render `test/carrel-test.html` (mock) with headless Chromium. Take one look per phase.
- Stage `carrel.html` into the scratchpad and publish to the **same artifact URL** with the full capabilities object (section 6).
- Ask the user before:
  - the first real Google Calendar write
  - publishing
- Phases are independently shippable: A → B → C. Publish after B at the latest. C can be a later session.

## 1. Data contract (verified against the app's `core/TokenCodec.kt`, `Models.kt`, `Commands.kt`)
- **Token:** the description contains `carrel1:` + base64url(UTF-8 JSON), with no padding. Regex `carrel1:([A-Za-z0-9_-]+)`.
- **Numbers:** all must be **integers** (epoch ms). The app uses `longValueExact`, so `1.0` or floats break parsing. Use `Math.round`.
- **Calendar:** the app reads **every non-deleted event** in the chosen calendar, with no time window, and picks the state with the highest `rev`. Event times don't matter to the app.

### State (Carrel writes; one event, updated in place)
```json
{"v":1,"kind":"state","rev":<int>,"status":"idle"|"running"|"break",
 "activity":{"id","name","color":"#RRGGBB"}|null,"startedAt":<int>|null,"intention":<string>|null,
 "pomo":{"focusEndsAt":<int>|null,"breakEndsAt":<int, optional>}|null,
 "breakStartedAt":<int>|null,"returnTo":{"name","color"}|null,
 "url":"https://claude.ai/artifact/GPbHEVpi3YYoRM7UcpZxT6"}
```
Rules the app enforces. Violating one makes it ignore the state:
- `url` is **required** (a string).
- `running` requires `activity` and `startedAt`.
- If `running` has `pomo`, it must have `focusEndsAt`.
- `break` requires `breakStartedAt`.
- Colours must be `#RRGGBB`. Carrel's `PALETTE` and `DEF_ACTS` already are.

### Mark (the app writes; Carrel imports, then deletes)
```json
{"v":1,"kind":"mark","id":"<uuid>","type":"urge"|"drift"|"park"|"stop"|"break","at":<int>,
 "driftMin":1|5|15|null,"text":<string>|null,"activityId":<string>|null,"stateRev":<int>|null,
 "startedAt":<int>   // present only for stop/break
}
```
Titles: "Carrel · noticed" (urge, drift), "Carrel · parked", "Carrel · stop", "Carrel · break".
**Stale rule:** apply stop/break only if Carrel's current timer start (ms) === `startedAt`. Otherwise ignore the command, but still delete the event.

## 2. Mapping Carrel → state (pure function in `logic.js`)
Add `liveStateOf(cur, actOf, breakId, url)` and export it in `module.exports`.
- `cur` = the `state/current` doc. `actOf(id)` → `{id, name, color}`. Use `act()` in `app.js` (line ~315).
- **Not running** (`!cur || !cur.running`) → `{status:'idle'}`, with every other field null and `url` set.
- **`cur.activity === breakId`** (the activity with `role:'break'`, see `breakAct()`) → status `break`:
  - `breakStartedAt = parseT(cur.start)`
  - `returnTo` = `cur.ret?.activity` → `{name, color}`, else null
  - If `cur.pomo?.phase === 'break'` and `breakLen` is set: `pomo = {focusEndsAt:null, breakEndsAt: parseT(cur.pomo.phaseStart) + breakLen*60000}`. Otherwise `pomo = null`.
- **Otherwise** → status `running`:
  - `activity`, `startedAt = parseT(cur.start)`
  - `intention = (cur.note || block title || '').trim() || null`. For the block title, look up `cur.block` in `V.plans[todayKey()].blocks`; pass it in as an argument to keep the function pure.
  - If `cur.pomo?.phase === 'focus'`: `pomo = {focusEndsAt: parseT(cur.pomo.phaseStart) + cur.pomo.focus*60000}`. Otherwise null.
- **`rev`:** see section 3.1.
- **Tests** in `test/logic_test.js`: idle, running, running+pomo, break+pomo, break without `ret`, and that every number is an integer.

## 3. Phase A: push state to the "Carrel live" calendar

### 3.1 Revision stamp
In `W()` (app.js ~389), every `set`/`update` on path `state/current` also writes `rev: Date.now()`. It is part of the same write, so undo restores the old rev; that's fine, since undo then pushes again with a new rev. In practice: when pushing, use `rev = max(cur.rev || 0, LIVE.pushedRev + 1)` so it always increases.

### 3.2 Config doc `config/live` (owner-only via the existing root rule)
`{enabled:bool, calendarId:string|null, calendarName:string, eventId:string|null, pushedRev:int, pushedAt:iso, imported:{<markId>: <atMs>}}`
Subscribe in `subscribe()` (app.js ~253), the same as `config/settings`. Prune `imported` entries older than 30 days on each write.

### 3.3 New file `live.js`
Add it to `build.py` between `gcal.js` and `boot.js`.
- `LIVE` runtime object: `{status:'off'|'ok'|'pushing'|'error'|'denied', msg, lastPushAt, pendingTimer}`.
- `encodeToken(obj)`:
  ```js
  'carrel1:' + b64url(new TextEncoder().encode(JSON.stringify(obj)))
  ```
  where `b64url` = btoa over the bytes, with `+`→`-`, `/`→`_` and trailing `=` stripped.
  `decodeToken(desc)`: the regex, then the reverse, wrapped in try/catch, returning null on failure. Put both in `logic.js` so node can test them. Use `Buffer` fallbacks under node.
- `livePush(reason)`, triggered when:
  - `changed()` notices `CUR.rev > cfg.pushedRev`, and **this device made the write** (set a flag in `commit()` when the write list touches `state/current`), with a 1.5 s debounce. **Fallback:** any device pushes if `CUR.rev > pushedRev` and `Date.now() - CUR.rev > 20s`. This covers a device that went offline before pushing.
  - The user presses Test.
- Steps:
  1. Build `state = liveStateOf(...)` and `desc = encodeToken(state)`.
  2. Title: `▶ <name>`, `☕ Break` or `Idle`.
  3. Event times: `startTime = localNoOffset(startedAt || breakStartedAt || now)`, `endTime = start + 30 min`. Use format `YYYY-MM-DDTHH:mm:ss` with **no offset** (that's what the tool schema asks for). Write a helper.
  4. If `eventId` is set → `update_event {calendarId, eventId, summary, description, startTime, endTime}`.
  5. Otherwise, or if update rejects with a not-found style tool_error → `create_event {calendarId, summary, description, startTime, endTime, availability:'AVAILABILITY_FREE', useDefaultReminders:false, notificationLevel:'NONE', visibility:'private'}`. Then store the returned event id.
     - **Unknown:** the result shape isn't verified. Read `payload.id ?? payload.event?.id ?? payload.eventId`.
     - If none is found, call `list_events` on that calendar and pick the event whose description decodes to this `rev`.
  6. On success, write `config/live {eventId, pushedRev: rev, pushedAt}` with `undo:false` and no toast.
- **Errors:** reuse the `GC_DENIED` codes from `gcal.js`.
  - Authz error → `LIVE.status='denied'` with a message and a "Fix permissions" button (`gcPermissions`).
  - Retryable → backoff 5 s, 30 s, 2 min. Also retry on the `online` event and on `visibilitychange`.
  - Never block the timer UI: pushes are fire-and-forget.
- Serialize pushes with one in-flight promise. If a newer rev arrives mid-push, push again afterwards.

### 3.4 Settings UI
Add a "Phone live timer" panel next to the Google Calendar panel. `vGcalPanel` in gcal.js is the pattern; also link it from Setup.
- Toggle: enabled.
- Calendar picker: a button "Choose calendar" calls `list_calendars`, then lists the writable calendars. Pre-select the name "Carrel live". **Refuse the primary calendar** with an inline message.
  - The payload shape isn't verified; it probably has `calendars[] {id, summary, primary?, accessRole?}`. Log it once and adapt. Filter to owner/writer if `accessRole` is present.
- Status line: "Phone up to date · 10:42", "Waiting to send…", or the error with an action.
- Buttons: "Send now", and "Turn off". Turning off clears `enabled` and leaves the event alone.
- Copy: one line explaining that the Carrel Live phone app reads this calendar, and that Carrel only writes there.

### 3.5 Make sure the planner ignores it
`gcal.js` reads the primary calendar only (`gcInput` has no `calendarId`), so Carrel live events never become busy time. Add a guard anyway: in `normGc`, drop any event whose description contains `carrel1:`.

## 4. Phase B: import marks from the phone

### 4.1 Watch
In `live.js`, when `enabled && calendarId`, start `S.mcp.watchTool('Google Calendar','list_events', {calendarId, startTime: now-14d (date T00:00:00), endTime: now+1d, pageSize: 250}, handler, {refetchInterval: 60000, cache:{staleTime:30000}})`.
- Re-arm when the calendar changes. Unsubscribe when disabled.
- **First verify that `list_events` accepts `calendarId`.** Load its schema with ToolSearch `select:mcp__Google_Calendar__list_events`. Also check whether results include `description` and `id`. If description isn't returned, use `get_event` per candidate and add it to the manifest.
- Also refetch on `visibilitychange` → visible. The watch handles stale data.

### 4.2 Apply (pure planner in logic.js + side effects in live.js)
- `planMarks(marks, curStartMs, imported)` → returns ordered actions:
  - skip ids already in `imported`
  - sort by `at`
  - for stop/break, check `startedAt === curStartMs` **as it evolves**: after a stop, the current start is null; after a break, it's `at`
  - returns `[{mark, action:'urge'|'drift'|'park'|'stop'|'break'|'stale'}]`
  - Unit-test it, including: stop then a stale break; a duplicate id; a stop for an older timer.
- **Side effects, per action, in order:**
  - `stop` → `stopTimer({at: mark.at})`. It already accepts `o.at` and clamps it.
  - `break` → extend `takeBreak(o)` to accept `o.at` (it currently uses `Date.now()`, app.js ~509-521). Pass `at` through to `startActivity`, and set the pomo `phaseStart` to `isoLocal(at)`.
  - `urge` / `drift` / `park` → record a distraction (Phase C data model). If Phase C isn't built yet, still store the record (4.3) so no data is lost.
- After applying, add the id to `config/live.imported`, **then** `delete_event {calendarId, eventId}`. If the delete fails, keep the id, so it's never applied twice.
- One toast summarising the batch, e.g. "From your phone: stopped Chemistry at 10:40 · 2 distractions noted".
- **Multiple open devices:** guard with the `imported` map, and process only if this device holds a lease, `config/live.importLease = {by: deviceId, until: now+30s}`. deviceId is a random id in localStorage. Take the lease with an `if_version`-style check if the store supports it. Otherwise, accept that a rare double-apply is impossible anyway, because `imported` is written in the same commit as the action.

### 4.3 Distraction storage (shared with Phase C)
- Collection `distractions`, doc id = logical day key, shaped `{date:'YYYY-MM-DD', items:{<id>:{type, at:iso, driftMin, text, activity, entry, src:'phone'|'page'}}}`.
- Subscribe with the same `where('date','>=',windowFrom)` pattern as `days`/`plans` (app.js ~265).
- Use a `W()` helper `w.distraction(k, id, item)`, following `w.day`.
- **Drift handling:** the drift period is `[at - driftMin*60000, at]`, clamped to the entry or timer covering it.
  - **Running timer case:** log `[cs, at-d]` as the current activity, then `[at-d, at]` as the activity with `role:'drift'` (`phone` in `DEF_ACTS`). Then set `state/current.start = at` with a new id, keeping pomo.
  - **Finished entry case:** split it into three. Reuse the split helpers near `saveSplit`/`trimOthers` (app.js ~660-680).
  - If no drift activity exists, record the distraction only.

## 5. Phase C: distraction features on the page (from the earlier brainstorm)
1. **Noticed button** on the running timer card (`vTimer`, app.js ~929), plus the `X` key.
   - One tap records an urge with `src:'page'`.
   - A small chip row appears for 6 s: "Drifted 1 · 5 · 15 min". Choosing one converts it to drift.
2. **Re-entry card:** after any noticed or drift action, including phone imports while the page is visible, show "Back to: {note or block title or activity}" for 8 s. Use `aria-live`, with no sound.
3. **Intention:** relabel the existing `cur-note` field "This session I will…". It feeds `state.intention`.
4. **Parking lot:**
   - a "Park a thought" input in the timer card
   - a list shown on the Today view while on break, and in a Calendar side panel
   - one-tap "→ backlog" moves an item into `planning/backlog`
5. **Patterns cards** (`patternsModel` in logic.js + `vPatterns`). Each needs ≥ 3 sessions of data; otherwise show "Not enough data yet".
   - distractions per focused hour
   - catch rate = urge ÷ (urge + drift); make this the headline
   - time lost to drift
   - longest unbroken focus stretch
   - typical minute-into-session of the first distraction
   - Include the "counts rise at first as you notice more" note.
6. **Weekly review data:** extend `meta/guide` so chat-Claude knows about `distractions/*` and `config/live`.

## 6. Capabilities on publish (full set; restate everything)
```json
{"db":{"rules":[{"path":"","read":"owner","write":"owner"}]},"user":{},"downloads":true,
 "mcp":{"servers":[{"server":"Google Calendar","tools":["list_events","list_calendars","create_event","update_event","delete_event"]}]}}
```
Add `get_event` only if 4.1 shows that descriptions are missing. Keep contract 0.2.90: omit `contract`.

## 7. Mock + verification
- `test/mock.js`: extend the mock `mcp.callTool`/`watchTool` for:
  - `list_calendars` (primary + "Carrel live")
  - `create_event` (returns `{id}`)
  - `update_event`
  - `delete_event`
  - `list_events` with `calendarId` = Carrel live, returning one urge mark, one drift (5 min) mark and one stop mark that matches the running timer's start (encode them with `encodeToken`)
- Run the logic tests: `liveStateOf`, token round-trip (including a non-ASCII name like "Hindi — हिंदी"), and `planMarks`.
- **Cross-check against the app:** for one state, use node to produce the token and decode it the way Kotlin does. Use `Buffer.from(b64,'base64url')`, then `JSON.parse`, and assert integer types and the required fields. It's optional to port `TokenCodecTest.kt` vectors if any fixed strings exist there (`grep -n carrel1: app/src/test`).
- One rendered look: the timer card with Noticed, the Settings panel, a toast after import, and the Patterns cards.
- Static check that every new `data-act` has a handler, same as before.
- **After publishing:**
  - ArtifactData `list` of `config` and `distractions` as owner
  - the same read with `as_level: "admin"`, which must be empty
- **Live test with the user:**
  1. Confirm the "Carrel live" calendar exists.
  2. In Carrel: Settings → Phone live timer → choose calendar → Send now. Expect a consent prompt.
  3. Phone: the notification appears. Tap Urge, Drift 5, then Stop.
  4. Carrel: within about a minute, a toast appears, the log is split, the timer is stopped and the events are deleted.

## 8. Known unknowns. Resolve them in this order, and tell the user if any blocks
1. The `create_event` result shape (event id field).
2. Whether `list_events` accepts `calendarId` and returns `description` and `id`.
3. The `list_calendars` payload shape.
4. Whether update_event on a deleted event rejects with a recognizable code. Otherwise, on any tool_error from update, fall back to create.
5. Google may wrap the description in HTML. The app's regex tolerates that, and Carrel's `decodeToken` must too, by using the regex rather than the whole string.

## 9. Out of scope
App changes. Server push. The Toggl integration. Phone "Noticed" without the calendar.
