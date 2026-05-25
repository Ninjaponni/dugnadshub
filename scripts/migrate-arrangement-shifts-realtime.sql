-- Legg event_shifts og shift_claims til supabase_realtime-publication
-- Uten dette fungerer ikke live-oppdatering av vakter (useRealtimeShifts-hook
-- får WebSocket-feil i loop, og brukere må refreshe for å se siste status).
-- Idempotent: hopper over hvis tabellen allerede er medlem.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_shifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_shifts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shift_claims'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_claims;
  END IF;
END $$;
