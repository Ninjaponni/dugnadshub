export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEventParticipants } from '@/lib/events/participants'

// Liste deltakere på et arrangement — for push-forhåndsvisning og bulk-tildeling
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: eventId } = await params
  const userIds = await getEventParticipants(eventId)

  if (userIds.length === 0) {
    return NextResponse.json({ count: 0, users: [] })
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)
    .order('full_name', { ascending: true })

  return NextResponse.json({ count: userIds.length, users: profiles ?? [] })
}
