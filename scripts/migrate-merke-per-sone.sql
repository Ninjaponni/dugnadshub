-- Kjørt i prod 2026-10-12 kl 21:56 (steg 1, ub_totalt 1272 uendret). Backup før: ~/Backups/dugnadshub/2026-10-12T19-55-26.
-- Migrering C (2026-10-12): ett merke per sone.
-- Lappeutdeling gir Lappemester Nord (18) / Sør (20) per sone etter zones.area.
-- Flaskeinnsamling gir Pantejeger (86) per sone. Plast er ikke med.
-- Additiv og bakoverkompatibel: gamle klienter leser bare badge_id og merker ingenting.
-- Kjøres i begin ... commit sammen med backfill-merke-per-sone.sql, deretter notify pgrst.
-- Spec: docs/superpowers/specs/2026-10-12-merke-per-sone-design.md

-- 1. Kobling til sonen merket ble tjent på.
-- on delete restrict: en sone med merker kan ikke slettes, så merker forsvinner aldri
-- og to rader kan aldri falle sammen til samme (user_id, badge_id, event_id) uten sone.
alter table public.user_badges
  add column if not exists zone_assignment_id uuid
    references public.zone_assignments(id) on delete restrict;

-- 2. Ett merke per bruker per merke per sone.
create unique index if not exists user_badges_zone_uniq
  on public.user_badges (user_id, badge_id, zone_assignment_id)
  where zone_assignment_id is not null;

-- 3. Hendelsesindeksen gjelder nå bare merker uten sone.
drop index if exists public.user_badges_event_unique;
create unique index user_badges_event_unique
  on public.user_badges (user_id, badge_id, event_id)
  where event_id is not null and zone_assignment_id is null;

-- 4. Merkene. auto_criteria forblir null, så admin fortsatt kan gi dem manuelt.
insert into public.badges (id, name, description, icon, category, auto_criteria) values
  (86, 'Pantejeger', 'Tok en flaskesone', '/badges/pantejeger.png', 'aktivitet', null)
on conflict (id) do nothing;
update public.badges set description = 'Tok en lappesone i Nord' where id = 18;
update public.badges set description = 'Tok en lappesone i Sør' where id = 20;

-- 5. Sonemerker for én hendelse. Bare soner meldt ferdig (completed/picked_up, også tatt med selv).
-- Lodd per person: alle på sonen får ett hver, også hjelpere og foreldre i samme familie.
-- Kalles av mark_event_completed, reevaluate_event_badges og tilbakefyllingen. Idempotent. Sletter aldri. Returnerer antall nye rader.
-- Først kobles en eksisterende rad uten sone (samme bruker, merke og hendelse) til en
-- sone, så manuelle tildelinger ikke blir dobbelt. Den gamle hendelsesindeksen sikrer
-- at det finnes høyst én slik rad per bruker og merke.
create or replace function public.award_zone_badges(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_nye integer;
begin
  select type into v_type from public.events where id = p_event_id;
  if v_type is null or v_type not in ('lapper', 'bottle_collection') then
    return 0;
  end if;

  with krav as (
    select distinct on (zc.user_id, m.badge_id)
           zc.user_id, m.badge_id, za.id as assignment_id
    from public.zone_claims zc
    join public.zone_assignments za on za.id = zc.assignment_id
    join public.zones z on z.id = za.zone_id
    cross join lateral (select case
        when v_type = 'bottle_collection' then 86
        when z.area = 'NORD' then 18
        when z.area = 'SOR' then 20
      end as badge_id) m
    where za.event_id = p_event_id
      and za.status in ('completed', 'picked_up')
      and m.badge_id is not null
      and not exists (
        select 1 from public.user_badges ub
        where ub.zone_assignment_id = za.id
          and ub.user_id = zc.user_id and ub.badge_id = m.badge_id
      )
    order by zc.user_id, m.badge_id, zc.claimed_at, za.id
  )
  update public.user_badges ub
  set zone_assignment_id = k.assignment_id
  from krav k
  where ub.user_id = k.user_id
    and ub.badge_id = k.badge_id
    and ub.event_id = p_event_id
    and ub.zone_assignment_id is null;

  insert into public.user_badges (user_id, badge_id, event_id, zone_assignment_id)
  select zc.user_id, m.badge_id, p_event_id, za.id
  from public.zone_claims zc
  join public.zone_assignments za on za.id = zc.assignment_id
  join public.zones z on z.id = za.zone_id
  cross join lateral (select case
      when v_type = 'bottle_collection' then 86
      when z.area = 'NORD' then 18
      when z.area = 'SOR' then 20
    end as badge_id) m
  where za.event_id = p_event_id
    and za.status in ('completed', 'picked_up')
    and m.badge_id is not null
  on conflict do nothing;
  get diagnostics v_nye = row_count;

  return v_nye;
end;
$$;
revoke all on function public.award_zone_badges(uuid) from public, anon, authenticated;

-- 6. mark_event_completed: uendret fra migrate-deltakelsesmerker-i-db.sql, pluss
-- sonemerker rett før terskelmerkene.
create or replace function public.mark_event_completed(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  first_user_id uuid;
  v_event_type text;
begin
  if not public.is_admin() then
    raise exception 'Kun admin kan markere hendelser som fullført';
  end if;

  select type into v_event_type from public.events where id = p_event_id;
  if not found then
    raise exception 'Hendelse ikke funnet';
  end if;

  update public.events set status = 'completed' where id = p_event_id;

  -- Sjåføren (14) og Stripsern (15). Ikke plast, ikke host.
  if v_event_type <> 'plast' then
    insert into public.user_badges (user_id, badge_id, event_id)
    select da.user_id, case when da.role = 'driver' then 14 else 15 end, p_event_id
    from public.driver_assignments da
    where da.event_id = p_event_id
      and da.role in ('driver', 'strapper')
      and da.user_id is not null
    on conflict do nothing;
  end if;

  -- Synk profiles.role. Prioritet: admin > driver > strapper > host > collector.
  for rec in
    select distinct user_id from public.driver_assignments
    where event_id = p_event_id and user_id is not null
  loop
    update public.profiles
    set role = (
      case
        when role = 'admin' then 'admin'
        when exists (
          select 1 from public.driver_assignments da join public.events e on e.id = da.event_id
          where da.user_id = rec.user_id and da.role = 'driver' and e.status <> 'completed'
        ) then 'driver'
        when exists (
          select 1 from public.driver_assignments da join public.events e on e.id = da.event_id
          where da.user_id = rec.user_id and da.role = 'strapper' and e.status <> 'completed'
        ) then 'strapper'
        when exists (
          select 1 from public.driver_assignments da join public.events e on e.id = da.event_id
          where da.user_id = rec.user_id and da.role = 'host' and e.status <> 'completed'
        ) then 'host'
        else 'collector'
      end
    )
    where id = rec.user_id;
  end loop;

  -- Førstemann (28): uendret oppførsel, beregnes på nytt. Ikke for plast.
  if v_event_type <> 'plast' then
    delete from public.user_badges where badge_id = 28 and event_id = p_event_id;
    select zc.user_id into first_user_id
    from public.zone_claims zc
    join public.zone_assignments za on za.id = zc.assignment_id
    where za.event_id = p_event_id
    order by zc.claimed_at asc
    limit 1;
    if first_user_id is not null then
      insert into public.user_badges (user_id, badge_id, event_id)
      values (first_user_id, 28, p_event_id)
      on conflict do nothing;
    end if;
  end if;

  -- Personvern: GPS-posisjoner skal ikke ligge igjen etter dugnaden.
  update public.driver_assignments
  set latitude = null, longitude = null, accuracy = null,
      location_updated_at = null, location_sharing = false
  where event_id = p_event_id;

  -- Åpne hjelpeforespørsler lukkes når hendelsen er ferdig.
  update public.zone_assignments
  set help_requested_at = null, help_requested_by = null
  where event_id = p_event_id and help_requested_at is not null;

  -- Ett merke per sone (Lappemester Nord/Sør, Pantejeger). Før tersklene.
  perform public.award_zone_badges(p_event_id);

  -- Terskelmerker for alle deltakere, fra alle kilder.
  perform public.award_participation_badges(public.event_participant_ids(p_event_id));
end;
$$;
revoke execute on function public.mark_event_completed(uuid) from public, anon;
grant execute on function public.mark_event_completed(uuid) to authenticated;

-- 7. Etterregistrering: også sonemerker. Returnerer antall nye merker.
create or replace function public.reevaluate_event_badges(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type text;
  v_before bigint;
  v_after bigint;
begin
  if not public.is_admin() then
    raise exception 'Kun admin kan oppdatere merker';
  end if;
  select type into v_event_type from public.events where id = p_event_id and status = 'completed';
  if not found then
    raise exception 'Hendelsen er ikke fullført';
  end if;

  select count(*) into v_before from public.user_badges;

  if v_event_type <> 'plast' then
    insert into public.user_badges (user_id, badge_id, event_id)
    select da.user_id, case when da.role = 'driver' then 14 else 15 end, p_event_id
    from public.driver_assignments da
    where da.event_id = p_event_id and da.role in ('driver', 'strapper') and da.user_id is not null
    on conflict do nothing;
  end if;

  perform public.award_zone_badges(p_event_id);

  perform public.award_participation_badges(public.event_participant_ids(p_event_id));

  select count(*) into v_after from public.user_badges;
  return (v_after - v_before)::integer;
end;
$$;
revoke execute on function public.reevaluate_event_badges(uuid) from public, anon;
grant execute on function public.reevaluate_event_badges(uuid) to authenticated;
