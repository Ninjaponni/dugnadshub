-- Base-påmelding: Sjåfører og stripsere kan melde seg via kart-markør
-- Kjør i Supabase SQL Editor

-- ============================================================
-- 1. Utvid driver_assignments med role og slot_number
-- ============================================================

ALTER TABLE public.driver_assignments
  ADD COLUMN role text NOT NULL DEFAULT 'driver' CHECK (role IN ('driver', 'strapper')),
  ADD COLUMN slot_number int NOT NULL DEFAULT 1;

-- Unik kombinasjon: én person per rolle/henger/plass per hendelse og område
ALTER TABLE public.driver_assignments
  ADD CONSTRAINT driver_assignments_unique
  UNIQUE (event_id, area, role, trailer_group, slot_number);

-- RLS allerede enabled med lesepolicy fra migration.sql
-- Skriving skjer kun via SECURITY DEFINER RPCer nedenfor

-- ============================================================
-- 2. RPC: claim_base_slot — meld deg som sjåfør/stripser
-- ============================================================

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
  -- Sjekk at brukeren ikke allerede har en base-plass for dette event+area
  IF EXISTS (
    SELECT 1 FROM public.driver_assignments
    WHERE event_id = p_event_id AND area = p_area AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Du har allerede en plass i dette området';
  END IF;

  -- Sjekk at plassen er ledig
  IF EXISTS (
    SELECT 1 FROM public.driver_assignments
    WHERE event_id = p_event_id AND area = p_area
      AND role = p_role AND trailer_group = p_trailer_group
      AND slot_number = p_slot_number
  ) THEN
    RAISE EXCEPTION 'Denne plassen er allerede tatt';
  END IF;

  -- Sett inn
  INSERT INTO public.driver_assignments (event_id, user_id, area, role, trailer_group, slot_number)
  VALUES (p_event_id, auth.uid(), p_area, p_role, p_trailer_group, p_slot_number);

  -- Oppdater profil-rolle (bevar admin-rolle)
  UPDATE public.profiles SET role = p_role
  WHERE id = auth.uid() AND role NOT IN ('admin');
END;
$$;

-- ============================================================
-- 3. RPC: unclaim_base_slot — gi opp plassen
-- ============================================================

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

  -- Tilbake til collector (bevar admin, og kun hvis ingen andre plasser)
  IF NOT EXISTS (
    SELECT 1 FROM public.driver_assignments WHERE user_id = auth.uid()
  ) THEN
    UPDATE public.profiles SET role = 'collector'
    WHERE id = auth.uid() AND role NOT IN ('admin');
  END IF;
END;
$$;

-- ============================================================
-- 4. RPC: admin_claim_base_slot — admin tildeler bruker
-- ============================================================

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
  -- Admin-sjekk
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan tildele plasser';
  END IF;

  -- Sjekk at plassen er ledig
  IF EXISTS (
    SELECT 1 FROM public.driver_assignments
    WHERE event_id = p_event_id AND area = p_area
      AND role = p_role AND trailer_group = p_trailer_group
      AND slot_number = p_slot_number
  ) THEN
    RAISE EXCEPTION 'Denne plassen er allerede tatt';
  END IF;

  -- Fjern eventuell eksisterende plass for brukeren i dette event+area
  DELETE FROM public.driver_assignments
  WHERE event_id = p_event_id AND area = p_area AND user_id = p_user_id;

  -- Sett inn
  INSERT INTO public.driver_assignments (event_id, user_id, area, role, trailer_group, slot_number)
  VALUES (p_event_id, p_user_id, p_area, p_role, p_trailer_group, p_slot_number);

  -- Oppdater profil-rolle (bevar admin-rolle)
  UPDATE public.profiles SET role = p_role
  WHERE id = p_user_id AND role NOT IN ('admin');
END;
$$;

-- ============================================================
-- 5. RPC: admin_unclaim_base_slot — admin fjerner bruker
-- ============================================================

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
  -- Admin-sjekk
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan fjerne plasser';
  END IF;

  DELETE FROM public.driver_assignments
  WHERE event_id = p_event_id AND area = p_area AND user_id = p_user_id;

  -- Tilbake til collector (bevar admin, og kun hvis ingen andre plasser)
  IF NOT EXISTS (
    SELECT 1 FROM public.driver_assignments WHERE user_id = p_user_id
  ) THEN
    UPDATE public.profiles SET role = 'collector'
    WHERE id = p_user_id AND role NOT IN ('admin');
  END IF;
END;
$$;
