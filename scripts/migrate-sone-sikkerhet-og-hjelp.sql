-- Migrering B (2026-09-28): sikring av sone-RPC-er og RLS (Del 3), og databasedelen av
-- "tatt med selv" (Del 1) og "be om en ekstra hånd" (Del 2).
-- Krever migrering A (kolonnene). Additiv for gamle klienter: samme funksjonsnavn og
-- parametre, feil kommer fortsatt som raise exception. Kjøres i begin ... commit,
-- deretter notify pgrst.

-- 1. zone_claims: klienten skriver bare via RPC-er. Notater kan fortsatt lagres.
drop policy if exists "zone_claims: bruker kan sette inn" on public.zone_claims;
drop policy if exists "zone_claims: bruker kan slette egne" on public.zone_claims;
revoke insert, update, delete on public.zone_claims from anon, authenticated;
grant update (notes) on public.zone_claims to authenticated;

-- 2. Claim
create or replace function public.claim_zone(p_event_id uuid, p_zone_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.zone_assignments;
  v_max int;
  v_current int;
  v_help boolean;
begin
  if auth.uid() is null then raise exception 'NOT_ALLOWED: Ikke innlogget'; end if;

  select * into v_a from public.zone_assignments
  where event_id = p_event_id and zone_id = p_zone_id
  for update;
  if not found then raise exception 'Sone ikke funnet for denne hendelsen'; end if;
  if v_a.status in ('completed', 'picked_up') then
    raise exception 'ZONE_FINISHED: Sonen er allerede ferdig';
  end if;
  if exists (select 1 from public.zone_claims where assignment_id = v_a.id and user_id = auth.uid()) then
    raise exception 'ALREADY_CLAIMED: Du har allerede denne sonen';
  end if;

  select collectors_needed into v_max from public.zones where id = p_zone_id;
  select count(*) into v_current from public.zone_claims where assignment_id = v_a.id;
  v_help := v_a.help_requested_at is not null;

  if v_current >= v_max and not v_help then
    raise exception 'ZONE_FULL: Sonen er allerede full';
  end if;

  insert into public.zone_claims (assignment_id, user_id, via_help)
  values (v_a.id, auth.uid(), v_help);

  -- Enhver vellykket claim lukker en åpen forespørsel.
  update public.zone_assignments
  set status = case when v_current + 1 >= v_max then 'claimed' else status end,
      help_requested_at = null,
      help_requested_by = null
  where id = v_a.id;
end; $$;

create or replace function public.admin_claim_zone(p_event_id uuid, p_zone_id text, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.zone_assignments;
  v_max int;
  v_current int;
  v_help boolean;
begin
  if not public.is_admin() then raise exception 'Kun admin kan tildele soner'; end if;

  select * into v_a from public.zone_assignments
  where event_id = p_event_id and zone_id = p_zone_id
  for update;
  if not found then raise exception 'Sone ikke funnet'; end if;
  if v_a.status in ('completed', 'picked_up') then
    raise exception 'ZONE_FINISHED: Sonen er allerede ferdig';
  end if;
  if exists (select 1 from public.zone_claims where assignment_id = v_a.id and user_id = p_user_id) then
    raise exception 'ALREADY_CLAIMED: Brukeren har allerede denne sonen';
  end if;

  select collectors_needed into v_max from public.zones where id = p_zone_id;
  select count(*) into v_current from public.zone_claims where assignment_id = v_a.id;
  v_help := v_a.help_requested_at is not null;

  if v_current >= v_max and not v_help then
    raise exception 'ZONE_FULL: Sonen er full';
  end if;

  insert into public.zone_claims (assignment_id, user_id, via_help)
  values (v_a.id, p_user_id, v_help);

  update public.zone_assignments
  set status = case when v_current + 1 >= v_max then 'claimed' else status end,
      help_requested_at = null,
      help_requested_by = null
  where id = v_a.id;
end; $$;

-- 3. Unclaim og nullstilling
create or replace function public.unclaim_zone(p_event_id uuid, p_zone_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.zone_assignments;
begin
  if auth.uid() is null then raise exception 'NOT_ALLOWED: Ikke innlogget'; end if;
  select * into v_a from public.zone_assignments
  where event_id = p_event_id and zone_id = p_zone_id
  for update;
  if not found then raise exception 'Sone ikke funnet for denne hendelsen'; end if;

  delete from public.zone_claims where assignment_id = v_a.id and user_id = auth.uid();

  -- Siste plukker går: sonen blir ledig og forespørselen lukkes.
  if not exists (select 1 from public.zone_claims where assignment_id = v_a.id) then
    update public.zone_assignments
    set status = 'available', help_requested_at = null, help_requested_by = null
    where id = v_a.id;
  end if;
end; $$;

create or replace function public.admin_unclaim_zone(p_event_id uuid, p_zone_id text, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.zone_assignments;
begin
  if not public.is_admin() then raise exception 'Kun admin'; end if;
  select * into v_a from public.zone_assignments
  where event_id = p_event_id and zone_id = p_zone_id
  for update;
  if not found then raise exception 'Sone ikke funnet'; end if;

  delete from public.zone_claims where assignment_id = v_a.id and user_id = p_user_id;

  if not exists (select 1 from public.zone_claims where assignment_id = v_a.id) then
    update public.zone_assignments
    set status = 'available', help_requested_at = null, help_requested_by = null
    where id = v_a.id;
  end if;
end; $$;

create or replace function public.admin_reset_claims(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Kun admin kan nullstille claims'; end if;
  perform 1 from public.zone_assignments where event_id = p_event_id for update;
  delete from public.zone_claims
  where assignment_id in (select id from public.zone_assignments where event_id = p_event_id);
  update public.zone_assignments
  set status = 'available', self_delivered = false,
      help_requested_at = null, help_requested_by = null
  where event_id = p_event_id;
end; $$;

-- 4. Ferdigmelding. DROP av gammel signatur først: create or replace med ny signatur
-- ville laget en overload, latt den usikrede versjonen ligge og gitt PGRST203.
-- Gamle klienter som bare sender p_assignment_id treffer den nye via default.
drop function if exists public.mark_zone_complete(uuid);

create or replace function public.mark_zone_complete(p_assignment_id uuid, p_self_delivered boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.zone_assignments;
  v_zone_type text;
begin
  select * into v_a from public.zone_assignments where id = p_assignment_id for update;
  if not found then raise exception 'Sone ikke funnet'; end if;

  if not (public.is_admin() or exists (
    select 1 from public.zone_claims where assignment_id = v_a.id and user_id = auth.uid()
  )) then
    raise exception 'NOT_ALLOWED: Du har ikke denne sonen';
  end if;
  if v_a.status in ('completed', 'picked_up') then
    raise exception 'ZONE_FINISHED: Sonen er allerede ferdig';
  end if;

  select zone_type into v_zone_type from public.zones where id = v_a.zone_id;
  if p_self_delivered and v_zone_type <> 'bottle' then
    raise exception 'NOT_BOTTLE: Tatt med selv gjelder bare flaskeinnsamling';
  end if;

  update public.zone_assignments
  set status = case when p_self_delivered then 'picked_up' else 'completed' end,
      self_delivered = p_self_delivered,
      help_requested_at = null,
      help_requested_by = null
  where id = v_a.id;
end; $$;

-- Angre: fra completed, eller fra picked_up når plukkeren tok med selv. Aldri fra
-- sjåførhentet. Status blir claimed hvis sonen er full, ellers available.
create or replace function public.uncomplete_zone(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.zone_assignments;
  v_max int;
  v_current int;
begin
  select * into v_a from public.zone_assignments where id = p_assignment_id for update;
  if not found then raise exception 'Sone ikke funnet'; end if;
  if not exists (select 1 from public.zone_claims where assignment_id = v_a.id and user_id = auth.uid()) then
    raise exception 'Du har ikke denne sonen';
  end if;
  if not (v_a.status = 'completed' or (v_a.status = 'picked_up' and v_a.self_delivered)) then
    raise exception 'Kan kun angre ferdigmelding';
  end if;

  select collectors_needed into v_max from public.zones where id = v_a.zone_id;
  select count(*) into v_current from public.zone_claims where assignment_id = v_a.id;
  update public.zone_assignments
  set status = case when v_current >= v_max then 'claimed' else 'available' end,
      self_delivered = false
  where id = v_a.id;
end; $$;

create or replace function public.admin_uncomplete_zone(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.zone_assignments;
  v_max int;
  v_current int;
begin
  if not public.is_admin() then raise exception 'Kun admin kan angre ferdigmelding for andre'; end if;
  select * into v_a from public.zone_assignments where id = p_assignment_id for update;
  if not found then raise exception 'Sone ikke funnet'; end if;
  if not (v_a.status = 'completed' or (v_a.status = 'picked_up' and v_a.self_delivered)) then
    raise exception 'Kan kun angre ferdigmelding';
  end if;

  select collectors_needed into v_max from public.zones where id = v_a.zone_id;
  select count(*) into v_current from public.zone_claims where assignment_id = v_a.id;
  update public.zone_assignments
  set status = case when v_current >= v_max then 'claimed' else 'available' end,
      self_delivered = false
  where id = v_a.id;
end; $$;

-- 5. Henting: bare sjåfør/stripser på hendelsen, eller admin. Sonen må være ferdigplukket.
create or replace function public.mark_zone_picked_up(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.zone_assignments;
begin
  select * into v_a from public.zone_assignments where id = p_assignment_id for update;
  if not found then raise exception 'Sone ikke funnet'; end if;
  if not (public.is_admin() or exists (
    select 1 from public.driver_assignments da
    where da.event_id = v_a.event_id and da.user_id = auth.uid()
      and da.role in ('driver', 'strapper')
  )) then
    raise exception 'NOT_ALLOWED: Bare sjåfører og stripsere på denne dugnaden kan markere som hentet';
  end if;
  if v_a.status <> 'completed' then
    raise exception 'NOT_COMPLETED: Sonen er ikke meldt ferdig';
  end if;

  update public.zone_assignments set status = 'picked_up', self_delivered = false where id = v_a.id;
end; $$;

-- 6. Be om en ekstra hånd
create or replace function public.request_zone_help(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.zone_assignments;
  v_zone_type text;
begin
  select * into v_a from public.zone_assignments where id = p_assignment_id for update;
  if not found then raise exception 'Sone ikke funnet'; end if;
  if not (public.is_admin() or exists (
    select 1 from public.zone_claims where assignment_id = v_a.id and user_id = auth.uid()
  )) then
    raise exception 'NOT_ALLOWED: Bare plukkerne på sonen kan be om hjelp';
  end if;

  select zone_type into v_zone_type from public.zones where id = v_a.zone_id;
  if v_zone_type <> 'bottle' then raise exception 'NOT_BOTTLE: Gjelder bare flaskeinnsamling'; end if;
  if not exists (select 1 from public.events where id = v_a.event_id and status = 'active') then
    raise exception 'EVENT_NOT_ACTIVE: Dugnaden er ikke aktiv';
  end if;
  if v_a.status in ('completed', 'picked_up') then
    raise exception 'ZONE_FINISHED: Sonen er allerede ferdig';
  end if;
  if not exists (select 1 from public.zone_claims where assignment_id = v_a.id) then
    raise exception 'NO_COLLECTORS: Sonen har ingen plukkere. Bruk Tildel medlem';
  end if;

  -- Idempotent: en åpen forespørsel beholder tidspunktet sitt.
  if v_a.help_requested_at is null then
    update public.zone_assignments
    set help_requested_at = now(), help_requested_by = auth.uid()
    where id = v_a.id;
  end if;
end; $$;

create or replace function public.cancel_zone_help(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a public.zone_assignments;
begin
  select * into v_a from public.zone_assignments where id = p_assignment_id for update;
  if not found then raise exception 'Sone ikke funnet'; end if;
  if not (public.is_admin() or exists (
    select 1 from public.zone_claims where assignment_id = v_a.id and user_id = auth.uid()
  )) then
    raise exception 'NOT_ALLOWED: Bare plukkerne på sonen kan avbryte';
  end if;
  update public.zone_assignments
  set help_requested_at = null, help_requested_by = null
  where id = v_a.id;
end; $$;

-- 7. Grants: ingen for anon/PUBLIC, execute for innloggede (og service_role).
do $$
declare f text;
begin
  foreach f in array array[
    'claim_zone(uuid, text)', 'admin_claim_zone(uuid, text, uuid)',
    'unclaim_zone(uuid, text)', 'admin_unclaim_zone(uuid, text, uuid)',
    'admin_reset_claims(uuid)', 'mark_zone_complete(uuid, boolean)',
    'uncomplete_zone(uuid)', 'admin_uncomplete_zone(uuid)', 'mark_zone_picked_up(uuid)',
    'request_zone_help(uuid)', 'cancel_zone_help(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;
