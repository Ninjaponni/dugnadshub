-- Migrasjon: Fiks host-rollen i mark_event_completed + gjeninnfør sjåfør-GPS-cleanup.
-- Bakgrunn:
--   (a) migrate-plast-skip-driver-badges.sql introduserte v_event_type-grenen,
--       men host-rollen finnes ikke i profiles.role-CASE — en bruker som har
--       aktiv host-tilknytning på et annet plast-event havner på 'collector'
--       i stedet for 'host'. Inkonsistent med lib/driver/sync-role.ts.
--   (b) Samme migrasjon mistet location-cleanup-blokken fra
--       migrate-cleanup-driver-locations.sql (v8.3). Sjåfør-koordinater
--       (latitude, longitude, accuracy, ...) nullstilles ikke ved completion,
--       så GPS-data forblir i DB etter dugnaden. Personvern-issue.
-- Kjør i Supabase Dashboard SQL Editor. Idempotent.

CREATE OR REPLACE FUNCTION public.mark_event_completed(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  first_user_id uuid;
  v_event_type text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan markere hendelser som fullført';
  END IF;

  SELECT type INTO v_event_type FROM public.events WHERE id = p_event_id;

  UPDATE public.events
  SET status = 'completed'
  WHERE id = p_event_id;

  -- Tildel Sjåfør (14) og Stripser (15) per driver_assignment.
  -- Hopper over plast (egne merker som Plastminister gis manuelt/i evaluator).
  -- Host får IKKE Stripser-merket — eksplisitt utelatt.
  IF v_event_type != 'plast' THEN
    INSERT INTO public.user_badges (user_id, badge_id, event_id)
    SELECT
      user_id,
      CASE WHEN role = 'driver' THEN 14 ELSE 15 END,
      p_event_id
    FROM public.driver_assignments
    WHERE event_id = p_event_id
      AND role IN ('driver', 'strapper')
    ON CONFLICT (user_id, badge_id, event_id) DO NOTHING;
  END IF;

  -- Synk profiles.role for berørte brukere.
  -- Prioritet: admin > driver > strapper > host > collector.
  -- Matcher lib/driver/sync-role.ts-API-en.
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
        WHEN EXISTS (
          SELECT 1 FROM public.driver_assignments da
          JOIN public.events e ON e.id = da.event_id
          WHERE da.user_id = rec.user_id
            AND da.role = 'host'
            AND e.status != 'completed'
        ) THEN 'host'
        ELSE 'collector'
      END
    )
    WHERE id = rec.user_id;
  END LOOP;

  -- Recompute Førstemann (badge 28). Ikke for plast.
  IF v_event_type != 'plast' THEN
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
  END IF;

  -- Cleanup live-posisjon for sjåfører (v8.3 — gjeninnført etter regresjon).
  -- Personvern: GPS-koordinater skal ikke ligge igjen etter dugnaden.
  UPDATE public.driver_assignments
  SET latitude = NULL,
      longitude = NULL,
      accuracy = NULL,
      location_updated_at = NULL,
      location_sharing = FALSE
  WHERE event_id = p_event_id;
END;
$$;
