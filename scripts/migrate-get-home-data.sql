-- RPC: get_home_data — henter alt hjem-siden trenger i ett kall.
-- Erstatter 5 sekvensielle klient-spørringer (events → assignments → zones → claims → shifts).
-- SECURITY INVOKER: RLS gjelder fortsatt, så funksjonen kan aldri returnere mer enn
-- kalleren allerede kan lese. Alle tabellene under er fritt lesbare (using(true)).
-- p_user_id default NULL → bruker auth.uid(). Param finnes kun for offline-verifisering
-- (service-role-skript der auth.uid() er NULL). Klienten kaller ALLTID uten argument.

CREATE OR REPLACE FUNCTION get_home_data(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH uid AS (
    SELECT COALESCE(p_user_id, auth.uid()) AS id
  ),
  ev AS (
    SELECT id, title, type, date, start_time, area, status, signup_deadline
    FROM events
    WHERE status IN ('upcoming', 'active')
    ORDER BY date ASC
  ),
  assign AS (
    SELECT id, event_id, zone_id, status
    FROM zone_assignments
    WHERE event_id IN (SELECT id FROM ev)
  ),
  zn AS (
    SELECT id, name, area, collectors_needed
    FROM zones
  ),
  claims AS (
    SELECT zc.id, zc.assignment_id, zc.user_id, p.full_name
    FROM zone_claims zc
    LEFT JOIN profiles p ON p.id = zc.user_id
    WHERE zc.assignment_id IN (SELECT id FROM assign)
  ),
  shifts AS (
    SELECT s.event_id, s.capacity,
           (SELECT COUNT(*) FROM shift_claims sc WHERE sc.shift_id = s.id)::int AS claim_count
    FROM event_shifts s
    WHERE s.event_id IN (SELECT id FROM ev WHERE type = 'arrangement' AND status = 'active')
  )
  SELECT jsonb_build_object(
    'current_user_id', (SELECT id FROM uid),
    'profile',          (SELECT to_jsonb(p) FROM profiles p WHERE p.id = (SELECT id FROM uid)),
    'events',           COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM ev e), '[]'::jsonb),
    'zone_assignments', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM assign a), '[]'::jsonb),
    'zones',            COALESCE((SELECT jsonb_agg(to_jsonb(z)) FROM zn z), '[]'::jsonb),
    'zone_claims',      COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM claims c), '[]'::jsonb),
    'shift_data',       COALESCE((SELECT jsonb_agg(to_jsonb(sh)) FROM shifts sh), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION get_home_data(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
