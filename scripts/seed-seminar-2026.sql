-- Korpsseminar 25.–27.09.2026 (Tonstad skole) — foreldrevakter som arrangement-event
-- Idempotent: trygt å kjøre flere ganger. Forutsetter migrate-arrangement-program.sql.
-- Eventet opprettes som 'upcoming' og UTEN push ved aktivering.
-- NB: 'upcoming' skjuler det kun fra forsiden. Det vises i Vakter-menyen på desktop og kan
-- åpnes via direkte lenke, og påmelding virker med en gang (RPC-en sjekker kun fristen).
-- Kjør derfor skriptet først når påmeldingen kan åpnes, og sett status til 'active' i admin.

-- 1) Event — rolleoppgavene er hentet fra «Foreldrevaktinstruks for overnattingsseminar» (styret).
--    «Alle foreldrevakter» er en felles oppgaveliste uten egne vakter (gir ingen kolonne i vaktplanen).
--    Fellespunktene er også lagt sist på hver rolle, siden vakt-arket bare viser oppgavene for vaktas rolle.
insert into public.events (
  title, type, date, start_time, end_time, status, area, description,
  signup_deadline, send_push_on_activate, meeting_point, role_info, general_info, program
)
select
  'Korpsseminar – foreldrevakter',
  'arrangement',
  '2026-09-25', '18:00', null,
  'upcoming',
  'begge',
  'Helgeseminar for hovedkorps og juniorkorps på Tonstad skole, 25.–27. september. Vi trenger foreldre som kveldsvakter, nattevakter og dagvakter. En fra styret er alltid til stede sammen med dere. Velg vakta som passer – hver vakt gjør helga mulig for ungene.',
  timestamp '2026-09-23 23:59' at time zone 'Europe/Oslo',
  false,
  '{"name": "Tonstad skole"}'::jsonb,
  '[
    {"role": "Alle foreldrevakter", "tasks": [
      "Føre logg underveis i vakta",
      "Sørge for at nøkler ikke brukes av uvedkommende",
      "Bistå med å holde ro under øvelsene",
      "Sørge for at ordensregler følges og at alle har det fint på seminar",
      "Mobilhotell"
    ]},
    {"role": "Dagvakt", "tasks": [
      "Vekke musikantene",
      "Sette frem frokost: brød, pålegg, melk og juice – allergivennlig buffet på eget bord",
      "Lørdag: krysse av for oppmøtte JK-musikanter, og be bringende foreldre om å hjelpe til med innlosjering",
      "Lørdag: sette frem frukt til pausene",
      "Lørdag: lage lunsj – middagsrester fra dagen før, brød, pålegg, melk og juice",
      "Søndag: rydde og pakke",
      "Søndag: sette opp foreldrekiosk (godt synlig ved henting)",
      "Føre logg underveis i vakta",
      "Sørge for at nøkler ikke brukes av uvedkommende",
      "Bistå med å holde ro under øvelsene",
      "Sørge for at ordensregler følges og at alle har det fint på seminar",
      "Mobilhotell"
    ]},
    {"role": "Kveldsvakt", "tasks": [
      "Fredag: krysse av for oppmøtte HK-musikanter, og be bringende foreldre om å hjelpe til med innlosjering",
      "Sørge for middag",
      "Fredag: bistå HK i å lage taco (og rydde opp)",
      "Lørdag: bestille/hente pizza",
      "Føre logg underveis i vakta",
      "Sørge for at nøkler ikke brukes av uvedkommende",
      "Bistå med å holde ro under øvelsene",
      "Sørge for at ordensregler følges og at alle har det fint på seminar",
      "Mobilhotell"
    ]},
    {"role": "Nattevakt", "tasks": [
      "Minst én nattevakt skal være våken til enhver tid",
      "Klargjøre frokost: legge opp pålegg på fat og sette klart riktig antall asjetter, glass og bestikk",
      "Natt til lørdag: merk pålegg ment for allergikere godt",
      "Skjære opp «passe mengde» frukt til fruktpausene",
      "Føre logg underveis i vakta",
      "Sørge for at nøkler ikke brukes av uvedkommende",
      "Bistå med å holde ro under øvelsene",
      "Sørge for at ordensregler følges og at alle har det fint på seminar",
      "Mobilhotell"
    ]}
  ]'::jsonb,
  '[
    {"label": "Sted", "value": "Tonstad skole"},
    {"label": "Styrevakt", "value": "En fra styret er til stede på hver vakt. Navnet står på vakta."},
    {"label": "Ved oppmøte", "value": "Alle foreldre oppfordres til å hjelpe sin(e) musikant(er) til å finne sin soveplass og evt. utpakking."},
    {"label": "Søndag kl. 15:00", "value": "Alle foreldre oppfordres til å komme og hjelpe med pakking og rydding."}
  ]'::jsonb,
  '[
    {"date": "2026-09-25", "label": "Fredag", "items": [
      {"time": "18:00", "hk": "Oppmøte og innkvartering"},
      {"time": "19:30", "hk": "Taco", "note": "Foreldrevakt + gutta i HK lager taco, jentene dekker bord og rydder etterpå"},
      {"time": "20:30", "hk": "Sosialt"},
      {"time": "21:00", "hk": "Mobiltid til kl. 22:00"},
      {"time": "23:00", "hk": "Nattero"}
    ]},
    {"date": "2026-09-26", "label": "Lørdag", "items": [
      {"time": "09:00", "hk": "Revelje"},
      {"time": "09:30", "hk": "Frokost"},
      {"time": "10:00", "jk": "Oppmøte og innkvartering"},
      {"time": "11:00", "hk": "Gruppeøvinger med instruktør", "jk": "Øving"},
      {"time": "11:45", "hk": "Fruktpause", "jk": "Fruktpause"},
      {"time": "12:00", "hk": "Gruppeøvinger med instruktør", "jk": "Aktivitet junior"},
      {"time": "12:30", "hk": "Lunsj", "jk": "Lunsj"},
      {"time": "13:00", "hk": "Gruppeøvinger med instruktør", "jk": "Øving"},
      {"time": "13:45", "hk": "Fruktpause", "jk": "Fruktpause"},
      {"time": "14:00", "hk": "Gruppeøvinger med instruktør", "jk": "Øving"},
      {"time": "14:45", "hk": "Fruktpause", "jk": "Fruktpause", "note": "Butikktur junior? Foreldrevakter bistår"},
      {"time": "15:00", "hk": "Øving", "jk": "Aktivitet junior"},
      {"time": "15:45", "hk": "Pause", "jk": "Pause"},
      {"time": "16:00", "hk": "Rekvisittlaging, scenografi og dans", "jk": "Rekvisittlaging, scenografi og dans"},
      {"time": "18:00", "hk": "Pizza", "jk": "Pizza"},
      {"time": "19:00", "hk": "Sosialt samvær", "jk": "Sosialt samvær", "note": "Rebusløp arrangeres av juniorstyret"},
      {"time": "20:00", "hk": "Mobiltid til kl. 21:00", "jk": "Mobiltid til kl. 21:00"},
      {"time": "23:00", "hk": "Nattero", "jk": "Nattero"}
    ]},
    {"date": "2026-09-27", "label": "Søndag", "items": [
      {"time": "09:00", "hk": "Revelje", "jk": "Revelje"},
      {"time": "09:30", "hk": "Frokost", "jk": "Frokost"},
      {"time": "11:00", "hk": "Øving", "jk": "Øving"},
      {"time": "12:00", "hk": "Lunsj", "jk": "Lunsj"},
      {"time": "12:30", "hk": "Øving / rekvisittlaging, scenografi og dans", "jk": "Øving"},
      {"time": "13:45", "hk": "Pause", "jk": "Pause"},
      {"time": "14:00", "hk": "Fellesøving HK/JK", "jk": "Fellesøving HK/JK"},
      {"time": "15:00", "hk": "Hjemreise", "jk": "Hjemreise", "note": "Foreldre oppfordres til å komme og bistå med pakking og rydding"}
    ]}
  ]'::jsonb
where not exists (
  select 1 from public.events where title = 'Korpsseminar – foreldrevakter'
);

-- 2) Vakter (kun hvis eventet ikke har vakter fra før)
with ev as (
  select id from public.events where title = 'Korpsseminar – foreldrevakter' limit 1
)
insert into public.event_shifts (event_id, role, shift_date, start_time, end_time, capacity, notes)
select ev.id, v.role, v.shift_date::date, v.start_time::time, v.end_time::time, v.capacity, v.notes
from ev, (values
  ('Kveldsvakt', '2026-09-25', '18:00', '23:00', 2, 'Styrevakt: Irun Walberg'),
  ('Nattevakt',  '2026-09-25', '23:00', '07:30', 2, null),
  ('Dagvakt',    '2026-09-26', '07:30', '16:00', 4, 'Styrevakt: Remi Bakke'),
  ('Kveldsvakt', '2026-09-26', '16:00', '23:00', 4, 'Styrevakt: Edel Askim'),
  ('Nattevakt',  '2026-09-26', '23:00', '07:30', 3, null),
  ('Dagvakt',    '2026-09-27', '07:30', '15:00', 4, 'Styrevakt: Alfhild Eide')
) as v(role, shift_date, start_time, end_time, capacity, notes)
where not exists (
  select 1 from public.event_shifts s where s.event_id = ev.id
);

-- 3) Forhåndspåmeldte fra regnearket — matchet på fullt navn (uten hensyn til store/små bokstaver).
--    Hoppes over hvis navnet ikke finnes eller treffer flere profiler; se rapport 4b.
--    Kjøres kun så lenge eventet ikke har noen påmeldinger, så en re-kjøring ikke
--    melder på igjen noen som har meldt seg av.
--    NB: direkte insert omgår kapasitetssjekken i claim_shift_atomic — ikke legg til
--    flere navn enn vakta har plass til.
with ev as (
  select id from public.events where title = 'Korpsseminar – foreldrevakter' limit 1
),
forhand (navn, role, shift_date) as (
  values
    ('Synnøve Løberg',   'Kveldsvakt', '2026-09-25'),
    ('Jan Åge Heggvik',  'Kveldsvakt', '2026-09-25'),
    ('Tove Myrhaug',     'Dagvakt',    '2026-09-26')
),
treff as (
  select f.navn, f.role, f.shift_date, min(p.id::text)::uuid as user_id, count(p.id) as antall
  from forhand f
  left join public.profiles p on lower(trim(p.full_name)) = lower(f.navn)
  group by f.navn, f.role, f.shift_date
)
insert into public.shift_claims (shift_id, user_id)
select s.id, t.user_id
from treff t
join ev on true
join public.event_shifts s
  on s.event_id = ev.id and s.role = t.role and s.shift_date = t.shift_date::date
where t.antall = 1
  and not exists (
    select 1 from public.shift_claims c2
    join public.event_shifts s2 on s2.id = c2.shift_id
    where s2.event_id = ev.id
  )
on conflict (shift_id, user_id) do nothing;

-- 4) Rapport — sjekk at alt ble som forventet
with ev as (
  select id from public.events where title = 'Korpsseminar – foreldrevakter' limit 1
)
select
  s.shift_date, s.start_time, s.end_time, s.role, s.capacity, s.notes,
  count(c.id) as pameldte,
  coalesce(string_agg(p.full_name, ', ' order by p.full_name), '') as navn
from public.event_shifts s
join ev on s.event_id = ev.id
left join public.shift_claims c on c.shift_id = s.id
left join public.profiles p on p.id = c.user_id
group by s.id
order by s.shift_date, s.start_time;

-- 4b) Forhåndsnavn som IKKE ble entydig matchet mot profiles (0 = finnes ikke, >1 = flere treff).
--     Tom liste = alle tre ble funnet. Disse må ellers melde seg på selv.
select f.navn, count(p.id) as antall_treff
from (values ('Synnøve Løberg'), ('Jan Åge Heggvik'), ('Tove Myrhaug')) as f(navn)
left join public.profiles p on lower(trim(p.full_name)) = lower(f.navn)
group by f.navn
having count(p.id) <> 1;
