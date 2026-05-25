# Arrangement-vakter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bygg ny dugnadstype `arrangement` med vakter (shifts), påmelding, admin-eksport og automatisk 24t push-påminnelse via Vercel Cron. Pilot-event: Fotball VM hos Clarion Hotel 2026.

**Architecture:** Ny event-type på eksisterende `events`-tabell, to nye tabeller (`event_shifts`, `shift_claims`), Supabase Realtime for live-oppdatering, Vercel Cron for daglig 24t-påminnelse. Bruker-UI som ny rute `/arrangement/[id]`, admin via utvidelse av eksisterende `/admin/hendelser`.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (PostgreSQL + Realtime + RLS + service role), Framer Motion, Tailwind CSS v4, web-push, Vercel Cron, claymorphism-design (Manrope + Plus Jakarta Sans).

**Design dok:** `docs/superpowers/specs/2026-05-25-arrangement-vakter-design.md`

**Testing:** Dugnadshub har ikke automatiske tester. Hver task verifiseres manuelt via `npm run dev` på `localhost:3000` og/eller `curl` mot API. Sjekkpunkter er beskrevet eksplisitt per task.

**Sjekkpunkter for Tor Martin:**
- **Checkpoint A** (etter task 14): Bruker-flyt fungerer end-to-end lokalt. Test før vi går videre med admin.
- **Checkpoint B** (etter task 22): Alt fungerer lokalt. Klar for commit + push til hovedbranchen.

---

## Task 1: Skriv migrasjons-SQL

**Files:**
- Create: `scripts/migrate-arrangement-shifts.sql`

- [ ] **Step 1: Opprett SQL-fil**

Lag filen med følgende innhold. Dette er idempotent — kan kjøres flere ganger trygt.

```sql
-- Migrasjon for arrangement-vakter (Fotball VM-pilot)
-- Idempotent: trygt å kjøre flere ganger

-- 1. Utvid events.type CHECK med 'arrangement'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_type_check') THEN
    ALTER TABLE events DROP CONSTRAINT events_type_check;
  END IF;
END $$;

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

- [ ] **Step 2: Kjør migrasjonen mot Supabase**

1. Åpne Supabase Dashboard: https://supabase.com/dashboard/project/meotsqwtpemzbwhuozyq/sql/new
2. Lim inn hele innholdet fra `scripts/migrate-arrangement-shifts.sql`
3. Trykk RUN

Forventet: "Success. No rows returned."

- [ ] **Step 3: Verifiser via REST**

```bash
curl -s "https://meotsqwtpemzbwhuozyq.supabase.co/rest/v1/event_shifts?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact" -H "Range: 0-0"
```

Forventet: `Content-Range: 0-0/0` (tabellen finnes, er tom)

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-arrangement-shifts.sql
git commit -m "feat(db): migrasjon for arrangement-vakter"
```

---

## Task 2: TypeScript-typer for shifts

**Files:**
- Create: `lib/types/shifts.ts`

- [ ] **Step 1: Opprett type-fil**

```typescript
// Typer for arrangement-vakter

export interface EventShift {
  id: string
  event_id: string
  role: string
  shift_date: string  // ISO date 'YYYY-MM-DD'
  start_time: string  // 'HH:MM:SS'
  end_time: string    // 'HH:MM:SS'
  capacity: number
  notes: string | null
  created_at: string
}

export interface ShiftClaim {
  id: string
  shift_id: string
  user_id: string
  claimed_at: string
}

export interface ShiftWithClaims extends EventShift {
  claims: Array<{
    user_id: string
    claimed_at: string
    profile: { full_name: string | null; phone: string | null } | null
  }>
}

export interface RoleInfo {
  role: string
  tasks: string[]
}

export interface GeneralInfoEntry {
  label: string
  value: string
}

export interface ArrangementEvent {
  id: string
  title: string
  description: string | null
  type: 'arrangement'
  date: string         // ISO date for startdato
  end_date?: string    // valgfri sluttdato (eksisterer ikke i schema enda — bruk start_time-mønster?)
  start_time: string | null
  end_time: string | null
  status: 'upcoming' | 'active' | 'completed'
  contact_phone: string | null
  signup_deadline: string | null  // ISO timestamp
  role_info: RoleInfo[] | null
  general_info: GeneralInfoEntry[] | null
  driver_notes: string | null
  meeting_point: { lat: number; lng: number; name: string; description: string } | null
  send_push_on_activate: boolean | null
}
```

**Merknad:** Vi har ingen `end_date`-kolonne i `events` i dag. For arrangementet bruker vi `date` som startdato. Hvis det er behov for "siste dato"-visning, bruker vi `MAX(shift_date)` fra `event_shifts` (utledes runtime). Hvis Tor Martin senere vil ha eksplisitt sluttdato på event, kan vi legge til i en ny migrasjon — ikke nødvendig nå.

- [ ] **Step 2: Commit**

```bash
git add lib/types/shifts.ts
git commit -m "feat(types): typer for shifts og arrangement"
```

---

## Task 3: Utility-funksjoner for vakter

**Files:**
- Create: `lib/shifts/utils.ts`

- [ ] **Step 1: Opprett utility-fil**

```typescript
import type { EventShift, ShiftWithClaims } from '@/lib/types/shifts'

// Norske ukedager
const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']

// Formaterer 'YYYY-MM-DD' til 'Mandag 15. juni'
export function formatShiftDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`
}

// Formaterer 'YYYY-MM-DD' til '15.06'
export function formatShiftDateShort(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Formaterer 'HH:MM:SS' eller 'HH:MM' til 'HH:MM'
export function formatShiftTime(t: string): string {
  return t.slice(0, 5)
}

// Returnerer "X/Y ledig" eller "Fullt"
export function formatCapacity(claimed: number, capacity: number): string {
  if (claimed >= capacity) return 'Fullt'
  return `${capacity - claimed}/${capacity} ledig`
}

// Status: 'empty' (0 påmeldte), 'partial' (mellom 0 og full), 'full'
export function shiftFillStatus(claimed: number, capacity: number): 'empty' | 'partial' | 'full' {
  if (claimed === 0) return 'empty'
  if (claimed >= capacity) return 'full'
  return 'partial'
}

// Grupperer en sortert liste med shifts per dato
export function groupShiftsByDate(shifts: ShiftWithClaims[]): Map<string, ShiftWithClaims[]> {
  const grouped = new Map<string, ShiftWithClaims[]>()
  for (const s of shifts) {
    const list = grouped.get(s.shift_date) ?? []
    list.push(s)
    grouped.set(s.shift_date, list)
  }
  return grouped
}

// Sortering: dato + starttid
export function sortShifts(shifts: EventShift[] | ShiftWithClaims[]): typeof shifts {
  return [...shifts].sort((a, b) => {
    if (a.shift_date !== b.shift_date) return a.shift_date.localeCompare(b.shift_date)
    return a.start_time.localeCompare(b.start_time)
  })
}

// Sjekker om en signup_deadline er passert
export function isDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

// Rolle-ikon mapping (utvides ved behov)
export function roleIcon(role: string): string {
  const r = role.toLowerCase()
  if (r.includes('renhold')) return '🧽'
  if (r.includes('host') || r.includes('serv')) return '🍽️'
  if (r.includes('vakt') || r.includes('parker')) return '🚧'
  if (r.includes('bar')) return '🍺'
  return '📋'
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/shifts/utils.ts
git commit -m "feat(shifts): utility-funksjoner for formatering og sortering"
```

---

## Task 4: Realtime hook for shifts

**Files:**
- Create: `lib/hooks/useRealtimeShifts.ts`

- [ ] **Step 1: Studer eksisterende mønster**

Les `lib/hooks/useRealtimeZones.ts` for å se hvordan Supabase Realtime brukes i denne kodebasen (createClient + useRef + channel + on('postgres_changes') + cleanup).

- [ ] **Step 2: Opprett hook**

```typescript
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ShiftWithClaims } from '@/lib/types/shifts'

export function useRealtimeShifts(eventId: string) {
  const supabaseRef = useRef(createClient())
  const [shifts, setShifts] = useState<ShiftWithClaims[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchShifts = useCallback(async () => {
    const { data, error: fetchError } = await supabaseRef.current
      .from('event_shifts')
      .select(`
        id, event_id, role, shift_date, start_time, end_time, capacity, notes, created_at,
        claims:shift_claims(
          user_id, claimed_at,
          profile:profiles(full_name, phone)
        )
      `)
      .eq('event_id', eventId)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }
    setShifts((data as unknown as ShiftWithClaims[]) ?? [])
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    fetchShifts()

    const channel = supabaseRef.current
      .channel(`shifts-${eventId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'event_shifts', filter: `event_id=eq.${eventId}` },
        () => fetchShifts()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'shift_claims' },
        () => fetchShifts()
      )
      .subscribe()

    return () => {
      supabaseRef.current.removeChannel(channel)
    }
  }, [eventId, fetchShifts])

  return { shifts, loading, error, refetch: fetchShifts }
}
```

**Merknad:** `shift_claims`-subscription har ikke filter på `event_id` (kan ikke filtrere på joinet kolonne). Vi får alle endringer og re-fetcher. For 10-50 vakter er det helt OK.

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useRealtimeShifts.ts
git commit -m "feat(shifts): realtime hook for vakter"
```

---

## Task 5: API — POST /api/shifts/[id]/claim

**Files:**
- Create: `app/api/shifts/[id]/claim/route.ts`

- [ ] **Step 1: Opprett route**

Studer først et eksisterende API-eksempel: `app/api/driver/sync-role/route.ts` for mønster (lazy supabase, runtime nodejs, auth-sjekk).

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shiftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  const service = getServiceClient()

  // Hent shift + event for å validere deadline og kapasitet
  const { data: shift, error: shiftErr } = await service
    .from('event_shifts')
    .select('id, capacity, event_id, events(signup_deadline)')
    .eq('id', shiftId)
    .single()

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Vakt finnes ikke' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deadline = (shift.events as any)?.signup_deadline as string | null
  if (deadline && new Date(deadline) < new Date()) {
    return NextResponse.json({ error: 'Påmeldingsfrist passert' }, { status: 403 })
  }

  // Sjekk kapasitet
  const { count } = await service
    .from('shift_claims')
    .select('id', { count: 'exact', head: true })
    .eq('shift_id', shiftId)

  if ((count ?? 0) >= shift.capacity) {
    return NextResponse.json({ error: 'Vakt er fullt' }, { status: 409 })
  }

  // Insert claim (UNIQUE constraint hindrer duplikat)
  const { error: insertErr } = await service
    .from('shift_claims')
    .insert({ shift_id: shiftId, user_id: user.id })

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'Du er allerede påmeldt' }, { status: 409 })
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shiftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  const service = getServiceClient()

  // Sjekk deadline
  const { data: shift } = await service
    .from('event_shifts')
    .select('events(signup_deadline)')
    .eq('id', shiftId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deadline = (shift?.events as any)?.signup_deadline as string | null
  if (deadline && new Date(deadline) < new Date()) {
    return NextResponse.json({ error: 'Påmeldingsfrist passert. Kontakt admin.' }, { status: 403 })
  }

  const { error: deleteErr } = await service
    .from('shift_claims')
    .delete()
    .eq('shift_id', shiftId)
    .eq('user_id', user.id)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verifiser API kjører lokalt**

```bash
npm run dev
```

I et annet terminal-vindu (etter neste tasks er ferdig og en test-vakt er opprettet via SQL):

```bash
# Forventet 401 uten cookie
curl -X POST http://localhost:3000/api/shifts/00000000-0000-0000-0000-000000000000/claim
```

Forventet: `{"error":"Ikke innlogget"}`

- [ ] **Step 3: Commit**

```bash
git add app/api/shifts/
git commit -m "feat(api): POST/DELETE for shift claim med deadline-validering"
```

---

## Task 6: Komponent — RoleInfoCard

**Files:**
- Create: `components/features/RoleInfoCard.tsx`

- [ ] **Step 1: Studer claymorphism-stil**

Les `components/features/ZoneClaimSheet.tsx` for å se hvilke Tailwind-klasser og CSS-variabler vi bruker (bg-surface, rounded-3xl, shadow-soft, text-foreground/70, etc).

- [ ] **Step 2: Opprett komponent**

```tsx
'use client'

import { ClipboardList } from 'lucide-react'
import type { RoleInfo } from '@/lib/types/shifts'
import { roleIcon } from '@/lib/shifts/utils'

interface Props {
  roleInfo: RoleInfo[]
}

export function RoleInfoCard({ roleInfo }: Props) {
  if (!roleInfo || roleInfo.length === 0) return null

  return (
    <section className="rounded-3xl bg-surface shadow-soft p-5">
      <header className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-display font-semibold tracking-tight">Oppgaver</h2>
      </header>

      <div className="space-y-5">
        {roleInfo.map((r) => (
          <div key={r.role}>
            <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
              <span>{roleIcon(r.role)}</span>
              {r.role}
            </h3>
            <ul className="space-y-1.5 ml-2">
              {r.tasks.map((t, i) => (
                <li key={i} className="text-sm text-foreground/70 flex gap-2">
                  <span className="text-accent">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/features/RoleInfoCard.tsx
git commit -m "feat(ui): RoleInfoCard for arrangement-oppgaver"
```

---

## Task 7: Komponent — GeneralInfoCard

**Files:**
- Create: `components/features/GeneralInfoCard.tsx`

- [ ] **Step 1: Opprett komponent**

```tsx
'use client'

import { Info } from 'lucide-react'
import type { GeneralInfoEntry } from '@/lib/types/shifts'

interface Props {
  entries: GeneralInfoEntry[]
}

export function GeneralInfoCard({ entries }: Props) {
  if (!entries || entries.length === 0) return null

  return (
    <section className="rounded-3xl bg-surface shadow-soft p-5">
      <header className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-display font-semibold tracking-tight">Generell informasjon</h2>
      </header>

      <dl className="space-y-3">
        {entries.map((e, i) => (
          <div key={i}>
            <dt className="text-xs uppercase tracking-wide text-foreground/50 mb-0.5">{e.label}</dt>
            <dd className="text-sm text-foreground">{e.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/features/GeneralInfoCard.tsx
git commit -m "feat(ui): GeneralInfoCard for arrangement-informasjon"
```

---

## Task 8: Komponent — ShiftListItem

**Files:**
- Create: `components/features/ShiftListItem.tsx`

- [ ] **Step 1: Opprett komponent**

```tsx
'use client'

import type { ShiftWithClaims } from '@/lib/types/shifts'
import { formatShiftTime, formatCapacity, shiftFillStatus, roleIcon } from '@/lib/shifts/utils'

interface Props {
  shift: ShiftWithClaims
  onClick: () => void
  currentUserId?: string
}

export function ShiftListItem({ shift, onClick, currentUserId }: Props) {
  const claimed = shift.claims?.length ?? 0
  const status = shiftFillStatus(claimed, shift.capacity)
  const meClaimed = currentUserId && shift.claims?.some(c => c.user_id === currentUserId)

  const ringClass =
    meClaimed ? 'ring-2 ring-accent' :
    status === 'partial' ? 'ring-2 ring-amber-300/60' :
    status === 'full' ? 'opacity-60' : ''

  const capacityClass =
    status === 'full' ? 'text-emerald-700' :
    status === 'partial' ? 'text-amber-700' :
    'text-foreground/70'

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl bg-surface shadow-soft p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform ${ringClass}`}
    >
      <span className="text-2xl shrink-0">{roleIcon(shift.role)}</span>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">{shift.role}</div>
        <div className="text-sm text-foreground/60">
          {formatShiftTime(shift.start_time)}–{formatShiftTime(shift.end_time)}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className={`text-sm font-medium ${capacityClass}`}>
          {formatCapacity(claimed, shift.capacity)}
        </div>
        {meClaimed && (
          <div className="text-xs text-accent font-medium mt-0.5">✓ Du er på</div>
        )}
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/features/ShiftListItem.tsx
git commit -m "feat(ui): ShiftListItem med kapasitet og status-ringer"
```

---

## Task 9: Komponent — ShiftClaimSheet

**Files:**
- Create: `components/features/ShiftClaimSheet.tsx`

- [ ] **Step 1: Studer eksisterende bottom-sheet**

Les `components/features/ZoneClaimSheet.tsx` og `components/features/MeetingPointSheet.tsx` for å se hvordan bottom-sheet er bygget (AnimatePresence, motion.div med bottom-0, backdrop, pb-20 for iPhone bottom-nav).

- [ ] **Step 2: Opprett komponent**

```tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Users, Phone } from 'lucide-react'
import type { ShiftWithClaims, RoleInfo } from '@/lib/types/shifts'
import { formatShiftDate, formatShiftTime, roleIcon, isDeadlinePassed } from '@/lib/shifts/utils'

interface Props {
  shift: ShiftWithClaims | null
  onClose: () => void
  onChange: () => void
  currentUserId?: string
  signupDeadline: string | null
  adminPhone: string | null
  roleInfo: RoleInfo[] | null
}

export function ShiftClaimSheet({
  shift, onClose, onChange, currentUserId, signupDeadline, adminPhone, roleInfo,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!shift) return null

  const meClaimed = currentUserId && shift.claims?.some(c => c.user_id === currentUserId)
  const claimed = shift.claims?.length ?? 0
  const isFull = claimed >= shift.capacity
  const deadlinePassed = isDeadlinePassed(signupDeadline)
  const taskList = roleInfo?.find(r => r.role === shift.role)?.tasks ?? []

  async function handleClaim() {
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/shifts/${shift!.id}/claim`, { method: 'POST' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'Ukjent feil' }))
      setError(j.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    onChange()
    onClose()
  }

  async function handleUnclaim() {
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/shifts/${shift!.id}/claim`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'Ukjent feil' }))
      setError(j.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    onChange()
    onClose()
  }

  return (
    <AnimatePresence>
      {shift && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto pb-20"
          >
            <header className="sticky top-0 bg-surface px-5 pt-5 pb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{roleIcon(shift.role)}</span>
                  <h2 className="text-xl font-display font-semibold tracking-tight uppercase">{shift.role}</h2>
                </div>
                <div className="mt-1 text-foreground/70 text-sm flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatShiftDate(shift.shift_date)} · {formatShiftTime(shift.start_time)}–{formatShiftTime(shift.end_time)}
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-foreground/5">
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="px-5 space-y-5">
              {/* Påmeldte */}
              <div>
                <h3 className="text-xs uppercase tracking-wide text-foreground/50 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Påmeldte ({claimed}/{shift.capacity})
                </h3>
                {claimed === 0 ? (
                  <p className="text-sm text-foreground/50 italic">Ingen påmeldt enda</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {shift.claims!.map((c) => (
                      <li key={c.user_id} className="flex items-center gap-2">
                        <span className="text-accent">•</span>
                        <span>{c.profile?.full_name ?? 'Anonym'}</span>
                        {c.user_id === currentUserId && (
                          <span className="text-xs text-accent">(deg)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Aksjon */}
              {deadlinePassed ? (
                <div className="rounded-2xl bg-amber-100/60 border border-amber-300/60 p-4 text-sm">
                  <div className="font-medium text-amber-900 mb-1">Påmelding stengt</div>
                  <p className="text-amber-900/80">
                    Hvis du må bytte vakt, kontakt admin
                    {adminPhone && (
                      <> på <a href={`tel:${adminPhone}`} className="underline inline-flex items-center gap-1"><Phone className="w-3 h-3" />{adminPhone}</a></>
                    )}.
                  </p>
                </div>
              ) : meClaimed ? (
                <button
                  onClick={handleUnclaim}
                  disabled={submitting}
                  className="w-full py-3 rounded-2xl bg-foreground/5 hover:bg-foreground/10 font-medium disabled:opacity-50"
                >
                  {submitting ? 'Melder av…' : 'Meld meg av'}
                </button>
              ) : isFull ? (
                <button disabled className="w-full py-3 rounded-2xl bg-emerald-100 text-emerald-900 font-medium">
                  Fullt
                </button>
              ) : (
                <button
                  onClick={handleClaim}
                  disabled={submitting}
                  className="w-full py-3 rounded-2xl bg-accent text-white font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Melder på…' : 'Meld meg på'}
                </button>
              )}

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>
              )}

              {/* Oppgaver */}
              {taskList.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-foreground/50 mb-2">Oppgaver</h3>
                  <ul className="space-y-1.5">
                    {taskList.map((t, i) => (
                      <li key={i} className="text-sm text-foreground/70 flex gap-2">
                        <span className="text-accent">•</span><span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {shift.notes && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm">
                  <div className="font-medium text-amber-900 mb-1">Merknad</div>
                  <div className="text-amber-900/80">{shift.notes}</div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/features/ShiftClaimSheet.tsx
git commit -m "feat(ui): ShiftClaimSheet bottom-sheet for vakt-påmelding"
```

---

## Task 10: Komponent — MyShiftsCard

**Files:**
- Create: `components/features/MyShiftsCard.tsx`

- [ ] **Step 1: Opprett komponent**

```tsx
'use client'

import { Check } from 'lucide-react'
import type { ShiftWithClaims } from '@/lib/types/shifts'
import { formatShiftDate, formatShiftTime, roleIcon } from '@/lib/shifts/utils'

interface Props {
  shifts: ShiftWithClaims[]
  currentUserId: string
  onShiftClick: (shift: ShiftWithClaims) => void
}

export function MyShiftsCard({ shifts, currentUserId, onShiftClick }: Props) {
  const mine = shifts.filter(s => s.claims?.some(c => c.user_id === currentUserId))
  if (mine.length === 0) return null

  return (
    <section className="rounded-3xl bg-accent/5 border border-accent/20 p-5">
      <h2 className="text-xs uppercase tracking-wide text-accent font-semibold mb-3">Dine vakter</h2>

      <div className="space-y-2">
        {mine.map(s => (
          <button
            key={s.id}
            onClick={() => onShiftClick(s)}
            className="w-full rounded-2xl bg-surface shadow-soft p-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
          >
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xl shrink-0">{roleIcon(s.role)}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{formatShiftDate(s.shift_date)}</div>
              <div className="text-xs text-foreground/60">
                {formatShiftTime(s.start_time)}–{formatShiftTime(s.end_time)} · {s.role}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/features/MyShiftsCard.tsx
git commit -m "feat(ui): MyShiftsCard for brukerens egne vakter"
```

---

## Task 11: Detaljside `/arrangement/[id]`

**Files:**
- Create: `app/(app)/arrangement/[id]/page.tsx`

- [ ] **Step 1: Studer eksisterende detaljside**

Les `app/(app)/sjafor/page.tsx` for mønster (createClient i useRef, useEffect for å hente data, loading skeleton, header med back-knapp).

- [ ] **Step 2: Opprett siden**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, MapPin, Clock as ClockIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeShifts } from '@/lib/hooks/useRealtimeShifts'
import { ShiftListItem } from '@/components/features/ShiftListItem'
import { ShiftClaimSheet } from '@/components/features/ShiftClaimSheet'
import { MyShiftsCard } from '@/components/features/MyShiftsCard'
import { RoleInfoCard } from '@/components/features/RoleInfoCard'
import { GeneralInfoCard } from '@/components/features/GeneralInfoCard'
import { formatShiftDate, formatShiftDateShort, groupShiftsByDate, sortShifts, isDeadlinePassed } from '@/lib/shifts/utils'
import type { ArrangementEvent, ShiftWithClaims } from '@/lib/types/shifts'

export default function ArrangementPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const [event, setEvent] = useState<ArrangementEvent | null>(null)
  const [userId, setUserId] = useState<string | undefined>()
  const [selectedShift, setSelectedShift] = useState<ShiftWithClaims | null>(null)

  const { shifts, loading, refetch } = useRealtimeShifts(id)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (user) setUserId(user.id)

      const { data: ev } = await supabaseRef.current
        .from('events')
        .select('*')
        .eq('id', id)
        .eq('type', 'arrangement')
        .maybeSingle()

      if (!ev) {
        router.push('/hjem')
        return
      }
      setEvent(ev as unknown as ArrangementEvent)
    }
    load()
  }, [id, router])

  if (!event || loading) {
    return (
      <div className="min-h-screen p-5 space-y-4 pb-20">
        <div className="h-8 w-24 bg-foreground/10 rounded animate-pulse" />
        <div className="h-32 bg-foreground/10 rounded-3xl animate-pulse" />
        <div className="h-64 bg-foreground/10 rounded-3xl animate-pulse" />
      </div>
    )
  }

  const sorted = sortShifts(shifts) as ShiftWithClaims[]
  const grouped = groupShiftsByDate(sorted)
  const dateRange = sorted.length > 0
    ? `${formatShiftDateShort(sorted[0].shift_date)} – ${formatShiftDateShort(sorted[sorted.length - 1].shift_date)}`
    : event.date
  const deadlinePassed = isDeadlinePassed(event.signup_deadline)

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-5 pt-5 pb-3">
        <button onClick={() => router.push('/hjem')} className="flex items-center gap-1 text-sm text-foreground/60 mb-3 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Tilbake
        </button>
        <h1 className="text-3xl font-display font-bold tracking-tight text-balance">{event.title}</h1>
        <div className="mt-2 space-y-1 text-sm text-foreground/70">
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4 shrink-0" />{dateRange}</div>
          {event.meeting_point?.name && (
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" />{event.meeting_point.name}</div>
          )}
          {event.signup_deadline && (
            <div className={`flex items-center gap-2 ${deadlinePassed ? 'text-amber-700' : ''}`}>
              <ClockIcon className="w-4 h-4 shrink-0" />
              {deadlinePassed ? 'Påmelding stengt' : `Påmelding stenger ${new Date(event.signup_deadline).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}`}
            </div>
          )}
        </div>
      </header>

      {/* Beskrivelse */}
      {event.description && (
        <p className="px-5 mt-2 text-foreground/80 text-balance">{event.description}</p>
      )}

      {/* Hovedinnhold */}
      <main className="px-5 mt-6 space-y-5">
        {userId && <MyShiftsCard shifts={sorted} currentUserId={userId} onShiftClick={setSelectedShift} />}

        <section>
          <h2 className="text-xs uppercase tracking-wide text-foreground/50 font-semibold mb-3">Ledige vakter</h2>
          {sorted.length === 0 ? (
            <div className="rounded-3xl bg-surface shadow-soft p-5 text-center text-foreground/60">
              Ingen vakter opprettet enda
            </div>
          ) : (
            <div className="space-y-5">
              {Array.from(grouped.entries()).map(([date, dayShifts]) => (
                <div key={date}>
                  <div className="text-xs uppercase tracking-wide text-foreground/40 mb-2">{formatShiftDate(date)}</div>
                  <div className="space-y-2">
                    {dayShifts.map(s => (
                      <ShiftListItem key={s.id} shift={s} onClick={() => setSelectedShift(s)} currentUserId={userId} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {event.role_info && event.role_info.length > 0 && <RoleInfoCard roleInfo={event.role_info} />}
        {event.general_info && event.general_info.length > 0 && <GeneralInfoCard entries={event.general_info} />}

        {event.contact_phone && (
          <div className="text-center text-sm text-foreground/60 pt-2">
            Spørsmål? Kontakt admin på <a href={`tel:${event.contact_phone}`} className="text-accent underline">{event.contact_phone}</a>
          </div>
        )}
      </main>

      {/* Bottom sheet */}
      <ShiftClaimSheet
        shift={selectedShift}
        onClose={() => setSelectedShift(null)}
        onChange={refetch}
        currentUserId={userId}
        signupDeadline={event.signup_deadline}
        adminPhone={event.contact_phone}
        roleInfo={event.role_info}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verifiser kompilering**

```bash
npm run dev
```

Forventet: ingen TypeScript-feil i terminalen. Naviger til `http://localhost:3000/arrangement/test` — skal redirecte til `/hjem`.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/arrangement/
git commit -m "feat(ui): detaljside for arrangement-vakter med live oppdatering"
```

---

## Task 12: Komponent — ArrangementCard for hjem-skjermen

**Files:**
- Create: `components/features/ArrangementCard.tsx`

- [ ] **Step 1: Studer eksisterende kort på hjem**

Les `app/(app)/hjem/page.tsx` for å se hvordan event-kort renderes i dag (claymorphism-styling, link-wrappet).

- [ ] **Step 2: Opprett komponent**

```tsx
'use client'

import Link from 'next/link'
import { Calendar, Sparkles, Clock } from 'lucide-react'
import type { ArrangementEvent } from '@/lib/types/shifts'

interface Props {
  event: ArrangementEvent
  totalShifts: number
  freePlaces: number
}

export function ArrangementCard({ event, totalShifts, freePlaces }: Props) {
  const deadlineText = event.signup_deadline
    ? new Date(event.signup_deadline).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
    : null

  return (
    <Link
      href={`/arrangement/${event.id}`}
      className="block rounded-3xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/30 shadow-soft p-5 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <h3 className="text-lg font-display font-semibold tracking-tight text-balance uppercase">{event.title}</h3>
      </div>

      <div className="space-y-1.5 text-sm text-foreground/70 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0" />
          {event.date && new Date(event.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}
        </div>
        {deadlineText && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            Påmelding stenger {deadlineText}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium text-foreground">{totalShifts}</span>
          <span className="text-foreground/60"> vakter · </span>
          <span className={`font-medium ${freePlaces > 0 ? 'text-accent' : 'text-emerald-700'}`}>
            {freePlaces > 0 ? `${freePlaces} plasser ledige` : 'Alle plasser fylt'}
          </span>
        </div>
        <div className="text-sm font-medium text-accent">Se vakter →</div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/features/ArrangementCard.tsx
git commit -m "feat(ui): ArrangementCard for hjem-skjermen"
```

---

## Task 13: Integrer ArrangementCard på hjem-skjermen

**Files:**
- Modify: `app/(app)/hjem/page.tsx`

- [ ] **Step 1: Les hjem-siden**

```bash
cat app/\(app\)/hjem/page.tsx | head -100
```

Identifiser hvor aktive events listes opp (sannsynligvis en `events`-query og en map over `event.type`).

- [ ] **Step 2: Utvid event-query til å hente shift-aggregater**

Finn `useEffect`/datahenting for events. Etter eksisterende event-fetch, legg til en parallel fetch for shift-aggregater per arrangement-event:

```typescript
// Etter at events er hentet, hent shift-aggregater for arrangement-events
const arrangementIds = events
  .filter(e => e.type === 'arrangement' && e.status === 'active')
  .map(e => e.id)

if (arrangementIds.length > 0) {
  const { data: shiftsData } = await supabase
    .from('event_shifts')
    .select('id, event_id, capacity, claims:shift_claims(id)')
    .in('event_id', arrangementIds)

  // Aggreger per event_id
  const agg = new Map<string, { total: number; free: number }>()
  for (const s of shiftsData ?? []) {
    const a = agg.get(s.event_id) ?? { total: 0, free: 0 }
    a.total += 1
    a.free += Math.max(0, s.capacity - (s.claims?.length ?? 0))
    agg.set(s.event_id, a)
  }
  setShiftAggregates(agg)
}
```

Legg til state: `const [shiftAggregates, setShiftAggregates] = useState<Map<string, { total: number; free: number }>>(new Map())`.

- [ ] **Step 3: Render ArrangementCard for arrangement-events**

I render-blokken hvor events mappes til kort, legg til en case for `event.type === 'arrangement'`:

```tsx
import { ArrangementCard } from '@/components/features/ArrangementCard'

// I render-løkken over events:
{events.filter(e => e.type === 'arrangement' && e.status === 'active').map(e => {
  const agg = shiftAggregates.get(e.id) ?? { total: 0, free: 0 }
  return (
    <ArrangementCard
      key={e.id}
      event={e as unknown as ArrangementEvent}
      totalShifts={agg.total}
      freePlaces={agg.free}
    />
  )
})}
```

Plasser det sammen med de andre event-kortene (typisk over eller under flaskeinnsamling/plast).

- [ ] **Step 4: Verifiser i nettleser**

```bash
npm run dev
```

Naviger til `http://localhost:3000/hjem`. Forventet: ingen feil, men ingen arrangement-kort vises ennå (vi har ikke opprettet ett). Det kommer i Task 14.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/hjem/page.tsx
git commit -m "feat(hjem): vis arrangement-kort med shift-aggregater"
```

---

## Task 14: Opprett test-arrangement og verifiser bruker-flyt (CHECKPOINT A)

**Files:** ingen (manuell verifisering)

- [ ] **Step 1: Opprett test-arrangement via SQL**

I Supabase Dashboard SQL Editor:

```sql
INSERT INTO events (
  title, description, type, date, start_time, end_time, status, area,
  contact_phone, signup_deadline,
  role_info, general_info
) VALUES (
  'Fotball VM hos Clarion Hotel',
  'Vi har fått en flott mulighet til å bidra under Fotball VM hos Clarion Hotel. Korpset får 150 kr per vakt vi tar.',
  'arrangement',
  '2026-06-15',
  '15:30',
  '20:30',
  'active',
  'begge',
  '91351290',
  '2026-06-02T23:59:00+02:00',
  '[
    {"role":"Renhold","tasks":["Tøm søppel","Toaletter: vask ved behov, fyll på toalettpapir og tørkepapir","Space: vask over gulvet ved behov"]},
    {"role":"Host/servering","tasks":["Mottak: plassering av gjester","Rydde søppel (hvite dunker)","Rydding bord"]}
  ]'::jsonb,
  '[
    {"label":"Kleskode","value":"Helsvart klær og gode sko"},
    {"label":"Oppmøtested","value":"Resepsjonen, Clarion Hotel Trondheim, Brattørkaia 1"},
    {"label":"Ved ankomst","value":"Signer skjema i resepsjonen og få tildelt nøkkelkort"},
    {"label":"Betaling","value":"150 kr per vakt. Faktura sendes Clarion i ettertid."},
    {"label":"Hvem kan delta","value":"Ungdom fra 16 år og voksne"}
  ]'::jsonb
)
RETURNING id;
```

Noter ID-en som returneres.

- [ ] **Step 2: Opprett noen test-vakter**

Erstatt `<EVENT_ID>` med ID fra forrige steg:

```sql
INSERT INTO event_shifts (event_id, role, shift_date, start_time, end_time, capacity) VALUES
  ('<EVENT_ID>', 'Renhold', '2026-06-15', '15:30', '20:30', 2),
  ('<EVENT_ID>', 'Renhold', '2026-06-18', '15:30', '20:30', 2),
  ('<EVENT_ID>', 'Renhold', '2026-06-20', '15:30', '20:00', 2),
  ('<EVENT_ID>', 'Host/servering', '2026-06-20', '15:30', '22:30', 3),
  ('<EVENT_ID>', 'Host/servering', '2026-06-22', '15:30', '23:30', 4);
```

- [ ] **Step 3: Verifiser i nettleser**

```bash
npm run dev
```

1. Åpne `http://localhost:3000/hjem` (logget inn). Forventet: nytt ArrangementCard "Fotball VM" med "5 vakter · 13 plasser ledige"
2. Klikk på kortet → detaljside lastes
3. Verifiser at:
   - Header viser navn, datoer, "Påmelding stenger 2. juni"
   - Beskrivelse vises
   - Vakter er gruppert per dato kronologisk
   - Oppgaver-card viser begge roller med bullets
   - Generell informasjon-card viser alle 5 punktene
4. Klikk på en vakt → bottom-sheet åpnes med oppgaver og "Meld meg på"-knapp
5. Trykk "Meld meg på"
   - Sheet lukker, telleren går fra 0/2 til 1/2, ring blir gul (partial), "✓ Du er på" vises
   - Mine vakter-card dukker opp øverst
6. Åpne en annen fane på samme URL, meld på i fane 1, se telleren oppdatere seg i fane 2 (realtime)
7. Åpne samme vakt igjen → "Meld meg av"-knapp vises. Trykk → forsvinner fra Mine vakter

- [ ] **Step 4: Test deadline-stenging**

Sett deadline til fortid:

```sql
UPDATE events SET signup_deadline = '2025-01-01T00:00:00+01:00' WHERE id = '<EVENT_ID>';
```

Last siden på nytt. Forventet:
- Header viser "Påmelding stengt" i gult
- Bottom-sheet viser gul info-boks med admin-tel, ingen påmeldingsknapp

Reverser:

```sql
UPDATE events SET signup_deadline = '2026-06-02T23:59:00+02:00' WHERE id = '<EVENT_ID>';
```

- [ ] **Step 5: Test og rapporter til Tor Martin**

Når alt over fungerer, si fra. Hvis noe ikke fungerer som forventet, dokumenter symptomer og fiks før vi går videre.

**🛑 CHECKPOINT A:** Vent på godkjenning fra Tor Martin før Task 15.

---

## Task 15: Admin — utvid hendelser-form med arrangement-felter

**Files:**
- Modify: `app/admin/hendelser/page.tsx` (eller hvor opprettings-formen ligger)

- [ ] **Step 1: Identifiser admin-form for events**

```bash
grep -r "type.*plast\|type.*lapper" app/admin/ | head -5
```

Finn formen som lager nye events. Sannsynligvis i `app/admin/hendelser/page.tsx` eller en underkomponent.

- [ ] **Step 2: Legg til 'arrangement' i type-dropdown**

Finn `<select>` eller knapp-rad for event-type, og legg til `'arrangement'` med label "Arrangement (vakter)".

- [ ] **Step 3: Conditional rendering av arrangement-felter**

Når `type === 'arrangement'` er valgt, vis disse ekstra feltene under standardfeltene:

```tsx
{formType === 'arrangement' && (
  <>
    <label className="block">
      <span className="text-sm font-medium">Påmeldingsfrist</span>
      <input
        type="datetime-local"
        value={signupDeadline}
        onChange={e => setSignupDeadline(e.target.value)}
        className="mt-1 w-full rounded-xl border-foreground/15 bg-surface px-3 py-2"
        required
      />
    </label>

    {/* Roller-repeater */}
    <div>
      <h3 className="text-sm font-medium mb-2">Roller og oppgaver</h3>
      {roles.map((r, i) => (
        <div key={i} className="rounded-2xl bg-foreground/[0.03] p-3 mb-2 space-y-2">
          <div className="flex gap-2">
            <input
              placeholder="Rollenavn (eks. Renhold)"
              value={r.role}
              onChange={e => updateRole(i, { ...r, role: e.target.value })}
              className="flex-1 rounded-xl border-foreground/15 bg-surface px-3 py-2"
            />
            <button type="button" onClick={() => removeRole(i)} className="px-3 text-red-600">Slett</button>
          </div>
          <textarea
            placeholder="Oppgaver (én linje per punkt)"
            value={r.tasks.join('\n')}
            onChange={e => updateRole(i, { ...r, tasks: e.target.value.split('\n').filter(Boolean) })}
            rows={4}
            className="w-full rounded-xl border-foreground/15 bg-surface px-3 py-2 text-sm"
          />
        </div>
      ))}
      <button type="button" onClick={() => setRoles([...roles, { role: '', tasks: [] }])} className="text-sm text-accent">
        + Legg til rolle
      </button>
    </div>

    {/* Generell info-repeater */}
    <div>
      <h3 className="text-sm font-medium mb-2">Generell informasjon</h3>
      {generalInfo.map((g, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input
            placeholder="Etikett (Kleskode)"
            value={g.label}
            onChange={e => updateInfo(i, { ...g, label: e.target.value })}
            className="w-40 rounded-xl border-foreground/15 bg-surface px-3 py-2 text-sm"
          />
          <input
            placeholder="Verdi"
            value={g.value}
            onChange={e => updateInfo(i, { ...g, value: e.target.value })}
            className="flex-1 rounded-xl border-foreground/15 bg-surface px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => removeInfo(i)} className="px-2 text-red-600">×</button>
        </div>
      ))}
      <button type="button" onClick={() => setGeneralInfo([...generalInfo, { label: '', value: '' }])} className="text-sm text-accent">
        + Legg til info-punkt
      </button>
    </div>
  </>
)}
```

Tilhørende state:

```tsx
const [signupDeadline, setSignupDeadline] = useState('')
const [roles, setRoles] = useState<{ role: string; tasks: string[] }[]>([])
const [generalInfo, setGeneralInfo] = useState<{ label: string; value: string }[]>([])

function updateRole(i: number, r: { role: string; tasks: string[] }) {
  setRoles(roles.map((x, idx) => idx === i ? r : x))
}
function removeRole(i: number) {
  setRoles(roles.filter((_, idx) => idx !== i))
}
function updateInfo(i: number, g: { label: string; value: string }) {
  setGeneralInfo(generalInfo.map((x, idx) => idx === i ? g : x))
}
function removeInfo(i: number) {
  setGeneralInfo(generalInfo.filter((_, idx) => idx !== i))
}
```

- [ ] **Step 4: Inkluder feltene i INSERT/UPDATE**

I submit-handler, når `type === 'arrangement'`, legg til:

```typescript
const insertData: Record<string, unknown> = {
  // ... eksisterende felter
}
if (formType === 'arrangement') {
  insertData.signup_deadline = signupDeadline || null
  insertData.role_info = roles.filter(r => r.role.trim())
  insertData.general_info = generalInfo.filter(g => g.label.trim())
}
```

- [ ] **Step 5: Verifiser**

```bash
npm run dev
```

Åpne `/admin/hendelser`, velg type "Arrangement", fyll inn felter, lagre. Verifiser i Supabase Dashboard at `signup_deadline`, `role_info`, `general_info` er satt.

- [ ] **Step 6: Commit**

```bash
git add app/admin/hendelser/
git commit -m "feat(admin): utvid hendelser-form med arrangement-felter"
```

---

## Task 16: Admin — vakt-oppretter på event-detaljside

**Files:**
- Modify: `app/admin/hendelser/[id]/page.tsx` (eller tilsvarende detaljside)

- [ ] **Step 1: Identifiser event-detaljsiden**

```bash
ls app/admin/hendelser/
```

Finn detaljsiden. Hvis den ikke finnes som `[id]/page.tsx`, bygg inn redigerings-form i hovedsiden.

- [ ] **Step 2: Legg til vakt-seksjon for arrangement-events**

Vis kun når `event.type === 'arrangement'`:

```tsx
{event.type === 'arrangement' && (
  <section className="mt-8 rounded-3xl bg-surface shadow-soft p-5">
    <h2 className="text-lg font-display font-semibold mb-4">Vakter</h2>

    <div className="space-y-2 mb-4">
      {shifts.map((s, i) => (
        <div key={s.id ?? i} className="flex gap-2 items-center">
          <input type="date" value={s.shift_date} onChange={e => updateShift(i, { ...s, shift_date: e.target.value })}
            className="rounded-xl border-foreground/15 px-2 py-1.5 text-sm" />
          <input type="time" value={s.start_time} onChange={e => updateShift(i, { ...s, start_time: e.target.value })}
            className="rounded-xl border-foreground/15 px-2 py-1.5 text-sm w-24" />
          <span>–</span>
          <input type="time" value={s.end_time} onChange={e => updateShift(i, { ...s, end_time: e.target.value })}
            className="rounded-xl border-foreground/15 px-2 py-1.5 text-sm w-24" />
          <select value={s.role} onChange={e => updateShift(i, { ...s, role: e.target.value })}
            className="rounded-xl border-foreground/15 px-2 py-1.5 text-sm flex-1">
            <option value="">Velg rolle</option>
            {(event.role_info ?? []).map((r: RoleInfo) => (
              <option key={r.role} value={r.role}>{r.role}</option>
            ))}
          </select>
          <input type="number" min="1" value={s.capacity} onChange={e => updateShift(i, { ...s, capacity: parseInt(e.target.value) || 1 })}
            className="w-16 rounded-xl border-foreground/15 px-2 py-1.5 text-sm" />
          <button type="button" onClick={() => removeShift(i)} className="px-2 text-red-600">×</button>
        </div>
      ))}
    </div>

    <button type="button" onClick={addShift} className="text-sm text-accent">+ Legg til vakt</button>

    <button onClick={saveShifts} disabled={saving}
      className="mt-4 px-4 py-2 rounded-2xl bg-accent text-white font-medium disabled:opacity-50">
      {saving ? 'Lagrer…' : 'Lagre vakter'}
    </button>
  </section>
)}
```

State + helpers:

```tsx
const [shifts, setShifts] = useState<Array<{
  id?: string; shift_date: string; start_time: string; end_time: string;
  role: string; capacity: number; notes?: string
}>>([])
const [saving, setSaving] = useState(false)

// Last shifts ved mount
useEffect(() => {
  if (event?.type !== 'arrangement') return
  supabase.from('event_shifts').select('*').eq('event_id', event.id)
    .order('shift_date').order('start_time').then(({ data }) => setShifts(data ?? []))
}, [event?.id, event?.type, supabase])

function updateShift(i: number, s: typeof shifts[number]) { setShifts(shifts.map((x, idx) => idx === i ? s : x)) }
function removeShift(i: number) { setShifts(shifts.filter((_, idx) => idx !== i)) }
function addShift() {
  setShifts([...shifts, { shift_date: '', start_time: '15:30', end_time: '20:30', role: '', capacity: 2 }])
}

async function saveShifts() {
  setSaving(true)
  const valid = shifts.filter(s => s.shift_date && s.role && s.capacity > 0)
  // Skill mellom eksisterende (med id) og nye
  const updates = valid.filter(s => s.id)
  const inserts = valid.filter(s => !s.id).map(s => ({ ...s, event_id: event.id }))

  if (inserts.length > 0) {
    await supabase.from('event_shifts').insert(inserts)
  }
  for (const u of updates) {
    await supabase.from('event_shifts').update({
      shift_date: u.shift_date, start_time: u.start_time, end_time: u.end_time,
      role: u.role, capacity: u.capacity, notes: u.notes ?? null
    }).eq('id', u.id!)
  }
  // Re-hent
  const { data } = await supabase.from('event_shifts').select('*').eq('event_id', event.id)
    .order('shift_date').order('start_time')
  setShifts(data ?? [])
  setSaving(false)
}
```

**Merknad om sletting:** For å slette en vakt med påmeldte må admin slette manuelt i Supabase Dashboard. Sletting i UI legges til v2 hvis det blir et behov.

- [ ] **Step 3: Verifiser**

Åpne admin-detaljsiden for VM-arrangementet. Legg til 1-2 nye vakter, lagre. Bekreft at de dukker opp på bruker-detaljsiden.

- [ ] **Step 4: Commit**

```bash
git add app/admin/hendelser/
git commit -m "feat(admin): vakt-oppretter for arrangement-events"
```

---

## Task 17: API — Eksport CSV

**Files:**
- Create: `app/api/admin/arrangement/[id]/export/route.ts`

- [ ] **Step 1: Opprett route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Sjekk admin-rolle
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return new Response('Forbidden', { status: 403 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: event } = await service.from('events').select('title').eq('id', eventId).single()
  if (!event) return new Response('Not found', { status: 404 })

  const { data: shifts } = await service
    .from('event_shifts')
    .select(`
      shift_date, start_time, end_time, role, capacity,
      claims:shift_claims(profile:profiles(full_name, phone))
    `)
    .eq('event_id', eventId)
    .order('shift_date')
    .order('start_time')

  const rows: string[] = ['Dato,Tidspunkt,Rolle,Antall plasser,Navn,Telefon']
  for (const s of shifts ?? []) {
    const date = new Date(s.shift_date).toLocaleDateString('nb-NO')
    const time = `${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claims = (s.claims as any[]) ?? []
    if (claims.length === 0) {
      rows.push(`${date},${time},${csvEscape(s.role)},${s.capacity},,`)
    } else {
      for (const c of claims) {
        rows.push(`${date},${time},${csvEscape(s.role)},${s.capacity},${csvEscape(c.profile?.full_name ?? '')},${csvEscape(c.profile?.phone ?? '')}`)
      }
    }
  }

  const csv = '﻿' + rows.join('\n')  // BOM så Excel åpner UTF-8 riktig
  const filename = `vaktliste-${event.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function csvEscape(s: string): string {
  if (!s) return ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
```

- [ ] **Step 2: Verifiser**

Åpne `http://localhost:3000/api/admin/arrangement/<EVENT_ID>/export` mens du er logget inn som admin. Last ned CSV, åpne i Excel/Numbers, sjekk at norske bokstaver vises riktig.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/arrangement/
git commit -m "feat(api): CSV-eksport av vaktliste for arrangør"
```

---

## Task 18: Admin — Eksport-knapp på event-detaljside

**Files:**
- Modify: `app/admin/hendelser/[id]/page.tsx` (samme som Task 16)

- [ ] **Step 1: Legg til knapp**

Inne i `{event.type === 'arrangement' && (` blokken, etter vakt-listen:

```tsx
<div className="mt-6 flex gap-3">
  <a
    href={`/api/admin/arrangement/${event.id}/export`}
    download
    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-surface shadow-soft text-sm font-medium hover:bg-foreground/5"
  >
    📥 Last ned vaktliste (.csv)
  </a>
</div>
```

- [ ] **Step 2: Verifiser**

Klikk knappen i admin-UI, sjekk at CSV lastes ned.

- [ ] **Step 3: Commit**

```bash
git add app/admin/hendelser/
git commit -m "feat(admin): nedlasting av vaktliste fra event-detaljside"
```

---

## Task 19: API — Cron for 24t påminnelse

**Files:**
- Create: `app/api/cron/shift-reminders/route.ts`

- [ ] **Step 1: Sjekk eksisterende push-mønster**

```bash
cat app/api/push/send/route.ts
```

Identifiser hvordan web-push brukes i dag (sannsynligvis `import webpush from 'web-push'`, VAPID-nøkler fra env).

- [ ] **Step 2: Opprett endepunktet**

```typescript
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const runtime = 'nodejs'

webpush.setVapidDetails(
  'mailto:tormartin@superponni.no',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function GET(request: Request) {
  // Beskytt med CRON_SECRET (Vercel injecter automatisk)
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Hent alle vakter som starter i morgen (basert på server-tid)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: shifts, error } = await service
    .from('event_shifts')
    .select(`
      id, role, shift_date, start_time, event_id,
      events!inner(title),
      shift_claims(user_id)
    `)
    .eq('shift_date', tomorrowStr)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  let failed = 0

  for (const shift of shifts ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const title = (shift.events as any)?.title ?? 'Arrangement'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claims = (shift.shift_claims as any[]) ?? []

    for (const c of claims) {
      const { data: subs } = await service
        .from('push_subscriptions')
        .select('endpoint, keys_p256dh, keys_auth')
        .eq('user_id', c.user_id)

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
            },
            JSON.stringify({
              title: `Påminnelse: ${title}`,
              body: `Din vakt (${shift.role}) er i morgen kl ${shift.start_time.slice(0,5)}.`,
              url: `/arrangement/${shift.event_id}`,
            })
          )
          sent++
        } catch (e) {
          console.error('Push failed:', e)
          failed++
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent, failed, date: tomorrowStr })
}
```

- [ ] **Step 3: Test lokalt med curl**

```bash
# Hent CRON_SECRET fra .env.local — eller bare lag en midlertidig for test
echo "CRON_SECRET=lokaltesthemmelighet" >> .env.local
```

Restart `npm run dev`, så:

```bash
curl http://localhost:3000/api/cron/shift-reminders \
  -H "Authorization: Bearer lokaltesthemmelighet"
```

Forventet: `{"ok":true,"sent":0,"failed":0,"date":"YYYY-MM-DD"}`

Test også 401:
```bash
curl http://localhost:3000/api/cron/shift-reminders
# Forventet: Unauthorized
```

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/
git commit -m "feat(cron): 24t-påminnelse for vakter via Vercel Cron"
```

---

## Task 20: Vercel Cron-konfig

**Files:**
- Create or modify: `vercel.json`

- [ ] **Step 1: Sjekk om vercel.json finnes**

```bash
ls vercel.json 2>/dev/null && cat vercel.json
```

- [ ] **Step 2: Opprett eller utvid vercel.json**

Hvis fila ikke finnes:

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

Hvis fila finnes, slå sammen — legg til `"crons"`-arrayen (eller utvid eksisterende).

**Cron-utgangspunkt:** `0 17 * * *` = kl 17:00 UTC daglig. Det blir kl 19:00 norsk sommertid (CEST) og kl 18:00 vintertid (CET). Greit for vakt-påminnelser.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(cron): aktivér Vercel Cron for daglig vakt-påminnelse"
```

**Merknad:** Cron-jobben aktiveres ikke før koden er deployet til Vercel og `CRON_SECRET` er satt i Vercel env (gjøres i checkpoint B før push).

---

## Task 21: Admin — manuell push-trigger som backup

**Files:**
- Modify: `app/admin/hendelser/[id]/page.tsx`

- [ ] **Step 1: Legg til knapp**

I samme `{event.type === 'arrangement' && (` blokken, etter eksport-knappen:

```tsx
<button
  onClick={triggerReminders}
  disabled={triggering}
  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-surface shadow-soft text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
>
  🔔 {triggering ? 'Sender…' : 'Send 24t-påminnelser nå'}
</button>
```

State + handler:

```tsx
const [triggering, setTriggering] = useState(false)
const [triggerResult, setTriggerResult] = useState<string | null>(null)

async function triggerReminders() {
  setTriggering(true)
  setTriggerResult(null)
  const res = await fetch('/api/cron/shift-reminders', {
    headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
  })
  // Trenger en proxy-rute fordi vi ikke vil eksponere CRON_SECRET i klient
  // ...
}
```

**Problem:** Vi vil ikke eksponere `CRON_SECRET` til klient. Lag heller en intern admin-rute som sjekker admin-rolle og kaller cron-endepunktet med server-side secret.

- [ ] **Step 2: Opprett admin-trigger-rute**

Create: `app/api/admin/trigger-shift-reminders/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return new Response('Forbidden', { status: 403 })

  // Kall cron-endepunktet med server-side secret
  const url = new URL('/api/cron/shift-reminders', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const body = await res.json()
  return NextResponse.json(body, { status: res.status })
}
```

**Merknad:** `NEXT_PUBLIC_SITE_URL` bør være satt til `http://localhost:3000` lokalt og `https://dugnadshub.no` i prod. Hvis ikke satt, fallback til localhost (det funker også lokalt).

- [ ] **Step 3: Oppdater knapp til å bruke admin-rute**

```tsx
async function triggerReminders() {
  setTriggering(true)
  setTriggerResult(null)
  const res = await fetch('/api/admin/trigger-shift-reminders', { method: 'POST' })
  const j = await res.json().catch(() => ({}))
  setTriggering(false)
  setTriggerResult(res.ok ? `Sendt: ${j.sent} (${j.failed} feilet)` : `Feil: ${j.error ?? 'ukjent'}`)
}

// Vis resultat under knappen
{triggerResult && <div className="text-sm text-foreground/60 mt-2">{triggerResult}</div>}
```

- [ ] **Step 4: Verifiser**

Klikk knappen i admin. Forventet svar: "Sendt: 0 (0 feilet)" hvis ingen vakter er i morgen, eller faktiske tall.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/ app/admin/hendelser/
git commit -m "feat(admin): manuell trigger for vakt-påminnelser"
```

---

## Task 22: Versjonsbump

**Files:**
- Modify: `app/(app)/profil/page.tsx`

- [ ] **Step 1: Bump versjonsnummer**

Endre `v 9.2` til `v 10.0` (ny dugnadstype markerer major bump i dette mønsteret).

```bash
grep -n "v 9\." app/\(app\)/profil/page.tsx
```

Edit linjen 610 (eller hvor versjonen står):

```tsx
Tillerbyen Skolekorps Dugnadshub v 10.0
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/profil/page.tsx
git commit -m "chore: versjonsbump til 10.0 (arrangement-vakter)"
```

---

## Task 23: Full lokal verifikasjon (CHECKPOINT B)

**Files:** ingen (manuell verifisering)

- [ ] **Step 1: Last alt på nytt**

```bash
npm run dev
```

- [ ] **Step 2: Bruker-flyt**

1. Hjem-skjerm viser ArrangementCard for Fotball VM
2. Klikk → detaljside lastes med vakter, oppgaver, generell info
3. Meld på en vakt → telleren oppdateres, "Mine vakter" dukker opp
4. Realtime: åpne annen fane, meld på → telleren oppdateres uten refresh
5. Meld av → forsvinner fra "Mine vakter"

- [ ] **Step 3: Admin-flyt**

1. `/admin/hendelser` har "Arrangement" som type-valg
2. Opprett nytt test-arrangement (eller bruk eksisterende Fotball VM)
3. På event-detaljside: legg til/endre vakter, lagre
4. Last ned vaktliste-CSV → åpnes i Excel med norske bokstaver intakt
5. Klikk "Send 24t-påminnelser nå" → får tilbakemelding (sent/failed)

- [ ] **Step 4: Deadline-håndtering**

1. Sett `signup_deadline` til fortid via SQL → bottom-sheet viser "Påmelding stengt" med kontakttelefon
2. Reverser

- [ ] **Step 5: Versjonsbump synlig**

Åpne `/profil`, bekreft "v 10.0"

- [ ] **Step 6: Lint-sjekk**

```bash
npm run lint
```

Forventet: ingen errors. Warnings er OK hvis de er om eksisterende kode.

- [ ] **Step 7: Build-sjekk**

```bash
npm run build
```

Forventet: bygg fullføres uten feil.

- [ ] **Step 8: Rapporter til Tor Martin**

Når alt over fungerer, gi beskjed. Vi går ikke videre til push før dette er grønt.

**🛑 CHECKPOINT B:** Vent på godkjenning fra Tor Martin.

---

## Task 24: Push til main + Vercel-deploy

**Files:** ingen (deploy-steg)

- [ ] **Step 1: Sett CRON_SECRET i Vercel**

1. Åpne Vercel Dashboard for dugnadshub-prosjektet
2. Settings → Environment Variables
3. Legg til `CRON_SECRET` for Production (Vercel kan generere en sikker verdi, eller bruk noe som `openssl rand -hex 32`)
4. Optional: legg til samme i Preview/Development hvis du vil teste cron i preview-deploys

- [ ] **Step 2: Merge til main**

```bash
git checkout main
git merge arrangement-vakter
```

- [ ] **Step 3: Push**

```bash
git push origin main
```

Vercel auto-deployer fra `main`.

- [ ] **Step 4: Verifiser prod-deploy**

1. Åpne `https://dugnadshub.no/hjem` (logget inn) — sjekk at Fotball VM dukker opp hvis det er aktivt
2. Sjekk Vercel Cron-fanen i Dashboard: skal vise "Next run: ..." for `/api/cron/shift-reminders`

- [ ] **Step 5: Rydd test-data hvis ønskelig**

Hvis du opprettet test-arrangement med test-vakter for utvikling og ikke vil ha det i prod:

```sql
DELETE FROM events WHERE id = '<TEST_EVENT_ID>' AND type = 'arrangement';
```

CASCADE sletter også shifts og claims.

---

## Self-review

**Spec coverage check:**
- ✅ Datamodell — Task 1
- ✅ Detaljside UI — Task 11
- ✅ Hjem-kort — Task 12, 13
- ✅ ShiftClaimSheet — Task 9
- ✅ MyShiftsCard — Task 10
- ✅ Oppgaver + Generell info — Task 6, 7
- ✅ Admin form for arrangement — Task 15
- ✅ Vakt-oppretter — Task 16
- ✅ CSV-eksport — Task 17, 18
- ✅ Vercel Cron — Task 19, 20
- ✅ Manuell push-trigger — Task 21
- ✅ Realtime — Task 4 (hook brukt i Task 11)
- ✅ Påmeldingsregler — Task 5
- ✅ Versjonsbump — Task 22
- ✅ Lokal testing — Task 14 (A), Task 23 (B)

**Placeholder check:** Ingen TBD/TODO. Komponenter har komplett kode. SQL er komplett. Cron-endepunkt har komplett kode.

**Type consistency:** `ShiftWithClaims`, `RoleInfo`, `GeneralInfoEntry`, `ArrangementEvent` brukt konsistent gjennom. `EventShift` brukt for rå rows uten claims. Funksjonsnavn (`updateShift`, `removeShift`, `addShift`) konsistent på tvers av admin-tasks.

**Bevisste forenklinger:**
- Sletting av vakter i admin må gjøres via Supabase Dashboard (ikke i UI denne runden)
- CSV-import av vakter er ikke implementert (manuell legg-til via "+"-knapp)
- Bytt vakt-funksjon er ikke implementert

Disse er notert i designdokumentet som "out of scope" for første runde.
