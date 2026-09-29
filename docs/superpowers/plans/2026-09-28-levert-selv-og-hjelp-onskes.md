# "Tatt med selv", "Be om en ekstra hånd" og automatiske deltakelsesmerker - implementeringsplan

> **For agentiske utførere:** Påkrevd underskill: superpowers:executing-plans (inline, med sjekkpunkter hos Tor Martin). Stegene bruker avkrysning (`- [ ]`).

**Mål:** Flaskeplukkere kan melde "tatt med selv" og be om en ekstra hånd. Sone-RPC-ene sikres. Terskelmerkene (Frøspire, Tre på rad, Ringrev, Maskin) deles ut av databasen selv, fra alle kilder.

**Arkitektur:** To additive SQL-migreringer (A: merker, B: sone-sikkerhet og hjelp), deretter frontend. All logikk som må være riktig under kappløp og for gamle klienter ligger i databasen (RPC-er med `for update`, trigger, unik indeks). Frontend er tynn og bare for bottle-soner.

**Teknologi:** Next.js 15, Supabase (Postgres, PostgREST, Realtime), Mapbox via react-map-gl, Tailwind v4 med tokens i `app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-09-28-levert-selv-og-hjelp-onskes-design.md` (les den sammen med planen).

## Globale krav

- Bokmål i all UI-tekst. Ingen tankestreker. Kjønnsnøytrale formuleringer (bruk fornavn, ikke "hun/han").
- Del 1 og 2 gjelder kun `zone_type = 'bottle'`. Lapper og plast uendret.
- Ingen nye hovedknapper, ingen endring i fyllfarger, samme antall trykk i vanlig flyt.
- Ingen ny verdi i `zone_assignments.status`.
- Migreringer er additive og bakoverkompatible. Rekkefølge ved drift: migrering, `notify pgrst, 'reload schema'`, frontend med versjonsbump.
- Alle nye/endrede security definer-funksjoner: `set search_path`, `revoke execute ... from public, anon`.
- **Ingen sletting eller rydding i `user_badges` uten Tor Martins godkjenning.** Tester mot prod kjøres bare i `begin ... rollback`.
- Hver migrering vises til Tor Martin før den kjøres ekte. Ekvivalenstesten vises før noe kjøres ekte.
- Push og deploy først etter Tor Martins OK. Deploy kun via push til `main`.
- Designtokens: `bg-card`, `bg-surface-low`, `text-text-primary/secondary/tertiary`, `text-accent`, `text-success`, `text-danger`. Aldri `bg-surface`, `text-foreground`.
- Verifisering: `npx tsc --noEmit` og `npm run build` (ingen ESLint, ingen testsuite).
- Versjon: `lib/version.ts` (`APP_VERSION`, i dag `10.40.0`). Første frontend-commit blir `10.41.0`, deretter siste siffer +1 per commit.
- Frist: deployet og testet innen 5. oktober.

## Avvik fra specen og funn (må godkjennes)

1. **`mark_event_completed` i prod er en regresjon.** Migreringen 7. juni (`migrate-mark-event-completed-fix.sql`) ble bygget på april-versjonen og fjernet tre ting som `migrate-host-completion-fix.sql` (31. mai) la inn: plast-unntaket for merke 14/15/28, host-rollen i rollesynken og slettingen av sjåførenes GPS-posisjoner. Ny versjon bygger på 31. mai-versjonen pluss specens endringer. Følge: 3 `driver_assignments`-rader på fullførte hendelser har fortsatt GPS-posisjon. Forslag: nullstille dem i migrering A (ikke merker, men prod-data, så det trenger OK).
2. **Kolonnene på `zone_assignments` legges inn i migrering A**, ikke B, fordi `mark_event_completed` (Del 4) skal nullstille hjelpeforespørsler (Del 2). Kolonnene er usynlige for gamle klienter.
3. **Del 3 og databasedelen av Del 1 og 2 er én migrering (B)**, fordi det er de samme funksjonene. Å skrive dem om to ganger gir dobbel risiko.
4. **Ny kolonne `zone_claims.via_help boolean`.** Specen vil vise "hjelper" i Samlere-lista, men sier ikke hvor det lagres. Kolonnen brukes også til å verifisere "Hjelpen er på vei"-pushen på serveren.
5. **Feilkode `ZONE_FULL` i stedet for `HELP_TAKEN`.** Databasen kan ikke skille "tapte kappløpet om hjelpeplassen" fra "sonen er full". Klienten vet at den trykket "Bli med som hjelper" og viser da den nøytrale teksten.
6. **Push-lenken får `&hjelp=1`** (`/kart?event=…&sone=…&hjelp=1`), så arket kan vise "De klarte seg likevel. Takk!" når forespørselen er lukket.
7. **Samtidighetstest 5 kan ikke kjøres med to sesjoner.** Verktøyet har bare én tilkobling per kall, og `dblink` finnes ikke. Erstattes med enkelt-sesjonsbevis (andre innsetting gir 0 rader / 23505) og Postgres' garanti for unike indekser.
8. **Mock-modus stubber ikke RPC-er.** Mock-testen dekker utseende og dialoger. Flytene testes med rollback-testene i SQL, og med en kveldstest på en "TEST, se bort fra denne"-hendelse etter deploy (egen OK).
9. **`reevaluate_event_badges` deler også ut Sjåfør/Stripsern (14/15)** til etterregistrerte sjåfører, ikke bare terskelmerker. Idempotent.
10. **`scripts/audit-badges.ts` slettes** sammen med `finalize-drivers`. Den har utdatert id-liste (mangler 68-84). Reserven er `scripts/backfill-deltakelse-merker.sql`.
11. **Repoet har ingen `CLAUDE.md`.** Specen ber om at triggeren nevnes der. Jeg lager en kort fil med bare driftskritiske fakta.
12. **`get_home_data` endres ikke.** Hjem trenger bare `status` for å vise "Ferdig" på `picked_up`.
13. **Kjent eksisterende oppførsel beholdes:** `mark_event_completed` sletter og setter inn Førstemann (28) for hendelsen på nytt. Det er ikke ny sletting, men nevnes fordi merkene er lodd.
14. Hjelper utover kapasitet gir f.eks. "3/2 samlere" i arket. Det er riktig (én ekstra hånd) og vises uendret.
15. Nedtrekkslista i admin/medlemmer viser de 10 siste **aktive eller fullførte** hendelsene. Kommende hendelser utelates, ellers havner fremtidige dugnader øverst.

---

## Filkart

**Nye filer**
- `scripts/migrate-deltakelsesmerker-i-db.sql` - migrering A (Del 4 + kolonner)
- `scripts/migrate-sone-sikkerhet-og-hjelp.sql` - migrering B (Del 3 + DB for Del 1/2)
- `scripts/tester/test-a-merker.sql` - rollback-tester for A (ekvivalens, bulk, fullfør x2, grants, unikhet)
- `scripts/tester/test-b-soner.sql` - rollback-tester for B (alle RPC-scenarioer)
- `app/api/push/notify-zone-help/route.ts` - push for hjelp
- `components/ui/UndoToast.tsx` - toast med "Angre"
- `CLAUDE.md` - driftskritiske fakta, inkl. triggeren

**Endrede filer**
- `lib/supabase/types.ts`, `lib/hooks/useRealtimeZones.ts`, `lib/mock/data.ts`
- `lib/map/zone-colors.ts`, `app/globals.css`
- `components/features/ZoneClaimSheet.tsx`, `components/features/MapInfoSheet.tsx`
- `components/map/ZoneLayer.tsx`, `components/map/ZoneMarkers.tsx`, `components/map/DugnadMap.tsx`
- `app/(app)/kart/page.tsx`, `app/(app)/sjafor/page.tsx`, `app/(app)/hjem/page.tsx`
- `app/api/export/event/route.ts`, `app/api/push/notify-drivers/route.ts`
- `app/api/badges/evaluate/route.ts`, `lib/badges/evaluator.ts`, `lib/badges/definitions.ts`
- `app/(app)/profil/page.tsx`, `components/features/onboarding/ProfileStep.tsx`
- `app/admin/hendelser/page.tsx`, `app/admin/hendelser/DesktopEventCard.tsx`, `app/admin/oversikt/page.tsx`
- `app/admin/medlemmer/page.tsx`, `components/admin/useMemberDetail.ts`, `components/admin/BadgeDetailSheet.tsx`, `components/admin/MemberDetailOverlay.tsx`, `components/admin/MemberDetailDesktop.tsx`
- `scripts/backfill-deltakelse-merker.sql`, `lib/driver/sync-role.ts` (kommentar), `lib/version.ts`

**Slettes**
- `app/api/events/finalize-drivers/route.ts`, `scripts/audit-badges.ts`

---

## Fase 1: Database (Del 4 og Del 3)

### Task 1: Migrering A - deltakelsesmerker i databasen

**Files:**
- Create: `scripts/migrate-deltakelsesmerker-i-db.sql`

**Interfaces:**
- Produces: kolonnene `zone_assignments.self_delivered/help_requested_at/help_requested_by/help_notified_at`, `zone_claims.via_help`; funksjonene `award_participation_badges(uuid[]) returns setof user_badges` (kun service_role), `event_participant_ids(uuid) returns uuid[]` (intern), `reevaluate_event_badges(uuid) returns integer` (admin), ny `mark_event_completed(uuid)`; indeks `user_badges_once_uniq`; trigger `user_badges_award_participation`.

Filen har ikke `begin/commit`, så testene kan pakke den inn i `begin ... rollback` og ekte kjøring i `begin ... commit`.

- [ ] **Steg 1: Skriv migreringsfila**

```sql
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

-- 8. (Krever OK fra Tor Martin) GPS-rester fra før regresjonen ble rettet.
update public.driver_assignments da
set latitude = null, longitude = null, accuracy = null,
    location_updated_at = null, location_sharing = false
from public.events e
where e.id = da.event_id and e.status = 'completed'
  and (da.latitude is not null or da.location_sharing);
```

- [ ] **Steg 2: Commit fila (ikke kjørt ennå)**

```bash
git add scripts/migrate-deltakelsesmerker-i-db.sql
git commit -m "Migrering A: deltakelsesmerker i databasen (ikke kjørt)"
```

### Task 2: Rollback-tester for migrering A

**Files:**
- Create: `scripts/tester/test-a-merker.sql`

**Interfaces:**
- Consumes: migrering A fra Task 1 (limes inn der det står `-- <MIGRERING A>`).

Kjøres via Supabase-MCP `execute_sql` mot `meotsqwtpemzbwhuozyq`. Verktøyet returnerer resultatet fra siste `select` før `rollback`. Etter hver test: et eget kall som bekrefter at ingenting ble lagret (`select count(*) from pg_proc where proname = 'award_participation_badges'` skal gi 0, og `user_badges`-antallet skal være uendret).

- [ ] **Steg 1: Førsjekk (specens test 0)**

```sql
select
  (select count(*) from (select user_id, badge_id from user_badges
     where event_id is null and badge_id in (1,2,3,4,5,6,8,9,12,16)
     group by 1, 2 having count(*) > 1) x) as duplikater,
  (select count(*) from user_badges ub join driver_assignments da
     on da.user_id = ub.user_id and da.event_id = ub.event_id and da.role = 'host'
     where ub.badge_id = 15) as host_15,
  (select count(*) from user_badges) as ub_totalt;
```
Forventet: `duplikater = 0`, `host_15 = 0` (begge var 0 den 28.09). Er noe ≠ 0: stopp og spør Tor Martin.

- [ ] **Steg 2: Ekvivalenstest (specens test 1)**

```sql
begin;
create temp table _forventet on commit drop as
with deltakelse as (
  select user_id, event_id from (
    select zc.user_id, za.event_id from zone_claims zc join zone_assignments za on za.id = zc.assignment_id
    union
    select sc.user_id, es.event_id from shift_claims sc join event_shifts es on es.id = sc.shift_id
    union
    select da.user_id, da.event_id from driver_assignments da where da.event_id is not null
    union
    select em.profile_id as user_id, em.event_id from event_musicians em
    union
    select ub.user_id, ub.event_id from user_badges ub
    join badges b on b.id = ub.badge_id and b.category in ('aktivitet','17mai','sommerkonsert','seminar')
    where ub.event_id is not null
  ) u
  join events e on e.id = u.event_id and e.status = 'completed'
  where u.user_id is not null
),
antall as (select user_id, count(distinct event_id) as n from deltakelse group by user_id)
select a.user_id, b.badge_id
from antall a cross join (values (1,1),(4,3),(8,10),(12,20)) as b(badge_id, terskel)
where a.n >= b.terskel
  and not exists (select 1 from user_badges ub where ub.user_id = a.user_id and ub.badge_id = b.badge_id);

-- <MIGRERING A>

create temp table _faktisk on commit drop as
  select user_id, badge_id from public.award_participation_badges(null);
create temp table _andre on commit drop as
  select user_id, badge_id from public.award_participation_badges(null);

select json_build_object(
  'forventet', (select count(*) from _forventet),
  'faktisk', (select count(*) from _faktisk),
  'kun_i_forventet', (select count(*) from (select * from _forventet except select * from _faktisk) x),
  'kun_i_faktisk', (select count(*) from (select * from _faktisk except select * from _forventet) y),
  'andre_kjoring', (select count(*) from _andre),
  'per_merke', (select json_object_agg(badge_id, n) from (select badge_id, count(*) n from _faktisk group by 1) z),
  'kjente', (select json_agg(json_build_object('navn', p.full_name, 'merke', f.badge_id))
             from _faktisk f join profiles p on p.id = f.user_id
             where p.full_name ilike any (array['%Hanne%','%Tesfagabir%','%Edel%']))
) as resultat;
rollback;
```
Forventet: `kun_i_forventet = 0`, `kun_i_faktisk = 0`, `andre_kjoring = 0`, og Hanne, Tesfagabir og Edel med i `kjente`. Er `forventet = 0` (noen har kjørt backfill nylig), sier jeg fra, fordi testen da ikke beviser noe, og foreslår en variant.

- [ ] **Steg 3: Vis resultatet til Tor Martin (sjekkpunkt).** Ingen ekte kjøring før OK.

- [ ] **Steg 4: Bulk via trigger som admin (specens test 2)**

Velger en ikke-admin med færrest fullførte deltakelser og 5 fullførte hendelser hen ikke deltok på, og setter inn 5 aktivitetsmerker (Kakeboss, id 17) i én setning som innlogget admin (RLS gjelder).

```sql
begin;
-- <MIGRERING A>
create temp table _ctx on commit drop as
select
  (select id from profiles where role = 'admin' order by created_at limit 1) as admin_id,
  (select p.id from profiles p
     where p.role = 'collector'
       and not exists (select 1 from user_badges ub where ub.user_id = p.id and ub.badge_id in (1,4))
     order by p.created_at limit 1) as bruker_id;
create temp table _ev on commit drop as
select e.id from events e, _ctx c
where e.status = 'completed'
  and not (c.bruker_id = any (public.event_participant_ids(e.id)))
order by e.date desc limit 5;
grant select on _ctx, _ev to authenticated;

select set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true) from _ctx;
set local role authenticated;
insert into user_badges (user_id, badge_id, event_id)
select c.bruker_id, 17, v.id from _ctx c, _ev v;
reset role;

select json_build_object(
  'hendelser', (select count(*) from _ev),
  'fro_spire', (select count(*) from user_badges ub, _ctx c where ub.user_id = c.bruker_id and ub.badge_id = 1),
  'tre_pa_rad', (select count(*) from user_badges ub, _ctx c where ub.user_id = c.bruker_id and ub.badge_id = 4),
  'nye_rader_totalt', (select count(*) from user_badges ub, _ctx c where ub.user_id = c.bruker_id and ub.awarded_at >= now())
) as resultat;
rollback;
```

Forventet: `hendelser = 5`, `fro_spire = 1`, `tre_pa_rad = 1`, `nye_rader_totalt = 7` (5 Kakeboss + Frøspire + Tre på rad). Ingen feil fra RLS.

- [ ] **Steg 5: Fullfør to ganger (specens test 3)**

```sql
begin;
-- <MIGRERING A>
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where role = 'admin' order by created_at limit 1),
                    'role', 'authenticated')::text, true);
set local role authenticated;
create temp table _t (steg text, ub bigint) on commit drop;
insert into _t select 'for', count(*) from user_badges;
select public.mark_event_completed((select id from events where type = 'bottle_collection' and status = 'completed' order by date desc limit 1));
insert into _t select 'etter_1', count(*) from user_badges;
select public.mark_event_completed((select id from events where type = 'bottle_collection' and status = 'completed' order by date desc limit 1));
insert into _t select 'etter_2', count(*) from user_badges;
reset role;
select json_object_agg(steg, ub) as resultat from _t;
rollback;
```
Forventet: `etter_2 = etter_1`. `etter_1 - for` er antall merker Flaskeinnsamling Sør 28.09 ville gitt (rapporteres, rulles tilbake).

- [ ] **Steg 6: Grants (specens test 4)**

```sql
begin;
-- <MIGRERING A>
create temp table _g (test text, utfall text) on commit drop;
grant insert on _g to anon, authenticated;
do $$
declare r text;
begin
  execute 'set local role anon';
  begin perform public.award_participation_badges(null); r := 'KJØRTE'; exception when insufficient_privilege then r := 'nektet'; end;
  insert into _g values ('anon award', r);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where role = 'collector' limit 1), 'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.award_participation_badges(null); r := 'KJØRTE'; exception when insufficient_privilege then r := 'nektet'; end;
  insert into _g values ('authenticated award', r);
  begin perform public.event_participant_ids(gen_random_uuid()); r := 'KJØRTE'; exception when insufficient_privilege then r := 'nektet'; end;
  insert into _g values ('authenticated participant_ids', r);
  begin perform public.reevaluate_event_badges(gen_random_uuid()); r := 'KJØRTE'; exception when others then r := sqlerrm; end;
  insert into _g values ('ikke-admin reevaluate', r);
  begin perform public.mark_event_completed(gen_random_uuid()); r := 'KJØRTE'; exception when others then r := sqlerrm; end;
  insert into _g values ('ikke-admin fullfør', r);
  execute 'reset role';
end $$;
select json_object_agg(test, utfall) as resultat from _g;
rollback;
```
Forventet: award og participant_ids "nektet"; reevaluate "Kun admin kan oppdatere merker"; fullfør "Kun admin kan markere hendelser som fullført".

- [ ] **Steg 7: Unikhet (erstatning for specens test 5)**

```sql
begin;
-- <MIGRERING A>
create temp table _u (test text, utfall text) on commit drop;
do $$
declare v_user uuid; n int;
begin
  select user_id into v_user from public.user_badges where badge_id = 1 and event_id is null limit 1;
  insert into public.user_badges (user_id, badge_id, event_id) values (v_user, 1, null) on conflict do nothing;
  get diagnostics n = row_count;
  insert into _u values ('on conflict do nothing', n::text || ' rader');
  begin
    insert into public.user_badges (user_id, badge_id, event_id) values (v_user, 1, null);
    insert into _u values ('vanlig insert', 'SATT INN');
  exception when unique_violation then insert into _u values ('vanlig insert', '23505');
  end;
end $$;
select json_object_agg(test, utfall) as resultat from _u;
rollback;
```
Forventet: `0 rader` og `23505`. To samtidige sesjoner gir samme utfall: den andre venter på den første og gjør så ingenting (Postgres' garanti for unike indekser).

- [ ] **Steg 8: Kontroll etter testene**

```sql
select (select count(*) from pg_proc where proname = 'award_participation_badges') as fn,
       (select count(*) from user_badges) as ub_totalt,
       (select count(*) from information_schema.columns where table_name = 'zone_assignments' and column_name = 'self_delivered') as kolonne;
```
Forventet: `fn = 0`, `kolonne = 0`, `ub_totalt` lik førsjekken.

- [ ] **Steg 9: Commit testfila**

```bash
git add scripts/tester/test-a-merker.sql
git commit -m "Rollback-tester for migrering A"
```

### Task 3: Migrering B - sone-sikkerhet og hjelp

**Files:**
- Create: `scripts/migrate-sone-sikkerhet-og-hjelp.sql`

**Interfaces:**
- Consumes: kolonnene fra migrering A.
- Produces (alle `returns void`, grant til `authenticated`):
  - `claim_zone(p_event_id uuid, p_zone_id text)`, `admin_claim_zone(p_event_id uuid, p_zone_id text, p_user_id uuid)`
  - `unclaim_zone(p_event_id uuid, p_zone_id text)`, `admin_unclaim_zone(p_event_id uuid, p_zone_id text, p_user_id uuid)`, `admin_reset_claims(p_event_id uuid)`
  - `mark_zone_complete(p_assignment_id uuid, p_self_delivered boolean default false)`
  - `uncomplete_zone(p_assignment_id uuid)`, `admin_uncomplete_zone(p_assignment_id uuid)`, `mark_zone_picked_up(p_assignment_id uuid)`
  - `request_zone_help(p_assignment_id uuid)`, `cancel_zone_help(p_assignment_id uuid)`
- Feilkoder i meldingen (UI matcher på prefiks, lesbar tekst etter kolon): `ZONE_FULL`, `ZONE_FINISHED`, `ALREADY_CLAIMED`, `NOT_ALLOWED`, `NOT_BOTTLE`, `EVENT_NOT_ACTIVE`, `NO_COLLECTORS`, `NOT_COMPLETED`.

- [ ] **Steg 1: Skriv migreringsfila**

```sql
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
```

- [ ] **Steg 2: Commit fila (ikke kjørt ennå)**

```bash
git add scripts/migrate-sone-sikkerhet-og-hjelp.sql
git commit -m "Migrering B: sone-sikkerhet og hjelp (ikke kjørt)"
```

### Task 4: Rollback-tester for migrering B

**Files:**
- Create: `scripts/tester/test-b-soner.sql`

**Interfaces:**
- Consumes: migrering A og B (limes inn i rekkefølge).

Testen lager en midlertidig aktiv flaskehendelse med én bottle-sone og én lapper-sone, bruker ekte profiler som testpersoner og rulles tilbake. Uncommitted data sendes ikke via Realtime, og hendelsen blir aldri synlig for andre.

- [ ] **Steg 1: Skriv testfila**

Oppsettet lager id-ene i `_ctx` som postgres. Deretter kjøres alt som `authenticated`, og brukerbytte skjer med `pg_temp.som(id)`, som bare setter JWT-claims. Hvert steg skriver forventet og faktisk utfall til `_r`.

```sql
begin;
-- <MIGRERING A>
-- <MIGRERING B>

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
grant all on _r, _ctx to authenticated;
grant usage on sequence _r_nr_seq to authenticated;
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
```
(`_r` og `_r_nr_seq` må også få `grant` til `anon` for steg 24.)

Forventet: alle 24 steg `ok = true`. Steg 22 gir i tillegg terskelmerker til testpersonene, men alt rulles tilbake.

- [ ] **Steg 2: Kjør, vis resultat til Tor Martin, og kjør kontrollen** (`select count(*) from events where title = 'TEST rollback'` → 0, `pg_proc` for `request_zone_help` → 0).

- [ ] **Steg 3: Commit**

```bash
git add scripts/tester/test-b-soner.sql
git commit -m "Rollback-tester for migrering B"
```

### Task 5: Sjekkpunkt og ekte kjøring av migreringene

- [ ] **Steg 1:** Vis Tor Martin migrering A, B og testresultatene. Vent på eksplisitt OK for hver migrering, og for punkt 8 i A (GPS-rester).
- [ ] **Steg 2:** Fersk backup: `node scripts/backup-db.mjs` (sjekk at alle tabeller kom med).
- [ ] **Steg 3:** Kjør A: `begin; <A>; commit;` via MCP. Kjør deretter `notify pgrst, 'reload schema';`.
- [ ] **Steg 4:** Verifiser A: indeks, trigger og funksjoner finnes; grants som forventet; `select count(*) from user_badges` er uendret (A setter ikke inn merker selv).
- [ ] **Steg 5:** Kjør B: `begin; <B>; commit;`, så `notify pgrst, 'reload schema';`.
- [ ] **Steg 6:** Verifiser B: én `mark_zone_complete`, policyene på `zone_claims`, kolonnegrant for `notes`.
- [ ] **Steg 7:** Røyktest med dagens (gamle) frontend i prod: åpne kartet for Lappeutdeling Nord (aktiv) som admin og sjekk at arket laster og at notater kan lagres. Ingen klikk som endrer data uten Tor Martins OK.

Merk: Migreringene er trygge for dagens frontend. Frontend deployes først når Tor Martin sier OK.

---

## Fase 2: Merker i frontend (Del 4 TS)

### Task 6: Evaluator og evaluate-ruten

**Files:**
- Modify: `app/api/badges/evaluate/route.ts`, `lib/badges/evaluator.ts`, `lib/badges/definitions.ts`
- Modify: `app/(app)/profil/page.tsx:12,298`, `components/features/onboarding/ProfileStep.tsx:7,92`, `components/features/ZoneClaimSheet.tsx:12,109,147`

**Interfaces:**
- Produces: `evaluateMyBadges(): Promise<number[]>`; `PARTICIPATION_CATEGORIES: ReadonlySet<BadgeCategory>` i `definitions.ts`.

- [ ] **Steg 1:** I `definitions.ts`, legg til under `STACKABLE_BADGE_CATEGORIES`:

```ts
// Merker i disse kategoriene teller som deltakelse når de er koblet til en hendelse.
// Speiles i SQL: award_participation_badges, event_participant_ids og
// triggeren award_participation_on_badge_insert (scripts/migrate-deltakelsesmerker-i-db.sql).
export const PARTICIPATION_CATEGORIES: ReadonlySet<BadgeCategory> = new Set(['aktivitet', '17mai', 'sommerkonsert', 'seminar'])
```

- [ ] **Steg 2:** I `evaluator.ts`: gi funksjonen nytt navn `evaluateMyBadges()` uten argument (kroppen er uendret, den brukte aldri `userId`). Oppdater de tre kallstedene til `evaluateMyBadges()`.

- [ ] **Steg 3:** I ruten: fjern `PARTICIPATION_BADGE_IDS`, deltakelsesinnsamlingen (kilde 2-5, `completedEvents`) og merkene 1, 4, 8, 12. Behold 2, 3, 5, 6, 9, 16 (de trenger bare `userClaims`, `zoneMap` og profilen). Bytt innsettingen til:

```ts
  // Engangsmerker har unik indeks (user_badges_once_uniq). Sett inn én og én og
  // ignorer 23505: supabase-js kan ikke peke på en partial index i upsert.
  const awarded: number[] = []
  for (const badgeId of toAward) {
    const { error } = await supabase.from('user_badges').insert({ user_id: userId, badge_id: badgeId, event_id: null })
    if (error && error.code !== '23505') throw new Error(`Kunne ikke tildele merke ${badgeId}: ${error.message}`)
    if (!error) awarded.push(badgeId)
  }

  // Terskelmerkene (1, 4, 8, 12) eies av databasen, én kilde til sannhet.
  const { data: thresholdRows, error: rpcError } = await supabase.rpc('award_participation_badges', { p_user_ids: [userId] })
  if (rpcError) throw new Error(`Kunne ikke tildele deltakelsesmerker: ${rpcError.message}`)
  for (const row of (thresholdRows || []) as Array<{ badge_id: number }>) awarded.push(row.badge_id)

  return awarded
```

- [ ] **Steg 4:** `npx tsc --noEmit` → ingen feil.
- [ ] **Steg 5:** Commit (`APP_VERSION = '10.41.0'`).

```bash
git add -A lib/badges app/api/badges "app/(app)/profil/page.tsx" components/features/onboarding/ProfileStep.tsx components/features/ZoneClaimSheet.tsx lib/version.ts
git commit -m "Terskelmerker fra databasen, evaluateMyBadges uten argument (v10.41.0)"
```

### Task 7: Én fullføringsvei og etterregistrering

**Files:**
- Modify: `app/admin/hendelser/page.tsx` (L12, L488-552, L1977-2046, L2308-2333, L2512-2571), `app/admin/hendelser/DesktopEventCard.tsx` (L196-203, L416-430), `app/admin/oversikt/page.tsx` (L64-67, knapp L278-286)
- Delete: `app/api/events/finalize-drivers/route.ts`, `scripts/audit-badges.ts`
- Modify: `lib/driver/sync-role.ts:3` (kommentar), `scripts/backfill-deltakelse-merker.sql`

**Interfaces:**
- Consumes: RPC `mark_event_completed(p_event_id)`, `reevaluate_event_badges(p_event_id) → integer`.

- [ ] **Steg 1:** `admin/hendelser`: fjern `evaluateBadges`-importen og hele blokka L503-514 (zone_claims-henting og løkka). Etter vellykket RPC går flyten rett videre. Kommentar: `// mark_event_completed deler ut alle terskelmerker i databasen (alle kilder).`

- [ ] **Steg 2:** `admin/hendelser`: ny state `const [noticeMsg, setNoticeMsg] = useState<string | null>(null)` og en nøytral banner under feilbanneret (samme markup som L2211-2219, men `bg-success/10 text-success`). Ny handler:

```ts
  async function handleReevaluate(eventId: string) {
    setUpdatingId(eventId)
    setErrorMsg(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseRef.current.rpc as any)('reevaluate_event_badges', { p_event_id: eventId })
    if (error) setErrorMsg(`Kunne ikke oppdatere merker: ${error.message}`)
    else setNoticeMsg(data === 0 ? 'Merkene var allerede oppdatert.' : `${data} nye merker delt ut.`)
    setUpdatingId(null)
  }
```

Knapp i mobil-lista rett etter "Eksporter CSV" (L2034-2046), samme stil (`Button size="sm" variant="secondary"`), ikon `Award`, tekst "Oppdater merker". På desktop: ny prop `onReevaluate` på `DesktopEventCard`, knapp `EventActionButton variant="secondary" icon={<Award size={14} />}` etter "Eksporter CSV".

- [ ] **Steg 3:** `admin/oversikt`: `handleStatusChange` for `completed` kaller RPC-en og viser feil:

```ts
  async function handleStatusChange(eventId: string, newStatus: EventStatus) {
    setUpdatingId(eventId)
    setErrorMsg(null)
    const { error } = newStatus === 'completed'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await (supabaseRef.current.rpc as any)('mark_event_completed', { p_event_id: eventId })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : await (supabaseRef.current.from('events') as any).update({ status: newStatus }).eq('id', eventId)
    if (error) setErrorMsg(`Kunne ikke endre status: ${error.message}`)
    // … resten uendret (reload)
  }
```
Legg til `errorMsg`-state og samme feilbanner-markup som i admin/hendelser øverst i innholdet.

- [ ] **Steg 4:** Slett `finalize-drivers` og `audit-badges.ts`. Oppdater kommentaren i `sync-role.ts` til å peke på `mark_event_completed`. Skriv `backfill-deltakelse-merker.sql` om til:

```sql
-- Reserve: del ut terskelmerker (Frøspire 1, Tre på rad 4, Ringrev 8, Maskin 12)
-- til alle som kvalifiserer. Logikken ligger i databasen siden 2026-09-28
-- (scripts/migrate-deltakelsesmerker-i-db.sql) og kjøres automatisk ved Fullfør
-- og når event-koblede deltakelsesmerker settes inn. Idempotent.
select u.badge_id, p.full_name
from public.award_participation_badges(null) u
join public.profiles p on p.id = u.user_id
order by u.badge_id, p.full_name;
```

- [ ] **Steg 4b:** `app/api/events/recompute-first-user/route.ts`: hent `events.type` og returner tidlig (`{ skipped: 'plast' }`) for `plast`, før Førstemann slettes/settes. Samme regel som i `mark_event_completed` (godkjent av Tor Martin 29.09). Førstemann til plastdugnaden 31. mai blir liggende.

- [ ] **Steg 5:** `npx tsc --noEmit` og `grep -rn "finalize-drivers\|audit-badges\|evaluateBadges(" app lib components scripts` → ingen treff utenom kommentarer.
- [ ] **Steg 6:** Commit (`10.41.1`).

### Task 8: Hendelsesvalg ved manuell merkeutdeling

**Files:**
- Modify: `app/admin/medlemmer/page.tsx` (L88-93 henting, L212-232 `handleAwardBadge`, L317-328, L586-598)
- Modify: `components/admin/useMemberDetail.ts` (L51-69), `components/admin/BadgeDetailSheet.tsx`, `components/admin/MemberDetailOverlay.tsx:257`, `components/admin/MemberDetailDesktop.tsx:267`

**Interfaces:**
- Produces: `type AwardResult = 'ok' | 'duplicate' | 'error'`; `onAwardBadge(badgeId: number, eventId: string | null) => Promise<AwardResult>`; `interface AwardEventOption { id: string; title: string; date: string; status: string }`.

- [ ] **Steg 1:** `medlemmer/page.tsx` henter hendelser i samme `Promise.all`:

```ts
supabaseRef.current.from('events').select('id, title, date, status')
  .in('status', ['active', 'completed']).order('date', { ascending: false }).limit(10)
```
Lagres i `awardEvents: AwardEventOption[]`. Standardvalg: første aktive, ellers første (nyeste) fullførte.

- [ ] **Steg 2:** `handleAwardBadge(userId, badgeId, eventId)` setter inn `event_id: eventId`. Returnerer `'duplicate'` ved `error.code === '23505'`, `'error'` ved annen feil. Ved `'ok'` hentes brukerens merker på nytt (`from('user_badges').select('*').eq('user_id', userId)`) og erstatter brukerens rader i `userBadges`. Da vises Tre på rad o.l. som triggeren delte ut.

- [ ] **Steg 3:** `useMemberDetail.handleAward(badgeId, eventId)`:

```ts
    const result = await onAwardBadge(badgeId, eventId)
    if (result === 'duplicate') { showToast(`${firstName} har allerede dette merket for denne dugnaden`); return }
    if (result === 'error') { showToast('Kunne ikke lagre merket, prøv igjen'); return }
    // eksisterende suksesstekster uendret
```
(`firstName` = første ord i profilens `full_name`.)

- [ ] **Steg 4:** `BadgeDetailSheet` får props `events: AwardEventOption[]`, `defaultEventId: string | null`. Når `PARTICIPATION_CATEGORIES.has(badge.category)` og merket ikke er automatisk, vises over "Gi merket"-knappen:

```tsx
<label className="block text-xs font-medium text-text-secondary mb-1.5">Dugnad</label>
<select
  value={eventId ?? ''}
  onChange={e => setEventId(e.target.value || null)}
  className="w-full appearance-none box-border min-h-[42px] px-3 rounded-[12px] bg-surface-low text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/30 mb-3"
>
  {events.map(ev => (
    <option key={ev.id} value={ev.id}>{ev.title} · {formatShortDate(ev.date)}</option>
  ))}
  <option value="">Ingen hendelse</option>
</select>
```
`onAward` kalles med `eventId` (null for andre kategorier). `eventId`-state nullstilles til `defaultEventId` når arket åpnes. `formatShortDate`: gjenbruk eksisterende datohelper i `lib/utils/date.ts` hvis den finnes, ellers `toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })`.

- [ ] **Steg 5:** Overlay og Desktop sender `events`/`defaultEventId` videre og kaller `handleAward(selectedBadgeId, eventId)`.
- [ ] **Steg 6:** `npx tsc --noEmit`. Commit (`10.41.2`).

---

## Fase 3: Tatt med selv (Del 1)

### Task 9: Typer, sanntid og mock-data

**Files:**
- Modify: `lib/supabase/types.ts:119-124,197`, `lib/hooks/useRealtimeZones.ts:9-13,82-92`, `lib/mock/data.ts:104-243,246-305`

**Interfaces:**
- Produces: `ZoneAssignment` med `self_delivered: boolean; help_requested_at: string | null; help_requested_by: string | null; help_notified_at: string | null`. `ZoneWithStatus` med `self_delivered: boolean; help_requested_at: string | null; help_requested_by: string | null`, og `claims[]` med `via_help: boolean`.

- [ ] **Steg 1:** Typer. Insert-typen skal ikke kreve de nye feltene:

```ts
type ZoneAssignmentDefaults = 'id' | 'self_delivered' | 'help_requested_at' | 'help_requested_by' | 'help_notified_at'
// zone_assignments:
Insert: Omit<ZoneAssignment, ZoneAssignmentDefaults> & Partial<Pick<ZoneAssignment, ZoneAssignmentDefaults>>
```

- [ ] **Steg 2:** `useRealtimeZones`: i mappingen, etter `status`:

```ts
        self_delivered: assignment?.self_delivered ?? false,
        help_requested_at: assignment?.help_requested_at ?? null,
        help_requested_by: assignment?.help_requested_by ?? null,
```
og i claims-mappingen `via_help: c.via_help ?? false`.

- [ ] **Steg 3:** Mock: `makeZone` får `selfDelivered`, `helpRequestedAt`, `helpRequestedBy`. Endre mock-scenariet så alle nye tilstander vises samtidig:
  - N3 (brukerens, `claimed`): hjelp åpen, bedt om av `MOCK_USER_ID`.
  - N4 (annens, `claimed`, full): hjelp åpen, bedt om av en annen. Viser pillen og "Bli med som hjelper".
  - N8 (`picked_up`): `selfDelivered: true`.
  - Én claim i N1 med `via_help: true`.
  - `mockDriverZones`: én hentet sone med `selfDelivered: true`.

- [ ] **Steg 4:** `npx tsc --noEmit`. Commit (`10.41.3`).

### Task 10: Ferdigmelding med "Hvor er panten nå?" og angre-toast

**Files:**
- Create: `components/ui/UndoToast.tsx`
- Modify: `components/features/ZoneClaimSheet.tsx` (L32-40, L135-161, L163-178, L514-543, L580-585), `app/(app)/kart/page.tsx` (L105, L230-231, L374-387)

**Interfaces:**
- Produces: `ZoneClaimSheet` prop `onSelfDelivered?: (info: { assignmentId: string; asClaimer: boolean }) => void`. `UndoToast` props `{ message: string | null; actionLabel: string; onAction: () => void; onDone: () => void; durationMs?: number }`.

- [ ] **Steg 1:** `UndoToast`: fast pille nederst (samme uttrykk som `MemberToast`, men `pointer-events-auto`), tekst + knapp med minst 44 px høyde. Lukker seg selv etter `durationMs` (5000) med `useEffect`/`setTimeout`, og straks ved trykk på knappen.

```tsx
'use client'
import { useEffect } from 'react'

interface UndoToastProps { message: string | null; actionLabel: string; onAction: () => void; onDone: () => void; durationMs?: number }

export default function UndoToast({ message, actionLabel, onAction, onDone, durationMs = 5000 }: UndoToastProps) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, durationMs)
    return () => clearTimeout(t)
  }, [message, durationMs, onDone])
  if (!message) return null
  return (
    <div role="status" className="fixed left-4 right-4 bottom-24 z-[60] mx-auto max-w-sm flex items-center gap-3 pl-4 pr-1 rounded-full bg-text-primary text-bg shadow-md">
      <span className="flex-1 text-sm py-3">{message}</span>
      <button onClick={() => { onAction(); onDone() }} className="min-h-[44px] px-4 text-sm font-bold text-accent active:opacity-70">
        {actionLabel}
      </button>
    </div>
  )
}
```
(Sjekk mot `MemberToast.tsx` at `bg-text-primary`/`text-bg` finnes som tokens, ellers bruk samme klasser som den.)

- [ ] **Steg 2:** `getDisplayStatus`: første linje blir

```ts
  if (zone.status === 'picked_up') return { label: zone.self_delivered ? 'Tatt med selv' : 'Hentet', color: 'bg-purple' }
```

- [ ] **Steg 3:** `handleComplete(selfDelivered = false)`:

```ts
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('mark_zone_complete', {
      p_assignment_id: zone.assignment_id,
      p_self_delivered: selfDelivered,
    })
    …
    if (zone.zone_type === 'bottle' && !selfDelivered) notifyDrivers()
    else if (zone.zone_type === 'lapper') notifyAdmin(zone.name)
    if (selfDelivered) onSelfDelivered?.({ assignmentId: zone.assignment_id, asClaimer: userHasClaimed })
```
`notifyDrivers()` sender `{ assignmentId: zone.assignment_id, zoneId: zone.id, eventId }` (ingen `zoneName`, se Task 12).

- [ ] **Steg 4:** Bekreftelsesboksen for bottle (lapper og plast beholder dagens boks uendret):

```tsx
{showCompleteConfirm && zone.zone_type === 'bottle' && (
  <div className="rounded-2xl border border-success/20 bg-success/5 p-4">
    <p className="text-[15px] font-medium text-center mb-3">Hvor er panten nå?</p>
    <button onClick={() => handleComplete(false)} disabled={loading}
      className="w-full min-h-[44px] py-3 rounded-full bg-success text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-40">
      {loading ? 'Sender...' : 'Klar for henting'}
      <span className="block text-xs font-medium opacity-90">Sjåførene får beskjed.</span>
    </button>
    <button onClick={() => handleComplete(true)} disabled={loading}
      className="w-full min-h-[44px] mt-3 py-2 rounded-full text-success font-semibold text-sm active:bg-success/10 disabled:opacity-40">
      Jeg har tatt med alt selv
      <span className="block text-xs font-medium text-text-secondary">Ingenting å hente.</span>
    </button>
    <button onClick={() => setShowCompleteConfirm(false)} className="w-full mt-1 py-2 text-xs text-text-tertiary">
      Avbryt
    </button>
  </div>
)}
```
Hovedvalget nederst i boksen hadde ligget bedre for tommelen, men "Klar for henting" øverst gjør det til første, store, fylte valg rett under der "Marker som ferdig" ble trykket. `mt-3` gir 12 px luft.

- [ ] **Steg 5:** "Angre ferdigmelding" vises når `(zone.status === 'completed' || (zone.status === 'picked_up' && zone.self_delivered)) && (userHasClaimed || isAdmin)`.

- [ ] **Steg 6:** Kartsiden:
  - `selectedZone` lagres som id: `const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)` og `const selectedZone = zones.find(z => z.id === selectedZoneId) ?? null`. Alle `setSelectedZone(zone)` blir `setSelectedZoneId(zone.id)`, `setSelectedZone(null)` blir `setSelectedZoneId(null)`. Da oppdateres et åpent ark live.
  - Toast:

```tsx
const [undoInfo, setUndoInfo] = useState<{ assignmentId: string; asClaimer: boolean } | null>(null)
async function handleUndoSelfDelivered() {
  if (!undoInfo) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseRef.current.rpc as any)(undoInfo.asClaimer ? 'uncomplete_zone' : 'admin_uncomplete_zone', { p_assignment_id: undoInfo.assignmentId })
  refetch()
}
…
<ZoneClaimSheet … onSelfDelivered={setUndoInfo} />
<UndoToast message={undoInfo ? 'Registrert: ingenting å hente.' : null} actionLabel="Angre"
  onAction={handleUndoSelfDelivered} onDone={() => setUndoInfo(null)} />
```
(`onDone` pakkes i `useCallback` så timeren ikke startes på nytt ved hver render.)

- [ ] **Steg 7:** `npx tsc --noEmit`. Commit (`10.41.4`).

### Task 11: Sjåførside, Hjem og eksport

**Files:**
- Modify: `app/(app)/sjafor/page.tsx` (L15-25, L203-209, L287-306, L600-610), `app/(app)/hjem/page.tsx` (L352-374), `app/api/export/event/route.ts` (L52-55, L200)

- [ ] **Steg 1:** Sjåfør: select `'id, event_id, zone_id, status, self_delivered'`, `DriverZone.selfDelivered: boolean`, mapping `selfDelivered: a.self_delivered ?? false`. I lista over hentede soner (L600-610):

```tsx
<span className={zone.selfDelivered ? 'text-text-tertiary' : …eksisterende klasse}>
  {zone.selfDelivered ? 'Tatt med av plukker' : 'Hentet'}
</span>
```
Og sonenavnet dempes (`opacity-60`) for `selfDelivered`.

- [ ] **Steg 2:** Hjem: innfør `const isDone = zone.status === 'completed' || zone.status === 'picked_up'` og bruk `isDone` i stedet for `zone.status === 'completed'` på L352, L354 og L367.

- [ ] **Steg 3:** Eksport: select `'id, zone_id, status, self_delivered'`, og

```ts
    const hentet = a.status === 'picked_up' ? (a.self_delivered ? 'Tatt med selv' : 'Ja') : ''
```

- [ ] **Steg 4:** `npx tsc --noEmit`. Commit (`10.41.5`).

### Task 12: notify-drivers sikres (Del 3)

**Files:**
- Modify: `app/api/push/notify-drivers/route.ts` (L23-58)

- [ ] **Steg 1:** Erstatt claim-sjekken og `zoneName` fra klienten:

```ts
  const body = await request.json()
  // Nye klienter sender assignmentId. Gamle cachede klienter sender zoneId + eventId.
  let query = supabase.from('zone_assignments').select('id, event_id, zone_id, status, self_delivered, zones(name, area, trailer_group)')
  if (body.assignmentId) query = query.eq('id', body.assignmentId)
  else if (body.zoneId && body.eventId) query = query.eq('event_id', body.eventId).eq('zone_id', body.zoneId)
  else return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })
  const { data: assignment } = await query.maybeSingle()
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (assignment.status !== 'completed') return NextResponse.json({ skipped: 'not completed' })

  const [{ data: claim }, { data: profile }] = await Promise.all([
    supabase.from('zone_claims').select('id').eq('assignment_id', assignment.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ])
  if (!claim && profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const zone = assignment.zones as unknown as { name: string; area: string; trailer_group: number | null }
  const zoneName = zone.name
  const eventId = assignment.event_id
  const zoneArea = zone.area
  const zoneTrailerGroup = zone.trailer_group
```
Resten (tier 1, tier 2, fallback) bruker disse variablene uendret. `status !== 'completed'` betyr at "tatt med selv" (picked_up) aldri gir sjåførpush, heller ikke fra en gammel klient.

- [ ] **Steg 2:** `npx tsc --noEmit`. Commit (`10.41.6`).

---

## Fase 4: Be om en ekstra hånd (Del 2)

### Task 13: Farge, kartlag og markør

**Files:**
- Modify: `lib/map/zone-colors.ts`, `app/globals.css` (L31-36, L79-83, L109-112), `components/map/ZoneLayer.tsx` (L82-87, etter L145), `components/map/ZoneMarkers.tsx`, `components/map/DugnadMap.tsx:124`, `components/features/MapInfoSheet.tsx:10-28`

**Interfaces:**
- Produces: `ZONE_COLORS.help = '#EF7A1A'`; CSS-token `--color-zone-help` (klassene `bg-zone-help`, `text-zone-help`, `border-zone-help`); `ZoneMarkers` prop `onZoneClick?: (zone: ZoneWithStatus) => void`; hjelper `isHelpOpen(zone)` i `lib/map/zone-colors.ts`.

- [ ] **Steg 1:** Farge:

```ts
  help: '#EF7A1A', // hjelp ønskes (oransje omriss og pille, hvit tekst)
```
og i `globals.css` `--color-zone-help: #EF7A1A;` i lys @theme, `[data-theme="dark"]` og system-mørk-blokka. Hjelper i samme fil:

```ts
// Åpen hjelpeforespørsel: bare flaskesoner som ikke er ferdige
export function isHelpOpen(zone: { zone_type: string; status: string; help_requested_at: string | null }) {
  return zone.zone_type === 'bottle' && !!zone.help_requested_at && zone.status !== 'completed' && zone.status !== 'picked_up'
}
```

- [ ] **Steg 2:** `ZoneLayer`: property `helpOpen: zone ? isHelpOpen(zone) : false` i feature-properties, og et nytt lag etter `zone-line` på samme source:

```tsx
<Layer id="zone-help-line" type="line" filter={['==', ['get', 'helpOpen'], true]}
  paint={{ 'line-color': ZONE_COLORS.help, 'line-width': 2.5 }} />
```
Fyllfargene er uendret.

- [ ] **Steg 3:** `ZoneMarkers`: vis markør også når `helpOpen`. Rekkefølge: ferdig-hake, så plukkerens "DU" (med oransje prikk når hjelp er åpen), så pillen for alle andre. Maks én markør per sone, og pillen og haken kan aldri vises samtidig fordi `isHelpOpen` er usann for ferdige soner.

```tsx
const helpOpen = isHelpOpen(zone)
if (!isMine && !isCompleted && !isPickedUp && !helpOpen) return null
…
{isCompleted || isPickedUp ? (/* hake, uendret */) : isMine ? (
  <div className="relative px-2 py-0.5 rounded-full bg-accent text-white text-[11px] font-bold shadow-md border-2 border-white">
    DU
    {helpOpen && <span aria-label="Venter på hjelp" className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-zone-help border border-white" />}
  </div>
) : helpOpen ? (
  <button type="button" onClick={(e) => { e.stopPropagation(); onZoneClick?.(zone) }}
    className="relative isolate px-2.5 py-1 rounded-full bg-zone-help text-white text-[11px] font-bold shadow-md border-2 border-white">
    <span aria-hidden className="next-beacon absolute inset-0 -z-10 rounded-full bg-zone-help/50" />
    Hjelp ønskes
  </button>
) : null}
```
Pulsen kommer fra `.next-beacon`, som bare animeres innenfor `prefers-reduced-motion: no-preference`. Avvik fra specen: alle plukkerne på sonen ser "DU" med prikk, ikke bare den som ba om hjelp.

- [ ] **Steg 4:** `DugnadMap` sender `onZoneClick` videre til `ZoneMarkers`. `MapInfoSheet`: ny forklaringsrad "Hjelp ønskes" med oransje omriss, bare for flaskeinnsamling.

- [ ] **Steg 5:** `npx tsc --noEmit`. Commit (`10.41.7`).

### Task 14: Arket, brikken og kappløpet

**Files:**
- Modify: `components/features/ZoneClaimSheet.tsx`, `app/(app)/kart/page.tsx` (L65, L136-151, L217-222, L314-335)

**Interfaces:**
- Consumes: RPC-ene `request_zone_help`, `cancel_zone_help`, `claim_zone`, `admin_claim_zone`; route `/api/push/notify-zone-help` (Task 15) med body `{ assignmentId: string; kind: 'request' | 'joined' }`.
- Produces: `ZoneClaimSheet` prop `fromHelpLink?: boolean`.

- [ ] **Steg 1:** Avledede flagg i arket:

```ts
  const isBottle = zone.zone_type === 'bottle'
  const helpOpen = isHelpOpen(zone)
  const canClaim = eventId && !userHasClaimed && !isFinished && (!isFull || helpOpen)
  const canRequestHelp = eventId && isBottle && !isFinished && !helpOpen && zone.claims.length > 0 && (userHasClaimed || isAdmin)
  const canManageHelp = helpOpen && (userHasClaimed || isAdmin)
```
Ny state: `showHelpConfirm`, `notice` (nøytral melding).

- [ ] **Steg 2:** Statuslabel: i `getDisplayStatus`, rett etter ferdig-linjene: `if (isHelpOpen(zone)) return { label: 'Hjelp ønskes', color: 'bg-zone-help' }`.

- [ ] **Steg 3:** Claim med kappløp:

```ts
  async function handleClaim() {
    if (!eventId) return
    const joiningAsHelper = helpOpen
    setLoading(true); setError(null); setNotice(null)
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('claim_zone', { p_event_id: eventId, p_zone_id: zone!.id })
    if (rpcError) {
      if (joiningAsHelper && rpcError.message?.startsWith('ZONE_FULL')) setNotice('Noen kom deg i forkjøpet. Sonen har fått hjelp.')
      else setError('Kunne ikke ta sonen. Prøv igjen.')
      setLoading(false)
      return
    }
    if (joiningAsHelper) notifyZoneHelp('joined')
    // resten uendret (evaluateMyBadges, recomputeFirstUser, onAction)
  }
```
Knappteksten: `helpOpen ? 'Bli med som hjelper' : 'Ta denne sonen'`. `notice` vises i `bg-surface-low text-text-secondary`-boks, ikke i den røde.

- [ ] **Steg 4:** Be om og avbryt:

```ts
  async function handleRequestHelp() {
    if (!zone?.assignment_id) return
    setLoading(true); setError(null)
    const { error: rpcError } = await (supabaseRef.current.rpc as any)('request_zone_help', { p_assignment_id: zone.assignment_id })
    if (rpcError) { setError('Kunne ikke be om hjelp. Prøv igjen.'); setLoading(false); return }
    notifyZoneHelp('request')
    setShowHelpConfirm(false); setShowUnclaimConfirm(false)
    setLoading(false)
  }
  async function handleCancelHelp() {
    if (!zone?.assignment_id) return
    await (supabaseRef.current.rpc as any)('cancel_zone_help', { p_assignment_id: zone.assignment_id })
  }
  async function notifyZoneHelp(kind: 'request' | 'joined') {
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      if (!session) return
      await fetch('/api/push/notify-zone-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ assignmentId: zone!.assignment_id, kind }),
      })
    } catch { /* push-feil er ikke kritisk */ }
  }
```
Arket lukkes ikke etter be/avbryt (ingen `onAction()`), så plukkeren ser "Venter på en ekstra hånd" med en gang via sanntid.

- [ ] **Steg 5:** UI i handlingsområdet, i denne rekkefølgen:
  - Hovedknappen (`canClaim`) som i dag, med ny tekst ved `helpOpen`.
  - "Tildel medlem": betingelsen blir `isAdmin && (!isFull || helpOpen) && !isFinished && !showMemberPicker`.
  - "Marker som ferdig" uendret.
  - Når `canManageHelp`: `<p className="text-sm text-text-secondary text-center py-2">Venter på en ekstra hånd · <button onClick={handleCancelHelp} className="text-accent font-semibold">Avbryt</button></p>`
  - Når `canRequestHelp && !showHelpConfirm && !showUnclaimConfirm && !showCompleteConfirm && !editingNote`: tekstknapp `w-full text-accent text-xs font-semibold py-2` "Be om en ekstra hånd", rett over "Gi opp sonen".
  - Bekreftelse (samme boksmønster som gi opp, men `border-accent/20 bg-accent/5`): "Plukkerne i innsamlingen får varsel. Første som melder seg, blir med." med "Avbryt" / "Be om hjelp".
  - I "Gi opp sonen"-boksen, under teksten, når `canRequestHelp`: `<p className="text-sm text-text-secondary mt-2">Heller få hjelp? <button onClick={handleRequestHelp} className="text-accent font-semibold">Be om en ekstra hånd</button></p>`
  - "Sonen er full"-teksten vises bare når `!helpOpen`. Når `fromHelpLink && isFull && !helpOpen && !userHasClaimed && !isFinished` vises i stedet "De klarte seg likevel. Takk!".

- [ ] **Steg 6:** Samlere-lista: etter navnet, når `claim.via_help`: `<span className="text-[11px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">hjelper</span>`.

- [ ] **Steg 7:** Kartsiden:
  - `const fromHelpLink = searchParams.get('hjelp') === '1'` sendes til arket.
  - `const helpZones = assignedZones.filter(isHelpOpen).sort((a, b) => a.help_requested_at!.localeCompare(b.help_requested_at!))`
  - Brikke på egen linje under tellerprikkene (L314-335), bare når `helpZones.length > 0`:

```tsx
<button onClick={() => openZone(helpZones[0])}
  className="mt-2 inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-full bg-card shadow-sm text-xs font-semibold text-text-primary active:scale-[0.98]">
  <span className="w-2 h-2 rounded-full bg-zone-help" />
  {helpZones.length === 1 ? '1 sone trenger hjelp' : `${helpZones.length} soner trenger hjelp`}
</button>
```
  - `openZone(zone)`: finn geometrien som i `?sone=`-flyten (L144-146), `setFlyTarget({ lng, lat, zoom: 16 })` og `setSelectedZoneId(zone.id)`. Samme `openZone` sendes som `onZoneClick` til kartet, så pillen åpner arket.

- [ ] **Steg 8:** `npx tsc --noEmit`. Commit (`10.41.8`).

### Task 15: Push-ruten notify-zone-help

**Files:**
- Create: `app/api/push/notify-zone-help/route.ts`

- [ ] **Steg 1:** Skriv ruten:

```ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push/server'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const COOLDOWN_MS = 10 * 60 * 1000
const JOINED_WINDOW_MS = 10 * 60 * 1000

// Push for "Be om en ekstra hånd". Klienten sender bare assignmentId og kind.
// Sonenavn, hendelse og mottakere hentes her, og rettigheter sjekkes her.
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { assignmentId, kind } = await request.json()
  if (!assignmentId || (kind !== 'request' && kind !== 'joined')) {
    return NextResponse.json({ error: 'assignmentId og kind kreves' }, { status: 400 })
  }

  const { data: a } = await supabase
    .from('zone_assignments')
    .select('id, event_id, zone_id, help_requested_at, help_requested_by, zones(name, zone_type)')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const zone = a.zones as unknown as { name: string; zone_type: string }
  if (zone.zone_type !== 'bottle') return NextResponse.json({ error: 'Bare flaskeinnsamling' }, { status: 400 })

  const { data: zoneClaims } = await supabase
    .from('zone_claims').select('user_id, via_help, claimed_at').eq('assignment_id', a.id)
  const claimers = (zoneClaims || []) as Array<{ user_id: string; via_help: boolean; claimed_at: string }>
  const url = `/kart?event=${a.event_id}&sone=${a.zone_id}&hjelp=1`

  if (kind === 'request') {
    if (!a.help_requested_at) return NextResponse.json({ skipped: 'ingen åpen forespørsel' })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const allowed = profile?.role === 'admin' || a.help_requested_by === user.id || claimers.some(c => c.user_id === user.id)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Cooldown: atomisk "sett help_notified_at hvis eldre enn 10 min".
    const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString()
    const { data: claimed } = await supabase
      .from('zone_assignments')
      .update({ help_notified_at: new Date().toISOString() })
      .eq('id', a.id)
      .or(`help_notified_at.is.null,help_notified_at.lt.${cutoff}`)
      .select('id')
    if (!claimed || claimed.length === 0) return NextResponse.json({ skipped: 'cooldown' })

    // Mottakere: alle med sone-claim i samme hendelse, minus plukkerne på denne sonen.
    // Ikke eventId-filteret i sendPush: det tar med sjåfører og musikanter.
    const { data: eventClaims } = await supabase
      .from('zone_claims').select('user_id, zone_assignments!inner(event_id)')
      .eq('zone_assignments.event_id', a.event_id)
    const onZone = new Set(claimers.map(c => c.user_id))
    const userIds = [...new Set(((eventClaims || []) as Array<{ user_id: string }>).map(c => c.user_id))]
      .filter(id => !onZone.has(id))
    if (userIds.length === 0) return NextResponse.json({ sent: 0 })

    const result = await sendPush({
      title: `${zone.name} trenger en ekstra hånd`,
      body: 'Har du krefter til en runde til? Første som melder seg, blir med.',
      url,
    }, { userIds })
    return NextResponse.json(result)
  }

  // kind === 'joined': kalleren må nettopp ha kommet inn via hjelpeplassen.
  const mine = claimers.find(c => c.user_id === user.id)
  if (!mine || !mine.via_help || Date.now() - new Date(mine.claimed_at).getTime() > JOINED_WINDOW_MS) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data: me } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const firstName = me?.full_name?.trim().split(/\s+/)[0] || 'En hjelper'
  const userIds = claimers.map(c => c.user_id).filter(id => id !== user.id)
  if (userIds.length === 0) return NextResponse.json({ sent: 0 })
  const result = await sendPush({
    title: 'Hjelpen er på vei',
    body: `${firstName} kommer til ${zone.name}. Tusen takk!`,
    url,
  }, { userIds })
  return NextResponse.json(result)
}
```

- [ ] **Steg 2:** Sjekk at `/api/push/notify-zone-help` ikke blokkeres av `middleware.ts` (sammenlign med hvordan `/api/push/notify-drivers` slipper gjennom).
- [ ] **Steg 3:** `npx tsc --noEmit` og `npm run build`. Commit (`10.41.9`).

---

## Fase 5: Verifisering, dokumentasjon og deploy

### Task 16: Test i mock-modus

- [ ] **Steg 1:** `NEXT_PUBLIC_MOCK_MODE=true npm run dev` (via preview-verktøyet), åpne `/kart`, `/hjem`, `/sjafor`.
- [ ] **Steg 2:** Sjekk og ta skjermbilder, mobil (375 px) og desktop, lys og mørk:
  - N4: oransje omriss, pille "Hjelp ønskes" med puls. Trykk på pillen åpner arket. Arket viser "Hjelp ønskes" og "Bli med som hjelper".
  - N3: "DU" med oransje prikk, arket viser "Venter på en ekstra hånd · Avbryt".
  - Brikke "2 soner trenger hjelp" under tellerprikkene, trykk flyr til eldste.
  - N8: "Tatt med selv" i arket, "Angre ferdigmelding" vises.
  - "Marker som ferdig" på egen sone: boksen "Hvor er panten nå?" med to valg, trykkflater ≥ 44 px, 12 px luft.
  - "Gi opp sonen"-boksen viser "Heller få hjelp? Be om en ekstra hånd".
  - Samlere-lista viser "hjelper"-merkingen.
  - Soner uten forespørsel ser ut akkurat som før (sammenlign med skjermbilde tatt før endringene, `git stash` på en kopi).
  - Med "reduser bevegelse" (DevTools → Rendering → prefers-reduced-motion: reduce): ingen puls.
  - Sjåfør: "Tatt med av plukker" dempet. Hjem: "Ferdig" på picked_up.
  - Lapper- og plastsoner: uendret ark (sjekk i mock ved å midlertidig sette `zone_type`, uten å committe).
- [ ] **Steg 3:** Toasten testes ved å kalle `setUndoInfo` direkte fra React DevTools eller en midlertidig knapp (fjernes før commit), siden RPC-ene ikke stubbes i mock.
- [ ] **Steg 4:** `npx tsc --noEmit` og `npm run build` grønt.

### Task 17: Dokumentasjon

**Files:**
- Create: `CLAUDE.md`

- [ ] **Steg 1:** Kort fil:

```markdown
# Dugnadshub - driftskritiske fakta

- Delt prod-database for lokal utvikling og prod. Deploy kun via push til `main`.
- Merkene er lodd i julekonserttrekningen. Ingen sletting i `user_badges` uten styrets OK.
- **Usynlig oppførsel:** triggeren `user_badges_award_participation` (etter insert på
  `user_badges`) deler ut terskelmerkene Frøspire (1), Tre på rad (4), Ringrev (8) og Maskin (12)
  når et deltakelsesmerke (aktivitet, 17mai, sommerkonsert, seminar) med `event_id` på en
  fullført hendelse settes inn, også via REST-skript. Logikken ligger i
  `award_participation_badges()`. Se `scripts/migrate-deltakelsesmerker-i-db.sql`.
- Ny deltakelseskategori må inn fire steder: `award_participation_badges`, `event_participant_ids`,
  triggerfunksjonen og `PARTICIPATION_CATEGORIES` i `lib/badges/definitions.ts`.
- `mark_event_completed` er eneste fullføringsvei. Admin-knappen "Oppdater merker" kjører
  `reevaluate_event_badges` ved etterregistrering.
- `zone_claims` skrives bare via RPC-er (kun `notes` kan oppdateres direkte).
- Migreringer ligger i `scripts/migrate-*.sql`, rollback-tester i `scripts/tester/`.
```

- [ ] **Steg 2:** Commit (`10.41.10`).

### Task 18: Kodegjennomgang og deploy (krever OK)

- [ ] **Steg 1:** Kjør `superpowers:requesting-code-review` på hele diffen. Rett funn.
- [ ] **Steg 2:** Vis Tor Martin: oppsummering, skjermbilder fra mock, versjon. **Vent på OK.**
- [ ] **Steg 3:** `git push origin main`. Følg deployen med avgrenset løkke (`vercel ls dugnadshub --scope superponni`, maks 8 × 10 s).
- [ ] **Steg 4:** Etter deploy: sjekk at `dugnadshub.no` viser ny versjon i profilen.
- [ ] **Steg 5 (egen OK):** Kveldstest på en hendelse "TEST, se bort fra denne" med push ved aktivering av, etter protokollen i minnet: be om hjelp, bli med fra en annen konto, tatt med selv + angre via toast, sjåfør henter. Slett testhendelsen etterpå (sletter ikke merker, men sjekk at ingen merker ble koblet til den).
- [ ] **Steg 6:** Oppdater minnet (`dugnadshub.md`, versjonsliste og nye fallgruver).

---

## Selvsjekk mot specen

| Spec | Task |
|---|---|
| Del 0 additivt, rekkefølge, ingen ny status | 1, 3, 5, 18 |
| Del 1 datamodell, RPC, angre | 1, 3, 4 |
| Del 1 UI i arket, toast, statuslabel | 10 |
| Del 1 sanntid, sjåfør, Hjem, eksport, typer, mock | 9, 11 |
| Del 2 kolonner, RPC-er, låsing, lukking | 1, 3, 4 |
| Del 2 kart (token, omriss, pille, brikke, id i stedet for snapshot) | 10, 13, 14 |
| Del 2 ark (label, hjelperknapp, bekreftelse, venter, kappløp, push-åpnet, tildel) | 14 |
| Del 2 push med cooldown og riktige mottakere | 15 |
| Del 3 RPC-er, RLS, notify-drivers, grants | 3, 4, 12 |
| Del 4 indeks, award-funksjon, fullfør, trigger, reevaluate, oversikt, TS, sletting | 1, 2, 6, 7 |
| Del 4 hendelsesvalg i admin/medlemmer | 8 |
| Del 4 tester 0-5 | 2 (test 5 som enkelt-sesjon, se avvik 7) |
| Akseptkriterier 1-11 | 4, 16, 18 |
