# Ett merke per sone, automatisk Lappemester og ×N overalt - implementeringsplan

> **For agentiske utførere:** Påkrevd underskill: superpowers:executing-plans (inline, med sjekkpunkter hos Tor Martin). Stegene bruker avkrysning (`- [ ]`).

**Mål:** Hver sone på en fullført lappeutdeling gir Lappemester Nord/Sør, og hver sone på en fullført flaskeinnsamling gir Pantejeger. Gamle hendelser fylles inn uten sletting. Merkesiden viser ×N og hvor merkene kommer fra, og ulest-prikken reagerer på nye eksemplarer.

**Arkitektur:** Én additiv migrering (ny kolonne `user_badges.zone_assignment_id`, indeksbytte, merke 86, intern funksjon `award_zone_badges`, nye versjoner av `mark_event_completed` og `reevaluate_event_badges`) og ett idempotent tilbakefyllingsskript. Begge testes sammen i `begin ... rollback` mot prod før noe lagres. Frontend får en liten hjelpefil (`lib/badges/earned.ts`) som mobil, desktop og BottomNav deler.

**Teknologi:** Next.js 15, Supabase (Postgres, PostgREST), Tailwind v4 med tokens i `app/globals.css`, framer-motion.

**Spec:** `docs/superpowers/specs/2026-10-12-merke-per-sone-design.md` (les den sammen med planen).

## Globale krav

- Bokmål i all UI-tekst. Ingen tankestreker, bruk vanlig bindestrek. Kjønnsnøytrale formuleringer.
- **Ingen sletting i `user_badges`** uten styrets OK, heller ikke i tester. Tester mot prod kjøres bare i `begin ... rollback`.
- Hver migrering og tilbakefyllingen vises til Tor Martin før de kjøres ekte. Tallene fra tilbakefyllingen (nye Lappemester- og Pantejeger-rader per person) rapporteres og godkjennes eksplisitt før `commit` i databasen.
- Navn fra rapporten vises bare i chatten til Tor Martin. De skrives aldri inn i filer i repoet, i minnet eller i commit-meldinger (personvern, se `../../CLAUDE.md`).
- Ta fersk backup (`node scripts/backup-db.mjs`) rett før ekte kjøring.
- Rekkefølge ved drift: migrering + tilbakefylling, `notify pgrst, 'reload schema'`, deretter push av frontend. Frontend leser `zone_assignment_id` og må ikke deployes før kolonnen finnes.
- Alle nye/endrede security definer-funksjoner: `set search_path`, `revoke ... from public, anon` (og `authenticated` for interne).
- Plast er ikke med. Merkene: Lappemester Nord (18), Lappemester Sør (20), Pantejeger (86, kategori `aktivitet`, beskrivelse "Tok en flaskesone"). Ny beskrivelse for 18/20: "Tok en lappesone i Nord" / "Tok en lappesone i Sør".
- Grafikk `public/badges/pantejeger.png` finnes. Ikke lag plassholder.
- Designtokens: `bg-card`, `bg-surface-low`, `text-text-primary/secondary/tertiary`, `text-accent`, `text-success`, `text-danger`. Aldri `bg-surface`, `text-foreground`.
- Verifisering: `npx tsc --noEmit` og `npm run build` (ingen ESLint, ingen testsuite). Rene funksjoner testes med `npx tsx scripts/tester/test-merke-hjelpere.ts`.
- Mock-modus: launch-konfig `dugnadshub-mock` (port 3100). Mock stubber ikke RPC-er, så den dekker bare visning.
- Versjon: `lib/version.ts` (`APP_VERSION`, i dag `10.42.1`). Første frontend-commit blir `10.43.0`, deretter siste siffer +1 per commit.
- Push og deploy først etter Tor Martins OK. Deploy kun via push til `main`.

## Funn fra prod 12.10 (grunnlag for planen)

- `user_badges`: 1272 rader. Indekser: `user_badges_event_unique (user_id, badge_id, event_id) where event_id is not null` og `user_badges_once_uniq`. `event_id`-FK har ingen `on delete`-regel. Trigger `user_badges_award_participation` finnes.
- `zone_assignments.event_id` har `on delete cascade` mot `events`. `zone_claims` har unik `(assignment_id, user_id)`.
- `zones.area` er bare `NORD`/`SOR`. Hendelsestypene `lapper` og `bottle_collection` har bare soner av riktig type (0 avvik).
- Prod-versjonen av `mark_event_completed` og `reevaluate_event_badges` er identisk med `scripts/migrate-deltakelsesmerker-i-db.sql`. Den bygges videre på her.
- Lappemester i dag: 17 rader. 11 uten `event_id` (6 Nord fra 30.03-05.04, 5 Sør fra 15.-17.04) og 6 koblet til Sør 21.09. Lappeclaims: 24 (Nord 07.04: 6, Sør 14.04: 6, Sør 21.09: 6, Nord 29.09: 6). Flaskeclaims: 136 (38 + 29 + 31 + 38).
- Den ene som mangler på Sør 14.04 er en person som har Lappemester Sør bare fra 21.09.
- Admin "Slett hendelse" (`app/admin/hendelser/page.tsx:468`) sletter `zone_assignments` og så `events` uten transaksjon.

## Avvik fra specen og avklaringer (må godkjennes)

1. **(Godkjent av Tor Martin 12.10.)** **FK med `on delete restrict`** for `zone_assignment_id`. `set null` kan gi to rader på samme `(user_id, badge_id, event_id)` uten sone, og da feiler slettingen likevel på indeksen. Med `restrict` mister vi aldri merker. Følge: "Slett hendelse" på en fullført dugnad med sonemerker feiler allerede på første steg, før noe er slettet. I dag slettes sonene og så feiler hendelsen på `event_id`-FK-en, som etterlater en halvslettet hendelse. Dette blir altså bedre.
2. **(Godkjent av Tor Martin 12.10.)** **Gjenbruk av manuelle rader også i vanlig drift.** `award_zone_badges` kobler først en eksisterende rad med samme bruker, merke og hendelse uten sone til en sone, før den setter inn nye. En admin som har gitt Lappemester manuelt med hendelse før fullføring, får derfor ikke dobbelt opp. Tilbakefyllingen bruker samme funksjon.
3. **(Godkjent av Tor Martin 12.10, med målet om helautomatiske merker, se specen.)** Merkene deles ut helt automatisk, og manuell tildeling er bare reserve. **`auto_criteria` forblir `null`** for 18/20/86. Ellers stenger admin-arket (`BadgeDetailSheet`, `isAuto`) for manuell tildeling, som specen krever at fortsatt virker. Teksten "Deles ut automatisk for hver sone du tar" styres i stedet av ny konstant `ZONE_BADGE_IDS`.
4. **(Godkjent av Tor Martin 12.10.)** **Ulest-prikken og eksisterende brukere.** I dag lagres sette `badge_id`-er. Ny lagring er antall per merke. Ved første lasting etter deploy regnes alt med `awarded_at` før 12.10 kl 00 som sett for merker brukeren hadde sett før. Uten dette ville alle med gamle ×N-merker (17. mai o.l.) fått en falsk prikk. Tilbakefylte rader har ny `awarded_at` og gir prikk, slik vi vil. Koblede gamle Lappemester-rader beholder sin `awarded_at` og gir ikke prikk.
5. **(Godkjent av Tor Martin 12.10.)** **Manuell tildeling av 18/20/86 med hendelse** der brukeren allerede har et sonemerke på samme hendelse, gir ett ekstra eksemplar (den nye indeksen hindrer bare to rader uten sone). Det er et bevisst admin-valg og vises som ×N.
6. **Sonemerket blir liggende** hvis noen fjernes fra en sone etter at hendelsen er fullført. Merket peker på sonen, ikke på claimen. `reevaluate_event_badges` sletter aldri.
7. **Forventede tall** (sjekkes i rollback): Lappemester 24 koblet til sone, hvorav 11 gamle rader uten hendelse koblet, 6 rader fra Sør 21.09 koblet, 7 nye (6 for Nord 29.09 og 1 for Sør 14.04). Pantejeger 136. Terskelmerker: trolig 0, fordi sone-claims allerede teller som deltakelse. `user_badges` 1272 → 1415 (+143). Specen sa ca. 145.
8. **(Godkjent av Tor Martin 12.10.)** **Ingen testsuite.** `lib/badges/earned.ts` testes med et lite `tsx`-skript med `node:assert`.
10. **Beslutninger fra Tor Martin 12.10 etter agentgjennomgangen:** lodd per person (to foreldre på samme sone får ett hver); bare soner meldt ferdig (`completed`/`picked_up`) gir merke; hjelpere får merke; ingen grense per dugnad; ekte kjøring i to steg med egen godkjenning av tilbakefyllingen; tydelig melding i "Slett hendelse" når hendelsen har merker.
9. **Makker (3) og Heldekkende (9)** er utenfor scope, som i specen.

---

## Filkart

**Nye filer**
- `scripts/migrate-merke-per-sone.sql` - migreringen (Del 1, 2, 3)
- `scripts/backfill-merke-per-sone.sql` - tilbakefyllingen (Del 4), idempotent
- `scripts/tester/test-c-merke-per-sone.sql` - rollback-tester og rapport
- `lib/badges/earned.ts` - telling, kilder per merke, ulest-logikk
- `scripts/tester/test-merke-hjelpere.ts` - test av `earned.ts`

**Endrede filer**
- `lib/badges/definitions.ts`, `lib/supabase/types.ts`, `lib/mock/data.ts`
- `app/(app)/merker/page.tsx`, `components/merker/MerkerDesktop.tsx`, `components/layout/BottomNav.tsx`
- `components/admin/useMemberDetail.ts` (kommentar om indeksen)
- `CLAUDE.md`, `docs/tilbakemeldinger.md`, `lib/version.ts`

---

## Fase 0: Rydd arbeidskopien

### Task 0: Commit spec, grafikk og innboks

- [ ] **Steg 1: Sjekk at bare forventede filer er endret**

Run: `git status --short`
Forventet: `M docs/tilbakemeldinger.md`, `?? docs/superpowers/specs/2026-10-12-merke-per-sone-design.md`, `?? docs/superpowers/plans/2026-10-12-merke-per-sone.md`, `?? public/badges/pantejeger.png`, `?? .claude/`. Ikke ta med `.claude/`.

- [ ] **Steg 2: Commit**

```bash
git add docs/tilbakemeldinger.md docs/superpowers/specs/2026-10-12-merke-per-sone-design.md docs/superpowers/plans/2026-10-12-merke-per-sone.md public/badges/pantejeger.png
git commit -m "Spec og plan: ett merke per sone, Pantejeger-grafikk"
```

---

## Fase 1: Database

### Task 1: Migreringen

**Files:**
- Create: `scripts/migrate-merke-per-sone.sql`

**Interfaces:**
- Produces: kolonnen `user_badges.zone_assignment_id uuid` (FK `on delete restrict`); indeksene `user_badges_zone_uniq` og ny `user_badges_event_unique`; merke 86; `award_zone_badges(p_event_id uuid) returns integer` (intern, bare eier/service_role); nye `mark_event_completed(uuid)` og `reevaluate_event_badges(uuid)` med samme signatur som før.

Fila har ikke `begin/commit`, så testene kan pakke den inn i `begin ... rollback` og ekte kjøring i `begin ... commit`.

- [ ] **Steg 1: Skriv migreringsfila**

```sql
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
-- Lodd per person: alle på sonen får ett hver, også hjelpere og foreldre i samme familie. Kalles av mark_event_completed, reevaluate_event_badges
-- og tilbakefyllingen. Idempotent. Sletter aldri. Returnerer antall nye rader.
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
```

- [ ] **Steg 2: Commit fila (ikke kjørt)**

```bash
git add scripts/migrate-merke-per-sone.sql
git commit -m "Migrering C: ett merke per sone (ikke kjørt)"
```

### Task 2: Tilbakefyllingen

**Files:**
- Create: `scripts/backfill-merke-per-sone.sql`

**Interfaces:**
- Consumes: `award_zone_badges(uuid)` og kolonnen `zone_assignment_id` fra Task 1; `award_participation_badges(uuid[])` fra migrering A.

- [ ] **Steg 1: Skriv fila**

```sql
-- Tilbakefylling (2026-10-12): sonemerker for alle fullførte lappeutdelinger og
-- flaskeinnsamlinger. Krever migrate-merke-per-sone.sql. Ingen sletting. Idempotent.
-- Kjøres i samme begin ... commit som migreringen.

-- 1. Manuelle Lappemester-rader uten hendelse (våren 2026) kobles til hendelse og sone.
-- Parres én til én per bruker og merke: eldste claim mot eldste rad. Claims på hendelser
-- der brukeren allerede har en rad med samme event_id, tas i steg 2.
with krav as (
  select zc.user_id,
         case z.area when 'NORD' then 18 else 20 end as badge_id,
         za.event_id,
         za.id as assignment_id,
         row_number() over (
           partition by zc.user_id, case z.area when 'NORD' then 18 else 20 end
           order by e.date, za.id
         ) as rn
  from public.zone_claims zc
  join public.zone_assignments za on za.id = zc.assignment_id
  join public.zones z on z.id = za.zone_id
  -- Radene uten hendelse er alle fra våren 2026. Grensen hindrer at en vårrad pares med en høstclaim.
  join public.events e on e.id = za.event_id and e.status = 'completed' and e.type = 'lapper'
    and e.date < date '2026-07-01'
  where z.area in ('NORD', 'SOR')
    and za.status in ('completed', 'picked_up')
    and not exists (
      select 1 from public.user_badges ub
      where ub.user_id = zc.user_id
        and ub.badge_id = case z.area when 'NORD' then 18 else 20 end
        and (ub.event_id = za.event_id or ub.zone_assignment_id = za.id)
    )
),
rader as (
  select ub.id, ub.user_id, ub.badge_id,
         row_number() over (partition by ub.user_id, ub.badge_id order by ub.awarded_at, ub.id) as rn
  from public.user_badges ub
  where ub.badge_id in (18, 20)
    and ub.event_id is null
    and ub.zone_assignment_id is null
)
update public.user_badges ub
set event_id = k.event_id, zone_assignment_id = k.assignment_id
from rader r
join krav k on k.user_id = r.user_id and k.badge_id = r.badge_id and k.rn = r.rn
where ub.id = r.id;

-- 2. Alle fullførte hendelser: kobler rader med samme event_id og setter inn resten.
do $$
declare
  r record;
begin
  for r in
    select id from public.events
    where status = 'completed' and type in ('lapper', 'bottle_collection')
    order by date
  loop
    perform public.award_zone_badges(r.id);
  end loop;
end;
$$;

-- 3. Terskelmerker for alle. Triggeren har allerede tatt de som fikk nye rader i steg 2,
-- dette fanger koblingene fra steg 1 (update utløser ikke triggeren).
select count(*) as nye_terskelmerker from public.award_participation_badges(null);
```

- [ ] **Steg 2: Commit fila (ikke kjørt)**

```bash
git add scripts/backfill-merke-per-sone.sql
git commit -m "Tilbakefylling av sonemerker (ikke kjørt)"
```

### Task 3: Rollback-tester og rapport

**Files:**
- Create: `scripts/tester/test-c-merke-per-sone.sql`

**Interfaces:**
- Consumes: Task 1 og 2. Markørene `-- <MIGRERING C>` og `-- <TILBAKEFYLLING>` erstattes med hele innholdet i fila før kjøring (siste `select` i tilbakefyllingen fjernes ikke, den er ufarlig).

Kjøres via Supabase-MCP `execute_sql` mot `meotsqwtpemzbwhuozyq`, én test per kall, utenfor aktiv dugnad. **Hver `begin;` følges av `set local lock_timeout = '3s'; set local statement_timeout = '60s';`** (vist under), fordi `alter table`/`drop index` låser `user_badges` og `zone_assignments` til `rollback`. Etter hver test: `select count(*) from pg_stat_activity where state like 'idle in transaction%';` skal gi 0. Verktøyet returnerer siste `select` før `rollback`. Fila lagres med alle testene etter hverandre, skilt med `-- ===== TEST N =====`.

- [ ] **Steg 1: Førsjekk (TEST 0)**

```sql
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
```
Forventet (12.10): `ub_totalt = 1272`, `lm_totalt = 17`, `lm_uten_hendelse = 11`, `merke_86_finnes = 0`, `kolonne_finnes = 0`, `lappeclaims = 24`, `flaskeclaims = 136`, `uferdige_claims_paa_fullfort = 0` (ellers blir tallene i TEST 1 tilsvarende lavere, og det rapporteres). Avvik: forklar årsaken før neste steg (f.eks. en ny dugnad fullført siden 12.10).

- [ ] **Steg 2: Hovedtesten med rapport (TEST 1)**

```sql
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
```
Forventet: `ub_etter - ub_for = 143` (+ eventuelle terskelmerker), `lm_med_sone = 24`, `lm_koblet_uten_hendelse = 11`, `lm_koblet_med_hendelse = 6`, `lm_nye = 7`, `lm_ukoblet = 0`, `pantejeger = 136`, `andre_nye = null`, og `claims = sonemerker` for hver hendelse i `per_hendelse`. `lm_ukoblet > 0` rapporteres med hvilke rader (de blir liggende som de er, specens punkt 4.3).

- [ ] **Steg 3: Idempotens (TEST 2)**

```sql
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
```
Forventet: samme `n` og samme `md5` i begge. Da har ingen kobling flyttet seg. Migreringen tåler også å kjøres to ganger.

- [ ] **Steg 4: Ny fullføring og etterregistrering (TEST 3)**

Kjører bare migreringen (ikke tilbakefyllingen), og fullfører Lappeutdeling Nord 29.09 og Flaskeinnsamling NORD 12.10 på nytt som admin.

```sql
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
-- <MIGRERING C>
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where role = 'admin' order by created_at limit 1),
                    'role', 'authenticated')::text, true);
set local role authenticated;
create temp table _t (steg text, n bigint) on commit drop;
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
```
Forventet: `lapper_18_med_sone = 6`, `lapper_2 = lapper_1`, `flaske_1 - lapper_2 = 38` (pluss eventuelle terskelmerker, som rapporteres), `reevaluate_flaske = 0`.

- [ ] **Steg 5: Indekser, FK og tilganger (TEST 4)**

```sql
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
```
Forventet: `0 rader`, `satt inn`, `23505`, `23503`, `nektet`, `nektet`, `Kun admin kan oppdatere merker`.

- [ ] **Steg 6: Kontroll etter testene (TEST 5)**

```sql
select (select count(*) from information_schema.columns where table_name = 'user_badges' and column_name = 'zone_assignment_id') as kolonne,
       (select count(*) from pg_proc where proname = 'award_zone_badges') as fn,
       (select count(*) from badges where id = 86) as merke_86,
       (select count(*) from user_badges) as ub_totalt,
       (select indexdef from pg_indexes where indexname = 'user_badges_event_unique') as event_idx,
       (select count(*) from pg_indexes where indexname = 'user_badges_zone_uniq') as zone_idx,
       (select count(*) from pg_stat_activity where state like 'idle in transaction%') as hengende;
```
Forventet: `kolonne = 0`, `fn = 0`, `merke_86 = 0`, `ub_totalt` lik TEST 0, `event_idx` slutter på `WHERE (event_id IS NOT NULL)`, `zone_idx = 0`, `hengende = 0`.

- [ ] **Steg 7: Commit testfila** (TEST 6 for angrefila legges til i Task 4)

```bash
git add scripts/tester/test-c-merke-per-sone.sql
git commit -m "Rollback-tester for migrering C og tilbakefylling"
```

- [ ] **Steg 8: SJEKKPUNKT hos Tor Martin**

Vis i chatten: hele `scripts/migrate-merke-per-sone.sql` og `scripts/backfill-merke-per-sone.sql`, avvikslista øverst i planen, resultatet av TEST 0-5, og rapporten fra TEST 1 som tabell per person (navn, nye Lappemester, koblede Lappemester, nye Pantejeger, nye terskelmerker) pluss summene. Si tydelig hvor mange nye lodd det blir. **Ingen ekte kjøring før eksplisitt OK på tilbakefyllingen.**

### Task 4: Angrefil for migreringen

**Files:**
- Create: `scripts/rollback-merke-per-sone.sql`

Gjør migreringen omgjørbar uten sletting så lenge tilbakefyllingen ikke er kjørt. Testes i rollback før ekte kjøring.

- [ ] **Steg 1: Skriv fila**

```sql
-- Angrer migrate-merke-per-sone.sql UTEN sletting i user_badges. Bare gyldig før
-- tilbakefyllingen, og så lenge ingen sonemerker er delt ut (stopper ellers).
-- Merke 86 i badges blir stående (ufarlig, ingen har det).
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
```
Etterpå limes seksjon 6 og 7 (`mark_event_completed` og `reevaluate_event_badges`) fra `scripts/migrate-deltakelsesmerker-i-db.sql` inn ordrett, så `drop function if exists public.award_zone_badges(uuid);` til slutt.

- [ ] **Steg 2: Test angringen (TEST 6)**

```sql
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
-- <MIGRERING C>
-- <ANGREFIL>
select json_build_object(
  'kolonne', (select count(*) from information_schema.columns where table_name = 'user_badges' and column_name = 'zone_assignment_id'),
  'fn', (select count(*) from pg_proc where proname = 'award_zone_badges'),
  'event_idx', (select indexdef from pg_indexes where indexname = 'user_badges_event_unique'),
  'mec_har_sonemerker', (select pg_get_functiondef('public.mark_event_completed(uuid)'::regprocedure) ilike '%award_zone_badges%')
) as resultat;
rollback;
```
Forventet: `kolonne = 0`, `fn = 0`, `event_idx` slutter på `WHERE (event_id IS NOT NULL)`, `mec_har_sonemerker = false`.

- [ ] **Steg 3: Commit**

```bash
git add scripts/rollback-merke-per-sone.sql scripts/tester/test-c-merke-per-sone.sql
git commit -m "Angrefil for migrering C, med test"
```

### Task 5a: Ekte kjøring, steg 1: migreringen alene (etter OK)

- [ ] **Steg 1: Fersk backup**

Run: `node scripts/backup-db.mjs`
Forventet: alle tabeller eksportert uten feil. Noter mappenavnet.

- [ ] **Steg 2: Kjør TEST 0 på nytt.** Samme tall som ved sjekkpunktet, og ingen aktiv lappe- eller flaskedugnad. Ellers stopp.

- [ ] **Steg 3: Kjør migreringen**

Via MCP `execute_sql`: `begin; set local lock_timeout = '3s'; set local statement_timeout = '60s';` + innholdet i `scripts/migrate-merke-per-sone.sql` + `commit;`. Deretter i eget kall: `notify pgrst, 'reload schema';`

- [ ] **Steg 4: Les tilbake**

```sql
select json_build_object(
  'ub_totalt', (select count(*) from user_badges),
  'kolonne', (select count(*) from information_schema.columns where table_name = 'user_badges' and column_name = 'zone_assignment_id'),
  'merke_86', (select name from badges where id = 86),
  'zone_idx', (select count(*) from pg_indexes where indexname = 'user_badges_zone_uniq'),
  'hengende', (select count(*) from pg_stat_activity where state like 'idle in transaction%')
) as resultat;
```
Forventet: `ub_totalt` uendret, `kolonne = 1`, `merke_86 = Pantejeger`, `zone_idx = 1`, `hengende = 0`. Rapporter til Tor Martin. Angring på dette stadiet: `scripts/rollback-merke-per-sone.sql`.

- [ ] **Steg 5: Marker fila som kjørt**

Legg til `-- Kjørt i prod 2026-10-DD.` øverst i `scripts/migrate-merke-per-sone.sql`.
```bash
git add scripts/migrate-merke-per-sone.sql
git commit -m "Migrering C kjørt i prod"
```

### Task 5b: Ekte kjøring, steg 2: tilbakefyllingen (egen OK)

- [ ] **Steg 1: Be om eksplisitt OK** på tallene fra TEST 1. Si at dette ikke kan angres uten sletting. Ingen kjøring uten ja.

- [ ] **Steg 2: Kjør tilbakefyllingen**

Via MCP `execute_sql`: `begin; set local lock_timeout = '3s'; set local statement_timeout = '60s';` + innholdet i `scripts/backfill-merke-per-sone.sql` + `commit;`

- [ ] **Steg 3: Les tilbake**

```sql
select json_build_object(
  'ub_totalt', (select count(*) from user_badges),
  'lm_med_sone', (select count(*) from user_badges where badge_id in (18, 20) and zone_assignment_id is not null),
  'lm_ukoblet', (select count(*) from user_badges where badge_id in (18, 20) and zone_assignment_id is null),
  'pantejeger', (select count(*) from user_badges where badge_id = 86),
  'avvik_per_hendelse', (select count(*) from events e
     where e.status = 'completed' and e.type in ('lapper', 'bottle_collection')
       and (select count(*) from zone_claims zc join zone_assignments za on za.id = zc.assignment_id
            where za.event_id = e.id and za.status in ('completed', 'picked_up'))
        <> (select count(*) from user_badges ub where ub.event_id = e.id and ub.zone_assignment_id is not null))
) as resultat;
```
Forventet: samme tall som TEST 1, `avvik_per_hendelse = 0`. Rapporter til Tor Martin.

- [ ] **Steg 4: Marker fila som kjørt**

Legg til `-- Kjørt i prod 2026-10-DD (ub_totalt før → etter).` øverst i `scripts/backfill-merke-per-sone.sql`.
```bash
git add scripts/backfill-merke-per-sone.sql
git commit -m "Tilbakefylling av sonemerker kjørt i prod"
```

---

## Fase 2: Frontend

### Task 7: Definisjoner, typer og hjelpefil

**Files:**
- Modify: `lib/badges/definitions.ts` (linje 32, 34, etter linje 49, og etter `PARTICIPATION_CATEGORIES`)
- Modify: `lib/supabase/types.ts:184-190`
- Create: `lib/badges/earned.ts`
- Create: `scripts/tester/test-merke-hjelpere.ts`

**Interfaces:**
- Produces:
  - `ZONE_BADGE_IDS: ReadonlySet<number>` i `definitions.ts`
  - `UserBadge.zone_assignment_id: string | null`
  - fra `earned.ts`: `EARNED_BADGE_SELECT: string`, `RawEarnedBadgeRow`, `EarnedBadgeRow`, `BadgeSource`, `SeenCounts`, `toEarnedRow(raw)`, `countByBadge(rows)`, `sourcesByBadge(rows)`, `hasEventSources(sources)`, `unseenBadgeIds(counts, seen)`, `unseenTotal(counts, seen)`, `legacySeenCounts(rows, legacyIds, cutoffIso?)`, `loadSeenCounts(userId, rows)`, `saveSeenCounts(userId, counts)`, `formatBadgeDate(iso)`

- [ ] **Steg 1: Skriv testen først**

`scripts/tester/test-merke-hjelpere.ts`:

```ts
// Test av lib/badges/earned.ts. Kjør: npx tsx scripts/tester/test-merke-hjelpere.ts
import assert from 'node:assert/strict'
import {
  toEarnedRow, countByBadge, sourcesByBadge, hasEventSources,
  unseenBadgeIds, unseenTotal, legacySeenCounts, formatBadgeDate,
  type EarnedBadgeRow,
} from '../../lib/badges/earned'

const rader: EarnedBadgeRow[] = [
  { badge_id: 86, awarded_at: '2026-10-13T08:00:00Z', event_title: 'Flaskeinnsamling NORD', event_date: '2026-10-12', zone_name: 'Sone A' },
  { badge_id: 86, awarded_at: '2026-10-13T08:00:00Z', event_title: 'Flaskeinnsamling Sør', event_date: '2026-09-28', zone_name: 'Sone B' },
  { badge_id: 18, awarded_at: '2026-03-31T10:00:00Z', event_title: 'Lappeutdeling NORD', event_date: '2026-04-07', zone_name: 'Sone C' },
  { badge_id: 1, awarded_at: '2026-04-01T10:00:00Z', event_title: null, event_date: null, zone_name: null },
]

// toEarnedRow: innebygde objekter fra PostgREST, også når de mangler
assert.deepEqual(
  toEarnedRow({ badge_id: 86, awarded_at: 'x', event_id: 'e', zone_assignment_id: 'z',
    events: { title: 'T', date: '2026-10-12' }, zone_assignments: { zones: { name: 'S' } } }),
  { badge_id: 86, awarded_at: 'x', event_title: 'T', event_date: '2026-10-12', zone_name: 'S' })
assert.deepEqual(
  toEarnedRow({ badge_id: 1, awarded_at: 'y', event_id: null, zone_assignment_id: null, events: null, zone_assignments: null }),
  { badge_id: 1, awarded_at: 'y', event_title: null, event_date: null, zone_name: null })

// countByBadge
assert.deepEqual([...countByBadge(rader)].sort((a, b) => a[0] - b[0]), [[1, 1], [18, 1], [86, 2]])

// sourcesByBadge: nyeste dugnad først
const kilder = sourcesByBadge(rader)
assert.deepEqual(kilder.get(86)!.map(k => k.eventDate), ['2026-10-12', '2026-09-28'])
assert.equal(kilder.get(86)![0].zoneName, 'Sone A')
assert.equal(hasEventSources(kilder.get(86)!), true)
assert.equal(hasEventSources(kilder.get(1)!), false)

// Ulest: nytt eksemplar av et merke man har fra før gir prikk
const antall = new Map([[86, 2], [18, 1], [1, 1]])
assert.deepEqual(unseenBadgeIds(antall, { 86: 1, 18: 1, 1: 1 }), [86])
assert.equal(unseenTotal(antall, { 86: 1, 18: 1, 1: 1 }), 1)
assert.equal(unseenTotal(antall, {}), 4)
assert.deepEqual(unseenBadgeIds(antall, { 86: 2, 18: 1, 1: 1 }), [])

// Gammel lagring: rader før skjæringstidspunktet regnes som sett for merker man hadde sett
const gamle = legacySeenCounts(rader, [86, 18, 1], '2026-10-12T00:00:00+02:00')
assert.deepEqual(gamle, { 86: 1, 18: 1, 1: 1 }) // 86 fikk ingen rader før skjæringen, men var sett: minst 1
assert.deepEqual(legacySeenCounts(rader, [1], '2026-10-12T00:00:00+02:00'), { 1: 1 })

// Dato
assert.equal(formatBadgeDate('2026-10-12'), '12. okt. 2026')

console.log('Alle tester OK')
```

- [ ] **Steg 2: Kjør testen og se at den feiler**

Run: `npx tsx scripts/tester/test-merke-hjelpere.ts`
Forventet: FEIL, "Cannot find module '../../lib/badges/earned'".

- [ ] **Steg 3: Skriv `lib/badges/earned.ts`**

```ts
// Opptjente merker: antall per merke, hvor hvert eksemplar kommer fra (dugnad og
// sone), og ulest-prikken. Delt av merkesiden (mobil og desktop) og BottomNav.
// Rene funksjoner testes i scripts/tester/test-merke-hjelpere.ts, så fila skal
// ikke importere noe med @/-alias.

// Henter dugnad og sone sammen med merket. Krever kolonnen zone_assignment_id
// (scripts/migrate-merke-per-sone.sql).
export const EARNED_BADGE_SELECT =
  'badge_id, awarded_at, event_id, zone_assignment_id, events(title, date), zone_assignments(zones(name))'

export interface RawEarnedBadgeRow {
  badge_id: number
  awarded_at: string
  event_id: string | null
  zone_assignment_id: string | null
  events: { title: string; date: string } | null
  zone_assignments: { zones: { name: string } | null } | null
}

export interface EarnedBadgeRow {
  badge_id: number
  awarded_at: string
  event_title: string | null
  event_date: string | null
  zone_name: string | null
}

export interface BadgeSource {
  eventTitle: string | null
  eventDate: string | null
  zoneName: string | null
  awardedAt: string
}

// Sett antall per merke (badge_id → antall eksemplarer brukeren har sett)
export type SeenCounts = Record<number, number>

// Fra 12.10 kl 00 lagres antall per merke. Eldre rader regnes som sett for merker
// som sto i den gamle lista, så gamle ×N-merker ikke gir falsk prikk.
export const LEGACY_SEEN_CUTOFF = '2026-10-12T00:00:00+02:00'

const seenKey = (userId: string) => `seen_badge_counts_${userId}`
const legacySeenKey = (userId: string) => `seen_badges_${userId}`

export function toEarnedRow(raw: RawEarnedBadgeRow): EarnedBadgeRow {
  return {
    badge_id: raw.badge_id,
    awarded_at: raw.awarded_at,
    event_title: raw.events?.title ?? null,
    event_date: raw.events?.date ?? null,
    zone_name: raw.zone_assignments?.zones?.name ?? null,
  }
}

export function countByBadge(rows: ReadonlyArray<{ badge_id: number }>): Map<number, number> {
  const counts = new Map<number, number>()
  for (const r of rows) counts.set(r.badge_id, (counts.get(r.badge_id) ?? 0) + 1)
  return counts
}

// Kilder per merke, nyeste dugnad først (tildelingsdato når merket ikke har dugnad)
export function sourcesByBadge(rows: ReadonlyArray<EarnedBadgeRow>): Map<number, BadgeSource[]> {
  const map = new Map<number, BadgeSource[]>()
  for (const r of rows) {
    const list = map.get(r.badge_id) ?? []
    list.push({ eventTitle: r.event_title, eventDate: r.event_date, zoneName: r.zone_name, awardedAt: r.awarded_at })
    map.set(r.badge_id, list)
  }
  const key = (s: BadgeSource) => s.eventDate ?? s.awardedAt.slice(0, 10)
  for (const list of map.values()) list.sort((a, b) => key(b).localeCompare(key(a)))
  return map
}

// Lista over dugnader vises bare når minst ett eksemplar er koblet til en dugnad
export function hasEventSources(sources: ReadonlyArray<BadgeSource>): boolean {
  return sources.some(s => s.eventTitle !== null)
}

export function unseenBadgeIds(counts: Map<number, number>, seen: SeenCounts): number[] {
  return [...counts].filter(([id, n]) => n > (seen[id] ?? 0)).map(([id]) => id)
}

export function unseenTotal(counts: Map<number, number>, seen: SeenCounts): number {
  let total = 0
  counts.forEach((n, id) => { total += Math.max(0, n - (seen[id] ?? 0)) })
  return total
}

export function legacySeenCounts(
  rows: ReadonlyArray<{ badge_id: number; awarded_at: string }>,
  legacyIds: ReadonlyArray<number>,
  cutoffIso: string = LEGACY_SEEN_CUTOFF,
): SeenCounts {
  const cutoff = new Date(cutoffIso).getTime()
  const seen: SeenCounts = {}
  for (const id of legacyIds) seen[id] = 1
  const before = countByBadge(rows.filter(r => new Date(r.awarded_at).getTime() < cutoff))
  before.forEach((n, id) => { if (id in seen) seen[id] = Math.max(seen[id], n) })
  return seen
}

// localStorage kan mangle eller kaste (privat modus o.l.): da regnes ingenting som sett
export function loadSeenCounts(
  userId: string,
  rows: ReadonlyArray<{ badge_id: number; awarded_at: string }>,
): SeenCounts {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(seenKey(userId))
    if (raw) return JSON.parse(raw) as SeenCounts
    const legacy = window.localStorage.getItem(legacySeenKey(userId))
    if (legacy) return legacySeenCounts(rows, JSON.parse(legacy) as number[])
  } catch {
    // ignorer, se over
  }
  return {}
}

export function saveSeenCounts(userId: string, counts: Map<number, number>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(seenKey(userId), JSON.stringify(Object.fromEntries(counts)))
  } catch {
    // ignorer: prikken kommer bare tilbake neste gang
  }
}

// "2026-10-12" eller ISO-tidsstempel → "12. okt. 2026"
export function formatBadgeDate(iso: string): string {
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso)
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}
```

- [ ] **Steg 4: Kjør testen og se at den passerer**

Run: `npx tsx scripts/tester/test-merke-hjelpere.ts`
Forventet: `Alle tester OK`. Feiler bare datoformatet (Node-ICU kan gi "12. okt 2026" uten punktum), juster forventningen i testen til det Node faktisk gir, og sjekk visuelt i nettleseren i Task 9.

- [ ] **Steg 5: Definisjoner og typer**

I `lib/badges/definitions.ts`:

```ts
  { id: 18, name: 'Lappemester Nord', icon: '/badges/lappemester-nord.png', category: 'aktivitet' as const, description: 'Tok en lappesone i Nord', auto_criteria: null },
```
```ts
  { id: 20, name: 'Lappemester Sør', icon: '/badges/lappemester-sor.png', category: 'aktivitet' as const, description: 'Tok en lappesone i Sør', auto_criteria: null },
```
Rett etter linja for id 85:
```ts
  { id: 86, name: 'Pantejeger', icon: '/badges/pantejeger.png', category: 'aktivitet' as const, description: 'Tok en flaskesone', auto_criteria: null },
```
Nederst i fila:
```ts

// Ett eksemplar per sone deles ut automatisk når dugnaden fullføres
// (award_zone_badges i scripts/migrate-merke-per-sone.sql). auto_criteria er null
// fordi admin fortsatt skal kunne gi dem manuelt.
export const ZONE_BADGE_IDS: ReadonlySet<number> = new Set([18, 20, 86])
```

I `lib/supabase/types.ts`, `UserBadge`:
```ts
export interface UserBadge {
  id: string
  user_id: string
  badge_id: number
  awarded_at: string
  event_id: string | null
  // Satt for sonemerker (Lappemester Nord/Sør, Pantejeger): sonen merket ble tjent på
  zone_assignment_id: string | null
}
```

Og Insert-typen i samme fil (linje 214), så innsetting uten sone er riktig dokumentert:
```ts
      user_badges: { Row: UserBadge; Insert: Omit<UserBadge, 'id' | 'zone_assignment_id'> & { zone_assignment_id?: string | null }; Update: Partial<UserBadge> }
```

I `components/admin/useMemberDetail.ts` linje 16-17, oppdater kommentaren:
```ts
// Resultat av en merketildeling. 'duplicate' = samme merke uten sone finnes allerede
// på samme hendelse (unik indeks user_badges_event_unique, gjelder bare rader uten sone).
```

- [ ] **Steg 6: Typesjekk**

Run: `npx tsc --noEmit`
Forventet: ingen feil. Gir `Omit<UserBadge, 'id'>` (Insert-typen) feil i `app/admin/medlemmer/page.tsx`, er det fordi `zone_assignment_id` nå er påkrevd: innsettingen der bruker `as any`, så det skal ikke skje. Får du feil andre steder, legg `zone_assignment_id: null` i objektet som settes inn.

- [ ] **Steg 7: Commit**

`lib/version.ts`: `export const APP_VERSION = '10.43.0'`

```bash
git add lib/badges/earned.ts lib/badges/definitions.ts lib/supabase/types.ts components/admin/useMemberDetail.ts scripts/tester/test-merke-hjelpere.ts lib/version.ts
git commit -m "Pantejeger og sonemerker i definisjonene, hjelpefil for opptjente merker (v10.43.0)"
```

### Task 8: Mock-data

**Files:**
- Modify: `lib/mock/data.ts:324-329`

**Interfaces:**
- Consumes: `EarnedBadgeRow`, `countByBadge` fra Task 7.
- Produces: `mockEarnedBadgeRows: EarnedBadgeRow[]`; `mockBadgeCounts` avledes av den.

- [ ] **Steg 1: Sjekk hvem som bruker `mockBadgeCounts`**

Run: `grep -rn "mockBadgeCounts" app lib components`
Forventet: `lib/mock/data.ts` og `app/(app)/merker/page.tsx`. Flere treff: sjekk at de bare leser Map-en (typen er uendret).

- [ ] **Steg 2: Erstatt blokka**

Øverst i `lib/mock/data.ts`, ved de andre importene:
```ts
import { countByBadge, type EarnedBadgeRow } from '@/lib/badges/earned'
```
Erstatt `mockBadgeCounts`:
```ts
// Opptjente merker i mock-modus. Viser ×N for sonemerker og et gjentatt 17. mai-merke.
export const mockEarnedBadgeRows: EarnedBadgeRow[] = [
  { badge_id: 16, awarded_at: '2026-03-01T10:00:00Z', event_title: null, event_date: null, zone_name: null },
  { badge_id: 2, awarded_at: '2026-03-15T10:00:00Z', event_title: null, event_date: null, zone_name: null },
  { badge_id: 1, awarded_at: '2026-03-15T12:00:00Z', event_title: null, event_date: null, zone_name: null },
  { badge_id: 3, awarded_at: '2026-03-15T12:00:00Z', event_title: null, event_date: null, zone_name: null },
  { badge_id: 18, awarded_at: '2026-04-07T18:00:00Z', event_title: 'Lappeutdeling Nord', event_date: '2026-04-07', zone_name: 'Sone N1' },
  { badge_id: 18, awarded_at: '2026-09-29T18:00:00Z', event_title: 'Lappeutdeling Nord', event_date: '2026-09-29', zone_name: 'Sone N2' },
  { badge_id: 86, awarded_at: '2026-04-13T18:00:00Z', event_title: 'Flaskeinnsamling Nord', event_date: '2026-04-13', zone_name: 'Sone N1' },
  { badge_id: 86, awarded_at: '2026-10-12T18:00:00Z', event_title: 'Flaskeinnsamling NORD', event_date: '2026-10-12', zone_name: 'Sone N1' },
  { badge_id: 86, awarded_at: '2026-10-12T18:00:00Z', event_title: 'Flaskeinnsamling NORD', event_date: '2026-10-12', zone_name: 'Sone N3' },
  { badge_id: 30, awarded_at: '2026-05-17T18:00:00Z', event_title: '17. mai 2026', event_date: '2026-05-17', zone_name: null },
  { badge_id: 30, awarded_at: '2025-05-17T18:00:00Z', event_title: '17. mai 2025', event_date: '2025-05-17', zone_name: null },
]

export const mockBadgeCounts = countByBadge(mockEarnedBadgeRows)
```
Sjekk at id 30 er et `17mai`-merke i `definitions.ts` (`grep -n "id: 30," lib/badges/definitions.ts`). Er det ikke det, bruk et annet `17mai`-merke.

- [ ] **Steg 3: Typesjekk og commit**

Run: `npx tsc --noEmit` → ingen feil.

`lib/version.ts` → `10.43.1`
```bash
git add lib/mock/data.ts lib/version.ts
git commit -m "Mock-data for sonemerker og ×N (v10.43.1)"
```

### Task 9: Merkesiden på mobil

**Files:**
- Modify: `app/(app)/merker/page.tsx`

**Interfaces:**
- Consumes: alt fra `earned.ts` (Task 7), `STACKABLE_BADGE_CATEGORIES` og `ZONE_BADGE_IDS` fra `definitions.ts`, `mockEarnedBadgeRows` (Task 10).
- Produces: sender `badgeSources: Map<number, BadgeSource[]>` som ny prop til `MerkerDesktop` (Task 10).

- [ ] **Steg 1: Importer**

Erstatt importene for definitions og mock:
```ts
import { badgeDefinitions, STACKABLE_BADGE_CATEGORIES, ZONE_BADGE_IDS } from '@/lib/badges/definitions'
import {
  EARNED_BADGE_SELECT, toEarnedRow, countByBadge, sourcesByBadge, hasEventSources,
  loadSeenCounts, saveSeenCounts, unseenBadgeIds, formatBadgeDate,
  type RawEarnedBadgeRow, type EarnedBadgeRow, type BadgeSource,
} from '@/lib/badges/earned'
import { mockEarnedBadgeRows } from '@/lib/mock/data'
```

- [ ] **Steg 2: Erstatt lastingen (linje 72-128)**

```ts
  // Map: badge_id → antall eksemplarer (stable-bare merker kan gis flere ganger)
  const [badgeCounts, setBadgeCounts] = useState<Map<number, number>>(new Map())
  // Map: badge_id → hvilke dugnader (og soner) eksemplarene kommer fra
  const [badgeSources, setBadgeSources] = useState<Map<number, BadgeSource[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selectedBadge, setSelectedBadge] = useState<typeof badgeDefinitions[0] | null>(null)
  const [revealBadge, setRevealBadge] = useState<typeof badgeDefinitions[0] | null>(null)
  const [newBadgeIds, setNewBadgeIds] = useState<Set<number>>(new Set())
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    function apply(rows: EarnedBadgeRow[]) {
      setBadgeCounts(countByBadge(rows))
      setBadgeSources(sourcesByBadge(rows))
    }
    if (isMockMode()) {
      apply(mockEarnedBadgeRows)
      setLoading(false)
      return
    }
    async function load() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data, error } = await supabaseRef.current
        .from('user_badges')
        .select(EARNED_BADGE_SELECT)
        .eq('user_id', user.id) as unknown as { data: RawEarnedBadgeRow[] | null; error: unknown }

      // Feilet hentingen: ikke skriv sett-status, ellers blir alt "nytt" neste gang
      if (error || !data) { setLoading(false); return }

      const rows = data.map(toEarnedRow)
      const counts = countByBadge(rows)
      apply(rows)

      // Nye eksemplarer (også av merker man har fra før) gir prikk og reveal
      const unseen = unseenBadgeIds(counts, loadSeenCounts(user.id, rows))
      setNewBadgeIds(new Set(unseen))
      if (unseen.length > 0) {
        const badge = badgeDefinitions.find(b => b.id === unseen[0])
        if (badge) {
          setTimeout(() => setRevealBadge(badge), 500)
        }
      }

      // Marker alle som sett
      saveSeenCounts(user.id, counts)

      setLoading(false)
    }
    load()
  }, [])
```

Fjern importen av `mockBadgeCounts` (ubrukt nå).

- [ ] **Steg 3: Send kildene til desktop**

```tsx
          <MerkerDesktop
            loading={loading}
            badgeCounts={badgeCounts}
            badgeSources={badgeSources}
            earnedBadgeIds={earnedBadgeIds}
            newBadgeIds={newBadgeIds}
          />
```

- [ ] **Steg 4: ×N for alle stable-bare kategorier (linje 251)**

```ts
                    const isStackable = STACKABLE_BADGE_CATEGORIES.has(badge.category)
```
og bytt `isActivity` med `isStackable` i de to betingelsene under (hake og teller). Oppdater kommentaren `{/* Teller for aktivitetsmerker */}` til `{/* Teller for merker som kan gis flere ganger */}`.

- [ ] **Steg 5: Detaljvisningen (linje 389-397)**

Erstatt beskrivelse og "Tildeles av admin" med:
```tsx
                <p className="text-text-secondary text-[15px]">
                  {selectedBadge.description}
                </p>

                {ZONE_BADGE_IDS.has(selectedBadge.id) ? (
                  <p className="text-xs text-text-tertiary mt-2">
                    Deles ut automatisk for hver sone du tar
                  </p>
                ) : selectedBadge.auto_criteria === null && (
                  <p className="text-xs text-text-tertiary mt-2">
                    Tildeles av admin
                  </p>
                )}

                {(() => {
                  const sources = badgeSources.get(selectedBadge.id) ?? []
                  if (!hasEventSources(sources)) return null
                  return (
                    <ul className="mt-4 text-left max-h-48 overflow-y-auto rounded-xl bg-surface-low px-3 py-1">
                      {sources.map((s, i) => (
                        <li key={i} className="flex justify-between gap-3 py-2 text-sm border-b border-card last:border-b-0">
                          <span className="text-text-primary">
                            {s.eventTitle ?? 'Tildelt'}
                            {s.zoneName && <span className="text-text-secondary"> · {s.zoneName}</span>}
                          </span>
                          <span className="text-text-secondary shrink-0">
                            {formatBadgeDate(s.eventDate ?? s.awardedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                })()}
```
Flytt også modalen så lista ikke havner under BottomNav (`z-[60]`, 80 px): bytt `top-1/3` til `top-1/2 -translate-y-1/2 max-h-[calc(100dvh-7rem)] overflow-y-auto` i `className` på modal-`motion.div`. Sjekk at `border-card` finnes som farge-token (`grep -n "color-card" app/globals.css`). Finnes den ikke, bruk `divide-y` uten farge.

- [ ] **Steg 6: Typesjekk**

Run: `npx tsc --noEmit`
Forventet: feil bare i `MerkerDesktop` (mangler prop `badgeSources`), som rettes i Task 10. Ingen andre feil.

### Task 10: Merkesiden på desktop

**Files:**
- Modify: `components/merker/MerkerDesktop.tsx`

**Interfaces:**
- Consumes: `badgeSources` fra Task 9; `BadgeSource`, `hasEventSources`, `formatBadgeDate` fra `earned.ts`; `ZONE_BADGE_IDS`.

- [ ] **Steg 1: Props og DBadge**

```ts
import { badgeDefinitions, ZONE_BADGE_IDS } from '@/lib/badges/definitions'
import { hasEventSources, formatBadgeDate, type BadgeSource } from '@/lib/badges/earned'
```
Legg `sources: BadgeSource[]` til `DBadge`, `badgeSources: Map<number, BadgeSource[]>` til `Props`, ta den inn i funksjonssignaturen, og i `all`:
```ts
    sources: badgeSources.get(d.id) ?? [],
```

- [ ] **Steg 2: Detaljmodalen (etter `<p>` med `sel.desc`)**

```tsx
                  {ZONE_BADGE_IDS.has(sel.id) && (
                    <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', margin: '8px 4px 0' }}>Deles ut automatisk for hver sone du tar</p>
                  )}
                  {hasEventSources(sel.sources) && (
                    <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: '4px 14px', textAlign: 'left', maxHeight: 220, overflowY: 'auto', borderRadius: 16, background: 'var(--color-surface-low)' }}>
                      {sel.sources.map((s, i) => (
                        <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', fontSize: 13.5, borderBottom: i < sel.sources.length - 1 ? '1px solid var(--color-card)' : 'none' }}>
                          <span style={{ color: 'var(--color-text-primary)' }}>
                            {s.eventTitle ?? 'Tildelt'}
                            {s.zoneName && <span style={{ color: 'var(--color-text-secondary)' }}> · {s.zoneName}</span>}
                          </span>
                          <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>{formatBadgeDate(s.eventDate ?? s.awardedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
```
Sjekk at `--color-surface-low` og `--color-card` finnes i `app/globals.css` (begge brukes allerede som Tailwind-klasser).

- [ ] **Steg 3: Typesjekk og bygg**

Run: `npx tsc --noEmit && npm run build`
Forventet: ingen feil.

- [ ] **Steg 4: Visuell sjekk i mock-modus**

Start `preview_start { name: "dugnadshub-mock" }`, åpne `/merker`.
- Mobilbredde (`resize_window preset: mobile`): Lappemester Nord viser ×2, Pantejeger ×3, 17. mai-merket ×2. Trykk Pantejeger: "Opptjent ×3", "Deles ut automatisk for hver sone du tar", lista med tre linjer, nyeste først, med sone og dato.
- Desktop (`preset: desktop`): samme i detaljmodalen.
- Mørk modus (`colorScheme: dark`): lista er lesbar.
- `read_console_messages onlyErrors` → ingen feil.
Ta skjermbilde av mobil og desktop til Tor Martin. Tilbakestill `preset: desktop` etterpå.

- [ ] **Steg 5: Commit**

`lib/version.ts` → `10.43.2`
```bash
git add "app/(app)/merker/page.tsx" components/merker/MerkerDesktop.tsx lib/version.ts
git commit -m "Merkesiden: ×N for alle stable-bare merker, liste over dugnader og soner, ulest per eksemplar (v10.43.2)"
```

### Task 11: Ulest-prikken i BottomNav

**Files:**
- Modify: `components/layout/BottomNav.tsx:47-59`

**Interfaces:**
- Consumes: `countByBadge`, `loadSeenCounts`, `unseenTotal` fra `earned.ts`.

- [ ] **Steg 1: Erstatt tellingen**

```ts
import { countByBadge, loadSeenCounts, unseenTotal } from '@/lib/badges/earned'
```
```ts
      const { data } = await supabaseRef.current
        .from('user_badges')
        .select('badge_id, awarded_at')
        .eq('user_id', user.id) as unknown as { data: Array<{ badge_id: number; awarded_at: string }> | null }

      if (!data) return

      // Teller eksemplarer, så et nytt Pantejeger-merke gir prikk selv om man har ett fra før
      setUnseenBadges(unseenTotal(countByBadge(data), loadSeenCounts(user.id, data)))
```
BottomNav skriver aldri sett-status. Det gjør bare merkesiden.

- [ ] **Steg 2: Typesjekk, bygg og commit**

Run: `npx tsc --noEmit && npm run build` → ingen feil.

`lib/version.ts` → `10.43.3`
```bash
git add components/layout/BottomNav.tsx lib/version.ts
git commit -m "Ulest-prikken teller nye eksemplarer av merker man har fra før (v10.43.3)"
```

### Task 11b: Admin fjerner helst merker uten sone

**Files:**
- Modify: `app/admin/medlemmer/page.tsx:253-262` (`handleRemoveBadge`)

Et sonemerke som fjernes, kommer tilbake ved neste "Oppdater merker". Fjern derfor helst et eksemplar uten sone.

- [ ] **Steg 1: Velg rad uten sone først**

```ts
  // Fjern ett merke: helst et uten sone, fordi sonemerker deles ut på nytt av
  // "Oppdater merker" (reevaluate_event_badges)
  async function handleRemoveBadge(userId: string, badgeId: number): Promise<boolean> {
    const badges = userBadges.filter(ub => ub.user_id === userId && ub.badge_id === badgeId)
    const badge = [...badges].reverse().find(b => !b.zone_assignment_id) ?? badges[badges.length - 1]
    if (!badge) return false
```
Resten av funksjonen er uendret.

- [ ] **Steg 2: Typesjekk, bygg og commit**

Run: `npx tsc --noEmit && npm run build` → ingen feil.

`lib/version.ts` → siste siffer +1
```bash
git add app/admin/medlemmer/page.tsx lib/version.ts
git commit -m "Admin fjerner helst merker uten sone (v10.43.x)"
```

### Task 11c: Tydelig melding i "Slett hendelse"

**Files:**
- Modify: `app/admin/hendelser/page.tsx:468-483` (`handleDelete`)

Sjekk merker før noe slettes, så hendelsen aldri blir halvslettet.

- [ ] **Steg 1: Legg inn sjekken først i `handleDelete`**

```ts
  // Slett hendelse (og tilhorende zone_assignments). Hendelser med merker kan ikke
  // slettes: merkene er lodd, og databasen nekter (user_badges.event_id og zone_assignment_id).
  async function handleDelete(eventId: string) {
    setDeleting(true)
    setErrorMsg(null)
    const { count: badgeCount } = await supabaseRef.current
      .from('user_badges')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
    if (badgeCount && badgeCount > 0) {
      setErrorMsg(`Hendelsen har ${badgeCount} merker og kan ikke slettes`)
      setDeleting(false)
      return
    }
```
Resten av funksjonen er uendret.

- [ ] **Steg 2: Typesjekk, bygg og commit**

Run: `npx tsc --noEmit && npm run build` → ingen feil.

`lib/version.ts` → siste siffer +1
```bash
git add app/admin/hendelser/page.tsx lib/version.ts
git commit -m "Slett hendelse sier fra når hendelsen har merker (v10.43.x)"
```

### Task 12: Dokumentasjon

**Files:**
- Modify: `CLAUDE.md`, `docs/tilbakemeldinger.md`

- [ ] **Steg 1: `CLAUDE.md`, ny seksjon etter "Automatisk merkeutdeling i databasen"**

```markdown
## Sonemerker (siden 2026-10-DD)

- Ett merke per `zone_claims`-rad på fullførte hendelser: `lapper` gir Lappemester Nord (18) /
  Sør (20) etter `zones.area`, `bottle_collection` gir Pantejeger (86). Plast er ikke med.
- `award_zone_badges(p_event_id)` (intern) kalles av `mark_event_completed` og
  `reevaluate_event_badges`, før terskelmerkene. Kobler først en rad uten sone på samme
  hendelse, så setter den inn resten. Idempotent, sletter aldri.
- `user_badges.zone_assignment_id` (FK `on delete restrict`). Indekser: `user_badges_zone_uniq`
  (bruker, merke, sone) og `user_badges_event_unique`, som nå bare gjelder rader uten sone.
- `auto_criteria` er `null` for 18/20/86 så admin fortsatt kan gi dem manuelt. UI bruker
  `ZONE_BADGE_IDS` i `lib/badges/definitions.ts`.
- Kilde: `scripts/migrate-merke-per-sone.sql`, tilbakefylling `scripts/backfill-merke-per-sone.sql`.
```
Bytt `DD` med faktisk kjøredato.

- [ ] **Steg 2: `docs/tilbakemeldinger.md`**

Punkt 1: `Status: gjort (×N-delen, v10.43.x). Nivåer på enkeltmerker er ikke med.`
Punkt 3, 7 og 8: `Status: gjort (v10.43.x, DD.10)` med faktisk versjon og dato.

- [ ] **Steg 3: Commit (ikke frontend-endring, ingen versjonsbump)**

```bash
git add CLAUDE.md docs/tilbakemeldinger.md
git commit -m "Dokumenter sonemerker i CLAUDE.md og innboksen"
```

### Task 13: Deploy og verifisering (etter OK)

- [ ] **Steg 1: Sjekk at migreringen er kjørt** (Task 5a steg 4 og 5b steg 3). Ellers: stopp, frontend krever kolonnen.

- [ ] **Steg 2: Be om OK til push.** Ingen push uten eksplisitt ja.

- [ ] **Steg 3: Push og vent på deploy**

```bash
git push origin main
```
Vent med avgrenset løkke (8 forsøk × 10 s) på at første linje i `vercel ls dugnadshub --scope superponni` viser Ready eller Error.

- [ ] **Steg 4: Verifiser i prod**

Be Tor Martin åpne Merker på telefonen: forventet prikk på Merker-fanen, reveal for Pantejeger, ×N på Lappemester/Pantejeger, og lista over dugnader og soner i detaljvisningen. Sjekk Vercel-loggene for feil på `/merker` hvis noe ikke vises.

- [ ] **Steg 5: Oppdater minnet**

Ny minnefil i `~/.claude/projects/-Users-tormartin/memory/` (`dugnadshub-merke-per-sone.md`) med status, kjøredato, tallene før/etter (bare summer, ingen navn), og pekere til spec, plan og SQL-filer. Legg én linje i `MEMORY.md` i prosjektminnet.
