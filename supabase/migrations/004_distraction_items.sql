-- One row per noticed urge, drift or parked thought, so Claude (and SQL) can read them without unpacking jsonb.
create or replace view public.distraction_items with (security_invoker = true) as
select d.date,
       i.key                                   as id,
       i.value->>'type'                        as type,          -- urge | drift | park
       (i.value->>'at')::timestamptz           as at,
       (i.value->>'driftMin')::int             as drift_min,     -- drift only
       i.value->>'text'                        as text,          -- park only
       i.value->>'activity'                    as activity,
       i.value->>'entry'                       as entry,
       i.value->>'src'                         as src,           -- phone | page
       coalesce((i.value->>'applied')::boolean, true) as applied, -- false = a phone drift not yet cut out of the log
       coalesce((i.value->>'moved')::boolean, false)  as moved,   -- parked thought sent to the backlog
       coalesce((i.value->>'dismissed')::boolean, false) as dismissed
from public.docs d, jsonb_each(d.data->'items') i
where d.coll = 'distractions' and d.owner = public.carrel_uid();

revoke all on public.distraction_items from anon, public;
grant select on public.distraction_items to authenticated;
