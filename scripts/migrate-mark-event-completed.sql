-- Migrasjon: Atomisk RPC for å markere hendelse som fullført
-- Kjørt 2026-04-27 (v7.9)
--
-- Erstatter klient-flyten der admin/hendelser-page.tsx satte status og deretter
-- gjorde tre separate fetch-kall (badges, finalize-drivers, recompute-first-user).
-- Den flyten kunne feile silently hvis service worker hadde cachet gammel JS
-- eller fetch-en feilet — vi så det skje på Flaskeinnsamling Sør 27. april 2026.
--
-- Nå er alt i én transaksjon: status-endring + sjåfør/stripser-merker +
-- rolle-synking + Førstemann-recompute.

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
END;
$$;
