-- Sommerkonsert 2026 — merker etter konserten 11. juni (Sjetne Bydelshus).
-- Kjøres ETTER at v10.36.0 (kategori sommerkonsert, id 74-79 + PNG-er) er deployet.
--
-- Mønster: 17. mai-/korpstur-måten — metadata-event + user_badges med event_id,
-- så konserten dukker opp i deltakernes historikk og teller mot
-- deltakelses-merkene (Frøspire/Tre på rad/Ringrev/Maskin).
--
-- Idempotent: ON CONFLICT DO NOTHING (partial unique index på
-- (user_id, badge_id, event_id) WHERE event_id IS NOT NULL — derfor uten
-- kolonneliste, jf. 42P10-fella).
--
-- IKKE med: Rita Myrvold + Anne Mari Fiksdal (ikke i korpset), Sverre
-- (musikant, ingen bruker), Rolf Erik Magnussen (ukjent), hele Tillerblæsen,
-- åresalg-selgerne (alle TB).

-- 0) badges-tabellen har FK fra user_badges OG en category-CHECK — begge må
--    utvides FØR tildeling. (Kjørt i prod 2026-06-11, idempotent.)
alter table public.badges drop constraint if exists badges_category_check;
alter table public.badges add constraint badges_category_check
  check (category = any (array['starter','vanlig','veteran','elite','aktivitet','17mai','sommerkonsert','styret','komite','vakt']));

insert into public.badges (id, name, description, icon, category, auto_criteria) values
  (74, 'Sommerkonserten', 'Bidro på korpsets sommerkonsert', '/badges/sommerkonserten.png', 'sommerkonsert', null),
  (75, 'Sommerbakeren', 'Bakte kake til sommerkonserten', '/badges/sommerbakeren.png', 'sommerkonsert', null),
  (76, 'Sommerkiosken', 'Sto i kiosken på sommerkonserten', '/badges/sommerkiosken.png', 'sommerkonsert', null),
  (77, 'Sommerriggen', 'Rigget og ryddet til sommerkonserten', '/badges/sommerriggen.png', 'sommerkonsert', null),
  (78, 'Sommergaver', 'Skaffet premier til åresalget', '/badges/sommergaver.png', 'sommerkonsert', null),
  (79, 'Sommertrekker', 'Ledet lotteri, trekning og premieutdeling', '/badges/sommertrekker.png', 'sommerkonsert', null)
on conflict (id) do nothing;

-- 1) Metadata-event for konserten (0 vakter, 0 soner — kun badge-kobling/historikk)
insert into public.events (title, type, date, status, area, description)
select 'Sommerkonsert 2026', 'other', '2026-06-11', 'completed', 'begge',
       'Sommerkonsert med Tillerblæsen og Tillerbyen skolekorps på Sjetne Bydelshus'
where not exists (
  select 1 from public.events where title = 'Sommerkonsert 2026'
);

-- 2) Tildel merker, matchet på telefonnummer (normalisert for mellomrom)
with ev as (
  select id from public.events where title = 'Sommerkonsert 2026' limit 1
),
p as (
  select id, regexp_replace(coalesce(phone, ''), '\s', '', 'g') as tel
  from public.profiles
),
tildeling (tel, badge_id) as (
  values
    -- Sommerkonserten (id 74) — alle 16 TS-bidragsytere
    ('97034895', 74), -- Arne-Olav Thuestad (rigg)
    ('48130067', 74), -- Wusam Jabber (rigg)
    ('93887270', 74), -- Linda Svendsen Dahl (rigg)
    ('98002317', 74), -- Roar Gjøvaag (kiosk)
    ('45665959', 74), -- Kine Halgunset (kiosk + kake)
    ('97963424', 74), -- Tina Wågseth (kiosk)
    ('40832888', 74), -- Magnus Gule (kake)
    ('45449193', 74), -- Ingrid Aaen (kake)
    ('45035478', 74), -- Irun Walberg (premie + styreansvar)
    ('97720890', 74), -- Lisbeth Hultmann (premie)
    ('40873732', 74), -- Karna Løberg (premier)
    ('98849029', 74), -- Tove Myrhaug (premie)
    ('90971238', 74), -- Alfhild Lien Eide (premie)
    ('97546823', 74), -- Remi Bakke (styreansvar rigg/kiosk/frakt)
    ('91351290', 74), -- Tor Martin Norvik (lotteri)
    ('93614200', 74), -- Aina Nesmoen (fruktkurver)
    -- Sommerbakeren (id 75)
    ('45665959', 75), ('40832888', 75), ('45449193', 75),
    -- Sommerkiosken (id 76)
    ('98002317', 76), ('45665959', 76), ('97963424', 76),
    -- Sommerriggen (id 77)
    ('97034895', 77), ('48130067', 77), ('93887270', 77),
    ('97546823', 77), -- Remi (styreansvar for riggingen)
    -- Sommergaver (id 78)
    ('45035478', 78), ('97720890', 78), ('40873732', 78),
    ('98849029', 78), ('90971238', 78),
    ('93614200', 78), -- Aina Nesmoen (fruktkurver)
    -- Sommertrekker (id 79)
    ('91351290', 79)
)
insert into public.user_badges (user_id, badge_id, event_id)
select p.id, t.badge_id, ev.id
from tildeling t
join p on p.tel = t.tel
cross join ev
on conflict do nothing;

-- Kontroll: hvem fikk hva
select pr.full_name, ub.badge_id
from public.user_badges ub
join public.profiles pr on pr.id = ub.user_id
where ub.badge_id between 74 and 79
order by ub.badge_id, pr.full_name;

-- ETTERPÅ: kjør scripts/backfill-deltakelse-merker.sql på nytt!
-- Sommerkonsert-eventet gir +1 deltakelse til 15 personer og kan løfte noen
-- over tersklene for Frøspire/Tre på rad/Ringrev/Maskin.
