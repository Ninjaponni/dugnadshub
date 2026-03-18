import { createClient } from '@/lib/supabase/client'

// Evaluerer og tildeler badges basert på brukerens aktivitet
// Kalles etter at brukeren tar en sone, markerer ferdig, osv.
export async function evaluateBadges(userId: string) {
  const supabase = createClient()

  // Hent eksisterende badges
  const { data: existingBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId) as unknown as { data: Array<{ badge_id: number }> | null }

  const earned = new Set((existingBadges || []).map(b => b.badge_id))
  const toAward: number[] = []

  // Hent brukerens claims
  const { data: claims } = await supabase
    .from('zone_claims')
    .select('*, zone_assignments(zone_id, status, event_id)')
    .eq('user_id', userId) as unknown as {
      data: Array<{
        id: string
        assignment_id: string
        zone_assignments: { zone_id: string; status: string; event_id: string }
      }> | null
    }

  const userClaims = claims || []

  // Hent sone-info for claims
  const zoneIds = [...new Set(userClaims.map(c => c.zone_assignments?.zone_id).filter(Boolean))]
  const { data: zones } = await supabase
    .from('zones')
    .select('id, area')
    .in('id', zoneIds.length > 0 ? zoneIds : ['none']) as unknown as { data: Array<{ id: string; area: string }> | null }

  const zoneMap = new Map((zones || []).map(z => [z.id, z]))

  // Hent fullførte hendelser (bruker har claim i hendelse med status completed)
  const eventIds = [...new Set(userClaims.map(c => c.zone_assignments?.event_id).filter(Boolean))]
  const { data: events } = await supabase
    .from('events')
    .select('id, status')
    .in('id', eventIds.length > 0 ? eventIds : ['none']) as unknown as { data: Array<{ id: string; status: string }> | null }

  const completedEvents = (events || []).filter(e => e.status === 'completed')

  // --- Badge 16: Profil-proffen — fylte ut profilen ---
  if (!earned.has(16)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, child_name, child_group')
      .eq('id', userId)
      .single() as unknown as { data: { full_name: string | null; phone: string | null; child_name: string | null; child_group: string | null } | null }
    if (profile?.full_name && profile?.phone && profile?.child_name && profile?.child_group) {
      toAward.push(16)
    }
  }

  // --- Badge 2: Kartleser — tok en sone for første gang ---
  if (!earned.has(2) && userClaims.length > 0) {
    toAward.push(2)
  }

  // --- Badge 1: Spire — fullførte første dugnad ---
  if (!earned.has(1) && completedEvents.length > 0) {
    toAward.push(1)
  }

  // --- Badge 3: Lagspiller — fullførte sone med partner ---
  if (!earned.has(3)) {
    const assignmentIds = userClaims.map(c => c.assignment_id)
    if (assignmentIds.length > 0) {
      const { data: allPartnerClaims } = await supabase
        .from('zone_claims')
        .select('assignment_id, user_id')
        .in('assignment_id', assignmentIds)
        .neq('user_id', userId) as unknown as { data: Array<{ assignment_id: string; user_id: string }> | null }

      const partnerAssignments = new Set((allPartnerClaims || []).map(c => c.assignment_id))
      const hasPartnerCompletion = userClaims.some(c =>
        c.zone_assignments?.status === 'completed' && partnerAssignments.has(c.assignment_id)
      )
      if (hasPartnerCompletion) toAward.push(3)
    }
  }

  // --- Badge 4: Dugnadssoldat — 3 fullførte dugnader ---
  if (!earned.has(4) && completedEvents.length >= 3) {
    toAward.push(4)
  }

  // --- Badge 5: Nordmester — 5 soner i Nord ---
  if (!earned.has(5)) {
    const nordClaims = userClaims.filter(c => {
      const z = zoneMap.get(c.zone_assignments?.zone_id)
      return z?.area === 'NORD'
    })
    if (nordClaims.length >= 5) toAward.push(5)
  }

  // --- Badge 6: Sørmester — 5 soner i Sør ---
  if (!earned.has(6)) {
    const sorClaims = userClaims.filter(c => {
      const z = zoneMap.get(c.zone_assignments?.zone_id)
      return z?.area === 'SOR'
    })
    if (sorClaims.length >= 5) toAward.push(6)
  }

  // --- Badge 8: Veteran — 10 fullførte dugnader ---
  if (!earned.has(8) && completedEvents.length >= 10) {
    toAward.push(8)
  }

  // --- Badge 9: Alle soner — minst én i hvert område ---
  if (!earned.has(9)) {
    const areas = new Set(userClaims.map(c => zoneMap.get(c.zone_assignments?.zone_id)?.area).filter(Boolean))
    if (areas.has('NORD') && areas.has('SOR')) toAward.push(9)
  }

  // --- Badge 12: Ustoppelig — 20+ dugnader ---
  if (!earned.has(12) && completedEvents.length >= 20) {
    toAward.push(12)
  }

  // Tildel nye badges
  for (const badgeId of toAward) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('user_badges') as any).insert({
      user_id: userId,
      badge_id: badgeId,
    })
  }

  return toAward
}
