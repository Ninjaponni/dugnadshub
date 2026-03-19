-- Admin kan tildele et medlem til en sone
create or replace function public.admin_claim_zone(
  p_event_id uuid, p_zone_id text, p_user_id uuid
) returns void as $$
declare
  v_assignment_id uuid;
  v_max int;
  v_current int;
begin
  -- Sjekk at kaller er admin
  if not public.is_admin() then
    raise exception 'Kun admin kan tildele soner';
  end if;

  select za.id into v_assignment_id
  from public.zone_assignments za
  where za.event_id = p_event_id and za.zone_id = p_zone_id;
  if v_assignment_id is null then raise exception 'Sone ikke funnet'; end if;

  select z.collectors_needed into v_max from public.zones z where z.id = p_zone_id;
  select count(*) into v_current from public.zone_claims zc where zc.assignment_id = v_assignment_id;
  if v_current >= v_max then raise exception 'Sonen er full'; end if;
  if exists (select 1 from public.zone_claims where assignment_id = v_assignment_id and user_id = p_user_id) then
    raise exception 'Brukeren har allerede denne sonen';
  end if;

  insert into public.zone_claims (assignment_id, user_id) values (v_assignment_id, p_user_id);
  if v_current + 1 >= v_max then
    update public.zone_assignments set status = 'claimed' where id = v_assignment_id;
  end if;
end;
$$ language plpgsql security definer;

-- Admin kan fjerne en annen brukers claim
create or replace function public.admin_unclaim_zone(
  p_event_id uuid, p_zone_id text, p_user_id uuid
) returns void as $$
declare
  v_assignment_id uuid;
begin
  if not public.is_admin() then raise exception 'Kun admin'; end if;

  select za.id into v_assignment_id
  from public.zone_assignments za
  where za.event_id = p_event_id and za.zone_id = p_zone_id;
  if v_assignment_id is null then raise exception 'Sone ikke funnet'; end if;

  delete from public.zone_claims where assignment_id = v_assignment_id and user_id = p_user_id;

  if not exists (select 1 from public.zone_claims where assignment_id = v_assignment_id) then
    update public.zone_assignments set status = 'available' where id = v_assignment_id;
  end if;
end;
$$ language plpgsql security definer;
