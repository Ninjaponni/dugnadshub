-- Admin-policies for event_shifts og shift_claims
-- Lar admins skrive til vaktene fra klienten via is_admin()-bypass.
-- Idempotent: trygt å kjøre om policies allerede finnes (DROP POLICY IF EXISTS).
-- Avhenger av at public.is_admin() finnes (lagt til av migrate-admin-assign.sql).

-- event_shifts: admin kan opprette, oppdatere og slette vakter
DROP POLICY IF EXISTS "event_shifts admin write" ON event_shifts;
CREATE POLICY "event_shifts admin write" ON event_shifts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- shift_claims: admin kan se og slette alle claims (eksisterende egne-claims-policies beholdes)
DROP POLICY IF EXISTS "shift_claims admin all" ON shift_claims;
CREATE POLICY "shift_claims admin all" ON shift_claims
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';
