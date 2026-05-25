# Arrangement-vakter — Designdokument

**Status:** Brainstorming godkjent, klar for implementeringsplan
**Eier:** Tor Martin Norvik
**Dato:** 2026-05-25
**Pilot-event:** Fotball VM hos Clarion Hotel Trondheim (15. juni – 19. juli 2026)

## Bakgrunn

Tillerbyen Skolekorps påtar seg ulike inntektsbringende dugnader. I tillegg til de geo-baserte (flaskeinnsamling, lappeutdeling, plastdugnad), kommer det jevnlig forespørsler om å bemanne vakter på arrangementer. Eksempel: Clarion Hotel trenger frivillige til renhold og host/servering under Fotball VM 2026, fordelt på 17 vakter over fem uker.

Dette mønsteret skiller seg fra dagens dugnadstyper på flere måter:

- **Tidsbasert, ikke geo-basert.** Ingen kart eller soner.
- **Ett arrangement strekker seg over uker** — ikke én dato.
- **Flere roller per arrangement** (eks. Renhold og Host/servering) med ulike oppgavebeskrivelser.
- **Eksternt utstedt påmeldingsfrist.** Arrangøren krever liste innen en gitt dato. Etter det er lista låst.
- **Inntektsmodellen varierer** (per vakt, per person, fast pris osv.) og håndteres manuelt utenfor app-en.

## Mål

Bygge en ny dugnadstype `arrangement` som dekker dette mønsteret, med:

- Tydelig oversikt over alle vakter (dato, tid, rolle, ledige plasser)
- Lett påmelding og avmelding for foreldre
- Strukturert visning av oppgavebeskrivelse og generell informasjon
- Eksport av påmeldingsliste til arrangør
- Automatisk vakt-påminnelse 24 timer før
- Gjenbrukbart for fremtidige arrangementer (Neon, Pstereo, Olavsfest osv.)

## Ikke-mål

- Aldersfiltrering basert på fødselsår. Vi bruker tillitsbasert visning av "Hvem kan delta" i fritekst, og admin rydder manuelt ved behov.
- Bytte vakter mellom påmeldte direkte i app-en.
- Automatisk varsling ved halvfylte vakter.
- Automatisk telling av kroner/vakter i "Ditt bidrag". Tor Martin oppdaterer manuelt etter gjennomført arrangement.
- Kart-integrasjon eller geo-sone-tilknytning.
- Egen merker-kategori for arrangement-vakter (kan vurderes etter VM).

## Datamodell

### Nye kolonner på `events`

```sql
ALTER TABLE events
  ADD COLUMN signup_deadline timestamptz,
  ADD COLUMN role_info jsonb,
  ADD COLUMN general_info jsonb;
```

`role_info` — array med rolle-objekter og oppgaver:

```json
[
  {
    "role": "Renhold",
    "tasks": [
      "Tøm søppel",
      "Toaletter: vask ved behov, fyll på toalettpapir og tørkepapir",
      "Space: vask over gulvet ved behov"
    ]
  },
  {
    "role": "Host/servering",
    "tasks": [
      "Mottak: plassering av gjester",
      "Rydde søppel (hvite dunker)",
      "Rydding bord"
    ]
  }
]
```

`general_info` — array med label/verdi-rader:

```json
[
  { "label": "Kleskode",    "value": "Helsvart klær og gode sko" },
  { "label": "Oppmøtested", "value": "Resepsjonen, Clarion Hotel Trondheim, Brattørkaia 1" },
  { "label": "Ved ankomst", "value": "Signer skjema i resepsjonen og få tildelt nøkkelkort" },
  { "label": "Betaling",    "value": "150 kr per vakt. Faktura sendes Clarion i ettertid." },
  { "label": "Hvem kan delta", "value": "Ungdom fra 16 år og voksne" }
]
```

### Utvidet CHECK på `events.type`

```sql
ALTER TABLE events DROP CONSTRAINT events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('bottle_collection','lapper','lottery','baking','other','plast','arrangement'));
```

### Ny tabell `event_shifts`

```sql
CREATE TABLE event_shifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role          text NOT NULL,
  shift_date    date NOT NULL,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  capacity      int NOT NULL CHECK (capacity > 0),
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_event_shifts_event ON event_shifts(event_id);
CREATE INDEX idx_event_shifts_date ON event_shifts(shift_date);
```

### Ny tabell `shift_claims`

```sql
CREATE TABLE shift_claims (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    uuid NOT NULL REFERENCES event_shifts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claimed_at  timestamptz DEFAULT now(),
  UNIQUE (shift_id, user_id)
);

CREATE INDEX idx_shift_claims_shift ON shift_claims(shift_id);
CREATE INDEX idx_shift_claims_user ON shift_claims(user_id);
```

### RLS-policies

- `event_shifts`: alle innloggede kan SELECT. Kun service role kan INSERT/UPDATE/DELETE (admin-flow går via API).
- `shift_claims`:
  - SELECT: alle innloggede
  - INSERT: kun egne (`auth.uid() = user_id`)
  - DELETE: kun egne (`auth.uid() = user_id`)
  - UPDATE: ingen (vi sletter og oppretter på nytt ved behov)

### Realtime

Begge nye tabeller legges i `supabase_realtime`-publication:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE event_shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE shift_claims;
```

### Hvorfor egen `event_shifts`-tabell og ikke gjenbruk `zones`?

`zones` er geometri-basert med MultiPolygon-støtte og kart-tilknytning. Shifts er tids/rolle-basert. Å presse begge inn i én tabell ville skapt mer kompleksitet (nullbar geometry, betinget logikk overalt) enn det løser.

## Bruker-UI

### Hjem-skjermen

Kort per aktivt arrangement, plassert i samme region som dagens flaskeinnsamling/plast-kort.

```
┌─────────────────────────────────────────────┐
│  🎉 FOTBALL VM HOS CLARION HOTEL            │
│  15. juni – 19. juli                        │
│                                             │
│  17 vakter • 24 plasser ledige              │
│  Påmelding stenger 2. juni                  │
│                                             │
│  [   Se vakter og meld deg på   ]           │
└─────────────────────────────────────────────┘
```

Hvis flere arrangementer er aktive samtidig, stables kortene under hverandre.

### Detaljside `/arrangement/[id]`

Komponentstruktur, oppefra og ned:

1. **Header** — navn, dato-range, sted
2. **Beskrivelse** — `events.description`
3. **Deadline-info** — "Påmelding stenger 2. juni"
4. **Mine vakter** (vises kun hvis bruker har minst ett `shift_claim`)
5. **Vakter-liste** — gruppert per dato kronologisk
6. **Oppgaver-card** — rendret fra `role_info`
7. **Generell informasjon-card** — rendret fra `general_info`
8. **Kontakt** — admin-telefon fra `events.contact_phone`

### Vakt-element

```
─── MANDAG 15.06 ─────────────────
🧽 Renhold     15:30–20:30   1/2 ledig    [Meld på]
```

Halvfylte vakter (`0 < påmeldte < capacity`) får en gul/oransje accent-ring som visuell prioritering. Fulle vakter (`påmeldte = capacity`) viser "Fullt" i grønt og er ikke trykkbare.

Rolle-ikoner: 🧽 for "Renhold", 🍽️ for "Host/servering" (utvides ved behov). Lagres ikke i DB — mappes i frontend per rolle-navn med fallback til 📋.

### Bottom-sheet `ShiftClaimSheet`

Åpnes ved klikk på vakt-element. Følger samme mønster som eksisterende `ZoneClaimSheet` med pb-20 for å unngå iPhone bottom-nav overlap.

```
┌─────────────────────────────────────────────┐
│  🧽 RENHOLD                                 │
│  Lørdag 20. juni  •  15:30–20:00            │
│                                             │
│  Påmeldte (1/2):                            │
│  • Tor Martin Norvik                        │
│                                             │
│  [        Meld meg på         ]             │
│                                             │
│  Oppgaver:                                  │
│  • Tøm søppel                               │
│  • Toaletter: vask ved behov...             │
│  • Space: vask over gulvet ved behov        │
└─────────────────────────────────────────────┘
```

Etter `signup_deadline` erstattes "Meld meg på"-knappen med en gul info-boks:

> Påmelding stengt. Hvis du ikke kan møte, må du finne en erstatter eller kontakte [admin-navn] på [telefon].

`tel:`-lenken bruker `events.contact_phone`.

### Mine vakter-card

```
┌─────────────────────────────────────────────┐
│  DINE VAKTER                                │
│                                             │
│  ✓ Lørdag 20. juni   15:30-20:00            │
│    Renhold                                  │
│                                             │
│  ✓ Mandag 29. juni   15:30-23:00            │
│    Host/servering                           │
└─────────────────────────────────────────────┘
```

Klikk åpner samme bottom-sheet som vakt-listen.

## Admin-UI

### Opprett arrangement

Utvidelse av `/admin/hendelser`-form. Når `type='arrangement'` velges, vises nye seksjoner:

- **Påmeldingsfrist** (`signup_deadline`) — dato + tid
- **Roller og oppgaver** — repeater. Hver rolle har navn (text input) og oppgaver (textarea, én linje per punkt)
- **Generell informasjon** — repeater med label + verdi

### Opprett vakter

Etter at arrangement er lagret, viderefører til vakt-oppretter:

```
Vakter for FOTBALL VM
────────────────────────────────────────

[ + Legg til vakt ]

Dato         Tidspunkt     Rolle               Antall
[15.06.2026] [15:30-20:30] [Renhold ▾]         [ 2 ]  [Slett]
[18.06.2026] [15:30-20:30] [Renhold ▾]         [ 2 ]  [Slett]
[20.06.2026] [15:30-20:00] [Renhold ▾]         [ 2 ]  [Slett]
...
[ Lagre vakter ]
```

Rolle-dropdown henter fra `role_info`-rollene som ble lagt inn på arrangementet.

### Eksport-knapp

På admin-detaljsiden for et arrangement-event:

```
[ 📥 Last ned vaktliste for arrangør (.csv) ]
```

CSV-format:

```
Dato,Tidspunkt,Rolle,Antall plasser,Påmeldte,Telefon
15.06.2026,15:30-20:30,Renhold,2,"Tor Martin Norvik",91351290
18.06.2026,15:30-20:30,Renhold,2,"Anne Berg",98765432
...
```

Én linje per påmelding. Vakter uten påmeldte tas med, men med tomme felt for navn/telefon, så arrangør ser hva som mangler.

### Manuell push-trigger (backup)

På admin-detaljsiden:

```
[ 🔔 Send 24t-påminnelser nå (backup) ]
```

Trigger samme endepunkt som cron-jobben. Sendes til alle som har vakt innen 24 timer fra trykk.

### Status-flow

Arrangement-events går gjennom samme `upcoming → active → completed`-flow som andre events. `active` betyr at kortet vises på hjem-skjermen. `completed` skjuler det. Vi utvider ikke `mark_event_completed`-RPC for denne typen — ingen merker tildeles automatisk.

## Påmeldingslogikk

### Påmelding (`POST /api/shifts/[id]/claim`)

Valideres serverside:

1. Bruker er innlogget (`auth.uid()` finnes)
2. `NOW() < events.signup_deadline`
3. `COUNT(shift_claims WHERE shift_id = X) < event_shifts.capacity`
4. Bruker har ikke allerede meldt seg på samme vakt (UNIQUE-constraint fanger denne, men vi sjekker først for vennligere feilmelding)

### Avmelding (`DELETE /api/shifts/[id]/claim`)

1. Bruker er innlogget
2. `NOW() < events.signup_deadline`
3. Egen claim finnes

Etter deadline: API returnerer 403 og UI viser melding. Tor Martin kan slette manuelt via admin hvis nødvendig.

### Kollisjon mellom vakter

Ingen sjekk. Brukeren kan melde seg på to vakter som overlapper i tid hvis han vil. Vi stoler på voksne mennesker.

## Push-varsler

### Vercel Cron

`vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/shift-reminders",
      "schedule": "0 17 * * *"
    }
  ]
}
```

(17:00 UTC = 18:00/19:00 norsk tid avhengig av sommertid. Vi velger 17:00 UTC for å treffe rundt 19:00 om sommeren når VM kjøres.)

### Endepunkt `/api/cron/shift-reminders`

```typescript
// Beskyttet med CRON_SECRET som Vercel injecter
export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Finn alle vakter som starter i morgen
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const shifts = await supabase
    .from('event_shifts')
    .select('id, role, shift_date, start_time, event_id, events(title), shift_claims(user_id)')
    .eq('shift_date', tomorrowStr)

  // For hver shift, hent push-abonnement og send via eksisterende web-push-helper
  // (samme web-push-pakke som /api/push/send bruker i dag)
  for (const shift of shifts.data ?? []) {
    for (const claim of shift.shift_claims) {
      const subs = await supabase
        .from('push_subscriptions')
        .select('endpoint, keys_p256dh, keys_auth')
        .eq('user_id', claim.user_id)

      for (const sub of subs.data ?? []) {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          JSON.stringify({
            title: `Påminnelse: ${shift.events.title}`,
            body: `Din vakt (${shift.role}) er i morgen kl ${shift.start_time}.`,
            url: `/arrangement/${shift.event_id}`,
          })
        )
      }
    }
  }

  return Response.json({ sent: shifts.data?.length ?? 0 })
}
```

### Hvorfor daglig kl 18:00 og ikke "eksakt 24t før vakta"?

Vercel Hobby tier støtter kun daglige cron-jobs. Kveldspåminnelser er også mer praktisk — folk er hjemme, sjekker telefonen, har tid til å forberede seg.

### Engangs-oppsett

- `CRON_SECRET` legges til som env var i Vercel (Vercel genererer)
- Cron-jobben aktiveres automatisk ved første deploy etter at `vercel.json` inneholder `crons`-feltet

## Realtime

Frontend bruker en ny hook `useRealtimeShifts(eventId)` som:

- Abonnerer på `event_shifts` filtrert på `event_id`
- Abonnerer på `shift_claims` filtrert via JOIN (eller bare på alle og filtrerer lokalt)
- Returnerer aggregert state: `Map<shift_id, { shift, claimedCount, claimedByMe }>`

Når en annen bruker melder seg på, oppdaterer "X/Y ledige"-telleren umiddelbart på alle som har siden åpen.

## Migrasjon

Fil: `scripts/migrate-arrangement-shifts.sql`

```sql
-- Idempotent migrasjon for arrangement-vakter

-- 1. Utvid events.type CHECK
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('bottle_collection','lapper','lottery','baking','other','plast','arrangement'));

-- 2. Nye kolonner på events
ALTER TABLE events ADD COLUMN IF NOT EXISTS signup_deadline timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS role_info jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS general_info jsonb;

-- 3. event_shifts
CREATE TABLE IF NOT EXISTS event_shifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role          text NOT NULL,
  shift_date    date NOT NULL,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  capacity      int NOT NULL CHECK (capacity > 0),
  notes         text,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_shifts_event ON event_shifts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_shifts_date ON event_shifts(shift_date);

-- 4. shift_claims
CREATE TABLE IF NOT EXISTS shift_claims (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    uuid NOT NULL REFERENCES event_shifts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claimed_at  timestamptz DEFAULT now(),
  UNIQUE (shift_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shift_claims_shift ON shift_claims(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_claims_user ON shift_claims(user_id);

-- 5. RLS
ALTER TABLE event_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_shifts read" ON event_shifts;
CREATE POLICY "event_shifts read" ON event_shifts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shift_claims read" ON shift_claims;
CREATE POLICY "shift_claims read" ON shift_claims FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shift_claims insert own" ON shift_claims;
CREATE POLICY "shift_claims insert own" ON shift_claims FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shift_claims delete own" ON shift_claims;
CREATE POLICY "shift_claims delete own" ON shift_claims FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'event_shifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_shifts;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shift_claims'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shift_claims;
  END IF;
END $$;

-- 7. Schema cache reload
NOTIFY pgrst, 'reload schema';
```

## Filer som opprettes/endres

**Nye:**

- `app/(app)/arrangement/[id]/page.tsx` — detaljside
- `components/features/ArrangementCard.tsx` — kort på hjem
- `components/features/ShiftListItem.tsx` — én vakt i listen
- `components/features/ShiftClaimSheet.tsx` — bottom-sheet
- `components/features/MyShiftsCard.tsx` — "Dine vakter"-card
- `components/features/RoleInfoCard.tsx` — oppgaver-card
- `components/features/GeneralInfoCard.tsx` — info-card
- `lib/hooks/useRealtimeShifts.ts` — realtime-hook
- `app/api/shifts/[id]/claim/route.ts` — POST/DELETE
- `app/api/admin/arrangement/export/route.ts` — CSV-eksport
- `app/api/cron/shift-reminders/route.ts` — cron-endepunkt
- `scripts/migrate-arrangement-shifts.sql`
- `vercel.json` (oppdateres eller opprettes med `crons`-felt)

**Endres:**

- `app/(app)/page.tsx` (hjem) — vis arrangement-kort for aktive `type='arrangement'` events
- `app/admin/hendelser/page.tsx` — nytt skjema for arrangement-type
- `app/admin/hendelser/[id]/page.tsx` — eksport-knapp, manuell push-trigger
- `app/(app)/profil/page.tsx` — bump versjonsnummer
- `lib/badges/definitions.ts` — ingen endring (eksplisitt: ingen nye merker)

## Testing lokalt

1. Kjør migrasjon mot Supabase via Dashboard SQL Editor
2. `npm run dev`
3. Opprett test-arrangement via admin
4. Opprett 2-3 test-vakter
5. Logg inn som testbruker, meld på/av
6. Test eksport-CSV
7. Test push-cron manuelt via "Send påminnelser nå"-knapp i admin
8. Sett `signup_deadline` til fortid og verifiser at avmeldingsknappen erstattes
9. Verifiser realtime: åpne to faner, meld på i én, se telleren endre seg i andre

## Versjonsbump

`app/(app)/profil/page.tsx` oppdateres med ny versjon (`10.0` foreslås for å markere ny dugnadstype).

## Åpne punkter

Ingen — alle har vært gjennom design-runden og er enten besluttet eller eksplisitt utenfor scope.
