-- Rollback-tester for migrering C (merke per sone) og tilbakefyllingen.
-- Kjøres via Supabase-MCP execute_sql, én test per kall, utenfor aktiv dugnad.
-- Markørene -- <MIGRERING C>, -- <TILBAKEFYLLING> og -- <ANGREFIL> erstattes med hele
-- innholdet i scripts/migrate-merke-per-sone.sql, scripts/backfill-merke-per-sone.sql
-- og scripts/rollback-merke-per-sone.sql før kjøring. Alt rulles tilbake.

-- ===== TEST 0 =====
select json_build_object(
  'ub_totalt', (select count(*) from user_badges),
  'lm_totalt', (select count(*) from user_badges where badge_id in (18, 20)),
  'lm_uten_hendelse', (select count(*) from user_badges where badge_id in (18, 20) and event_id is null),
  'merke_86_finnes', (select count(*) from badges where id = 86),
  'kolonne_finnes', (select count(*) from information_schema.columns where table_name = 'user_badges' and column_name = 'zone_assignment_id'),
  'lappeclaims', (select count(*) from zone_claims zc join zone_assignments za on za.id = zc.assignment_id join events e on e.id = za.event_id where e.type = 'lapper' and e.status = 'completed'),
  'flaskeclaims', (select count(*) from zone_claims zc join zone_assignments za on za.id = zc.assignment_id join events e on e.id = za.event_id where e.type = 'bottle_collection' and e.status = 'completed'),
  'aktive_soneeventer', (select count(*) from events where type in ('lapper', 'bottle_collection') and status <> 'completed'),
  'uferdige_claims_paa_fullfort', (select count(*) from zone_claims zc join zone_assignments za on za.id = zc.assignment_id join events e on e.id = za.event_id where e.type in ('lapper', 'bottle_collection') and e.status = 'completed' and za.status not in ('completed', 'picked_up'))
) as resultat;

-- ===== TEST 1 =====
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
create temp table _for on commit drop as
  select id, user_id, badge_id, event_id from user_badges;

-- <MIGRERING C>
-- <TILBAKEFYLLING>

create temp table _etter on commit drop as
  select ub.id, ub.user_id, ub.badge_id, ub.event_id, ub.zone_assignment_id,
         (f.id is null) as ny, f.event_id as gammel_event_id
  from user_badges ub left join _for f on f.id = ub.id;

select json_build_object(
  'ub_for', (select count(*) from _for),
  'ub_etter', (select count(*) from _etter),
  'lm_med_sone', (select count(*) from _etter where badge_id in (18, 20) and zone_assignment_id is not null),
  'lm_koblet_uten_hendelse', (select count(*) from _etter where badge_id in (18, 20) and not ny and gammel_event_id is null and zone_assignment_id is not null),
  'lm_koblet_med_hendelse', (select count(*) from _etter where badge_id in (18, 20) and not ny and gammel_event_id is not null and zone_assignment_id is not null),
  'lm_nye', (select count(*) from _etter where badge_id in (18, 20) and ny),
  'lm_ukoblet', (select count(*) from _etter where badge_id in (18, 20) and zone_assignment_id is null),
  'pantejeger', (select count(*) from _etter where badge_id = 86),
  'terskel_nye', (select json_object_agg(badge_id, n) from (select badge_id, count(*) n from _etter where ny and badge_id in (1, 4, 8, 12) group by 1) t),
  'andre_nye', (select json_object_agg(badge_id, n) from (select badge_id, count(*) n from _etter where ny and badge_id not in (1, 4, 8, 12, 18, 20, 86) group by 1) t),
  'per_hendelse', (select json_agg(json_build_object('hendelse', e.title, 'dato', e.date, 'claims', c.n, 'sonemerker', coalesce(s.n, 0)) order by e.date)
     from events e
     join (select za.event_id, count(*) n from zone_claims zc join zone_assignments za on za.id = zc.assignment_id group by 1) c on c.event_id = e.id
     left join (select event_id, count(*) n from _etter where zone_assignment_id is not null group by 1) s on s.event_id = e.id
     where e.status = 'completed' and e.type in ('lapper', 'bottle_collection')),
  'per_person', (select json_agg(json_build_object(
       'navn', p.full_name,
       'lappemester_nye', x.lm_nye,
       'lappemester_koblet', x.lm_koblet,
       'pantejeger_nye', x.pj,
       'terskel_nye', x.terskel) order by x.pj + x.lm_nye desc, p.full_name)
     from (select user_id,
             count(*) filter (where badge_id in (18, 20) and ny) as lm_nye,
             count(*) filter (where badge_id in (18, 20) and not ny and zone_assignment_id is not null) as lm_koblet,
             count(*) filter (where badge_id = 86) as pj,
             count(*) filter (where badge_id in (1, 4, 8, 12) and ny) as terskel
           from _etter group by user_id) x
     join profiles p on p.id = x.user_id
     where x.lm_nye + x.lm_koblet + x.pj + x.terskel > 0)
) as resultat;
rollback;

-- ===== TEST 2 =====
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
-- <MIGRERING C>
-- <TILBAKEFYLLING>
create temp table _t (steg text, n bigint, fingeravtrykk text) on commit drop;
insert into _t select 'etter_1', count(*), md5(string_agg(id || ':' || coalesce(zone_assignment_id::text, '') || ':' || coalesce(event_id::text, ''), ',' order by id)) from user_badges;
-- <MIGRERING C>
-- <TILBAKEFYLLING>
insert into _t select 'etter_2', count(*), md5(string_agg(id || ':' || coalesce(zone_assignment_id::text, '') || ':' || coalesce(event_id::text, ''), ',' order by id)) from user_badges;
select json_object_agg(steg, json_build_object('n', n, 'md5', fingeravtrykk)) as resultat from _t;
rollback;

-- ===== TEST 3 =====
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
-- <MIGRERING C>
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where role = 'admin' order by created_at limit 1),
                    'role', 'authenticated')::text, true);
create temp table _t (steg text, n bigint) on commit drop;
grant insert, select on _t to authenticated;
set local role authenticated;
insert into _t select 'for', count(*) from user_badges;
select public.mark_event_completed((select id from events where type = 'lapper' and date = '2026-09-29'));
insert into _t select 'lapper_1', count(*) from user_badges;
insert into _t select 'lapper_18_med_sone', count(*) from user_badges
  where badge_id = 18 and event_id = (select id from events where type = 'lapper' and date = '2026-09-29') and zone_assignment_id is not null;
select public.mark_event_completed((select id from events where type = 'lapper' and date = '2026-09-29'));
insert into _t select 'lapper_2', count(*) from user_badges;
select public.mark_event_completed((select id from events where type = 'bottle_collection' and date = '2026-10-12'));
insert into _t select 'flaske_1', count(*) from user_badges;
insert into _t select 'reevaluate_flaske', public.reevaluate_event_badges((select id from events where type = 'bottle_collection' and date = '2026-10-12'));
reset role;
select json_object_agg(steg, n) as resultat from _t;
rollback;

-- ===== TEST 4 =====
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
-- <MIGRERING C>
-- <TILBAKEFYLLING>
create temp table _u (test text, utfall text) on commit drop;
grant insert on _u to anon, authenticated;
do $$
declare
  v_row public.user_badges;
  n int;
  r text;
begin
  select * into v_row from public.user_badges where badge_id = 86 limit 1;

  -- Samme sone en gang til: ingenting
  insert into public.user_badges (user_id, badge_id, event_id, zone_assignment_id)
  values (v_row.user_id, 86, v_row.event_id, v_row.zone_assignment_id) on conflict do nothing;
  get diagnostics n = row_count;
  insert into _u values ('samme sone, on conflict', n::text || ' rader');

  -- Manuell uten sone på samme hendelse: én tillatt, nummer to gir 23505
  insert into public.user_badges (user_id, badge_id, event_id) values (v_row.user_id, 86, v_row.event_id);
  insert into _u values ('manuell 1 uten sone', 'satt inn');
  begin
    insert into public.user_badges (user_id, badge_id, event_id) values (v_row.user_id, 86, v_row.event_id);
    insert into _u values ('manuell 2 uten sone', 'SATT INN');
  exception when unique_violation then insert into _u values ('manuell 2 uten sone', '23505');
  end;

  -- Sone med merke kan ikke slettes
  begin
    delete from public.zone_assignments where id = v_row.zone_assignment_id;
    insert into _u values ('slett sone med merke', 'SLETTET');
  exception when foreign_key_violation then insert into _u values ('slett sone med merke', '23503');
  end;

  -- Tilganger
  execute 'set local role anon';
  begin perform public.award_zone_badges(v_row.event_id); r := 'KJØRTE'; exception when insufficient_privilege then r := 'nektet'; end;
  insert into _u values ('anon award_zone_badges', r);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where role = 'collector' limit 1), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.award_zone_badges(v_row.event_id); r := 'KJØRTE'; exception when insufficient_privilege then r := 'nektet'; end;
  insert into _u values ('authenticated award_zone_badges', r);
  begin perform public.reevaluate_event_badges(v_row.event_id); r := 'KJØRTE'; exception when others then r := sqlerrm; end;
  insert into _u values ('ikke-admin reevaluate', r);
  execute 'reset role';
end $$;
select json_object_agg(test, utfall) as resultat from _u;
rollback;

-- ===== TEST 5 =====
select (select count(*) from information_schema.columns where table_name = 'user_badges' and column_name = 'zone_assignment_id') as kolonne,
       (select count(*) from pg_proc where proname = 'award_zone_badges') as fn,
       (select count(*) from badges where id = 86) as merke_86,
       (select count(*) from user_badges) as ub_totalt,
       (select indexdef from pg_indexes where indexname = 'user_badges_event_unique') as event_idx,
       (select count(*) from pg_indexes where indexname = 'user_badges_zone_uniq') as zone_idx,
       (select count(*) from pg_stat_activity where state like 'idle in transaction%') as hengende;

-- ===== TEST 6 =====
-- Angrefila: migrering og så angring i samme transaksjon. mec_md5 skal være lik
-- md5(pg_get_functiondef('public.mark_event_completed(uuid)'::regprocedure)) før migreringen.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
-- <MIGRERING C>
-- <ANGREFIL>
select json_build_object(
  'kolonne', (select count(*) from information_schema.columns where table_name = 'user_badges' and column_name = 'zone_assignment_id'),
  'fn', (select count(*) from pg_proc where proname = 'award_zone_badges'),
  'event_idx', (select indexdef from pg_indexes where indexname = 'user_badges_event_unique'),
  'mec_har_sonemerker', (select pg_get_functiondef('public.mark_event_completed(uuid)'::regprocedure) ilike '%award_zone_badges%'),
  'mec_md5', (select md5(pg_get_functiondef('public.mark_event_completed(uuid)'::regprocedure)))
) as resultat;
rollback;
