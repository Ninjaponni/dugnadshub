-- Kjørt i prod 2026-10-12 kl 21:57 (steg 2, ub_totalt 1272 → 1415, 0 nye terskelmerker).
-- Tilbakefylling (2026-10-12): sonemerker for alle fullførte lappeutdelinger og
-- flaskeinnsamlinger. Krever migrate-merke-per-sone.sql. Ingen sletting. Idempotent.
-- Kjøres i samme begin ... commit som migreringen.

-- 1. Manuelle Lappemester-rader uten hendelse (våren 2026) kobles til hendelse og sone.
-- Parres én til én per bruker og merke: eldste claim mot eldste rad. Claims på hendelser
-- der brukeren allerede har en rad med samme event_id, tas i steg 2.
with krav as (
  select zc.user_id,
         case z.area when 'NORD' then 18 else 20 end as badge_id,
         za.event_id,
         za.id as assignment_id,
         row_number() over (
           partition by zc.user_id, case z.area when 'NORD' then 18 else 20 end
           order by e.date, za.id
         ) as rn
  from public.zone_claims zc
  join public.zone_assignments za on za.id = zc.assignment_id
  join public.zones z on z.id = za.zone_id
  -- Radene uten hendelse er alle fra våren 2026. Grensen hindrer at en vårrad pares med en høstclaim.
  join public.events e on e.id = za.event_id and e.status = 'completed' and e.type = 'lapper'
    and e.date < date '2026-07-01'
  where z.area in ('NORD', 'SOR')
    and za.status in ('completed', 'picked_up')
    and not exists (
      select 1 from public.user_badges ub
      where ub.user_id = zc.user_id
        and ub.badge_id = case z.area when 'NORD' then 18 else 20 end
        and (ub.event_id = za.event_id or ub.zone_assignment_id = za.id)
    )
),
rader as (
  select ub.id, ub.user_id, ub.badge_id,
         row_number() over (partition by ub.user_id, ub.badge_id order by ub.awarded_at, ub.id) as rn
  from public.user_badges ub
  where ub.badge_id in (18, 20)
    and ub.event_id is null
    and ub.zone_assignment_id is null
)
update public.user_badges ub
set event_id = k.event_id, zone_assignment_id = k.assignment_id
from rader r
join krav k on k.user_id = r.user_id and k.badge_id = r.badge_id and k.rn = r.rn
where ub.id = r.id;

-- 2. Alle fullførte hendelser: kobler rader med samme event_id og setter inn resten.
do $$
declare
  r record;
begin
  for r in
    select id from public.events
    where status = 'completed' and type in ('lapper', 'bottle_collection')
    order by date
  loop
    perform public.award_zone_badges(r.id);
  end loop;
end;
$$;

-- 3. Terskelmerker for alle. Triggeren har allerede tatt de som fikk nye rader i steg 2,
-- dette fanger koblingene fra steg 1 (update utløser ikke triggeren).
select count(*) as nye_terskelmerker from public.award_participation_badges(null);
