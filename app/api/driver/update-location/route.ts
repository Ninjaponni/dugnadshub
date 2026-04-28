export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Sjåfør sender posisjon hvert ~10. sek mens "Del posisjon" er på.
// Validerer at brukeren faktisk er sjåfør på en aktiv hendelse innenfor tidsvinduet.
// Returnerer 410 Gone hvis utenfor vindu — klienten skal da stoppe deling.

interface Body {
  event_id: string
  latitude: number
  longitude: number
  accuracy?: number
}

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

  const body = await request.json().catch(() => null) as Body | null
  if (!body || typeof body.event_id !== 'string' || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
    return NextResponse.json({ error: 'Ugyldig body' }, { status: 400 })
  }

  // Sjekk at hendelsen er aktiv og at vi er innenfor tidsvinduet
  const { data: event } = await supabase
    .from('events')
    .select('id, status, date, start_time, end_time')
    .eq('id', body.event_id)
    .maybeSingle()

  if (!event) {
    return NextResponse.json({ error: 'Hendelse ikke funnet' }, { status: 404 })
  }

  if ((event as { status: string }).status !== 'active') {
    return NextResponse.json({ error: 'Hendelse er ikke aktiv' }, { status: 410 })
  }

  // Hard tidsgrense: 30 min etter end_time stopper vi delingen
  const ev = event as { date: string; start_time: string | null; end_time: string | null }
  if (ev.end_time && ev.date) {
    const endsAt = new Date(`${ev.date}T${ev.end_time}:00`)
    endsAt.setMinutes(endsAt.getMinutes() + 30)
    if (Date.now() > endsAt.getTime()) {
      return NextResponse.json({ error: 'Utenfor tidsvindu' }, { status: 410 })
    }
  }

  // Finn brukerens driver_assignment for denne hendelsen (kun sjåfører)
  const { data: assignment } = await supabase
    .from('driver_assignments')
    .select('id')
    .eq('event_id', body.event_id)
    .eq('user_id', user.id)
    .eq('role', 'driver')
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json({ error: 'Du er ikke sjåfør på denne hendelsen' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('driver_assignments')
    .update({
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy ?? null,
      location_updated_at: new Date().toISOString(),
      location_sharing: true,
    })
    .eq('id', (assignment as { id: string }).id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Sjåfør slår av deling — nullstiller posisjon
export async function DELETE(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('event_id')
  if (!eventId) {
    return NextResponse.json({ error: 'Mangler event_id' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('driver_assignments')
    .update({
      latitude: null,
      longitude: null,
      accuracy: null,
      location_updated_at: null,
      location_sharing: false,
    })
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('role', 'driver')

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
