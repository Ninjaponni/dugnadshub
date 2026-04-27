-- Migrasjon: Aktivér Supabase Realtime for kart og hendelser
-- Kjørt 2026-04-28 (v8.2)
--
-- Når disse tabellene er i supabase_realtime-publication, sender Postgres
-- en endring-event til alle abonnerte klienter ved INSERT/UPDATE/DELETE.
-- useRealtimeZones-hooken er allerede konfigurert til å lytte — den slår på
-- av seg selv så snart Realtime er aktivert på tabellene.
--
-- Idempotent — DO-block hopper over tabeller som allerede er medlem av
-- publication, slik at scriptet kan kjøres flere ganger uten feil.

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.zone_claims;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.zone_assignments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_assignments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
