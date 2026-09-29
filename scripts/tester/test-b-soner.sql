-- Test B: alle sone-RPC-scenarioer for migrering B. Alt rulles tilbake.
-- Forutsetter at migrering A er kjørt.
begin;
-- ===== MIGRERING B =====
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
-- ===== SLUTT MIGRERING B =====

create temp table _r (nr serial, steg text, forventet text, faktisk text) on commit drop;
create temp table _ctx on commit drop as
select
  (select id from profiles where role = 'admin' order by created_at limit 1) as adm,
  (select id from profiles where role = 'collector' order by created_at offset 0 limit 1) as u1,
  (select id from profiles where role = 'collector' order by created_at offset 1 limit 1) as u2,
  (select id from profiles where role = 'collector' order by created_at offset 2 limit 1) as u3,
  (select id from profiles where role = 'collector' order by created_at offset 3 limit 1) as u4,
  (select id from zones where zone_type = 'bottle' and collectors_needed = 2 and event_id is null order by id limit 1) as zb,
  (select id from zones where zone_type = 'bottle' and collectors_needed = 2 and event_id is null order by id offset 1 limit 1) as zb2,
  (select id from zones where zone_type = 'lapper' order by id limit 1) as zl,
  null::uuid as ev, null::uuid as ab, null::uuid as ab2, null::uuid as al;

do $$
declare c record; v_ev uuid; v_ab uuid; v_ab2 uuid; v_al uuid;
begin
  select * into c from _ctx;
  insert into events (title, type, area, status, date, send_push_on_activate)
  values ('TEST rollback', 'bottle_collection', 'begge', 'active', current_date, false)
  returning id into v_ev;
  insert into zone_assignments (event_id, zone_id, status) values (v_ev, c.zb, 'available') returning id into v_ab;
  insert into zone_assignments (event_id, zone_id, status) values (v_ev, c.zb2, 'available') returning id into v_ab2;
  insert into zone_assignments (event_id, zone_id, status) values (v_ev, c.zl, 'available') returning id into v_al;
  insert into driver_assignments (event_id, user_id, role, area, trailer_group, slot_number)
  values (v_ev, c.u4, 'driver', 'NORD', 1, 1);
  update _ctx set ev = v_ev, ab = v_ab, ab2 = v_ab2, al = v_al;
end $$;

create function pg_temp.som(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.feil(p text) returns text language sql as $$ select split_part(p, ':', 1) $$;
grant all on _r, _ctx to authenticated, anon;
grant usage on sequence _r_nr_seq to authenticated, anon;
set local role authenticated;

-- Blokk 1: kapasitet og hjelp (steg 1-6)
do $$
declare c record; r text;
begin
  select * into c from _ctx;
  perform pg_temp.som(c.u1); perform public.claim_zone(c.ev, c.zb);
  perform pg_temp.som(c.u2); perform public.claim_zone(c.ev, c.zb);
  insert into _r (steg, forventet, faktisk) select '1 to plukkere gir claimed', 'claimed', status from public.zone_assignments where id = c.ab;

  perform pg_temp.som(c.u3);
  begin perform public.claim_zone(c.ev, c.zb); r := 'OK'; exception when others then r := pg_temp.feil(sqlerrm); end;
  insert into _r (steg, forventet, faktisk) values ('2 tredje claim på full sone', 'ZONE_FULL', r);
  begin perform public.request_zone_help(c.ab); r := 'OK'; exception when others then r := pg_temp.feil(sqlerrm); end;
  insert into _r (steg, forventet, faktisk) values ('3 ikke-plukker ber om hjelp', 'NOT_ALLOWED', r);

  perform pg_temp.som(c.u1);
  perform public.request_zone_help(c.ab);
  perform public.request_zone_help(c.ab);
  insert into _r (steg, forventet, faktisk) select '4 be om hjelp to ganger (idempotent)', 'åpen av u1',
    case when help_requested_at is not null and help_requested_by = c.u1 then 'åpen av u1' else 'FEIL' end
  from public.zone_assignments where id = c.ab;

  perform pg_temp.som(c.u3); perform public.claim_zone(c.ev, c.zb);
  insert into _r (steg, forventet, faktisk) select '5 hjelper inn: antall, forespørsel, via_help', '3/lukket/true',
    (select count(*) from public.zone_claims where assignment_id = c.ab)::text || '/'
    || case when za.help_requested_at is null then 'lukket' else 'ÅPEN' end || '/'
    || (select via_help::text from public.zone_claims where assignment_id = c.ab and user_id = c.u3)
  from public.zone_assignments za where za.id = c.ab;

  perform pg_temp.som(c.adm);
  begin perform public.admin_claim_zone(c.ev, c.zb, c.u4); r := 'OK'; exception when others then r := pg_temp.feil(sqlerrm); end;
  insert into _r (steg, forventet, faktisk) values ('6 admin tildeler full sone uten forespørsel', 'ZONE_FULL', r);
end $$;

-- Blokk 2: direkte tabelltilgang (steg 7-9)
do $$
declare c record; r text;
begin
  select * into c from _ctx;
  perform pg_temp.som(c.u4);
  begin insert into public.zone_claims (assignment_id, user_id) values (c.ab, c.u4); r := 'SATT INN';
  exception when insufficient_privilege then r := 'nektet'; end;
  insert into _r (steg, forventet, faktisk) values ('7 direkte INSERT i zone_claims', 'nektet', r);

  perform pg_temp.som(c.u1);
  begin update public.zone_claims set assignment_id = c.ab2 where assignment_id = c.ab and user_id = c.u1; r := 'ENDRET';
  exception when insufficient_privilege then r := 'nektet'; end;
  insert into _r (steg, forventet, faktisk) values ('8 flytte claim via assignment_id', 'nektet', r);
  begin update public.zone_claims set notes = 'test' where assignment_id = c.ab and user_id = c.u1; r := 'OK';
  exception when others then r := sqlerrm; end;
  insert into _r (steg, forventet, faktisk) values ('9 lagre notat', 'OK', r);
end $$;

-- Blokk 3: ferdig, tatt med selv, angre, henting (steg 10-16, 18)
do $$
declare c record; r text;
begin
  select * into c from _ctx;
  perform pg_temp.som(c.u4);
  begin perform public.mark_zone_complete(c.ab); r := 'OK'; exception when others then r := pg_temp.feil(sqlerrm); end;
  insert into _r (steg, forventet, faktisk) values ('10 ikke-plukker melder ferdig', 'NOT_ALLOWED', r);

  perform pg_temp.som(c.u1);
  perform public.mark_zone_complete(c.ab, true);
  insert into _r (steg, forventet, faktisk) select '11 tatt med selv', 'picked_up/true', status || '/' || self_delivered from public.zone_assignments where id = c.ab;
  perform public.uncomplete_zone(c.ab);
  insert into _r (steg, forventet, faktisk) select '12 angre tatt med selv (full sone)', 'claimed/false', status || '/' || self_delivered from public.zone_assignments where id = c.ab;
  perform public.mark_zone_complete(p_assignment_id => c.ab);
  insert into _r (steg, forventet, faktisk) select '13 gammel klient (bare p_assignment_id)', 'completed', status from public.zone_assignments where id = c.ab;

  perform pg_temp.som(c.u2);
  begin perform public.mark_zone_picked_up(c.ab); r := 'OK'; exception when others then r := pg_temp.feil(sqlerrm); end;
  insert into _r (steg, forventet, faktisk) values ('14 plukker markerer hentet', 'NOT_ALLOWED', r);
  perform pg_temp.som(c.u4); perform public.mark_zone_picked_up(c.ab);
  perform pg_temp.som(c.u1);
  begin perform public.uncomplete_zone(c.ab); r := 'OK'; exception when others then r := sqlerrm; end;
  insert into _r (steg, forventet, faktisk) values ('15 angre etter sjåførhenting', 'Kan kun angre ferdigmelding', r);
  perform pg_temp.som(c.u2);
  begin perform public.claim_zone(c.ev, c.zb); r := 'OK'; exception when others then r := pg_temp.feil(sqlerrm); end;
  insert into _r (steg, forventet, faktisk) values ('16 claim på hentet sone', 'ZONE_FINISHED', r);

  perform pg_temp.som(c.u1); perform public.claim_zone(c.ev, c.zl);
  begin perform public.request_zone_help(c.al); r := 'OK'; exception when others then r := pg_temp.feil(sqlerrm); end;
  insert into _r (steg, forventet, faktisk) values ('17 hjelp på lapper-sone', 'NOT_BOTTLE', r);
  begin perform public.mark_zone_complete(c.al, true); r := 'OK'; exception when others then r := pg_temp.feil(sqlerrm); end;
  insert into _r (steg, forventet, faktisk) values ('18 tatt med selv på lapper', 'NOT_BOTTLE', r);
end $$;

-- Blokk 4: lukking av forespørsel, tom sone, overload og anon (steg 19-24)
do $$
declare c record; r text;
begin
  select * into c from _ctx;
  perform pg_temp.som(c.u1);
  perform public.claim_zone(c.ev, c.zb2);
  perform public.request_zone_help(c.ab2);
  perform public.unclaim_zone(c.ev, c.zb2);
  insert into _r (steg, forventet, faktisk) select '19 siste plukker går', 'available/lukket',
    status || '/' || case when help_requested_at is null then 'lukket' else 'ÅPEN' end from public.zone_assignments where id = c.ab2;

  perform pg_temp.som(c.adm);
  begin perform public.request_zone_help(c.ab2); r := 'OK'; exception when others then r := pg_temp.feil(sqlerrm); end;
  insert into _r (steg, forventet, faktisk) values ('20 admin ber om hjelp på tom sone', 'NO_COLLECTORS', r);

  perform pg_temp.som(c.u1);
  perform public.claim_zone(c.ev, c.zb2);
  perform public.request_zone_help(c.ab2);
  perform pg_temp.som(c.adm);
  perform public.admin_reset_claims(c.ev);
  insert into _r (steg, forventet, faktisk) select '21 admin nullstiller', '0 åpne/0 tatt med selv/0 claims',
    count(*) filter (where help_requested_at is not null) || ' åpne/'
    || count(*) filter (where self_delivered) || ' tatt med selv/'
    || (select count(*) from public.zone_claims zc join public.zone_assignments z on z.id = zc.assignment_id where z.event_id = c.ev) || ' claims'
  from public.zone_assignments where event_id = c.ev;

  perform pg_temp.som(c.u1);
  perform public.claim_zone(c.ev, c.zb2);
  perform public.request_zone_help(c.ab2);
  perform pg_temp.som(c.adm);
  perform public.mark_event_completed(c.ev);
  insert into _r (steg, forventet, faktisk) select '22 fullfør hendelsen lukker forespørsler', '0',
    count(*)::text from public.zone_assignments where event_id = c.ev and help_requested_at is not null;

  insert into _r (steg, forventet, faktisk)
  select '23 én mark_zone_complete (ingen overload)', '1', count(*)::text from pg_proc where proname = 'mark_zone_complete';
end $$;

reset role;
set local role anon;
do $$
declare r text;
begin
  begin perform public.claim_zone(gen_random_uuid(), 'X'); r := 'KJØRTE'; exception when insufficient_privilege then r := 'nektet'; end;
  insert into _r (steg, forventet, faktisk) values ('24 anon kaller claim_zone', 'nektet', r);
end $$;
reset role;

select json_agg(json_build_object('steg', steg, 'forventet', forventet, 'faktisk', faktisk, 'ok', forventet = faktisk) order by nr) as resultat
from _r;
rollback;
