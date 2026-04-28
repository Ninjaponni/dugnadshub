-- Migrasjon: Live GPS for sjåfører
-- Kjørt 2026-04-28 (v8.3)
--
-- Legger til posisjons-felter på driver_assignments slik at sjåfører kan dele
-- live-posisjon under aktive flaskeinnsamlinger. Synlig på kartet for alle
-- innloggede brukere via Realtime (allerede aktivert i v8.2).
--
-- Idempotent — IF NOT EXISTS hopper over hvis allerede kjørt.

ALTER TABLE public.driver_assignments
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS accuracy REAL,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_sharing BOOLEAN NOT NULL DEFAULT FALSE;

-- Indekser for raskere kart-queries (filtrering på event + active sharing)
CREATE INDEX IF NOT EXISTS idx_driver_assignments_event_sharing
  ON public.driver_assignments (event_id, location_sharing)
  WHERE location_sharing = TRUE;

-- Tving PostgREST til å oppdatere schema-cachen
NOTIFY pgrst, 'reload schema';
