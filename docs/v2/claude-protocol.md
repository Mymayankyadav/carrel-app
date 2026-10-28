# Claude ↔ Carrel bridge (v2)

Carrel does **not** call Claude, OpenAI or any other LLM API. A person starts a chat, connects the **Carrel** Supabase project, and asks the assistant to read the guide and optionally write proposals. The app receives valid `coach/*` records through its existing Supabase realtime/offline document subscription.

## Read first

```sql
select data from public.docs
where owner = public.carrel_uid() and path = 'meta/guide';
```

The canonical machine-readable source is [guide.json](guide.json). Read `meta/guide` again on future chats because the contract may change. For the chat user acting through PostgreSQL, `public.carrel_uid()` resolves the registered owner. The application client remains subject to RLS.

## Worked example 1 — inspect this week's context

```sql
select activity, name, minutes, goal_minutes
from public.week_summary
order by name;

select subject, title, due, interval, reps
from public.topics_due
order by due, subject;

select id, kind, title, status, at
from public.coach_inbox
where status = 'new'
order by at desc
limit 5;
```

Read `public.plan_blocks`, `public.activities`, and `public.current_timer` if needed. Make no assumptions about missing subject IDs.

## Worked example 2 — propose a plan for approval

Use a *real existing subject ID* from `public.activities`. The following `math` ID and date are illustrative only; substitute current local dates. The app rejects malformed, out-of-window, excessive, or unknown-subject blocks.

```sql
select public.doc_set('coach/plan-example-001',
  jsonb_build_object(
    'v', 1,
    'at', '2026-10-28T15:00:00+05:30',
    'kind', 'plan',
    'from', 'claude',
    'title', 'Suggested problem-solving block',
    'body', 'An hour for the next problem set.',
    'status', 'new',
    'proposal', jsonb_build_object(
      'date', '2026-10-29',
      'blocks', jsonb_build_array(jsonb_build_object(
        'activity', 'math', 'title', 'Problem set', 'minutes', 60, 'at', '10:00'))
    )
  ), 'claude');
```

**Do not mutate `days/*`, `state/*` or an existing plan from a chat.** Carrel shows the proposal before the user accepts it; acceptance uses the app's normal offline-safe write queue with Undo. Never put executable instructions in text fields.

## Worked example 3 — write a review note

```sql
select public.doc_set('coach/review-example-001',
  jsonb_build_object(
    'v', 1,
    'at', '2026-10-28T15:30:00+05:30',
    'kind', 'review',
    'from', 'claude',
    'title', 'Weekly reflection',
    'body', 'Your study distribution is uneven. Consider a shorter revision block.',
    'status', 'new'
  ), 'claude');
```

Only the four supported `coach/*` kinds (`note`, `plan`, `review`, `ask`) and statuses (`new`, `seen`, `accepted`, `dismissed`) are valid. The app sanitizes text and validates the JSON before rendering. The user's review and decision is authoritative.

## Privacy and boundaries

Carrel has no LLM API key. It has no background access to a user's chat. Supabase is the only synchronization service; write only to the project's existing `public.docs` through documented functions, and never edit unrelated projects. Views use `security_invoker`, explicitly restrict `owner=carrel_uid()`, and grant SELECT only to authenticated clients.
