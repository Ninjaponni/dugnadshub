-- Tester-tilbakemeldinger: Andreas (sikkerhet) + Irun (UX)
-- + oppfølgingsfikser v5.2–5.4
-- Kjør i Supabase SQL Editor

-- 1. KRITISK: RLS-policy som hindrer rolleendring via direkte API-kall
-- Gammel policy: auth.uid() = id uten feltrestriksjoner → bruker kan sette role: 'admin'
drop policy if exists "profiles: eier kan oppdatere" on public.profiles;

create policy "profiles: eier kan oppdatere" on public.profiles
  for update using (auth.uid() = id)
  with check (
    role is not distinct from (select role from public.profiles where id = auth.uid())
  );

-- 2. RPC: Angre ferdigmelding (uncomplete_zone)
create or replace function public.uncomplete_zone(p_assignment_id uuid)
returns void as $$
begin
  -- Sjekk at brukeren har claim på denne sonen
  if not exists (
    select 1 from public.zone_claims
    where assignment_id = p_assignment_id and user_id = auth.uid()
  ) then
    raise exception 'Du har ikke denne sonen';
  end if;

  -- Kun mulig å angre fra 'completed', ikke 'picked_up'
  if (select status from public.zone_assignments where id = p_assignment_id) != 'completed' then
    raise exception 'Kan kun angre ferdigmelding';
  end if;

  update public.zone_assignments set status = 'claimed' where id = p_assignment_id;
end;
$$ language plpgsql security definer;

-- 3. RLS på otp_codes (manglet helt — anon-nøkkel kunne lese OTP-koder)
alter table public.otp_codes enable row level security;
-- Ingen policies = kun service_role har tilgang (by design)

-- 4. RPC: Admin nullstill alle claims for en hendelse
create or replace function public.admin_reset_claims(p_event_id uuid)
returns void as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Kun admin kan nullstille claims';
  end if;

  delete from public.zone_claims
  where assignment_id in (select id from public.zone_assignments where event_id = p_event_id);

  update public.zone_assignments set status = 'available' where event_id = p_event_id;
end;
$$ language plpgsql security definer;

-- 5. RPC: Admin angre ferdigmelding på andres soner
create or replace function public.admin_uncomplete_zone(p_assignment_id uuid)
returns void as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Kun admin kan angre ferdigmelding for andre';
  end if;

  if (select status from public.zone_assignments where id = p_assignment_id) != 'completed' then
    raise exception 'Kan kun angre ferdigmelding';
  end if;

  update public.zone_assignments set status = 'claimed' where id = p_assignment_id;
end;
$$ language plpgsql security definer;
