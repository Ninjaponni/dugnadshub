-- Atomisk RPC for å hindre race condition ved samtidig påmelding
-- Bruker FOR UPDATE-lås på event_shifts-raden så count+insert blir én transaksjon

CREATE OR REPLACE FUNCTION claim_shift_atomic(p_shift_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity int;
  v_count int;
  v_deadline timestamptz;
BEGIN
  -- Hent capacity + signup_deadline, og lås raden så ingen andre kan endre count samtidig
  SELECT s.capacity, e.signup_deadline INTO v_capacity, v_deadline
  FROM event_shifts s
  JOIN events e ON e.id = s.event_id
  WHERE s.id = p_shift_id
  FOR UPDATE OF s;

  IF v_capacity IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vakt finnes ikke', 'code', 'not_found');
  END IF;

  IF v_deadline IS NOT NULL AND v_deadline < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Påmeldingsfrist passert', 'code', 'deadline_passed');
  END IF;

  SELECT COUNT(*) INTO v_count FROM shift_claims WHERE shift_id = p_shift_id;

  IF v_count >= v_capacity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vakta er full', 'code', 'full');
  END IF;

  BEGIN
    INSERT INTO shift_claims (shift_id, user_id) VALUES (p_shift_id, p_user_id);
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Du er allerede påmeldt', 'code', 'duplicate');
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION claim_shift_atomic(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
