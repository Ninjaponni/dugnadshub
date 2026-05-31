import { createClient } from '@supabase/supabase-js'

// Lazy server-klient med service-rolle — env vars ikke tilgjengelige ved build
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Returnerer alle user_ids som regnes som «deltakere» på et arrangement:
// - foreldre med sone-claim
// - sjåfører, stripsere og verter (driver_assignments — alle roller inkludert host)
// - vakttakere på arrangement (shift_claims via event_shifts)
// - musikanter som har lastet ned appen (event_musicians.profile_id + is_musician=true)
// - eventuelle ekstra IDer sendt inn manuelt
export async function getEventParticipants(
  eventId: string,
  extraUserIds: string[] = []
): Promise<string[]> {
  const supabase = getSupabase()
  const userIds = new Set<string>(extraUserIds)

  // 1. Sone-claims via zone_assignments
  const { data: assignments, error: assignErr } = await supabase
    .from('zone_assignments')
    .select('id')
    .eq('event_id', eventId)
  if (assignErr) console.error('getEventParticipants zone_assignments error:', assignErr)

  const assignmentIds = (assignments ?? []).map((a: { id: string }) => a.id)

  if (assignmentIds.length > 0) {
    const { data: claims, error: claimErr } = await supabase
      .from('zone_claims')
      .select('user_id')
      .in('assignment_id', assignmentIds)
    if (claimErr) console.error('getEventParticipants zone_claims error:', claimErr)

    for (const c of claims ?? []) {
      if (c.user_id) userIds.add(c.user_id)
    }
  }

  // 2. Sjåfører, stripsere og verter (alle driver_assignments-roller)
  const { data: drivers, error: driverErr } = await supabase
    .from('driver_assignments')
    .select('user_id')
    .eq('event_id', eventId)
  if (driverErr) console.error('getEventParticipants driver_assignments error:', driverErr)

  for (const d of drivers ?? []) {
    if (d.user_id) userIds.add(d.user_id)
  }

  // 3. Vakttakere på arrangement (shift_claims via event_shifts)
  const { data: shifts, error: shiftErr } = await supabase
    .from('event_shifts')
    .select('id')
    .eq('event_id', eventId)
  if (shiftErr) console.error('getEventParticipants event_shifts error:', shiftErr)

  const shiftIds = (shifts ?? []).map((s: { id: string }) => s.id)
  if (shiftIds.length > 0) {
    const { data: shiftClaims, error: shiftClaimErr } = await supabase
      .from('shift_claims')
      .select('user_id')
      .in('shift_id', shiftIds)
    if (shiftClaimErr) console.error('getEventParticipants shift_claims error:', shiftClaimErr)

    for (const c of shiftClaims ?? []) {
      if (c.user_id) userIds.add(c.user_id)
    }
  }

  // 4. Musikanter med egen app-bruker (is_musician=true).
  // OBS: event_musicians.profile_id kan også peke på FORELDERENS profil når
  // matchen skjer via children[].name. Vi henter alle profile_ids og filtrerer
  // mot profiles.is_musician etterpå for å bare få musikantene selv.
  const { data: musicians, error: musicianErr } = await supabase
    .from('event_musicians')
    .select('profile_id')
    .eq('event_id', eventId)
    .not('profile_id', 'is', null)
  if (musicianErr) console.error('getEventParticipants event_musicians error:', musicianErr)

  const candidateIds = Array.from(
    new Set((musicians ?? []).map((m: { profile_id: string }) => m.profile_id).filter(Boolean))
  )

  if (candidateIds.length > 0) {
    const { data: musicianProfiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .in('id', candidateIds)
      .eq('is_musician', true)
    if (profileErr) console.error('getEventParticipants profiles error:', profileErr)

    for (const p of musicianProfiles ?? []) {
      userIds.add(p.id)
    }
  }

  return Array.from(userIds)
}
