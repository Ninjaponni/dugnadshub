-- NB: Etter tilbakefyllingen 2026-10-12 finnes sonemerker, så denne fila stopper av seg selv.
-- Angrer migrate-merke-per-sone.sql UTEN sletting i user_badges. Bare gyldig før
-- tilbakefyllingen, og så lenge ingen sonemerker er delt ut (stopper ellers).
-- Merke 86 i badges blir stående (ufarlig, ingen har det).
-- Kjøres i begin ... commit, deretter notify pgrst, 'reload schema'.
do $$
begin
  if exists (select 1 from public.user_badges where zone_assignment_id is not null) then
    raise exception 'Det finnes sonemerker. Angring krever sletting og styrets OK.';
  end if;
end $$;

drop index if exists public.user_badges_zone_uniq;
drop index if exists public.user_badges_event_unique;
create unique index user_badges_event_unique
  on public.user_badges (user_id, badge_id, event_id)
  where event_id is not null;
alter table public.user_badges drop column if exists zone_assignment_id;
update public.badges set description = 'Delte ut lapper i Nord' where id = 18;
update public.badges set description = 'Delte ut lapper i Sør' where id = 20;

-- Funksjonene slik de var før migreringen (ordrett fra scripts/migrate-deltakelsesmerker-i-db.sql, seksjon 6 og 7)
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

drop function if exists public.award_zone_badges(uuid);
