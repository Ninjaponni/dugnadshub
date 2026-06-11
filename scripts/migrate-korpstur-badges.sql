-- Korpstur Lillehammer 2026 — merker etter endt tur (kjøres SØNDAG KVELD 14. juni
-- eller senere, ETTER at merke-definisjonene id 71-73 + PNG-er er deployet).
--
-- Mønster: 17. mai-måten — metadata-event + user_badges med event_id, så turen
-- dukker opp i deltakernes historikk på profilsiden. Aktivitet-merker med
-- event_id telles automatisk mot dugnads-merkene (Frøspire/Tre på rad/...).
--
-- Idempotent: ON CONFLICT DO NOTHING (partial unique index på
-- (user_id, badge_id, event_id) WHERE event_id IS NOT NULL — derfor uten
-- kolonneliste, jf. tidligere 42P10-felle) + NOT EXISTS-guards.

-- 0) badges-tabellen har FK fra user_badges — definisjonene må finnes der.
--    (Allerede kjørt i prod 2026-06-11 sammen med sommerkonsert-merkene,
--    men idempotent her så skriptet er selvbærende.)
insert into public.badges (id, name, description, icon, category, auto_criteria) values
  (71, 'Reiseleder', 'Reiseleder på korpstur', '/badges/reiseleder.png', 'aktivitet', null),
  (72, 'Nattevakta', 'Tok nattevakta på korpstur', '/badges/nattevakta.png', 'aktivitet', null),
  (73, 'Bussjåføren', 'Kjørte korpset trygt på tur', '/badges/bussjaforen.png', 'aktivitet', null)
on conflict (id) do nothing;

-- 1) Metadata-event for turen (0 vakter, 0 soner — kun badge-kobling/historikk)
insert into public.events (title, type, date, status, area, description)
select 'Korpstur Lillehammer 2026', 'other', '2026-06-14', 'completed', 'begge',
       'Korpstur til Lillehammerfestivalen 12.–14. juni'
where not exists (
  select 1 from public.events where title = 'Korpstur Lillehammer 2026'
);

-- 2) Tildel merker, matchet på telefonnummer (normalisert for mellomrom)
with ev as (
  select id from public.events where title = 'Korpstur Lillehammer 2026' limit 1
),
p as (
  select id, regexp_replace(coalesce(phone, ''), '\s', '', 'g') as tel
  from public.profiles
),
tildeling (tel, badge_id) as (
  values
    -- Reiseleder (id 71) — alle 14 reiselederne
    ('91580826', 71), ('45665959', 71), ('97034895', 71), ('99104938', 71),
    ('99464774', 71), ('97546823', 71), ('99309814', 71), ('99712460', 71),
    ('91351290', 71), ('98849029', 71), ('93066213', 71), ('97605797', 71),
    ('93614200', 71), ('91735177', 71),
    -- Nattevakta (id 72) — Ole Petter + Tor Martin
    ('93066213', 72), ('91351290', 72),
    -- Bussjåføren (id 73) — Eyvind Dyrendahl
    ('93027902', 73)
)
insert into public.user_badges (user_id, badge_id, event_id)
select p.id, t.badge_id, ev.id
from tildeling t
join p on p.tel = t.tel
cross join ev
on conflict do nothing;

-- 3) Turkomiteen (id 56, finnes fra før) — Maria, Kine, Edel, Arne-Olav.
--    Uten event_id (komite-merke, ikke stackable) — kun til de som mangler det.
insert into public.user_badges (user_id, badge_id, event_id)
select pr.id, 56, null
from public.profiles pr
where regexp_replace(coalesce(pr.phone, ''), '\s', '', 'g')
      in ('91580826', '45665959', '99104938', '97034895')
  and not exists (
    select 1 from public.user_badges ub
    where ub.user_id = pr.id and ub.badge_id = 56
  );

-- Kontroll: hvem fikk hva
select pr.full_name, ub.badge_id, ub.event_id is not null as event_koblet
from public.user_badges ub
join public.profiles pr on pr.id = ub.user_id
where ub.badge_id in (56, 71, 72, 73)
order by ub.badge_id, pr.full_name;

-- ETTERPÅ: kjør scripts/backfill-deltakelse-merker.sql på nytt!
-- Korpstur-eventet gir +1 deltakelse til 17 personer og kan løfte noen
-- over tersklene for Frøspire/Tre på rad/Ringrev/Maskin.
