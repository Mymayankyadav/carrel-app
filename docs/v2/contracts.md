# Carrel v2 shared contracts
Source of truth: [PLAN-v2.md](../PLAN-v2.md), Parts B–D. ORC owns frozen files.
## UI
- `VIEWS[id]()`: tabs today, plan, subjects, insights. `stats` is a legacy alias to insights, `settings` a gear-opened root.
- `PAGES[id]={title,render(params),actions?(params)}`; `pushPage`, `openPage(tab,id,params)`.
- `SHEETS[type]=sh=>html`, `openSheet({type,...})` and `closeSheet()`.
- `ACT[name]=el=>void`, `SUBMIT[name]=(form,event)=>void`.
- `CARDS[id]={rank(ctx),render(ctx),label?,snooze?}`; `ctx={now,k}`; rank 0–100; `topCards(max=3)`, `cardFrame(id,ctx)`, `renderTopCards(max)`, `card-snooze` uses `store.set('cardSnooze:<date>',ids)`.
- `LABS[name]={label,def}`; `lab(name)` reads `CFG.labs[name]` or the declared default; `PAGES['settings.labs']` saves through `saveSetting`.
- `kFlow(sh,steps)`, with `{title,body:()=>html,next?,canNext?:()=>boolean}`, `sh.step` zero-based, `sh.done()` on completion; browser/device Back returns to previous step.
## Storage
Only `W()` and `commit(message,w)` write, with offline queue and Undo. `w.set(path,doc)`, `w.update(path,patch,ensure)`, `w.day(k,patch)`, `w.plan(k,patch)`.
`S.base`, `S.loaded`, `V` each contain document maps `topics`, `rituals`, `coach`, `usage`. `watchColl(name)` streams topics/coach in full and rituals/usage from the window date. Fields are additive, with `v:1`; old fields are never removed.
- `topics/<id>`: `{v:1,subject,title,order,due,interval,ease,reps,last,archived}`
- `rituals/<date>`: `{v:1,date,morning:{at,picks,intent},shutdown:{at,done,carry,first}}`
- `coach/<id>`: `{v:1,at,kind:'note'|'plan'|'review'|'ask',from:'claude'|'me',title,body,proposal?,status:'new'|'seen'|'accepted'|'dismissed'}`
- `usage/<date>`: `{v:1,date,sessions:{<entryId>:{apps:{<label>:{min,opens}}}}}`
- Optional days entry fields: `intent`, `ifThen`, `energy` (1–3), `recall` (≤280 chars), `topics` (array of IDs).
Claude documents must be validated as untrusted input before rendering. No client AI API calls.
## Lane APIs
L1 registers `CARDS.deadline`, `CARDS.insight`, ribbon. L2 registers `CARDS.morning`, `CARDS.shutdown`, `SHEETS.morning`, `SHEETS.shutdown`. L3 provides pure `estimateFactor`, `energyWindows`, `autoPlan`, `backwardPlan`. L4 implements `VIEWS.subjects`, `PAGES.subject`, `dueTopics`, `CARDS.reviews`. L5 supplies break/recall logic and Labs flags. L6 registers `CARDS.distraction` and optional Android usage. L7 implements `VIEWS.insights`, `CARDS.freshstart`. L8 supplies Android surfaces with feature detection. L9 implements `SHEETS.capture` and parsing. L10 registers `CARDS.coach` and validates messages.
Pure logic modules in `web/logic/` use `module.exports` guards and receive all input explicitly; no `Date.now()` or DOM globals.
