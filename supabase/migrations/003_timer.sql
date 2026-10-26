-- Timer verbs used by the phone notification buttons and by Claude in chat.
-- They mirror stopTimer / takeBreak / startActivity in web/app.js.

create or replace function public.carrel_settings(p_uid uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce((select data from public.docs where owner = p_uid and path = 'config/settings'), '{}'::jsonb)
$$;

-- local ISO 8601 with offset, like isoLocal() in the app
create or replace function public.carrel_iso(t timestamptz, tz text) returns text
language sql stable set search_path = '' as $$
  select to_char(t at time zone tz, 'YYYY-MM-DD"T"HH24:MI:SS')
      || case when o >= 0 then '+' else '-' end
      || to_char(abs(o) / 3600, 'FM00') || ':' || to_char((abs(o) % 3600) / 60, 'FM00')
  from (select (extract(epoch from (t at time zone tz) - (t at time zone 'UTC')))::int as o) x
$$;

-- logical day key (day starts at settings.dayStart), like dayKeyOf() in logic.js
create or replace function public.carrel_daykey(t timestamptz, tz text, ds text) returns text
language sql stable set search_path = '' as $$
  select to_char(((t at time zone tz) - (ds || ':00')::interval)::date, 'YYYY-MM-DD')
$$;

create or replace function public.carrel_stop(p_at timestamptz default now(), p_expect_id text default null, p_by text default 'app')
returns jsonb language plpgsql set search_path = '' as $$
declare
  uid uuid := public.carrel_uid(); cur jsonb; st jsonb; tz text; ds text;
  s timestamptz; e timestamptz; ent jsonb; k text; logged boolean := false;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select data into cur from public.docs where owner = uid and path = 'state/current' for update;
  if cur is null or not coalesce((cur->>'running')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_running');
  end if;
  if p_expect_id is not null and cur->>'id' is distinct from p_expect_id then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;
  st := public.carrel_settings(uid);
  tz := coalesce(st->>'tz', 'Asia/Kolkata'); ds := coalesce(st->>'dayStart', '04:00');
  s := (cur->>'start')::timestamptz;
  e := least(greatest(p_at, s), now());
  if e - s >= interval '15 seconds' then
    k := public.carrel_daykey(s, tz, ds);
    ent := jsonb_build_object('activity', cur->'activity', 'start', cur->'start', 'end', public.carrel_iso(e, tz),
      'note', coalesce(cur->>'note', ''), 'focus', null, 'block', cur->'block',
      'pomo', case when jsonb_typeof(cur->'pomo') = 'object' and cur->'pomo'->>'phase' = 'focus'
                   then jsonb_build_object('phase', cur->'pomo'->'phaseStart', 'target', cur->'pomo'->'focus') else null end);
    perform public.doc_merge('days/' || k, jsonb_build_object('entries', jsonb_build_object(cur->>'id', ent)),
                             jsonb_build_object('date', k), p_by);
    logged := true;
  end if;
  update public.docs set data = jsonb_build_object('running', false, 'stopped', public.carrel_iso(e, tz)),
         updated_at = now(), updated_by = p_by
   where owner = uid and path = 'state/current';
  return jsonb_build_object('ok', true, 'logged', logged);
end $$;

create or replace function public.carrel_break(p_at timestamptz default now(), p_expect_id text default null, p_by text default 'app')
returns jsonb language plpgsql set search_path = '' as $$
declare
  uid uuid := public.carrel_uid(); cur jsonb; st jsonb; acts jsonb; tz text; ds text; brk text;
  s timestamptz; a timestamptz; pomo jsonb; cyc int; ev int; blen int; nid text; ent jsonb; k text;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select data into cur from public.docs where owner = uid and path = 'state/current' for update;
  if cur is null or not coalesce((cur->>'running')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_running');
  end if;
  if p_expect_id is not null and cur->>'id' is distinct from p_expect_id then
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;
  select data->'items' into acts from public.docs where owner = uid and path = 'config/activities';
  acts := coalesce(acts, '{}'::jsonb);
  select j.key into brk from jsonb_each(acts) j
   where j.value->>'role' = 'break' and not coalesce((j.value->>'archived')::boolean, false) order by j.key limit 1;
  if brk is null and acts ? 'break' then brk := 'break'; end if;
  if brk is null then return jsonb_build_object('ok', false, 'reason', 'no_break_activity'); end if;
  if cur->>'activity' = brk then return jsonb_build_object('ok', false, 'reason', 'already'); end if;
  st := public.carrel_settings(uid);
  tz := coalesce(st->>'tz', 'Asia/Kolkata'); ds := coalesce(st->>'dayStart', '04:00');
  s := (cur->>'start')::timestamptz;
  a := least(p_at, now());
  if a <= s + interval '1 second' then a := least(now(), s + interval '1 second'); end if;
  if a - s < interval '15 seconds' then
    a := s;                                   -- a quick correction replaces the start; nothing is logged
  else
    k := public.carrel_daykey(s, tz, ds);
    ent := jsonb_build_object('activity', cur->'activity', 'start', cur->'start', 'end', public.carrel_iso(a, tz),
      'note', coalesce(cur->>'note', ''), 'focus', null, 'block', cur->'block',
      'pomo', case when jsonb_typeof(cur->'pomo') = 'object' and cur->'pomo'->>'phase' = 'focus'
                   then jsonb_build_object('phase', cur->'pomo'->'phaseStart', 'target', cur->'pomo'->'focus') else null end);
    perform public.doc_merge('days/' || k, jsonb_build_object('entries', jsonb_build_object(cur->>'id', ent)),
                             jsonb_build_object('date', k), p_by);
  end if;
  if jsonb_typeof(cur->'pomo') = 'object' and cur->'pomo'->>'phase' = 'focus' then
    cyc := coalesce(nullif(cur->'pomo'->>'cycle', '')::int, 1);
    ev := greatest(coalesce(nullif(cur->'pomo'->>'every', '')::int, 4), 1);
    blen := case when cyc % ev = 0 then coalesce(nullif(cur->'pomo'->>'long', '')::int, 15)
                 else coalesce(nullif(cur->'pomo'->>'short', '')::int, 5) end;
    pomo := (cur->'pomo') || jsonb_build_object('phase', 'break', 'phaseStart', public.carrel_iso(a, tz), 'breakLen', blen);
  else
    pomo := null;
  end if;
  nid := 'e_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  update public.docs set data = jsonb_build_object('running', true, 'id', nid, 'activity', brk,
           'start', public.carrel_iso(a, tz), 'note', '', 'block', null, 'pomo', pomo,
           'ret', jsonb_build_object('activity', cur->'activity', 'block', cur->'block'), 'ack', null),
         updated_at = now(), updated_by = p_by
   where owner = uid and path = 'state/current';
  return jsonb_build_object('ok', true, 'id', nid);
end $$;

create or replace function public.carrel_mark(p_type text, p_at timestamptz default now(), p_drift_min int default null,
                                              p_text text default null, p_by text default 'native')
returns jsonb language plpgsql set search_path = '' as $$
declare
  uid uuid := public.carrel_uid(); cur jsonb; st jsonb; tz text; ds text; k text; mid text; running boolean;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_type not in ('urge', 'drift', 'park') then raise exception 'bad mark type %', p_type using errcode = '22023'; end if;
  select data into cur from public.docs where owner = uid and path = 'state/current';
  running := coalesce((cur->>'running')::boolean, false);
  st := public.carrel_settings(uid);
  tz := coalesce(st->>'tz', 'Asia/Kolkata'); ds := coalesce(st->>'dayStart', '04:00');
  k := public.carrel_daykey(p_at, tz, ds);
  mid := 'd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  perform public.doc_merge('distractions/' || k,
    jsonb_build_object('items', jsonb_build_object(mid, jsonb_build_object(
      'type', p_type, 'at', public.carrel_iso(p_at, tz), 'driftMin', p_drift_min, 'text', p_text,
      'activity', case when running then cur->'activity' end, 'entry', case when running then cur->'id' end,
      'src', 'phone', 'applied', p_type <> 'drift'))),
    jsonb_build_object('date', k), p_by);
  return jsonb_build_object('ok', true, 'id', mid);
end $$;

revoke execute on function public.carrel_settings(uuid), public.carrel_iso(timestamptz, text), public.carrel_daykey(timestamptz, text, text),
  public.carrel_stop(timestamptz, text, text), public.carrel_break(timestamptz, text, text),
  public.carrel_mark(text, timestamptz, int, text, text) from anon, public;
grant execute on function public.carrel_settings(uuid), public.carrel_iso(timestamptz, text), public.carrel_daykey(timestamptz, text, text),
  public.carrel_stop(timestamptz, text, text), public.carrel_break(timestamptz, text, text),
  public.carrel_mark(text, timestamptz, int, text, text) to authenticated;
