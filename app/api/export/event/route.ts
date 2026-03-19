export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// CSV-eksport av hendelse — matcher Google Sheets-formatet til Tillerbyen
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Norsk ukedagnavn
function norwegianWeekday(dateStr: string): string {
  const days = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
  return days[new Date(dateStr + 'T12:00:00').getDay()]
}

// Formater dato til dd.mm.yyyy
function formatDateNorwegian(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

// Formater klokkeslett (HH:MM:SS → HH.MM eller HH:MM → HH.MM)
function formatTime(time: string | null): string {
  if (!time) return '18.00'
  return time.slice(0, 5).replace(':', '.')
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

  // Hent full soneinfo inkl. husstander, henger-gruppe, kommentar
  const zoneIds = assignments.map(a => a.zone_id)
  const { data: zones } = await supabase
    .from('zones')
    .select('id, name, area, households, collectors_needed, trailer_group, notes')
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

  // Oppslag-maps
  const zoneMap = new Map((zones || []).map(z => [z.id, z]))
  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  // Grupper claims per assignment
  const claimsByAssignment = new Map<string, Array<{ user_id: string; notes: string | null }>>()
  for (const c of (claims || [])) {
    const list = claimsByAssignment.get(c.assignment_id) || []
    list.push(c)
    claimsByAssignment.set(c.assignment_id, list)
  }

  // Område-label for tittelen
  const areaLabels: Record<string, string> = { nord: 'Nord', sor: 'Sør', begge: 'Nord og Sør' }
  const areaLabel = areaLabels[event.area] || ''
  const startTime = formatTime(event.start_time)

  // Tittelrad — matcher Google Sheets-formatet
  const titleRow = `,FLASKEINNSAMLING ${areaLabel}: ${norwegianWeekday(event.date)} ${formatDateNorwegian(event.date)} Kl. ${startTime},,,,,,,,`

  // Header-rad
  const header = `Henger,Gate,Ant. husstander,Ant. samlere,Kommentar,Samlere,Telefon,Notat,Ut kl.: ${startTime},Ferdig,Flasker hentet`

  // Sorter assignments etter henger-gruppe, deretter gatenavn
  const sortedAssignments = [...assignments].sort((a, b) => {
    const zA = zoneMap.get(a.zone_id)
    const zB = zoneMap.get(b.zone_id)
    const groupA = zA?.trailer_group || 0
    const groupB = zB?.trailer_group || 0
    if (groupA !== groupB) return groupA - groupB
    return (zA?.name || '').localeCompare(zB?.name || '', 'nb')
  })

  // Bygg datarader
  let totalCollectors = 0
  const rows = sortedAssignments.map(a => {
    const zone = zoneMap.get(a.zone_id)
    const zoneClaims = claimsByAssignment.get(a.id) || []

    // Samlerinfo — alle navn og telefoner samlet med linjeskift
    const collectorNames = zoneClaims
      .map(c => profileMap.get(c.user_id)?.full_name || '')
      .filter(Boolean)
      .join('\n')
    const collectorPhones = zoneClaims
      .map(c => profileMap.get(c.user_id)?.phone || '')
      .filter(Boolean)
      .join('\n')
    const collectorNotes = zoneClaims
      .map(c => c.notes || '')
      .filter(Boolean)
      .join('\n')

    const collectorsNeeded = zone?.collectors_needed || 2
    totalCollectors += collectorsNeeded

    const ferdig = a.status === 'completed' || a.status === 'picked_up' ? 'Ja' : ''
    const hentet = a.status === 'picked_up' ? 'Ja' : ''

    return [
      zone?.trailer_group || '',
      csvEscape(zone?.name || a.zone_id),
      zone?.households || '',
      collectorsNeeded,
      csvEscape(zone?.notes || ''),
      csvEscape(collectorNames),
      csvEscape(collectorPhones),
      csvEscape(collectorNotes),
      '',
      ferdig,
      hentet,
    ].join(',')
  })

  // Totalrad — sum av samlere
  const totalRow = `,,,${totalCollectors},,,,,,,`

  // Bunnseksjon — sjåførinfo fra driver_notes
  const footerRows: string[] = ['', '']
  if (event.driver_notes) {
    // Splitt driver_notes på linjeskift — hver linje blir en rad
    const noteLines = (event.driver_notes as string).split('\n').filter((l: string) => l.trim())
    for (const line of noteLines) {
      footerRows.push(`,${csvEscape(line)},,,,,,,,`)
    }
  }

  // Sett sammen CSV
  const csvLines = [
    titleRow,
    '',
    header,
    ...rows,
    totalRow,
    ...footerRows,
  ]
  const csv = '\uFEFF' + csvLines.join('\n')

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
