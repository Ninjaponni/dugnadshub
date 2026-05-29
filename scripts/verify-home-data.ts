/**
 * Differensial-verifisering: get_home_data-RPC vs de gamle 5 spørringene.
 * Beviser at RPC-en returnerer nøyaktig samme data som klienten henter i dag.
 *
 * Bruk: npx tsx scripts/verify-home-data.ts <user_id>
 * Krever SUPABASE_URL (eller NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY i miljøet.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const userId = process.argv[2]

if (!URL || !KEY) { console.error('Mangler SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
if (!userId) { console.error('Bruk: npx tsx scripts/verify-home-data.ts <user_id>'); process.exit(1) }

const supabase = createClient(URL, KEY)

// Kanonisk JSON: sorter objektnøkler rekursivt så nøkkelrekkefølge ikke gir falske avvik
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function canon(v: any): any {
  if (Array.isArray(v)) return v.map(canon)
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o }, {} as Record<string, unknown>)
  }
  return v
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortRows(rows: any[], key: string) {
  return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])))
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compare(name: string, a: any[], b: any[], key = 'id'): boolean {
  const sa = JSON.stringify(canon(sortRows(a, key)))
  const sb = JSON.stringify(canon(sortRows(b, key)))
  const ok = sa === sb
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (gammel ${a.length} rader, ny ${b.length} rader)`)
  if (!ok) { console.log('  gammel:', sa.slice(0, 800)); console.log('  ny:    ', sb.slice(0, 800)) }
  return ok
}

async function oldPath() {
  const { data: events } = await supabase.from('events')
    .select('id,title,type,date,start_time,area,status,signup_deadline')
    .in('status', ['upcoming', 'active']).order('date', { ascending: true })
  const eventIds = (events || []).map(e => e.id)
  const { data: assignments } = eventIds.length
    ? await supabase.from('zone_assignments').select('id,event_id,zone_id,status').in('event_id', eventIds)
    : { data: [] }
  const { data: zones } = await supabase.from('zones').select('id,name,area,collectors_needed')
  const assignmentIds = (assignments || []).map(a => a.id)
  const { data: claims } = assignmentIds.length
    ? await supabase.from('zone_claims').select('id,assignment_id,user_id,profiles(full_name)').in('assignment_id', assignmentIds)
    : { data: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flatClaims = (claims || []).map((c: any) => ({ id: c.id, assignment_id: c.assignment_id, user_id: c.user_id, full_name: c.profiles?.full_name ?? null }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrangementIds = (events || []).filter((e: any) => e.type === 'arrangement' && e.status === 'active').map(e => e.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shiftData: any[] = []
  if (arrangementIds.length) {
    const { data: shifts } = await supabase.from('event_shifts').select('event_id,capacity,claims:shift_claims(id)').in('event_id', arrangementIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shiftData = (shifts || []).map((s: any) => ({ event_id: s.event_id, capacity: s.capacity, claim_count: s.claims.length }))
  }
  return { events: events || [], zone_assignments: assignments || [], zones: zones || [], zone_claims: flatClaims, shift_data: shiftData }
}

async function newPath() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_home_data', { p_user_id: userId })
  if (error) throw error
  return data
}

async function main() {
  const oldD = await oldPath()
  const newD = await newPath()
  let ok = true
  ok = compare('events', oldD.events, newD.events) && ok
  ok = compare('zone_assignments', oldD.zone_assignments, newD.zone_assignments) && ok
  ok = compare('zones', oldD.zones, newD.zones) && ok
  ok = compare('zone_claims', oldD.zone_claims, newD.zone_claims) && ok
  ok = compare('shift_data', oldD.shift_data, newD.shift_data, 'event_id') && ok
  const uidOk = newD.current_user_id === userId
  console.log(`${uidOk ? 'PASS' : 'FAIL'}  current_user_id`)
  ok = ok && uidOk
  console.log(ok ? '\nALLE PASS' : '\nNOEN FEILET')
  process.exit(ok ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
