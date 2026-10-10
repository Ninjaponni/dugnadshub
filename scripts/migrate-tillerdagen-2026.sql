-- Tillerdagen 10.10.2026 (Tillerparken): nytt aktivitetsmerke + hendelse + tildeling
-- Merke id 85 «Bidro på Tillerdagen», kategori aktivitet (kan stables).
-- Hendelsen opprettes direkte som 'completed' uten push. Den har ingen vakter eller soner,
-- så mark_event_completed har ingenting å gjøre her. Merkene gis med event_id, slik at
-- triggeren user_badges_award_participation teller Tillerdagen som én fullført dugnad
-- (Frøspire/Tre på rad/Ringrev/Maskin).
-- Idempotent: trygt å kjøre flere ganger. Kjørt i prod 2026-10-10.

insert into public.badges (id, name, description, icon, category, auto_criteria) values
  (85, 'Bidro på Tillerdagen', 'Bidro på Tillerdagen i Tillerparken', '/badges/tillerdagen.png', 'aktivitet', null)
on conflict (id) do nothing;

insert into public.events (title, type, date, status, area, description, send_push_on_activate)
select 'Tillerdagen 2026', 'arrangement', '2026-10-10', 'completed', 'begge',
       'Nærmiljøfestival i Tillerparken. Korpset bidro på dugnaden.', false
where not exists (select 1 from public.events where title = 'Tillerdagen 2026');

-- Tildeling: Alfhild Lien Eide og Synnøve Løberg
insert into public.user_badges (user_id, badge_id, event_id)
select p.id, 85, e.id
from public.profiles p
cross join (select id from public.events where title = 'Tillerdagen 2026') e
where p.id in ('335fcaca-0577-4497-b414-319e219cd5da', '985a348a-6f72-4c0d-bfed-7813a52ce63f')
  and not exists (
    select 1 from public.user_badges ub
    where ub.user_id = p.id and ub.badge_id = 85 and ub.event_id = e.id
  );

notify pgrst, 'reload schema';
