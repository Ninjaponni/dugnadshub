-- Migrering A (2026-09-28): terskelmerker (Frøspire 1, Tre på rad 4, Ringrev 8, Maskin 12)
-- deles ut av databasen, fra alle deltakelseskilder, med én kilde til sannhet.
-- Legger også inn kolonnene for "tatt med selv" og "be om en ekstra hånd", fordi
-- mark_event_completed skal nullstille hjelpeforespørsler.
-- Additiv og bakoverkompatibel. Kjøres i begin ... commit, deretter notify pgrst.
-- Spec: docs/superpowers/specs/2026-09-28-levert-selv-og-hjelp-onskes-design.md

-- 1. Nye kolonner (usynlige for gamle klienter)
alter table public.zone_assignments
  add column if not exists self_delivered boolean not null default false,
  add column if not exists help_requested_at timestamptz,
  add column if not exists help_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists help_notified_at timestamptz;

alter table public.zone_claims
  add column if not exists via_help boolean not null default false;

-- 2. Terskel- og engangsmerker uten hendelse kan bare finnes én gang per bruker.
-- Bruk "on conflict do nothing" (uten kolonneliste) mot denne partial-indeksen.
create unique index if not exists user_badges_once_uniq
  on public.user_badges (user_id, badge_id)
  where event_id is null and badge_id in (1, 2, 3, 4, 5, 6, 8, 9, 12, 16);

-- 3. Alle deltakere på én hendelse, fra alle kilder.
create or replace function public.event_participant_ids(p_event_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(u.user_id), '{}'::uuid[]) from (
    select zc.user_id from public.zone_claims zc
      join public.zone_assignments za on za.id = zc.assignment_id
      where za.event_id = p_event_id
    union
    select sc.user_id from public.shift_claims sc
      join public.event_shifts es on es.id = sc.shift_id
      where es.event_id = p_event_id
    union
    select da.user_id from public.driver_assignments da where da.event_id = p_event_id
    union
    select em.profile_id from public.event_musicians em where em.event_id = p_event_id
    union
    select ub.user_id from public.user_badges ub
      join public.badges b on b.id = ub.badge_id
        and b.category in ('aktivitet', '17mai', 'sommerkonsert', 'seminar')
      where ub.event_id = p_event_id
  ) u
  where u.user_id is not null;
$$;
revoke all on function public.event_participant_ids(uuid) from public, anon, authenticated;

-- 4. Terskellogikken fra backfill-deltakelse-merker.sql. null = alle brukere.
-- Returnerer radene som faktisk ble satt inn. Nye deltakelseskategorier må
-- legges til her, i event_participant_ids, i triggeren under og i
-- PARTICIPATION_CATEGORIES i lib/badges/definitions.ts.
create or replace function public.award_participation_badges(p_user_ids uuid[] default null)
returns setof public.user_badges
language sql
volatile
security definer
set search_path = ''
as $$
  with deltakelse as (
    select u.user_id, u.event_id from (
      select zc.user_id, za.event_id from public.zone_claims zc
        join public.zone_assignments za on za.id = zc.assignment_id
      union
      select sc.user_id, es.event_id from public.shift_claims sc
        join public.event_shifts es on es.id = sc.shift_id
      union
      select da.user_id, da.event_id from public.driver_assignments da where da.event_id is not null
      union
      select em.profile_id, em.event_id from public.event_musicians em
      union
      select ub.user_id, ub.event_id from public.user_badges ub
        join public.badges b on b.id = ub.badge_id
          and b.category in ('aktivitet', '17mai', 'sommerkonsert', 'seminar')
        where ub.event_id is not null
    ) u
    join public.events e on e.id = u.event_id and e.status = 'completed'
    where u.user_id is not null
      and (p_user_ids is null or u.user_id = any (p_user_ids))
  ),
  antall as (
    select d.user_id, count(distinct d.event_id) as n from deltakelse d group by d.user_id
  )
  insert into public.user_badges (user_id, badge_id, event_id)
  select a.user_id, t.badge_id, null
  from antall a
  cross join (values (1, 1), (4, 3), (8, 10), (12, 20)) as t(badge_id, terskel)
  where a.n >= t.terskel
    and not exists (
      select 1 from public.user_badges ub
      where ub.user_id = a.user_id and ub.badge_id = t.badge_id
    )
  on conflict do nothing
  returning *;
$$;
-- PUBLIC har execute som standard, så revoke fra anon/authenticated alene holder ikke.
revoke all on function public.award_participation_badges(uuid[]) from public, anon, authenticated;
grant execute on function public.award_participation_badges(uuid[]) to service_role;

-- 5. USYNLIG OPPFØRSEL: når et deltakelsesmerke (aktivitet/17mai/sommerkonsert/seminar)
-- med event_id på en FULLFØRT hendelse settes inn, sjekkes tersklene for de berørte
-- brukerne med en gang. Gjelder både admin/medlemmer, REST-skript og mark_event_completed.
-- Statement-nivå med transition table: én kjøring per insert-setning, uansett antall rader.
-- Security definer: ellers ville en admin-innsetting via RLS feile og rulles tilbake.
-- Funksjonen setter bare inn event_id = null-rader, så den utløser ikke seg selv på nytt.
create or replace function public.award_participation_on_badge_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_users uuid[];
begin
  select array_agg(distinct n.user_id) into v_users
  from new_rows n
  join public.events e on e.id = n.event_id and e.status = 'completed'
  join public.badges b on b.id = n.badge_id
    and b.category in ('aktivitet', '17mai', 'sommerkonsert', 'seminar')
  where n.event_id is not null;

  if v_users is not null then
    perform public.award_participation_badges(v_users);
  end if;
  return null;
end;
$$;
revoke all on function public.award_participation_on_badge_insert() from public, anon, authenticated;

drop trigger if exists user_badges_award_participation on public.user_badges;
create trigger user_badges_award_participation
  after insert on public.user_badges
  referencing new table as new_rows
  for each statement
  execute function public.award_participation_on_badge_insert();

-- 6. mark_event_completed: bygger på migrate-host-completion-fix.sql (31.05), som ble
-- overskrevet ved en feil 07.06. Gjeninnfører plast-unntak, host-rolle og GPS-sletting.
-- Nytt: 14/15 bare for driver/strapper (host-feilen), search_path, nullstilling av
-- hjelpeforespørsler og terskelmerker for alle deltakere.
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

  -- Terskelmerker for alle deltakere, fra alle kilder.
  perform public.award_participation_badges(public.event_participant_ids(p_event_id));
end;
$$;
revoke execute on function public.mark_event_completed(uuid) from public, anon;
grant execute on function public.mark_event_completed(uuid) to authenticated;

-- 7. Etterregistrering: admin-knapp i admin/hendelser. Returnerer antall nye merker.
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

  perform public.award_participation_badges(public.event_participant_ids(p_event_id));

  select count(*) into v_after from public.user_badges;
  return (v_after - v_before)::integer;
end;
$$;
revoke execute on function public.reevaluate_event_badges(uuid) from public, anon;
grant execute on function public.reevaluate_event_badges(uuid) to authenticated;

-- 8. GPS-rester fra perioden 07.06-28.09, da regresjonen gjorde at de ikke ble slettet (godkjent av Tor Martin 29.09).
update public.driver_assignments da
set latitude = null, longitude = null, accuracy = null,
    location_updated_at = null, location_sharing = false
from public.events e
where e.id = da.event_id and e.status = 'completed'
  and (da.latitude is not null or da.location_sharing);
