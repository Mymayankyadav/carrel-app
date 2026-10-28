-- Carrel v2: read-only, owner-filtered views for optional Claude chats.
-- All data remains under the existing public.docs RLS. No new tables or write rights.
create or replace view public.coach_inbox with (security_invoker = true) as
select d.id,
       d.data->>'at' as at,
       d.data->>'kind' as kind,
       d.data->>'from' as "from",
       d.data->>'title' as title,
       d.data->>'status' as status
from public.docs d
where d.owner = public.carrel_uid()
  and d.coll = 'coach'
  and d.data->>'kind' in ('note','plan','review','ask')
  and d.data->>'status' in ('new','seen','accepted','dismissed');

create or replace view public.topics_due with (security_invoker = true) as
select d.id,
       d.data->>'subject' as subject,
       d.data->>'title' as title,
       d.data->>'due' as due,
       case when d.data->>'interval' ~ '^[0-9]{1,4}$'
         then (d.data->>'interval')::integer else null end as interval,
       case when d.data->>'reps' ~ '^[0-9]{1,4}$'
         then (d.data->>'reps')::integer else null end as reps
from public.docs d
where d.owner = public.carrel_uid()
  and d.coll = 'topics'
  and d.data->>'archived' is distinct from 'true'
  and d.data->>'due' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}
  and d.data->>'due' <= to_char((now() at time zone
    coalesce((select s.data->>'tz' from public.docs s
              where s.owner=public.carrel_uid() and s.path='config/settings'),
             'Asia/Kolkata'))::date + 7,'YYYY-MM-DD');

create or replace view public.week_summary with (security_invoker = true) as
with current_week as (
  select public.carrel_uid() as uid,
    date_trunc('week', now() at time zone
      coalesce((select s.data->>'tz' from public.docs s
                where s.owner=public.carrel_uid() and s.path='config/settings'),
               'Asia/Kolkata'))::date as first_day
)
select a.id as activity,
       a.name as name,
       coalesce(sum(e.minutes), 0) as minutes,
       a.weekly_goal_min as goal_minutes
from current_week w
join public.activities a on a.owner = w.uid and a.kind = 'study' and not a.archived
left join public.entries e on e.owner=a.owner and e.activity=a.id
  and e.day >= to_char(w.first_day,'YYYY-MM-DD')
  and e.day < to_char(w.first_day + 7,'YYYY-MM-DD')
group by a.id, a.name, a.weekly_goal_min;

revoke all on public.coach_inbox, public.topics_due, public.week_summary from anon, public;
grant select on public.coach_inbox, public.topics_due, public.week_summary to authenticated;

  and d.data->>'due' <= to_char((now() at time zone
    coalesce((select s.data->>'tz' from public.docs s
              where s.owner=public.carrel_uid() and s.path='config/settings'),
             'Asia/Kolkata'))::date + 7,'YYYY-MM-DD');

create or replace view public.week_summary with (security_invoker = true) as
with current_week as (
  select public.carrel_uid() as uid,
    date_trunc('week', now() at time zone
      coalesce((select s.data->>'tz' from public.docs s
                where s.owner=public.carrel_uid() and s.path='config/settings'),
               'Asia/Kolkata'))::date as first_day
)
select a.id as activity,
       a.name as name,
       coalesce(sum(e.minutes), 0) as minutes,
       a.weekly_goal_min as goal_minutes
from current_week w
join public.activities a on a.owner = w.uid and a.kind = 'study' and not a.archived
left join public.entries e on e.owner=a.owner and e.activity=a.id
  and e.day >= to_char(w.first_day,'YYYY-MM-DD')
  and e.day < to_char(w.first_day + 7,'YYYY-MM-DD')
group by a.id, a.name, a.weekly_goal_min;

revoke all on public.coach_inbox, public.topics_due, public.week_summary from anon, public;
grant select on public.coach_inbox, public.topics_due, public.week_summary to authenticated;
