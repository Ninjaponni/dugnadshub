-- Migrasjon: Sjåfør/Stripser-merker per hendelse + idempotens
-- Kjørt 2026-04-27

-- Unik (user_id, badge_id, event_id) når event_id er satt — hindrer dobbel
-- tildeling hvis admin completer samme hendelse to ganger. Manuelle merker
-- uten event_id er fortsatt frie til å gis flere ganger.
CREATE UNIQUE INDEX IF NOT EXISTS user_badges_event_unique
  ON public.user_badges(user_id, badge_id, event_id)
  WHERE event_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
