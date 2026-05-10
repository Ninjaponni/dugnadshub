-- Plastdugnad: hopp over Sjåfør (14) og Stripser (15) merker ved completion
-- For plast-events skal vi senere ha egne merker (Vert, Søppelsjåfør)
-- Denne migrasjonen oppdaterer mark_event_completed til å sjekke event.type

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

  -- Hent event-type for å avgjøre badge-tildeling
  SELECT type INTO v_event_type FROM public.events WHERE id = p_event_id;

  -- Sett status til completed
  UPDATE public.events
  SET status = 'completed'
  WHERE id = p_event_id;

  -- Tildel sjåfør (14) og stripser (15) per driver_assignment
  -- Hopper over for plastdugnad — verter og søppelsjåfør får egne merker senere
  IF v_event_type != 'plast' THEN
    INSERT INTO public.user_badges (user_id, badge_id, event_id)
    SELECT
      user_id,
      CASE WHEN role = 'driver' THEN 14 ELSE 15 END,
      p_event_id
    FROM public.driver_assignments
    WHERE event_id = p_event_id
    ON CONFLICT (user_id, badge_id, event_id) DO NOTHING;
  END IF;

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
  -- Også hoppes over for plast (Førstemann gir ikke mening her)
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
END;
$$;
