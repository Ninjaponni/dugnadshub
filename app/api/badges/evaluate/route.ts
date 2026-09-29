import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

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

// Server-side badge-evaluering med admin-klient (bypass RLS).
// Terskelmerkene Frøspire (1), Tre på rad (4), Ringrev (8) og Maskin (12) eies av
// databasen: award_participation_badges() teller deltakelse fra alle kilder
// (scripts/migrate-deltakelsesmerker-i-db.sql). Her evalueres bare merkene som
// avhenger av soner og profil: 2, 3, 5, 6, 9 og 16.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function evaluateBadgesServer(supabase: any, userId: string) {
  // Hent eksisterende badges
  const { data: existingBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
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

  // Badge 3: Lagspiller — fullførte sone med partner
  // Godta både 'completed' (sone ferdigplukket) og 'picked_up' (hentet eller tatt med selv)
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

  // Badge 9: Alle soner — minst én i hvert område
  if (!earned.has(9)) {
    const areas = new Set(userClaims.map(c => zoneMap.get(c.zone_assignments?.zone_id)?.area).filter(Boolean))
    if (areas.has('NORD') && areas.has('SOR')) toAward.push(9)
  }

  // Engangsmerker har unik indeks (user_badges_once_uniq). Sett inn én og én og
  // ignorer 23505 (parallell evaluering kom først): supabase-js kan ikke peke på
  // en partial index i upsert.
  const awarded: number[] = []
  for (const badgeId of toAward) {
    const { error } = await supabase.from('user_badges').insert({ user_id: userId, badge_id: badgeId, event_id: null })
    if (error && error.code !== '23505') throw new Error(`Kunne ikke tildele merke ${badgeId}: ${error.message}`)
    if (!error) awarded.push(badgeId)
  }

  // Terskelmerkene (1, 4, 8, 12): én kilde til sannhet i databasen.
  const { data: thresholdRows, error: rpcError } = await supabase.rpc('award_participation_badges', { p_user_ids: [userId] })
  if (rpcError) throw new Error(`Kunne ikke tildele deltakelsesmerker: ${rpcError.message}`)
  for (const row of (thresholdRows || []) as Array<{ badge_id: number }>) awarded.push(row.badge_id)

  return awarded
}
