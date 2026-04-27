-- Migrasjon: Musikanter kan logge inn med egen profil
-- Kjørt 2026-04-27

-- Legg til felt for musikant-status og gruppe
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_musician boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS musician_group text
  CHECK (musician_group IN ('Aspirant', 'Junior', 'Hovedkorps'));

-- Reload schema cache slik at REST API ser de nye kolonnene
NOTIFY pgrst, 'reload schema';
