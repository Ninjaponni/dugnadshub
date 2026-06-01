// Audit-skript: finn brukere som har deltatt på dugnader (inkl. 17. mai, plast,
// arrangement-vakter, sjåfør- og stripse-roller) men ikke har fått "X dugnader"-merker.
// Kjør med: npx tsx scripts/audit-badges.ts
// Kjør med tildeling: npx tsx scripts/audit-badges.ts --apply

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Last .env.local manuelt for å unngå dotenv-avhengighet
try {
  const env = readFileSync('.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const APPLY = process.argv.includes('--apply')

// Tellende dugnads-merker — basert på "antall fullførte dugnader"
const COUNT_BADGES: Array<{ id: number; name: string; min: number }> = [
  { id: 1, name: 'Frøspire', min: 1 },
  { id: 4, name: 'Tre på rad', min: 3 },
  { id: 8, name: 'Ringrev', min: 10 },
  { id: 12, name: 'Maskin', min: 20 },
]

// Merker hvis tilstedeværelse indikerer deltakelse på event_id (når badge har event_id satt)
// aktivitet (17-28, 43, 44, 66, 67) + 17mai (29-42, 63, 64, 65)
const PARTICIPATION_BADGE_IDS = new Set([
  17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 43, 44, 66, 67,
  29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 63, 64, 65,
])

interface Profile { id: string; full_name: string | null }
interface UserBadge { user_id: string; badge_id: number; event_id: string | null }

async function main() {
  console.log(APPLY ? '— MODUS: TILDELER MERKER —' : '— MODUS: DRY-RUN (bruk --apply for å tildele) —')
  console.log()

  const { data: profiles } = await supabase.from('profiles').select('id, full_name')
  const { data: completedEvents } = await supabase
    .from('events')
    .select('id, title, type, date')
    .eq('status', 'completed')

  const completedEventIds = new Set((completedEvents ?? []).map(e => e.id))
  console.log(`Fullførte events: ${completedEventIds.size}`)
  console.log(`Brukere å sjekke: ${profiles?.length ?? 0}`)
  console.log()

  const { data: allBadges } = await supabase
    .from('user_badges')
    .select('user_id, badge_id, event_id')
  const badgesByUser = new Map<string, UserBadge[]>()
  for (const b of (allBadges ?? []) as UserBadge[]) {
    if (!badgesByUser.has(b.user_id)) badgesByUser.set(b.user_id, [])
    badgesByUser.get(b.user_id)!.push(b)
  }

  // Forhåndshent alle deltakelse-tabeller én gang
  const { data: zoneClaimsAll } = await supabase
    .from('zone_claims')
    .select('user_id, zone_assignments!inner(event_id)')
  const { data: shiftClaimsAll } = await supabase
    .from('shift_claims')
    .select('user_id, event_shifts!inner(event_id)')
  const { data: driverAssignsAll } = await supabase
    .from('driver_assignments')
    .select('user_id, event_id')
  const { data: musiciansAll } = await supabase
    .from('event_musicians')
    .select('profile_id, event_id')
    .not('profile_id', 'is', null)

  const totalsByUser = new Map<string, Set<string>>()
  const ensure = (uid: string) => {
    if (!totalsByUser.has(uid)) totalsByUser.set(uid, new Set())
    return totalsByUser.get(uid)!
  }

  for (const r of (zoneClaimsAll ?? []) as unknown as Array<{ user_id: string; zone_assignments: { event_id: string } }>) {
    const eid = r.zone_assignments?.event_id
    if (eid && completedEventIds.has(eid)) ensure(r.user_id).add(eid)
  }
  for (const r of (shiftClaimsAll ?? []) as unknown as Array<{ user_id: string; event_shifts: { event_id: string } }>) {
    const eid = r.event_shifts?.event_id
    if (eid && completedEventIds.has(eid)) ensure(r.user_id).add(eid)
  }
  for (const r of (driverAssignsAll ?? []) as Array<{ user_id: string; event_id: string }>) {
    if (r.event_id && completedEventIds.has(r.event_id)) ensure(r.user_id).add(r.event_id)
  }
  for (const r of (musiciansAll ?? []) as Array<{ profile_id: string; event_id: string }>) {
    if (r.event_id && completedEventIds.has(r.event_id)) ensure(r.profile_id).add(r.event_id)
  }
  // Aktivitet- og 17mai-merker indikerer event-deltakelse
  for (const b of (allBadges ?? []) as UserBadge[]) {
    if (b.event_id && PARTICIPATION_BADGE_IDS.has(b.badge_id) && completedEventIds.has(b.event_id)) {
      ensure(b.user_id).add(b.event_id)
    }
  }

  // Rapport
  const toAward: Array<{ user_id: string; badge_id: number }> = []
  let totalEligibleUsers = 0

  for (const profile of (profiles ?? []) as Profile[]) {
    const events = totalsByUser.get(profile.id)
    if (!events || events.size === 0) continue

    totalEligibleUsers++
    const userBadges = new Set((badgesByUser.get(profile.id) ?? []).map(b => b.badge_id))
    const missing: Array<{ id: number; name: string }> = []

    for (const cb of COUNT_BADGES) {
      if (events.size >= cb.min && !userBadges.has(cb.id)) {
        missing.push({ id: cb.id, name: cb.name })
        toAward.push({ user_id: profile.id, badge_id: cb.id })
      }
    }

    if (missing.length > 0) {
      const name = profile.full_name ?? profile.id
      console.log(`${name}: ${events.size} dugnader → mangler ${missing.map(m => `${m.name} (#${m.id})`).join(', ')}`)
    }
  }

  console.log()
  console.log(`Brukere med minst 1 deltakelse: ${totalEligibleUsers}`)
  console.log(`Manglende merker totalt: ${toAward.length}`)

  if (toAward.length === 0) {
    console.log('Ingenting å tildele.')
    return
  }

  if (!APPLY) {
    console.log()
    console.log('Kjør på nytt med --apply for å tildele.')
    return
  }

  console.log()
  console.log('Tildeler...')
  const rows = toAward.map(t => ({ user_id: t.user_id, badge_id: t.badge_id, event_id: null }))
  const { error } = await supabase.from('user_badges').insert(rows)
  if (error) {
    console.error('Feilet:', error.message)
    process.exit(1)
  }
  console.log(`Tildelt ${rows.length} merker.`)
}

main().catch(e => { console.error(e); process.exit(1) })
