-- Tester-tilbakemeldinger: Andreas (sikkerhet) + Irun (UX)
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
