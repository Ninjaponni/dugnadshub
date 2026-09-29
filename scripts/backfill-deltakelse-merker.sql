-- Reserve: del ut terskelmerkene Frøspire (1), Tre på rad (4), Ringrev (8) og
-- Maskin (12) til alle som kvalifiserer. Siden 2026-09-28 ligger logikken i
-- databasen (scripts/migrate-deltakelsesmerker-i-db.sql) og kjøres automatisk
-- ved Fullfør, via "Oppdater merker" og når event-koblede deltakelsesmerker
-- settes inn (trigger). Dette skriptet trengs bare hvis noe likevel har glippet.
-- Idempotent: gir 0 rader når alle er oppdatert. Sletter aldri.

select u.badge_id, b.name as merke, p.full_name
from public.award_participation_badges(null) u
join public.badges b on b.id = u.badge_id
join public.profiles p on p.id = u.user_id
order by u.badge_id, p.full_name;
