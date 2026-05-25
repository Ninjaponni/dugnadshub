-- Migrasjon for arrangement-vakter (Fotball VM-pilot)
-- Idempotent: trygt å kjøre flere ganger

-- 1. Utvid events.type CHECK med 'arrangement'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_type_check') THEN
    ALTER TABLE events DROP CONSTRAINT events_type_check;
  END IF;
END $$;

ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('bottle_collection','lapper','lottery','baking','other','plast','arrangement'));

-- 2. Nye kolonner på events
ALTER TABLE events ADD COLUMN IF NOT EXISTS signup_deadline timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS role_info jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS general_info jsonb;

-- 3. event_shifts
CREATE TABLE IF NOT EXISTS event_shifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role          text NOT NULL,
  shift_date    date NOT NULL,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  capacity      int NOT NULL CHECK (capacity > 0),
  notes         text,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_shifts_event ON event_shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_shifts_date ON event_shifts(shift_date);

-- 4. shift_claims
CREATE TABLE IF NOT EXISTS shift_claims (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    uuid NOT NULL REFERENCES event_shifts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claimed_at  timestamptz DEFAULT now(),
  UNIQUE (shift_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shift_claims_shift ON shift_claims(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_claims_user ON shift_claims(user_id);

-- 5. RLS
ALTER TABLE event_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_shifts read" ON event_shifts;
CREATE POLICY "event_shifts read" ON event_shifts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shift_claims read" ON shift_claims;
CREATE POLICY "shift_claims read" ON shift_claims FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shift_claims insert own" ON shift_claims;
CREATE POLICY "shift_claims insert own" ON shift_claims FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shift_claims delete own" ON shift_claims;
CREATE POLICY "shift_claims delete own" ON shift_claims FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'event_shifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_shifts;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shift_claims'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shift_claims;
  END IF;
END $$;

-- 7. Schema cache reload
NOTIFY pgrst, 'reload schema';
