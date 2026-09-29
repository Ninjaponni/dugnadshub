export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPush } from '@/lib/push/server'

// Lazy Supabase-init
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Maks én forespørsels-push per sone per 10 minutter, så be/avbryt/be ikke gir spam
const COOLDOWN_MS = 10 * 60 * 1000
// "Hjelpen er på vei" godtas bare rett etter at hjelperen kom inn
const JOINED_WINDOW_MS = 10 * 60 * 1000

// Push for "Be om en ekstra hånd" (bare flaskeinnsamling).
// Klienten sender bare assignmentId og kind. Sonenavn, hendelse og mottakere
// hentes her, og rettighetene sjekkes her.
//   kind 'request': til alle med sone-claim i samme hendelse, minus plukkerne på sonen
//   kind 'joined':  til plukkerne på sonen, når en hjelper har meldt seg
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { assignmentId?: string; kind?: string }
  const { assignmentId, kind } = body
  if (!assignmentId || (kind !== 'request' && kind !== 'joined')) {
    return NextResponse.json({ error: 'assignmentId og kind kreves' }, { status: 400 })
  }

  const { data: a } = await supabase
    .from('zone_assignments')
    .select('id, event_id, zone_id, help_requested_at, help_requested_by, help_notified_at, zones(name, zone_type)')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const zone = a.zones as unknown as { name: string; zone_type: string } | null
  if (zone?.zone_type !== 'bottle') {
    return NextResponse.json({ error: 'Bare flaskeinnsamling' }, { status: 400 })
  }

  const { data: zoneClaims } = await supabase
    .from('zone_claims')
    .select('user_id, via_help, claimed_at')
    .eq('assignment_id', a.id)
  const claimers = (zoneClaims || []) as Array<{ user_id: string; via_help: boolean; claimed_at: string }>
  const url = `/kart?event=${a.event_id}&sone=${a.zone_id}&hjelp=1`

  if (kind === 'request') {
    if (!a.help_requested_at) return NextResponse.json({ skipped: 'ingen åpen forespørsel' })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const allowed = profile?.role === 'admin'
      || a.help_requested_by === user.id
      || claimers.some(c => c.user_id === user.id)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Cooldown mot be/avbryt/be-spam: sett help_notified_at bare hvis den er tom eller
    // eldre enn 10 min. Unntak: "Be om én til" etter at forrige forespørsel ble fylt av
    // en hjelper. Da er det en ny forespørsel og varselet skal gå. Oppdateringen er
    // betinget i én spørring, så to samtidige kall gir maks én push.
    const lastNotified = a.help_notified_at as string | null
    const filledSinceLast = !!lastNotified && claimers.some(c => c.via_help && c.claimed_at > lastNotified)
    const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stampQuery: any = supabase
      .from('zone_assignments')
      .update({ help_notified_at: new Date().toISOString() })
      .eq('id', a.id)
    stampQuery = filledSinceLast
      ? stampQuery.eq('help_notified_at', lastNotified)
      : stampQuery.or(`help_notified_at.is.null,help_notified_at.lt."${cutoff}"`)
    const { data: stamped } = await stampQuery.select('id')
    if (!stamped || stamped.length === 0) return NextResponse.json({ skipped: 'cooldown' })

    // Mottakere: alle med sone-claim i samme hendelse, minus plukkerne på denne sonen.
    // Ikke eventId-filteret i sendPush: det tar med sjåfører og musikanter.
    const { data: eventClaims } = await supabase
      .from('zone_claims')
      .select('user_id, zone_assignments!inner(event_id)')
      .eq('zone_assignments.event_id', a.event_id)
    // Aldri til den som ba om hjelp (f.eks. admin med egen sone i samme innsamling)
    const onZone = new Set([...claimers.map(c => c.user_id), user.id])
    const userIds = [...new Set(((eventClaims || []) as Array<{ user_id: string }>).map(c => c.user_id))]
      .filter(id => !onZone.has(id))
    if (userIds.length === 0) return NextResponse.json({ sent: 0, failed: 0 })

    const result = await sendPush({
      title: `${zone.name} trenger en ekstra hånd`,
      body: 'Har du krefter til en runde til? Første som melder seg, blir med.',
      url,
    }, { userIds })
    return NextResponse.json(result)
  }

  // kind === 'joined': kalleren må nettopp ha kommet inn via hjelpeplassen, eller være
  // admin som har tildelt hjelpeplassen (da er hjelperen den nyeste via_help-claimen).
  const recent = (c: { via_help: boolean; claimed_at: string }) =>
    c.via_help && Date.now() - new Date(c.claimed_at).getTime() <= JOINED_WINDOW_MS
  let helper = claimers.find(c => c.user_id === user.id && recent(c))
  if (!helper) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role === 'admin') {
      helper = claimers.filter(recent).sort((x, y) => y.claimed_at.localeCompare(x.claimed_at))[0]
    }
  }
  if (!helper) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const helperId = helper.user_id

  const { data: helperProfile } = await supabase.from('profiles').select('full_name').eq('id', helperId).maybeSingle()
  const firstName = helperProfile?.full_name?.trim().split(/\s+/)[0] || 'En hjelper'
  const userIds = claimers.map(c => c.user_id).filter(id => id !== helperId && id !== user.id)
  if (userIds.length === 0) return NextResponse.json({ sent: 0, failed: 0 })

  const result = await sendPush({
    title: 'Hjelpen er på vei',
    body: `${firstName} kommer til ${zone.name}. Tusen takk!`,
    url,
  }, { userIds })
  return NextResponse.json(result)
}
