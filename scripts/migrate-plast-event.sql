-- Plastdugnad event-type + ad-hoc soner + musikantliste + push-toggle
-- Idempotent: kan kjøres flere ganger trygt
-- Kjøres via Supabase Dashboard SQL Editor

-- 1. Utvid events.type CHECK med 'plast'
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'events'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%type%bottle_collection%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.events
  ADD CONSTRAINT events_type_check
  CHECK (type IN ('bottle_collection','lapper','lottery','baking','plast','other'));

-- 2. Utvid zones.zone_type CHECK med 'plast'
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'zones'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%zone_type%bottle%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.zones DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.zones
  ADD CONSTRAINT zones_zone_type_check
  CHECK (zone_type IN ('bottle','lapper','plast'));

-- 3. Plast-soner kobles til event direkte (ad-hoc per dugnad)
ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_zones_event_id ON public.zones(event_id) WHERE event_id IS NOT NULL;

-- 4. zones.target_group — hvilken orkestergruppe sona er for (kun plast)
ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS target_group TEXT;

-- 5. events.meeting_point JSONB { lng, lat, name, description? }
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS meeting_point JSONB;

-- 6. events.send_push_on_activate — toggle for å undertrykke push under testing
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS send_push_on_activate BOOLEAN NOT NULL DEFAULT TRUE;

-- 7. Ny tabell: event_musicians (musikant-fordeling per event)
CREATE TABLE IF NOT EXISTS public.event_musicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_name TEXT,
  instrument TEXT,
  zone_id TEXT REFERENCES public.zones(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  attendance TEXT NOT NULL DEFAULT 'expected'
    CHECK (attendance IN ('expected','attended','absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, name)
);

CREATE INDEX IF NOT EXISTS idx_event_musicians_event_id ON public.event_musicians(event_id);
CREATE INDEX IF NOT EXISTS idx_event_musicians_zone_id ON public.event_musicians(zone_id);

ALTER TABLE public.event_musicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_musicians_select_all" ON public.event_musicians;
CREATE POLICY "event_musicians_select_all" ON public.event_musicians
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "event_musicians_admin_all" ON public.event_musicians;
CREATE POLICY "event_musicians_admin_all" ON public.event_musicians
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 8. Aktiver realtime for event_musicians
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'event_musicians'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_musicians';
  END IF;
END $$;

-- 9. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
