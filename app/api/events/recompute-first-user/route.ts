export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Beregner Førstemann-merket (badge_id 28) på nytt for en hendelse.
// Førstemann er den som har den tidligste zone_claim for hendelsen.
// Kalles etter claim/unclaim — hvis førstemann gir opp, mister de
// merket og det går til neste i køen.
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

  const body = await request.json().catch(() => null) as { eventId?: string } | null
  const eventId = body?.eventId
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }

  // Hent alle claims for hendelsen, sortert etter claimed_at (eldste først)
  const { data: claims } = await supabase
    .from('zone_claims')
    .select('user_id, claimed_at, zone_assignments!inner(event_id)')
    .eq('zone_assignments.event_id', eventId)
    .order('claimed_at', { ascending: true })

  const rows = (claims || []) as Array<{ user_id: string; claimed_at: string }>
  const firstUserId = rows[0]?.user_id || null

  // Slett alle eksisterende Førstemann-merker for hendelsen
  await supabase
    .from('user_badges')
    .delete()
    .eq('badge_id', 28)
    .eq('event_id', eventId)

  // Tildel til ny førstemann (hvis det finnes en)
  if (firstUserId) {
    await supabase
      .from('user_badges')
      .insert({ user_id: firstUserId, badge_id: 28, event_id: eventId })
  }

  return NextResponse.json({ firstUserId })
}
