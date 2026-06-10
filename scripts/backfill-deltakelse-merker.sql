-- Backfill av deltakelse-baserte merker (Frøspire 1, Tre på rad 4,
-- Ringrev 8, Maskin 12) for brukere som kvalifiserer men aldri ble
-- re-evaluert. Evaluator-reglene teller allerede ALLE kilder (soner,
-- vakter, sjåfør-roller, musikanter, event-koblede merker), men
-- evalueringen trigges kun per bruker ved profil-lagring/event-fullføring
-- — historiske kvalifiseringer falt mellom stolene.
--
-- KJØR PÅ NYTT etter bulk-tildelinger med event_id (f.eks. korpstur-merkene),
-- siden de gir ny deltakelse som kan løfte folk over tersklene. Idempotent.
--
-- NB: id-lista i user_badges-kilden = alle aktivitet+17mai-merker.
-- Synkroniser med lib/badges/definitions.ts hvis nye kategorier kommer til.

with deltakelse as (
  select user_id, event_id from (
    select zc.user_id, za.event_id from zone_claims zc join zone_assignments za on za.id = zc.assignment_id
    union
    select sc.user_id, es.event_id from shift_claims sc join event_shifts es on es.id = sc.shift_id
    union
    select da.user_id, da.event_id from driver_assignments da where da.event_id is not null
    union
    select em.profile_id as user_id, em.event_id from event_musicians em
    union
    select ub.user_id, ub.event_id from user_badges ub
    where ub.event_id is not null
      and ub.badge_id in (14,15,17,18,19,20,21,22,23,24,25,26,27,28,67,69,70,71,72,73,29,30,31,32,33,34,35,36,37,38,39,40,41,42,63,64,65,66,68,43,44)
  ) u
  join events e on e.id = u.event_id and e.status = 'completed'
  where u.user_id is not null  -- driver_assignments/event_musicians kan ha tomme slots
),
antall as (
  select user_id, count(distinct event_id) as n from deltakelse group by user_id
)
insert into public.user_badges (user_id, badge_id, event_id)
select a.user_id, b.badge_id, null
from antall a
cross join (values (1, 1), (4, 3), (8, 10), (12, 20)) as b(badge_id, terskel)
where a.n >= b.terskel
  and not exists (
    select 1 from public.user_badges ub
    where ub.user_id = a.user_id and ub.badge_id = b.badge_id
  );

-- Kontroll
select pr.full_name, count(*) filter (where ub.badge_id = 1) as frospire,
       count(*) filter (where ub.badge_id = 4) as tre_pa_rad
from user_badges ub join profiles pr on pr.id = ub.user_id
where ub.badge_id in (1, 4)
group by pr.full_name order by pr.full_name;
