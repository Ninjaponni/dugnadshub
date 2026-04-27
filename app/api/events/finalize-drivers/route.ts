export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncRoleForUser } from '@/app/api/driver/sync-role/route'

// Kalles når admin markerer en hendelse som fullført. Tildeler Sjåfør (id 14)
// og Stripser (id 15) til alle med driver_assignments på hendelsen, og
// synker profiles.role for hver berørt bruker basert på deres øvrige
// aktive driver_assignments.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if ((profile as { role: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { eventId?: string } | null
  const eventId = body?.eventId
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }

  // Hent alle driver_assignments for hendelsen
  const { data: assignments } = await supabase
    .from('driver_assignments')
    .select('user_id, role')
    .eq('event_id', eventId)

  const rows = (assignments || []) as Array<{ user_id: string; role: string }>

  // Tildel merker — unique partial index hindrer duplikater per (user, badge, event)
  const badgeRows = rows.map(a => ({
    user_id: a.user_id,
    badge_id: a.role === 'driver' ? 14 : 15,
    event_id: eventId,
  }))

  let awarded = 0
  if (badgeRows.length > 0) {
    const { error: insertError, count } = await supabase
      .from('user_badges')
      .upsert(badgeRows, { onConflict: 'user_id,badge_id,event_id', ignoreDuplicates: true, count: 'exact' })
    if (!insertError && count !== null) awarded = count
  }

  // Synk role for hver unike bruker
  const userIds = [...new Set(rows.map(r => r.user_id))]
  for (const uid of userIds) {
    await syncRoleForUser(supabase, uid)
  }

  return NextResponse.json({ awarded, syncedUsers: userIds.length })
}
