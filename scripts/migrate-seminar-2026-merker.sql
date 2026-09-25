-- Korpsseminar 2026 — merker til foreldrevaktene (Tonstad skole 25.–27. september).
-- Kjøres ETTER at v10.40.0 (kategori seminar, id 80-84 + PNG-er) er deployet.
--
-- Mønster: som sommerkonsert/korpstur — user_badges med event_id, så seminaret
-- dukker opp i deltakernes historikk og teller mot deltakelses-merkene
-- (Frøspire/Tre på rad/Ringrev/Maskin). Her finnes eventet allerede
-- ('Korpsseminar – foreldrevakter'), så vi lager ikke noe metadata-event.
--
-- Tildeling fra vaktene (event_shifts + shift_claims):
--   Kveldsvakt -> 81 Kveldsvakta, Nattevakt -> 82 Nattugla, Dagvakt -> 83 Dagvakta.
--   Én rad per person per merke, selv med to vakter av samme type.
-- IKKE med: 84 Seminarsjefen (styrevakt) og 80 Seminarhelten — tildeles manuelt i admin.
--
-- Idempotent: ON CONFLICT DO NOTHING (partial unique index user_badges_event_unique
-- på (user_id, badge_id, event_id) WHERE event_id IS NOT NULL — derfor uten
-- kolonneliste, jf. 42P10-fella).

-- 0) KONTROLL FØR KJØRING: hvem får hvilket merke. Sjekk mot vaktloggen.
--    shift_claims har ingen oppmøtekolonne — no-shows må fjernes for hånd (se 3).
select p.full_name, s.role, s.shift_date, s.start_time,
       case s.role when 'Kveldsvakt' then 'Kveldsvakta (81)'
                   when 'Nattevakt'  then 'Nattugla (82)'
                   when 'Dagvakt'    then 'Dagvakta (83)' end as merke
from public.event_shifts s
join public.events e on e.id = s.event_id
join public.shift_claims c on c.shift_id = s.id
join public.profiles p on p.id = c.user_id
where e.title = 'Korpsseminar – foreldrevakter'
order by s.shift_date, s.start_time, s.role, p.full_name;

-- 1) Kategori-CHECK må utvides FØR merkene settes inn (full liste).
alter table public.badges drop constraint if exists badges_category_check;
alter table public.badges add constraint badges_category_check
  check (category = any (array['starter','vanlig','veteran','elite','aktivitet','17mai','sommerkonsert','seminar','styret','komite','vakt']));

insert into public.badges (id, name, description, icon, category, auto_criteria) values
  (80, 'Seminarhelten', 'Bidro på korpsseminaret', '/badges/seminarhelten.png', 'seminar', null),
  (81, 'Kveldsvakta', 'Hadde kveldsvakt på seminar', '/badges/kveldsvakta.png', 'seminar', null),
  (82, 'Nattugla', 'Holdt seg våken for korpset på seminar', '/badges/nattugla.png', 'seminar', null),
  (83, 'Dagvakta', 'Hadde dagvakt på seminar', '/badges/dagvakta.png', 'seminar', null),
  (84, 'Seminarsjefen', 'Hadde styrevakt på seminar', '/badges/seminarsjefen.png', 'seminar', null)
on conflict (id) do nothing;

-- 2) Tildel vaktmerker fra påmeldingene
with ev as (
  select id from public.events where title = 'Korpsseminar – foreldrevakter' limit 1
)
insert into public.user_badges (user_id, badge_id, event_id)
select distinct c.user_id,
       case s.role when 'Kveldsvakt' then 81
                   when 'Nattevakt'  then 82
                   when 'Dagvakt'    then 83 end,
       ev.id
from ev
join public.event_shifts s on s.event_id = ev.id
join public.shift_claims c on c.shift_id = s.id
where s.role in ('Kveldsvakt', 'Nattevakt', 'Dagvakt')
on conflict do nothing;

-- 3) No-shows: fjern merket for hånd, f.eks.
-- delete from public.user_badges ub
-- using public.profiles p, public.events e
-- where ub.user_id = p.id and ub.event_id = e.id
--   and e.title = 'Korpsseminar – foreldrevakter'
--   and ub.badge_id = 83 and p.full_name = 'Navn Navnesen';

-- Kontroll etterpå: hvem fikk hva
select pr.full_name, ub.badge_id, b.name
from public.user_badges ub
join public.profiles pr on pr.id = ub.user_id
join public.badges b on b.id = ub.badge_id
where ub.badge_id between 80 and 84
order by ub.badge_id, pr.full_name;

-- ETTERPÅ: kjør scripts/backfill-deltakelse-merker.sql på nytt!
-- Seminar-eventet gir +1 deltakelse til alle vaktene og kan løfte noen
-- over tersklene for Frøspire/Tre på rad/Ringrev/Maskin.
