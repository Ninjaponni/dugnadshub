import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { badgeDefinitions } from '@/lib/badges/definitions'

export async function POST(request: NextRequest) {
  // Verifiser at kallet er autentisert
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]

  // Admin-klient med service role key — kan skrive til user_badges
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verifiser token og hent bruker
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Kjør badge-evaluering med admin-tilgang
  try {
    const awarded = await evaluateBadgesServer(supabaseAdmin, user.id)
    return NextResponse.json({ awarded })
  } catch {
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 })
  }
}

// Aktivitet-, 17mai- og sommerkonsert-merker indikerer event-deltakelse når event_id er satt.
// Utledes fra definisjonene så nye merker telles automatisk — den gamle
// håndskrevne id-lista hadde allerede driftet (manglet 68/69/70).
const PARTICIPATION_BADGE_IDS = new Set(
  badgeDefinitions
    .filter(b => b.category === 'aktivitet' || b.category === '17mai' || b.category === 'sommerkonsert')
    .map(b => b.id)
)

// Server-side badge-evaluering med admin-klient (bypass RLS)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function evaluateBadgesServer(supabase: any, userId: string) {
  // Hent eksisterende badges
  const { data: existingBadges } = await supabase
    .from('user_badges')
    .select('badge_id, event_id')
    .eq('user_id', userId)

  const earned = new Set((existingBadges || []).map((b: { badge_id: number }) => b.badge_id))
  const toAward: number[] = []

  // Hent brukerens claims med assignments
  const { data: claims } = await supabase
    .from('zone_claims')
    .select('*, zone_assignments(zone_id, status, event_id)')
    .eq('user_id', userId)

  const userClaims = (claims || []) as Array<{
    id: string
    assignment_id: string
    zone_assignments: { zone_id: string; status: string; event_id: string }
  }>

  // Hent sone-info
  const zoneIds = [...new Set(userClaims.map(c => c.zone_assignments?.zone_id).filter(Boolean))]
  const { data: zones } = await supabase
    .from('zones')
    .select('id, area')
    .in('id', zoneIds.length > 0 ? zoneIds : ['none'])

  const zoneMap = new Map<string, { id: string; area: string }>((zones || []).map((z: { id: string; area: string }) => [z.id, z]))

  // Hent ALLE fullførte event-ids brukeren har deltatt på, fra union av deltakelse-kilder.
  // Slik teller 17. mai, plast, arrangement-vakter og sjåfør-/stripse-/vert-roller likt
  // med flaskeinnsamling og lapper. Set-semantikk hindrer dobbelt-telling.
  const participatedEventIds = new Set<string>()

  // 1. Zone claims (flaske/lapper/plast-soner)
  for (const c of userClaims) {
    const eid = c.zone_assignments?.event_id
    if (eid) participatedEventIds.add(eid)
  }

  // 2. Shift claims (arrangement-vakter)
  const { data: shiftClaims } = await supabase
    .from('shift_claims')
    .select('event_shifts!inner(event_id)')
    .eq('user_id', userId)
  for (const r of (shiftClaims || []) as Array<{ event_shifts: { event_id: string } }>) {
    const eid = r.event_shifts?.event_id
    if (eid) participatedEventIds.add(eid)
  }

  // 3. Driver/stripser/vert-roller
  const { data: driverAssigns } = await supabase
    .from('driver_assignments')
    .select('event_id')
    .eq('user_id', userId)
  for (const r of (driverAssigns || []) as Array<{ event_id: string }>) {
    if (r.event_id) participatedEventIds.add(r.event_id)
  }

  // 4. Musikanter på plast (profile_id peker på forelderen, men det er riktig
  // siden det er forelderen som "deltar" via barnet)
  const { data: musicianRecords } = await supabase
    .from('event_musicians')
    .select('event_id')
    .eq('profile_id', userId)
  for (const r of (musicianRecords || []) as Array<{ event_id: string }>) {
    if (r.event_id) participatedEventIds.add(r.event_id)
  }

  // 5. Eksisterende aktivitet- og 17mai-merker med event_id
  for (const b of (existingBadges || []) as Array<{ badge_id: number; event_id: string | null }>) {
    if (b.event_id && PARTICIPATION_BADGE_IDS.has(b.badge_id)) {
      participatedEventIds.add(b.event_id)
    }
  }

  // Filtrer til kun fullførte events
  const allEventIds = Array.from(participatedEventIds)
  const { data: events } = await supabase
    .from('events')
    .select('id, status')
    .in('id', allEventIds.length > 0 ? allEventIds : ['none'])

  const completedEvents = (events || []).filter((e: { status: string }) => e.status === 'completed')

  // Badge 16: Profil-proffen — fylte ut profilen
  // Forelder: navn + minst ett barn
  // Musikant: navn + gruppe
  // Telefon er valgfritt for begge (matcher UI-en)
  if (!earned.has(16)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, children, is_musician, musician_group')
      .eq('id', userId)
      .single()
    const p = profile as { full_name: string | null; children: Array<{ name: string }> | null; is_musician: boolean | null; musician_group: string | null } | null
    if (p?.full_name) {
      if (p.is_musician && p.musician_group) {
        toAward.push(16)
      } else if (!p.is_musician && p.children?.some(c => c.name?.trim())) {
        toAward.push(16)
      }
    }
  }

  // Badge 2: Kartleser — tok en sone for første gang
  if (!earned.has(2) && userClaims.length > 0) toAward.push(2)

  // Badge 1: Spire — fullførte første dugnad
  if (!earned.has(1) && completedEvents.length > 0) toAward.push(1)

  // Badge 3: Lagspiller — fullførte sone med partner
  // Godta både 'completed' (sone ferdigplukket) og 'picked_up' (sjåfør har hentet)
  if (!earned.has(3)) {
    const assignmentIds = userClaims.map(c => c.assignment_id)
    if (assignmentIds.length > 0) {
      const { data: partnerClaims } = await supabase
        .from('zone_claims')
        .select('assignment_id, user_id')
        .in('assignment_id', assignmentIds)
        .neq('user_id', userId)
      const partnerAssignments = new Set((partnerClaims || []).map((c: { assignment_id: string }) => c.assignment_id))
      const finishedStatuses = new Set(['completed', 'picked_up'])
      if (userClaims.some(c => finishedStatuses.has(c.zone_assignments?.status) && partnerAssignments.has(c.assignment_id))) {
        toAward.push(3)
      }
    }
  }

  // Badge 4: Dugnadssoldat — 3 fullførte dugnader
  if (!earned.has(4) && completedEvents.length >= 3) toAward.push(4)

  // Badge 5: Nordmester — 5 soner i Nord
  if (!earned.has(5)) {
    const nordCount = userClaims.filter(c => zoneMap.get(c.zone_assignments?.zone_id)?.area === 'NORD').length
    if (nordCount >= 5) toAward.push(5)
  }

  // Badge 6: Sørmester — 5 soner i Sør
  if (!earned.has(6)) {
    const sorCount = userClaims.filter(c => zoneMap.get(c.zone_assignments?.zone_id)?.area === 'SOR').length
    if (sorCount >= 5) toAward.push(6)
  }

  // Badge 8: Veteran — 10 fullførte dugnader
  if (!earned.has(8) && completedEvents.length >= 10) toAward.push(8)

  // Badge 9: Alle soner — minst én i hvert område
  if (!earned.has(9)) {
    const areas = new Set(userClaims.map(c => zoneMap.get(c.zone_assignments?.zone_id)?.area).filter(Boolean))
    if (areas.has('NORD') && areas.has('SOR')) toAward.push(9)
  }

  // Badge 12: Ustoppelig — 20+ dugnader
  if (!earned.has(12) && completedEvents.length >= 20) toAward.push(12)

  // Tildel badges. Vi sjekker allerede mot `earned` over, så duplikater
  // er unngått. Plain insert — upsert med onConflict feiler her fordi
  // user_badges har ingen unique constraint på (user_id, badge_id);
  // partial index på (user_id, badge_id, event_id) WHERE event_id IS NOT NULL
  // dekker bare event-koblede merker.
  if (toAward.length > 0) {
    const rows = toAward.map(badgeId => ({ user_id: userId, badge_id: badgeId, event_id: null }))
    const { error: insertError } = await supabase.from('user_badges').insert(rows)
    if (insertError) {
      throw new Error(`Kunne ikke tildele badges: ${insertError.message}`)
    }
  }

  return toAward
}
