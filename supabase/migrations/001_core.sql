-- ===== table =====
create table public.docs (
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path text not null check (path ~ '^[a-z]+/[A-Za-z0-9_.:@+~-]+$'),
  coll text generated always as (split_part(path, '/', 1)) stored,
  id   text generated always as (split_part(path, '/', 2)) stored,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  date text generated always as (data->>'date') stored,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'app',          -- 'app' | 'native' | 'claude' | 'migration'
  primary key (owner, path)
);
create index docs_coll_date on public.docs (owner, coll, date);
alter table public.docs replica identity full;      -- realtime deletes carry the old row
alter table public.docs enable row level security;
create policy docs_own on public.docs for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
alter publication supabase_realtime add table public.docs;
comment on table public.docs is
  'Carrel study tracker. Read the guide first: select data from docs where path = ''meta/guide''.';

-- ===== single owner (for SQL run by Claude as postgres) =====
create table public.carrel_owner (
  singleton boolean primary key default true check (singleton),
  owner uuid not null references auth.users(id) on delete cascade
);
alter table public.carrel_owner enable row level security;   -- no policies: invisible to the app

create or replace function public.carrel_uid() returns uuid
language sql stable set search_path = '' as $$
  select coalesce(auth.uid(),
    case when current_user in ('postgres', 'service_role', 'supabase_admin')
         then (select owner from public.carrel_owner) end)
$$;

-- ===== json helpers =====
create or replace function public.jsonb_merge_deep(a jsonb, b jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; r jsonb := coalesce(a, '{}'::jsonb);
begin
  if b is null then return r; end if;
  for k, v in select * from jsonb_each(b) loop
    if jsonb_typeof(v) = 'object' and jsonb_typeof(r->k) = 'object' then
      r := r || jsonb_build_object(k, public.jsonb_merge_deep(r->k, v));
    else
      r := r || jsonb_build_object(k, v);           -- JSON null is stored, same as the artifact db
    end if;
  end loop;
  return r;
end $$;

-- ===== document RPCs (used by app, native and Claude) =====
create or replace function public.doc_merge(p_path text, p_patch jsonb, p_ensure jsonb default null, p_by text default 'app')
returns jsonb language plpgsql set search_path = '' as $$
declare uid uuid := public.carrel_uid(); r jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update public.docs set data = public.jsonb_merge_deep(data, p_patch), updated_at = now(), updated_by = p_by
   where owner = uid and path = p_path returning data into r;
  if found then return r; end if;
  if p_ensure is null then raise exception 'missing document %', p_path using errcode = 'P0002'; end if;
  insert into public.docs (owner, path, data, updated_by)
  values (uid, p_path, public.jsonb_merge_deep(p_ensure, p_patch), p_by)
  on conflict (owner, path) do update
    set data = public.jsonb_merge_deep(public.docs.data, p_patch), updated_at = now(), updated_by = p_by
  returning data into r;
  return r;
end $$;

create or replace function public.doc_set(p_path text, p_data jsonb, p_by text default 'app')
returns jsonb language plpgsql set search_path = '' as $$
declare uid uuid := public.carrel_uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  insert into public.docs (owner, path, data, updated_by) values (uid, p_path, p_data, p_by)
  on conflict (owner, path) do update set data = excluded.data, updated_at = now(), updated_by = p_by;
  return p_data;
end $$;

create or replace function public.doc_delete(p_path text) returns void
language plpgsql set search_path = '' as $$
begin
  delete from public.docs where owner = public.carrel_uid() and path = p_path;
end $$;

-- ===== views for Claude (security_invoker → RLS applies to the app) =====
create view public.entries with (security_invoker = true) as
select d.owner, d.id as day, e.key as entry_id,
       e.value->>'activity' as activity,
       (e.value->>'start')::timestamptz as start_at,
       (e.value->>'end')::timestamptz   as end_at,
       round((extract(epoch from (e.value->>'end')::timestamptz - (e.value->>'start')::timestamptz) / 60)::numeric, 1) as minutes,
       e.value->>'note' as note, (e.value->>'focus')::int as focus, e.value->>'block' as block,
       (e.value->'pomo'->>'target')::int as pomo_target
from public.docs d cross join lateral jsonb_each(d.data->'entries') e
where d.coll = 'days' and jsonb_typeof(e.value) = 'object';

create view public.activities with (security_invoker = true) as
select d.owner, a.key as id, a.value->>'name' as name, a.value->>'kind' as kind, a.value->>'color' as color,
       (a.value->>'goal')::int as weekly_goal_min, a.value->>'role' as role,
       coalesce((a.value->>'archived')::boolean, false) as archived, (a.value->>'order')::numeric as sort
from public.docs d cross join lateral jsonb_each(d.data->'items') a
where d.path = 'config/activities' and jsonb_typeof(a.value) = 'object';

create view public.daily_totals with (security_invoker = true) as
select e.owner, e.day, e.activity, a.name, a.kind, sum(e.minutes) as minutes, count(*) as sessions
from public.entries e left join public.activities a on a.owner = e.owner and a.id = e.activity
group by 1, 2, 3, 4, 5;

create view public.plan_blocks with (security_invoker = true) as
select d.owner, d.id as day, d.data->>'source' as source, b.key as block_id,
       b.value->>'activity' as activity, b.value->>'title' as title,
       (b.value->>'minutes')::int as minutes, (b.value->>'orig')::int as orig,
       (b.value->>'order')::numeric as sort, b.value->>'at' as at, b.value->>'status' as status,
       b.value->>'pomo' as pomo, b.value->>'from' as carried_from
from public.docs d cross join lateral jsonb_each(coalesce(d.data->'blocks', '{}'::jsonb)) b
where d.coll = 'plans' and jsonb_typeof(b.value) = 'object';

create view public.current_timer with (security_invoker = true) as
select owner, coalesce((data->>'running')::boolean, false) as running, data->>'id' as id,
       data->>'activity' as activity, (data->>'start')::timestamptz as start_at,
       case when (data->>'running')::boolean
            then round((extract(epoch from now() - (data->>'start')::timestamptz) / 60)::numeric, 1) end as elapsed_min,
       data->>'note' as note, data->'pomo' as pomo, updated_at, updated_by
from public.docs where path = 'state/current';

-- ===== privileges: nothing for anon =====
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant select, insert, update, delete on public.docs to authenticated;
grant select on public.entries, public.activities, public.daily_totals, public.plan_blocks, public.current_timer to authenticated;
grant execute on function public.carrel_uid(), public.jsonb_merge_deep(jsonb, jsonb),
  public.doc_merge(text, jsonb, jsonb, text), public.doc_set(text, jsonb, text), public.doc_delete(text) to authenticated;
