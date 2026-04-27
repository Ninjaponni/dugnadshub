-- Migrasjon: Fjern profiles.role-update fra base-RPC-er
-- Kjørt 2026-04-27 (v7.5)
--
-- Sync-role-API-et er eneste kilde til sannhet for profiles.role basert
-- på aktive driver_assignments (events.status != 'completed'). RPC-ene
-- skal bare skrive til driver_assignments-tabellen.

CREATE OR REPLACE FUNCTION public.claim_base_slot(
  p_event_id uuid,
  p_area text,
  p_role text,
  p_trailer_group int,
  p_slot_number int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.driver_assignments
    WHERE event_id = p_event_id AND area = p_area AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Du har allerede en plass i dette området';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.driver_assignments
    WHERE event_id = p_event_id AND area = p_area
      AND role = p_role AND trailer_group = p_trailer_group
      AND slot_number = p_slot_number
  ) THEN
    RAISE EXCEPTION 'Denne plassen er allerede tatt';
  END IF;

  INSERT INTO public.driver_assignments (event_id, user_id, area, role, trailer_group, slot_number)
  VALUES (p_event_id, auth.uid(), p_area, p_role, p_trailer_group, p_slot_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.unclaim_base_slot(
  p_event_id uuid,
  p_area text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.driver_assignments
  WHERE event_id = p_event_id AND area = p_area AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_claim_base_slot(
  p_event_id uuid,
  p_area text,
  p_role text,
  p_trailer_group int,
  p_slot_number int,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan tildele plasser';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.driver_assignments
    WHERE event_id = p_event_id AND area = p_area
      AND role = p_role AND trailer_group = p_trailer_group
      AND slot_number = p_slot_number
  ) THEN
    RAISE EXCEPTION 'Denne plassen er allerede tatt';
  END IF;

  DELETE FROM public.driver_assignments
  WHERE event_id = p_event_id AND area = p_area AND user_id = p_user_id;

  INSERT INTO public.driver_assignments (event_id, user_id, area, role, trailer_group, slot_number)
  VALUES (p_event_id, p_user_id, p_area, p_role, p_trailer_group, p_slot_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unclaim_base_slot(
  p_event_id uuid,
  p_area text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan fjerne plasser';
  END IF;

  DELETE FROM public.driver_assignments
  WHERE event_id = p_event_id AND area = p_area AND user_id = p_user_id;
END;
$$;
