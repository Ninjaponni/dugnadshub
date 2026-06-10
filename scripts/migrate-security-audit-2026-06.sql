-- Sikkerhetsaudit juni 2026 — to fikser:
--
-- 1) profiles manglet admin-policies for UPDATE/DELETE. Admin-UIets rollebytte
--    (admin/medlemmer) og profil-sletting skjer klient-side og traff 0 rader
--    stille fordi kun "eier kan oppdatere"-policyen fantes (med rolle-lås).
--    Vanlige brukere kan fortsatt IKKE endre egen rolle — den låsen beholdes.
--
-- 2) otp_codes får attempts-teller så verify-otp kan avvise etter 5 feilforsøk
--    (brute force-vern; 1s-forsinkelse alene stopper ikke parallelle kall).
--
-- Begge er additive og trygge å kjøre mens appen er live. Idempotent.

-- 1) Admin kan oppdatere og slette profiler
drop policy if exists "profiles: admin kan oppdatere" on public.profiles;
create policy "profiles: admin kan oppdatere" on public.profiles
  for update using (public.is_admin());

drop policy if exists "profiles: admin kan slette" on public.profiles;
create policy "profiles: admin kan slette" on public.profiles
  for delete using (public.is_admin());

-- 2) Forsøksteller på OTP-koder
alter table public.otp_codes add column if not exists attempts int not null default 0;

notify pgrst, 'reload schema';
