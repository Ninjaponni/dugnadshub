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
// - sjåfører og stripsere (driver_assignments — alle roller)
// - musikanter som har lastet ned appen (event_musicians.profile_id IS NOT NULL)
// - eventuelle ekstra IDer (verter osv) sendt inn av admin
export async function getEventParticipants(
  eventId: string,
  extraUserIds: string[] = []
): Promise<string[]> {
  const supabase = getSupabase()
  const userIds = new Set<string>(extraUserIds)

  // 1. Sone-claims via zone_assignments
  const { data: assignments } = await supabase
    .from('zone_assignments')
    .select('id')
    .eq('event_id', eventId)

  const assignmentIds = (assignments ?? []).map((a: { id: string }) => a.id)

  if (assignmentIds.length > 0) {
    const { data: claims } = await supabase
      .from('zone_claims')
      .select('user_id')
      .in('assignment_id', assignmentIds)

    for (const c of claims ?? []) {
      if (c.user_id) userIds.add(c.user_id)
    }
  }

  // 2. Sjåfører og stripsere
  const { data: drivers } = await supabase
    .from('driver_assignments')
    .select('user_id')
    .eq('event_id', eventId)

  for (const d of drivers ?? []) {
    if (d.user_id) userIds.add(d.user_id)
  }

  // 3. Musikanter med egen app-bruker (is_musician=true).
  // OBS: event_musicians.profile_id kan også peke på FORELDERENS profil når
  // matchen skjer via children[].name. Vi henter alle profile_ids og filtrerer
  // mot profiles.is_musician etterpå for å bare få musikantene selv.
  const { data: musicians } = await supabase
    .from('event_musicians')
    .select('profile_id')
    .eq('event_id', eventId)
    .not('profile_id', 'is', null)

  const candidateIds = Array.from(
    new Set((musicians ?? []).map((m: { profile_id: string }) => m.profile_id).filter(Boolean))
  )

  if (candidateIds.length > 0) {
    const { data: musicianProfiles } = await supabase
      .from('profiles')
      .select('id')
      .in('id', candidateIds)
      .eq('is_musician', true)

    for (const p of musicianProfiles ?? []) {
      userIds.add(p.id)
    }
  }

  return Array.from(userIds)
}
