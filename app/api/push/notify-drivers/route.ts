export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push/server'

// Lazy Supabase-init
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Auto-push til sjåfører når en sone er ferdigplukket
// Filtrerer på riktig henger basert på sonens trailer_group
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Nye klienter sender assignmentId. Gamle cachede klienter sender zoneId + eventId.
  // zoneName fra klienten brukes ikke lenger: navnet hentes fra databasen.
  const body = await request.json().catch(() => ({})) as { assignmentId?: string; zoneId?: string; eventId?: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('zone_assignments')
    .select('id, event_id, zone_id, status, zones(name, area, trailer_group)')
  if (body.assignmentId) query = query.eq('id', body.assignmentId)
  else if (body.zoneId && body.eventId) query = query.eq('event_id', body.eventId).eq('zone_id', body.zoneId)
  else return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })

  const { data: assignment } = await query.maybeSingle()
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Kalleren må ha claim på akkurat denne sonen, eller være admin
  const [{ data: claim }, { data: profile }] = await Promise.all([
    supabase.from('zone_claims').select('id').eq('assignment_id', assignment.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ])
  if (!claim && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Bare soner som faktisk venter på henting. "Tatt med selv" er picked_up
  // og gir aldri sjåførpush, heller ikke fra en gammel klient.
  if (assignment.status !== 'completed') {
    return NextResponse.json({ skipped: 'not completed' })
  }

  const zone = assignment.zones as { name: string; area: string; trailer_group: number | null } | null
  const zoneName = zone?.name || assignment.zone_id
  const eventId: string = assignment.event_id
  const zoneArea: string | null = zone?.area ?? null
  const zoneTrailerGroup: number | null = zone?.trailer_group ?? null

  const payload = {
    title: 'Sone klar for henting!',
    body: `${zoneName} er ferdigplukket og venter på henting.`,
    url: '/sjafor',
  }

  // Tier 1: Finn sjåfør for spesifikk henger
  if (eventId && zoneArea && zoneTrailerGroup !== null) {
    const { data: drivers } = await supabase
      .from('driver_assignments')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('area', zoneArea)
      .eq('trailer_group', zoneTrailerGroup)
      .eq('role', 'driver')

    if (drivers && drivers.length > 0) {
      const driverIds = drivers.map((d: { user_id: string }) => d.user_id)
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
      const adminIds = (admins || []).map((a: { id: string }) => a.id)
      const allIds = [...new Set([...driverIds, ...adminIds])]

      const result = await sendPush(payload, { userIds: allIds })
      return NextResponse.json(result)
    }
  }

  // Tier 2: Alle sjåfører for samme område (ikke alle områder)
  if (eventId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let driverQuery: any = supabase
      .from('driver_assignments')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('role', 'driver')
    if (zoneArea) driverQuery = driverQuery.eq('area', zoneArea)

    const { data: allDrivers } = await driverQuery
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')

    const driverIds = (allDrivers || []).map((d: { user_id: string }) => d.user_id)
    const adminIds = (admins || []).map((a: { id: string }) => a.id)
    const allIds = [...new Set([...driverIds, ...adminIds])]

    if (allIds.length > 0) {
      const result = await sendPush(payload, { userIds: allIds })
      return NextResponse.json(result)
    }
  }

  // Siste fallback: alle med driver/admin-rolle i profil
  const result = await sendPush(payload, { roles: ['driver', 'admin'] })
  return NextResponse.json(result)
}
