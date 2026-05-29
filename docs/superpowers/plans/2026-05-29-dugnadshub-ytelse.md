# Dugnadshub Ytelse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gjøre `/hjem` (og senere `/profil`, `/sjafor`) merkbart raskere ved å erstatte sekvensielle Supabase-vannfall med ett RPC-kall, og fjerne overflødige auth-runder, uten å bryte den aktive brukerbasen.

**Architecture:** En lese-only Postgres-funksjon (`get_home_data`) gjør alle joins server-side i Postgres (null nettverkslatens mellom stegene) og returnerer ett JSON-objekt. Klienten beholder sin eksisterende aggregeringslogikk uendret, men leser fra ett svar i stedet for fem. Auth-identitet hentes via `auth.uid()` i RPC-en, så klienten slipper et eget `getUser()`-kall på datastien. Alle endringer er additive: gamle tabeller og spørringer fungerer fortsatt, så gammel og ny kode kan kjøre side om side under deploy-vinduet.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres + PostgREST + RLS), `@supabase/ssr`, TypeScript (strict), `tsx` for skript. Ingen test-rammeverk i repoet — verifisering skjer via et differensial-skript + `tsc` + `next build` + manuell røyktest.

---

## Kontekst og sikkerhetsgrunnlag (lest før du starter)

Funn fra forundersøkelse som styrer planen:

- **Alle tabeller hjem-siden leser er fritt lesbare på SELECT** (`profiles`, `events`, `zones`, `zone_assignments`, `zone_claims`, `event_shifts`, `shift_claims` har alle RLS-policy `using(true)` for `authenticated`). En RPC returnerer derfor nøyaktig samme data, og kan ikke lekke mer enn brukeren allerede kan lese. Vi bruker `SECURITY INVOKER` (RLS gjelder fortsatt) som sikreste valg.
- **Service worker (`public/sw.js`) cacher INGEN kode** — kun push/notification. Returnerende brukere kjører ikke gammel JS fra SW. Vanlig HTTP/CDN-cache av hashede chunks gjelder kortvarig, så additiv bakoverkompatibilitet er fortsatt nødvendig i deploy-vinduet.
- **Lokal `npm run dev` og prod deler SAMME Supabase-database.** Derfor: kjør RPC-migrasjonen i prod-DB FØR du pusher kode, og hold alt additivt. Se [[dugnadshub-delt-prod-db]].
- **Ingen test-rammeverk.** Ingen `vitest`/`jest`/`playwright`. Verifisering = differensial-skript (`scripts/verify-home-data.ts`) + `npx tsc --noEmit` + `npm run build` + manuell test på dugnadshub.no.
- **Migrasjoner kjøres manuelt** ved å lime SQL inn i Supabase Dashboard SQL Editor: `https://supabase.com/dashboard/project/meotsqwtpemzbwhuozyq/sql/new`. Avslutt alltid med `NOTIFY pgrst, 'reload schema';`.
- **Versjon** står i `app/(app)/profil/page.tsx:610` (nå `v 10.3`). Bump ved hver endring.
- **Rollback:** Vercel Dashboard → Deployments → Instant Rollback. RPC-en er additiv (`CREATE OR REPLACE`), så den er ufarlig å la stå ved rollback.
- **Nye RPC-er trenger `(supabase.rpc as any)`-cast** — genererte Supabase-typer regenereres ikke i dette repoet.

**Fasene er uavhengig leverbare.** Du kan stoppe etter hvilken som helst fase og ha en fungerende, raskere app. Fase 1 løser det rapporterte problemet (treg `/hjem`). Fase 2 og 3 er gevinst på øvrige sider.

---

## Filstruktur

| Fil | Ansvar | Fase |
|-----|--------|------|
| `scripts/migrate-get-home-data.sql` | Ny RPC `get_home_data(p_user_id uuid)` (Create) | 1 |
| `scripts/verify-home-data.ts` | Differensial-test: gammel sti vs RPC (Create) | 0/1 |
| `app/(app)/hjem/page.tsx` | Bytt 5 spørringer → ett RPC-kall (Modify) | 1 |
| `lib/supabase/types.ts` | Ny `HomeEvent`-type + `HomeData`-type (Modify) | 1 |
| `lib/supabase/get-current-user.ts` | Helper: hent bruker fra `getSession()` (Create) | 2 |
| `app/(app)/profil/page.tsx`, `sjafor/page.tsx`, `kart/page.tsx`, `merker/page.tsx`, `arrangement/[id]/page.tsx`, `components/layout/BottomNav.tsx`, `components/features/onboarding/ProfileStep.tsx` | Bytt klient-`getUser()` → helper (Modify) | 2 |
| `scripts/migrate-get-profile-data.sql`, `scripts/migrate-get-driver-data.sql` | RPC-er for profil/sjåfør (Create) | 3 (valgfri) |

---

## Fase 0: Verifiserings-grunnlag (testryggraden)

Siden det ikke finnes et test-rammeverk, bygger vi et differensial-skript som kjører den GAMLE 5-spørrings-stien og den NYE RPC-en for samme bruker og sammenligner rad-for-rad. Dette er vår «failing test» (RPC-en finnes ikke ennå → skriptet feiler) og blir regresjonsvernet før og etter deploy.

**Files:**
- Create: `scripts/verify-home-data.ts`
- Modify: `package.json:11` (legg til npm-skript)

- [ ] **Steg 1: Skriv differensial-skriptet (den feilende testen)**

Opprett `scripts/verify-home-data.ts`:

```ts
/**
 * Differensial-verifisering: get_home_data-RPC vs de gamle 5 spørringene.
 * Beviser at RPC-en returnerer nøyaktig samme data som klienten henter i dag.
 *
 * Bruk: npx tsx scripts/verify-home-data.ts <user_id>
 * Krever SUPABASE_URL (eller NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY i miljøet.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const userId = process.argv[2]

if (!URL || !KEY) { console.error('Mangler SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
if (!userId) { console.error('Bruk: npx tsx scripts/verify-home-data.ts <user_id>'); process.exit(1) }

const supabase = createClient(URL, KEY)

// Kanonisk JSON: sorter objektnøkler rekursivt så nøkkelrekkefølge ikke gir falske avvik
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function canon(v: any): any {
  if (Array.isArray(v)) return v.map(canon)
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o }, {} as Record<string, unknown>)
  }
  return v
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortRows(rows: any[], key: string) {
  return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])))
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compare(name: string, a: any[], b: any[], key = 'id'): boolean {
  const sa = JSON.stringify(canon(sortRows(a, key)))
  const sb = JSON.stringify(canon(sortRows(b, key)))
  const ok = sa === sb
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (gammel ${a.length} rader, ny ${b.length} rader)`)
  if (!ok) { console.log('  gammel:', sa.slice(0, 800)); console.log('  ny:    ', sb.slice(0, 800)) }
  return ok
}

async function oldPath() {
  const { data: events } = await supabase.from('events')
    .select('id,title,type,date,start_time,area,status,signup_deadline')
    .in('status', ['upcoming', 'active']).order('date', { ascending: true })
  const eventIds = (events || []).map(e => e.id)
  const { data: assignments } = eventIds.length
    ? await supabase.from('zone_assignments').select('id,event_id,zone_id,status').in('event_id', eventIds)
    : { data: [] }
  const { data: zones } = await supabase.from('zones').select('id,name,area,collectors_needed')
  const assignmentIds = (assignments || []).map(a => a.id)
  const { data: claims } = assignmentIds.length
    ? await supabase.from('zone_claims').select('id,assignment_id,user_id,profiles(full_name)').in('assignment_id', assignmentIds)
    : { data: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flatClaims = (claims || []).map((c: any) => ({ id: c.id, assignment_id: c.assignment_id, user_id: c.user_id, full_name: c.profiles?.full_name ?? null }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrangementIds = (events || []).filter((e: any) => e.type === 'arrangement' && e.status === 'active').map(e => e.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shiftData: any[] = []
  if (arrangementIds.length) {
    const { data: shifts } = await supabase.from('event_shifts').select('event_id,capacity,claims:shift_claims(id)').in('event_id', arrangementIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shiftData = (shifts || []).map((s: any) => ({ event_id: s.event_id, capacity: s.capacity, claim_count: s.claims.length }))
  }
  return { events: events || [], zone_assignments: assignments || [], zones: zones || [], zone_claims: flatClaims, shift_data: shiftData }
}

async function newPath() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_home_data', { p_user_id: userId })
  if (error) throw error
  return data
}

async function main() {
  const oldD = await oldPath()
  const newD = await newPath()
  let ok = true
  ok = compare('events', oldD.events, newD.events) && ok
  ok = compare('zone_assignments', oldD.zone_assignments, newD.zone_assignments) && ok
  ok = compare('zones', oldD.zones, newD.zones) && ok
  ok = compare('zone_claims', oldD.zone_claims, newD.zone_claims) && ok
  ok = compare('shift_data', oldD.shift_data, newD.shift_data, 'event_id') && ok
  const uidOk = newD.current_user_id === userId
  console.log(`${uidOk ? 'PASS' : 'FAIL'}  current_user_id`)
  ok = ok && uidOk
  console.log(ok ? '\nALLE PASS' : '\nNOEN FEILET')
  process.exit(ok ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Steg 2: Legg til npm-skript**

I `package.json`, under `"scripts"` (etter linje 11 `"seed-zones": ...`), legg til:

```json
    "verify-home-data": "tsx scripts/verify-home-data.ts"
```

(Husk komma på linjen over.)

- [ ] **Steg 3: Kjør skriptet for å bekrefte at det FEILER (RPC finnes ikke ennå)**

```bash
cd /Users/tormartin/dugnadshub
set -a; source .env.local; set +a
npx tsx scripts/verify-home-data.ts 74b725d4-c59f-4285-b8a5-73b5c6a1f93f
```

Forventet: feiler med PostgREST-feil som `Could not find the function public.get_home_data` (RPC-en finnes ikke ennå). Det er riktig — den lager vi i Fase 1.

- [ ] **Steg 4: Commit**

```bash
git add scripts/verify-home-data.ts package.json
git commit -m "test: differensial-verifisering for get_home_data (gammel sti vs RPC)"
```

---

## Fase 1: `get_home_data`-RPC + koble `/hjem` til den

Dette er fiksen for det rapporterte problemet. Vi samler 5 sekvensielle nettverksrunder + 1 auth-runde til ett RPC-kall.

### Task 1.1: Lag og kjør RPC-migrasjonen

**Files:**
- Create: `scripts/migrate-get-home-data.sql`

- [ ] **Steg 1: Skriv migrasjonen**

Opprett `scripts/migrate-get-home-data.sql`:

```sql
-- RPC: get_home_data — henter alt hjem-siden trenger i ett kall.
-- Erstatter 5 sekvensielle klient-spørringer (events → assignments → zones → claims → shifts).
-- SECURITY INVOKER: RLS gjelder fortsatt, så funksjonen kan aldri returnere mer enn
-- kalleren allerede kan lese. Alle tabellene under er fritt lesbare (using(true)).
-- p_user_id default NULL → bruker auth.uid(). Param finnes kun for offline-verifisering
-- (service-role-skript der auth.uid() er NULL). Klienten kaller ALLTID uten argument.

CREATE OR REPLACE FUNCTION get_home_data(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH uid AS (
    SELECT COALESCE(p_user_id, auth.uid()) AS id
  ),
  ev AS (
    SELECT id, title, type, date, start_time, area, status, signup_deadline
    FROM events
    WHERE status IN ('upcoming', 'active')
    ORDER BY date ASC
  ),
  assign AS (
    SELECT id, event_id, zone_id, status
    FROM zone_assignments
    WHERE event_id IN (SELECT id FROM ev)
  ),
  zn AS (
    SELECT id, name, area, collectors_needed
    FROM zones
  ),
  claims AS (
    SELECT zc.id, zc.assignment_id, zc.user_id, p.full_name
    FROM zone_claims zc
    LEFT JOIN profiles p ON p.id = zc.user_id
    WHERE zc.assignment_id IN (SELECT id FROM assign)
  ),
  shifts AS (
    SELECT s.event_id, s.capacity,
           (SELECT COUNT(*) FROM shift_claims sc WHERE sc.shift_id = s.id)::int AS claim_count
    FROM event_shifts s
    WHERE s.event_id IN (SELECT id FROM ev WHERE type = 'arrangement' AND status = 'active')
  )
  SELECT jsonb_build_object(
    'current_user_id', (SELECT id FROM uid),
    'profile',          (SELECT to_jsonb(p) FROM profiles p WHERE p.id = (SELECT id FROM uid)),
    'events',           COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM ev e), '[]'::jsonb),
    'zone_assignments', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM assign a), '[]'::jsonb),
    'zones',            COALESCE((SELECT jsonb_agg(to_jsonb(z)) FROM zn z), '[]'::jsonb),
    'zone_claims',      COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM claims c), '[]'::jsonb),
    'shift_data',       COALESCE((SELECT jsonb_agg(to_jsonb(sh)) FROM shifts sh), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION get_home_data(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Steg 2: Kjør migrasjonen i prod-DB (FØR kodeendring, fordi DB er delt)**

Åpne `https://supabase.com/dashboard/project/meotsqwtpemzbwhuozyq/sql/new`, lim inn HELE innholdet i `scripts/migrate-get-home-data.sql`, og kjør. Forventet: «Success. No rows returned».

- [ ] **Steg 3: Kjør differensial-testen — nå skal den PASSERE**

```bash
cd /Users/tormartin/dugnadshub
set -a; source .env.local; set +a
npx tsx scripts/verify-home-data.ts 74b725d4-c59f-4285-b8a5-73b5c6a1f93f
```

Forventet: `ALLE PASS`. Hvis noe feiler, sammenlign «gammel» vs «ny» i utskriften og rett SQL-en før du går videre. Kjør gjerne også for en admin og en bruker uten claims for bredde:

```bash
# Tor Martin (admin, har claims/driver-assignments)
npx tsx scripts/verify-home-data.ts 993746b0-2299-4eb4-aa66-553027eaf1eb
```

- [ ] **Steg 4: Commit**

```bash
git add scripts/migrate-get-home-data.sql
git commit -m "feat: get_home_data RPC — samler hjem-data i ett kall"
```

### Task 1.2: Legg til typer for RPC-svaret

**Files:**
- Modify: `lib/supabase/types.ts` (etter `DugnadEvent`, rundt linje 78)

- [ ] **Steg 1: Legg til `HomeEvent` og `HomeData`**

I `lib/supabase/types.ts`, rett etter `DugnadEvent`-interfacet (etter linje 78), legg til:

```ts
// Lettvekts-event som get_home_data returnerer (kun feltene hjem-siden + ArrangementCard bruker).
// Tunge JSONB-kolonner (matches/role_info/general_info/description/meeting_point) utelates bevisst.
export interface HomeEvent {
  id: string
  title: string
  type: EventType
  date: string
  start_time: string | null
  area: EventArea
  status: EventStatus
  signup_deadline: string | null
}

// Svaret fra get_home_data-RPC-en.
export interface HomeData {
  current_user_id: string | null
  profile: Profile | null
  events: HomeEvent[]
  zone_assignments: Array<{ id: string; event_id: string; zone_id: string; status: ZoneStatus }>
  zones: Array<{ id: string; name: string; area: ZoneArea; collectors_needed: number }>
  zone_claims: Array<{ id: string; assignment_id: string; user_id: string; full_name: string | null }>
  shift_data: Array<{ event_id: string; capacity: number; claim_count: number }>
}
```

- [ ] **Steg 2: Verifiser typecheck**

```bash
cd /Users/tormartin/dugnadshub && npx tsc --noEmit
```

Forventet: ingen nye feil.

- [ ] **Steg 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: HomeEvent + HomeData typer for get_home_data"
```

### Task 1.3: Koble `/hjem` til RPC-en

**Files:**
- Modify: `app/(app)/hjem/page.tsx` (import linje 9; `EventWithProgress` linje 18-24; load-effekt linje 64-162; `completeOnboarding` reload linje 182-188)

- [ ] **Steg 1: Oppdater import-linjen for typer**

Endre linje 9 fra:

```ts
import type { Profile, DugnadEvent } from '@/lib/supabase/types'
```

til:

```ts
import type { Profile, HomeEvent, HomeData } from '@/lib/supabase/types'
```

- [ ] **Steg 2: La `EventWithProgress` utvide `HomeEvent`**

Endre linje 18 fra:

```ts
interface EventWithProgress extends DugnadEvent {
```

til:

```ts
interface EventWithProgress extends HomeEvent {
```

- [ ] **Steg 3: Erstatt hele load-effekten (linje 64-162) med ett RPC-kall**

Erstatt blokken som starter på linje 64 (`useEffect(() => { if (isMockMode()) return ...`) og slutter på linje 162 (`}, [])`) med:

```ts
  useEffect(() => {
    if (isMockMode()) return
    async function load() {
      // Ett RPC-kall henter alt (erstatter 5 sekvensielle spørringer + getUser).
      // JWT-en sendes automatisk av supabase-js; RPC-en leser auth.uid() selv.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseRef.current.rpc as any)('get_home_data')
      if (error || !data) { setLoading(false); return }
      const home = data as HomeData

      const userId = home.current_user_id
      if (!userId) { setLoading(false); return }
      if (home.profile) setProfile(home.profile)

      const allEvents = home.events || []
      if (allEvents.length === 0) { setLoading(false); return }

      const assignments = home.zone_assignments || []
      const claims = home.zone_claims || []
      const zoneMap = new Map((home.zones || []).map(z => [z.id, z]))

      const eventsWithProgress: EventWithProgress[] = allEvents.map(event => {
        const eventAssignments = assignments.filter(a => a.event_id === event.id)
        const total = eventAssignments.length
        let zonesWithClaims = 0
        let completed = 0
        let totalNeeded = 0
        let totalClaims = 0
        for (const a of eventAssignments) {
          const claimsOnAssignment = claims.filter(c => c.assignment_id === a.id).length
          totalClaims += claimsOnAssignment
          totalNeeded += zoneMap.get(a.zone_id)?.collectors_needed || 0
          if (claimsOnAssignment > 0) zonesWithClaims++
          if (a.status === 'completed' || a.status === 'picked_up') completed++
        }
        return { ...event, totalZones: total, claimedZones: zonesWithClaims, completedZones: completed, totalNeeded, totalClaims }
      })

      const activeEventIds = new Set(allEvents.filter(e => e.status === 'active').map(e => e.id))
      const myClaims = claims.filter(c => c.user_id === userId)
      const allMyZones: MyZone[] = myClaims.map(claim => {
        const assignment = assignments.find(a => a.id === claim.assignment_id)
        if (!assignment) return null
        if (!activeEventIds.has(assignment.event_id)) return null
        const zone = zoneMap.get(assignment.zone_id)
        const event = allEvents.find(e => e.id === assignment.event_id)
        const partner = claims.find(c => c.assignment_id === claim.assignment_id && c.user_id !== userId)
        return {
          zoneId: assignment.zone_id, eventId: assignment.event_id,
          zoneName: zone?.name || assignment.zone_id, area: zone?.area || '',
          status: assignment.status, eventTitle: event?.title || '',
          partnerName: partner?.full_name || null,
        }
      }).filter(Boolean) as MyZone[]

      setEvents(eventsWithProgress)
      setMyZones(allMyZones)

      // Vakt-aggregater: shift_data er allerede talt opp i RPC-en
      const shiftData = home.shift_data || []
      if (shiftData.length > 0) {
        const agg = new Map<string, { total: number; free: number; totalCapacity: number }>()
        for (const s of shiftData) {
          const a = agg.get(s.event_id) ?? { total: 0, free: 0, totalCapacity: 0 }
          a.total += 1
          a.totalCapacity += s.capacity
          a.free += Math.max(0, s.capacity - s.claim_count)
          agg.set(s.event_id, a)
        }
        setShiftAggregates(agg)
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

Merk de to forskjellene fra gammel kode: partner-navn leses fra `partner?.full_name` (var `partner?.profiles?.full_name`), og vakt-aggregat bruker `s.claim_count` (var `s.claims.length`).

- [ ] **Steg 4: Forenkle `completeOnboarding`-reload (linje 182-188) til samme RPC**

Erstatt `reload`-funksjonen inni `completeOnboarding` (linje 182-188) med:

```ts
    async function reload() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabaseRef.current.rpc as any)('get_home_data')
      if (data?.profile) setProfile((data as HomeData).profile)
    }
    reload()
```

- [ ] **Steg 5: Typecheck + build**

```bash
cd /Users/tormartin/dugnadshub && npx tsc --noEmit && npm run build
```

Forventet: begge passerer uten feil. (Hvis `DugnadEvent` nå er ubrukt og linting klager, fjern den fra import-linjen — den ble byttet ut i Steg 1, så det skal være greit.)

- [ ] **Steg 6: Manuell røyktest mot delt DB via lokal dev**

```bash
cd /Users/tormartin/dugnadshub && npm run dev
```

Logg inn som en ekte bruker på `http://localhost:3000/hjem`. Verifiser i nettleseren:
- Hilsen med riktig navn vises.
- Aktiv plastdugnad vises med riktig «X/Y soner tatt · Z% bemannet».
- Fotball VM-arrangementet vises som ArrangementCard med riktig «X/Y vakter fylt» og «Påmelding stenger ...».
- «Mine soner» viser brukerens egne soner med riktig partner-navn.
- Åpne Nettverk-fanen: bekreft at `/hjem`-lasting nå gjør ETT `get_home_data`-kall i stedet for 5 separate Supabase-kall.

- [ ] **Steg 7: Commit**

```bash
git add app/(app)/hjem/page.tsx
git commit -m "perf: /hjem bruker get_home_data — ett kall i stedet for 5 sekvensielle"
```

### Task 1.4: Bump versjon og deploy

- [ ] **Steg 1: Bump versjon**

I `app/(app)/profil/page.tsx:610`, endre `v 10.3` → `v 10.4`.

- [ ] **Steg 2: Commit og push (RPC er allerede i prod-DB fra Task 1.1)**

```bash
git add app/(app)/profil/page.tsx
git commit -m "chore: bump versjon til 10.4 (hjem-ytelse)"
git push origin main
```

- [ ] **Steg 3: Verifiser i prod etter Vercel-deploy**

Etter at Vercel har deployet: åpne `https://dugnadshub.no/hjem`, hard-refresh, og bekreft i Nettverk-fanen at ett `get_home_data`-kall erstatter de fem gamle. Kjør differensial-testen en siste gang for å bekrefte at prod-RPC og prod-data fortsatt stemmer:

```bash
cd /Users/tormartin/dugnadshub && set -a; source .env.local; set +a
npx tsx scripts/verify-home-data.ts 74b725d4-c59f-4285-b8a5-73b5c6a1f93f
```

**Hvis noe er galt i prod:** Vercel Dashboard → Deployments → Instant Rollback til forrige deploy. RPC-en kan stå (additiv, brukes ikke av gammel kode).

---

## Fase 2: Fjern overflødig klient-`getUser()` (valgfri, bredt gevinst)

`getUser()` treffer Supabase Auth-serveren hver gang (nettverksrunde). `getSession()` leser den allerede validerte cookien lokalt. Middleware (`lib/supabase/middleware.ts:35`) validerer brukeren server-side på hver navigasjon før siden lastes, og alle data-spørringer er RLS-beskyttet server-side — så å lese `user.id` fra `getSession()` på klienten er trygt. Vi rører IKKE de 7 server-side `getUser()`-kallene (sikkerhetsgrensen).

### Task 2.1: Lag en delt helper

**Files:**
- Create: `lib/supabase/get-current-user.ts`

- [ ] **Steg 1: Skriv helperen**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

// Henter innlogget bruker fra den lokale sesjonen (cookie) uten nettverksrunde til Auth.
// Trygt på klienten fordi middleware allerede har validert sesjonen server-side,
// og all datatilgang er RLS-beskyttet. Bruk ALDRI dette som sikkerhetsgrense server-side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCurrentUser(supabase: SupabaseClient<any>): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}
```

- [ ] **Steg 2: Typecheck**

```bash
cd /Users/tormartin/dugnadshub && npx tsc --noEmit
```

Forventet: ingen feil.

- [ ] **Steg 3: Commit**

```bash
git add lib/supabase/get-current-user.ts
git commit -m "feat: getCurrentUser-helper (getSession i stedet for getUser på klient)"
```

### Task 2.2: Bytt klient-kallsteder ett og ett

For HVER av filene under: legg til `import { getCurrentUser } from '@/lib/supabase/get-current-user'`, og erstatt mønsteret `const { data: { user } } = await <client>.auth.getUser()` med `const user = await getCurrentUser(<client>)`. `<client>` er `supabaseRef.current` i de fleste filene. La resten av logikken (`if (!user) ...`, `user.id`) stå uendret.

Kallsteder (klient-side, trygge å bytte):
- `app/(app)/profil/page.tsx:58`, `:184`, `:638`
- `app/(app)/sjafor/page.tsx:163`
- `app/(app)/kart/page.tsx:124`
- `app/(app)/merker/page.tsx:123`
- `app/(app)/arrangement/[id]/page.tsx:29`
- `components/layout/BottomNav.tsx:34`
- `components/features/onboarding/ProfileStep.tsx:35`, `:67`
- `app/admin/hendelser/page.tsx:291`, `:505`

**IKKE rør** (server-side sikkerhetsgrense): `app/page.tsx:7`, `app/admin/layout.tsx:8`, `lib/supabase/middleware.ts:35`, `app/api/**` route-handlere.

- [ ] **Steg 1: Bytt ett kallsted, typecheck, gjenta**

Gjør ÉN fil av gangen. Etter hver fil:

```bash
cd /Users/tormartin/dugnadshub && npx tsc --noEmit
```

- [ ] **Steg 2: Full build**

```bash
cd /Users/tormartin/dugnadshub && npm run build
```

Forventet: passerer.

- [ ] **Steg 3: Manuell røyktest**

`npm run dev`, logg inn, og klikk gjennom: `/hjem`, `/profil`, `/kart`, `/merker`, og (som driver/admin) `/sjafor`. Bekreft at hver side fortsatt laster brukerdata riktig og at ingen havner på `/logg-inn` uventet.

- [ ] **Steg 4: Commit, bump versjon, push**

```bash
# bump v10.4 -> v10.5 i app/(app)/profil/page.tsx:610 først
git add -A
git commit -m "perf: klient-sider bruker getSession i stedet for getUser (sparer auth-runde)"
git push origin main
```

---

## Fase 3: Samme RPC-mønster for `/profil` og `/sjafor` (valgfri følge-arbeid)

Begge sidene har samme vannfall-problem som `/hjem` hadde. Mønsteret er identisk med Fase 1: lag en `SECURITY INVOKER`-RPC som bundler spørringene, verifiser med et differensial-skript (kopier `scripts/verify-home-data.ts` og tilpass tabellene/aggregatene), koble siden til RPC-en, typecheck/build/røyktest, bump versjon, push.

### Task 3.1: `get_profile_data`-RPC

`app/(app)/profil/page.tsx:57-145` gjør: `getUser` → `profiles` → `zone_claims(assignment_id)` → `zone_assignments(event_id)` → `events(completed)` → `zone_assignments(id,event_id)` igjen. RPC-utkast (`scripts/migrate-get-profile-data.sql`):

```sql
CREATE OR REPLACE FUNCTION get_profile_data(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH uid AS (SELECT COALESCE(p_user_id, auth.uid()) AS id),
  my_claims AS (
    SELECT zc.id, zc.assignment_id
    FROM zone_claims zc WHERE zc.user_id = (SELECT id FROM uid)
  ),
  my_assign AS (
    SELECT za.id, za.event_id
    FROM zone_assignments za WHERE za.id IN (SELECT assignment_id FROM my_claims)
  ),
  completed AS (
    SELECT e.id, e.title, e.date,
           (SELECT COUNT(*) FROM my_assign a WHERE a.event_id = e.id)::int AS zone_count
    FROM events e
    WHERE e.id IN (SELECT event_id FROM my_assign) AND e.status = 'completed'
    ORDER BY e.date DESC
  )
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM profiles p WHERE p.id = (SELECT id FROM uid)),
    'history', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM completed c), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION get_profile_data(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
```

Steg: skriv migrasjon → kjør i Dashboard → kopier verify-skript til `scripts/verify-profile-data.ts` og bekreft `ALLE PASS` → koble `profil/page.tsx` til RPC-en (erstatt `load()`-blokken; `history` kommer ferdig aggregert som `{title, date, zone_count}` → map til eksisterende `history`-state med `zones: zone_count`) → typecheck/build/røyktest → bump versjon → commit + push.

### Task 3.2: `get_driver_data`-RPC

`app/(app)/sjafor/page.tsx:140-250` gjør ~6 sekvensielle kall (`events` → `getUser` → `driver_assignments(+profiles)` → `zone_assignments` → `zones` → `zone_claims(+profiles)`). Bundle disse i `scripts/migrate-get-driver-data.sql` etter samme `SECURITY INVOKER`-mal, returnér `{ driver_assignments, zone_assignments, zones, zone_claims }` filtrert på aktive `bottle_collection`-events. Verifiser med `scripts/verify-driver-data.ts`, koble siden til, typecheck/build/røyktest, bump versjon, push.

**Merk for Fase 3:** Ikke rør realtime-abonnementene (`useRealtimeZones`, `MeetingPointSheet`, `useDriverLocations`) — de leser de samme tabellene direkte og skal fortsatt fungere uendret. RPC-ene erstatter kun førstegangs-lastingen, ikke live-oppdateringene.

---

## Vurdert, men IKKE i denne planen (med begrunnelse)

- **Cold start (~1s på første kall).** Dette er Supabase free-tier compute som varmer opp, ikke noe kode kan fjerne. To muligheter hvis det plager: (a) Vercel Cron som pinger `get_home_data` hvert få minutt i aktive timer for å holde poolen varm, (b) oppgrader til Supabase Pro (ingen pausing). Begge er infrastruktur-valg, ikke kodeendringer — ta dem separat.
- **Flytte aggregeringen (progress/myZones) inn i SQL.** Ville gitt enda mindre payload, men dupliserer forretningslogikk i SQL (divergeringsrisiko). Vi beholder bevisst aggregeringen i TypeScript der den allerede er bevist i prod. «Dum bundler»-RPC er det sikre valget.
- **`/kart` henter `events` to ganger** (`useActiveEvent` + `useActiveEvents`). Liten gevinst, egen opprydding senere hvis ønskelig.
- **Regenerere Supabase-typer.** Repoet bruker manuelle typer og `(rpc as any)`-cast. Å innføre kodegenerering er et større, separat løft.

---

## Self-Review (utført av planforfatter)

- **Spec-dekning:** Problemet (treg `/hjem`, Supabase-vannfall) løses i Fase 1. Bredere gevinst i Fase 2 (auth-runder) og Fase 3 (profil/sjåfør). «Ikke ødelegge eksisterende»: additiv RPC + delt-DB-disiplin (RPC før kode) + differensial-test + bakoverkompatibilitet (SW cacher ikke kode) + Vercel instant rollback.
- **Plassholder-skann:** Ingen TBD/TODO. Fase 0-2 har komplett kode. Fase 3 har komplett SQL for `get_profile_data` og full fremgangsmåte; `get_driver_data` er beskrevet med eksakte kallsteder (kan kreve at utvikler skriver SQL etter mønsteret — bevisst, siden Fase 3 er valgfritt følge-arbeid).
- **Type-konsistens:** `HomeData`/`HomeEvent` (Task 1.2) brukes konsistent i Task 1.3. `claim_count` (RPC) vs gammel `claims.length`, og `full_name` (RPC) vs gammel `profiles.full_name` er eksplisitt flagget i Task 1.3 Steg 3. `EventWithProgress extends HomeEvent` matcher feltene `ArrangementCard` leser (`title/date/start_time/id/signup_deadline` — verifisert).
