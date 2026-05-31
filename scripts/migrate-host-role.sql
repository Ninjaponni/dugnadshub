-- Migrasjon: Legg til 'host' som rolle for verter på plastdugnader
-- Bakgrunn: MeetingPointSheet brukte tidligere role='strapper' for Vert 1/Vert 2
-- på plast, fordi 'host' ikke fantes som rolle. Det ga skjult kobling: en vert
-- på plast fikk profiles.role='strapper' og kunne mottatt push ment for
-- stripsere på flaskeinnsamling hvis begge events var åpne samtidig.
-- Kjør i Supabase Dashboard SQL Editor.

BEGIN;

-- 1. Tillat 'host' i driver_assignments
ALTER TABLE driver_assignments DROP CONSTRAINT driver_assignments_role_check;
ALTER TABLE driver_assignments ADD CONSTRAINT driver_assignments_role_check
  CHECK (role IN ('driver','strapper','host'));

-- 2. Tillat 'host' i profiles
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin','collector','driver','strapper','host'));

-- 3. Migrer historiske plast-verter: alle strapper-rader på plast-events → host
UPDATE driver_assignments da
SET role = 'host'
WHERE role = 'strapper'
  AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = da.event_id AND e.type = 'plast'
  );

-- 4. Synker profiles.role for de som nå bare har 'host' aktivt
-- (eks. Tor Martin og Irun fra Plastdugnad 2026 — Tor Martin er admin og skal
-- ikke endres, Irun er collector etter at plast ble completed, så ingen no-op
-- for dem. Tar med dette for fremtidige cases der host er eneste aktive rolle.)
UPDATE profiles p
SET role = 'host'
WHERE role = 'strapper'
  AND NOT EXISTS (
    SELECT 1 FROM driver_assignments da
    JOIN events e ON e.id = da.event_id
    WHERE da.user_id = p.id
      AND da.role = 'strapper'
      AND e.status IN ('upcoming','active')
  )
  AND EXISTS (
    SELECT 1 FROM driver_assignments da
    JOIN events e ON e.id = da.event_id
    WHERE da.user_id = p.id
      AND da.role = 'host'
      AND e.status IN ('upcoming','active')
  );

COMMIT;
