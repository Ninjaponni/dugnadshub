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

  // Valider UUID-format — fanger typos før vi sender uvalidert input til Postgres
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 })
  }

  // Verifiser at eventet finnes — ellers vil tom liste se ut som "0 deltakere"
  const { data: event } = await supabase.from('events').select('id').eq('id', eventId).single()
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

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
