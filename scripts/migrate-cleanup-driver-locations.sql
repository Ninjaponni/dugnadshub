-- Migrasjon: Cleanup av sjåfør-posisjoner ved completion
-- Kjørt 2026-04-28 (v8.3)
--
-- Utvider mark_event_completed med å nullstille latitude/longitude/location_sharing
-- på alle driver_assignments for hendelsen. Sikrer at posisjon ikke ligger igjen
-- etter dugnaden er ferdig — privatliv og rydding i én og samme transaksjon.
--
-- Krever at migrate-driver-location.sql er kjørt først (kolonnene må eksistere).
-- Idempotent — CREATE OR REPLACE FUNCTION.

CREATE OR REPLACE FUNCTION public.mark_event_completed(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  first_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan markere hendelser som fullført';
  END IF;

  -- Sett status til completed
  UPDATE public.events
  SET status = 'completed'
  WHERE id = p_event_id;

  -- Tildel sjåfør (14) og stripser (15) per driver_assignment
  -- Idempotent via unique partial index på (user_id, badge_id, event_id)
  INSERT INTO public.user_badges (user_id, badge_id, event_id)
  SELECT
    user_id,
    CASE WHEN role = 'driver' THEN 14 ELSE 15 END,
    p_event_id
  FROM public.driver_assignments
  WHERE event_id = p_event_id
  ON CONFLICT (user_id, badge_id, event_id) DO NOTHING;

  -- Synker profiles.role for alle berørte brukere
  -- Tilbakestill til 'collector' med mindre de har andre aktive driver_assignments
  -- Aldri rør admin
  FOR rec IN
    SELECT DISTINCT user_id FROM public.driver_assignments WHERE event_id = p_event_id
  LOOP
    UPDATE public.profiles
    SET role = (
      CASE
        WHEN role = 'admin' THEN 'admin'
        WHEN EXISTS (
          SELECT 1 FROM public.driver_assignments da
          JOIN public.events e ON e.id = da.event_id
          WHERE da.user_id = rec.user_id
            AND da.role = 'driver'
            AND e.status != 'completed'
        ) THEN 'driver'
        WHEN EXISTS (
          SELECT 1 FROM public.driver_assignments da
          JOIN public.events e ON e.id = da.event_id
          WHERE da.user_id = rec.user_id
            AND da.role = 'strapper'
            AND e.status != 'completed'
        ) THEN 'strapper'
        ELSE 'collector'
      END
    )
    WHERE id = rec.user_id;
  END LOOP;

  -- Recompute Førstemann (badge 28) — den med tidligst zone_claim
  DELETE FROM public.user_badges WHERE badge_id = 28 AND event_id = p_event_id;

  SELECT zc.user_id INTO first_user_id
  FROM public.zone_claims zc
  JOIN public.zone_assignments za ON za.id = zc.assignment_id
  WHERE za.event_id = p_event_id
  ORDER BY zc.claimed_at ASC
  LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id, event_id)
    VALUES (first_user_id, 28, p_event_id);
  END IF;

  -- Cleanup live-posisjon for sjåfører (v8.3)
  -- Privatliv: posisjon skal aldri ligge igjen etter dugnaden er ferdig
  UPDATE public.driver_assignments
  SET latitude = NULL,
      longitude = NULL,
      accuracy = NULL,
      location_updated_at = NULL,
      location_sharing = FALSE
  WHERE event_id = p_event_id;
END;
$$;
