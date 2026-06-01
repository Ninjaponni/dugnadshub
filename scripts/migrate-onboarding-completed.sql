-- Onboarding-status mot DB, så Safari ITP-purge av localStorage ikke trigger
-- onboarding på nytt etter inaktivitet i PWA.
-- Backfilles for alle eksisterende profiler med full_name siden de allerede
-- har fullført registrering minst én gang.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Backfill eksisterende brukere: alle med full_name antas å være ferdig
UPDATE profiles
SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at)
WHERE full_name IS NOT NULL
  AND onboarding_completed_at IS NULL;
