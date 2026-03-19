export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// CSV-eksport av hendelse — kun admin
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Sjekk admin-rolle
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const eventId = request.nextUrl.searchParams.get('id')
  if (!eventId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Hent hendelse
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single()
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  // Hent assignments med soner
  const { data: assignments } = await supabase
    .from('zone_assignments')
    .select('id, zone_id, status')
    .eq('event_id', eventId)

  if (!assignments) return NextResponse.json({ error: 'No data' }, { status: 500 })

  // Hent soneinfo
  const zoneIds = assignments.map(a => a.zone_id)
  const { data: zones } = await supabase
    .from('zones')
    .select('id, name, area')
    .in('id', zoneIds)

  // Hent claims med brukerinfo
  const assignmentIds = assignments.map(a => a.id)
  const { data: claims } = await supabase
    .from('zone_claims')
    .select('assignment_id, user_id, notes')
    .in('assignment_id', assignmentIds)

  // Hent profiler for alle claims
  const userIds = [...new Set((claims || []).map(c => c.user_id))]
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, phone').in('id', userIds)
    : { data: [] }

  // Bygg CSV-rader
  const zoneMap = new Map((zones || []).map(z => [z.id, z]))
  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  const areaLabels: Record<string, string> = { NORD: 'Nord', SOR: 'Sør' }

  // Grupper claims per assignment
  const claimsByAssignment = new Map<string, Array<{ user_id: string; notes: string | null }>>()
  for (const c of (claims || [])) {
    const list = claimsByAssignment.get(c.assignment_id) || []
    list.push(c)
    claimsByAssignment.set(c.assignment_id, list)
  }

  const statusLabels: Record<string, string> = {
    available: 'Ledig',
    claimed: 'Tatt',
    in_progress: 'Pågår',
    completed: 'Fullført',
    picked_up: 'Hentet',
  }

  const header = 'Sone,Område,Status,Samler 1,Telefon 1,Notat 1,Samler 2,Telefon 2,Notat 2,Ferdig'
  const rows = assignments.map(a => {
    const zone = zoneMap.get(a.zone_id)
    const zoneClaims = claimsByAssignment.get(a.id) || []
    const p1 = zoneClaims[0] ? profileMap.get(zoneClaims[0].user_id) : null
    const p2 = zoneClaims[1] ? profileMap.get(zoneClaims[1].user_id) : null
    const ferdig = a.status === 'completed' || a.status === 'picked_up' ? 'Ja' : 'Nei'

    return [
      csvEscape(zone?.name || a.zone_id),
      csvEscape(areaLabels[zone?.area || ''] || zone?.area || ''),
      csvEscape(statusLabels[a.status] || a.status),
      csvEscape(p1?.full_name || ''),
      csvEscape(p1?.phone || ''),
      csvEscape(zoneClaims[0]?.notes || ''),
      csvEscape(p2?.full_name || ''),
      csvEscape(p2?.phone || ''),
      csvEscape(zoneClaims[1]?.notes || ''),
      ferdig,
    ].join(',')
  })

  const csv = '\uFEFF' + [header, ...rows].join('\n')

  // Filnavn: tittel-dato.csv
  const safeTitle = event.title.replace(/[^a-zA-ZæøåÆØÅ0-9 ]/g, '').replace(/\s+/g, '-')
  const filename = `${safeTitle}-${event.date}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// Escape CSV-felt — wrap i anførselstegn hvis det inneholder komma/anførselstegn/linjeskift
function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}
