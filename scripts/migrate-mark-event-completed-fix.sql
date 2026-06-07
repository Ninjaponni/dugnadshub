-- Fix mark_event_completed for arrangement-events (2026-06-07)
--
-- Bug: ON CONFLICT (user_id, badge_id, event_id) krever en matchende UNIQUE constraint
-- eller index. user_badges har bare en PARTIAL unique index (WHERE event_id IS NOT NULL),
-- og PostgreSQL aksepterer den bare hvis ON CONFLICT-spec inkluderer samme WHERE-klausul.
--
-- Symptom: Neonfestivalen (type=arrangement) feilet med 42P10 "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification". Plast/bottle/lapper
-- har fungert tidligere — uklart hvorfor, men bytter uansett til catch-all.
--
-- Fix: bruk ON CONFLICT DO NOTHING uten kolonnespesifikasjon. Det krever ingen
-- spesifikk constraint og duplikat-håndteres av den partial index'en uansett.

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
  -- Idempotent via partial unique index (user_id, badge_id, event_id) WHERE event_id IS NOT NULL
  INSERT INTO public.user_badges (user_id, badge_id, event_id)
  SELECT
    user_id,
    CASE WHEN role = 'driver' THEN 14 ELSE 15 END,
    p_event_id
  FROM public.driver_assignments
  WHERE event_id = p_event_id
  ON CONFLICT DO NOTHING;

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
END;
$$;
