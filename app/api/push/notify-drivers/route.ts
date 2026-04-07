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

  const { zoneName, zoneId, eventId } = await request.json()
  if (!zoneName) {
    return NextResponse.json({ error: 'zoneName required' }, { status: 400 })
  }

  const payload = {
    title: 'Sone klar for henting!',
    body: `${zoneName} er ferdigplukket og venter på henting.`,
    url: '/sjafor',
  }

  // Prøv å finne riktig sjåfør basert på sonens trailer_group
  if (zoneId && eventId) {
    // Hent sonens trailer_group og area
    const { data: zone } = await supabase
      .from('zones')
      .select('trailer_group, area')
      .eq('id', zoneId)
      .single()

    if (zone) {
      // Finn sjåfør for denne hengeren
      const { data: drivers } = await supabase
        .from('driver_assignments')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('area', zone.area)
        .eq('trailer_group', zone.trailer_group)
        .eq('role', 'driver')

      if (drivers && drivers.length > 0) {
        // Send til sjåfør(ene) for denne hengeren + admins
        const driverIds = drivers.map((d: { user_id: string }) => d.user_id)

        // Hent admin-brukere
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')

        const adminIds = (admins || []).map((a: { id: string }) => a.id)
        const allIds = [...new Set([...driverIds, ...adminIds])]

        const result = await sendPush(payload, { userIds: allIds })
        return NextResponse.json(result)
      }
    }
  }

  // Fallback: send til alle sjåfører (fra driver_assignments) + admins
  if (eventId) {
    const { data: allDrivers } = await supabase
      .from('driver_assignments')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('role', 'driver')

    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

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
