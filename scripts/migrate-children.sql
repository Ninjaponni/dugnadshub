-- Migrasjon: Flere barn per forelder (JSONB)
-- Kjørt 2026-04-06

-- Legg til children jsonb-kolonne
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS children jsonb DEFAULT '[]'::jsonb;

-- Migrer eksisterende data fra child_name/child_group til children array
UPDATE public.profiles
SET children = jsonb_build_array(jsonb_build_object('name', child_name, 'group', child_group))
WHERE child_name IS NOT NULL AND child_name != '';

-- Fjern gamle kolonner
ALTER TABLE public.profiles DROP COLUMN IF EXISTS child_name;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS child_group;
