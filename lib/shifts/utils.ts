import type { EventShift, ShiftWithClaims, Match } from '@/lib/types/shifts'

// Norske ukedager
const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']

// Formaterer 'YYYY-MM-DD' til 'Mandag 15. juni'
export function formatShiftDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`
}

// Formaterer 'YYYY-MM-DD' til '15.06'
export function formatShiftDateShort(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Formaterer 'HH:MM:SS' eller 'HH:MM' til 'HH:MM'
export function formatShiftTime(t: string): string {
  return t.slice(0, 5)
}

// Sjekker om vakta krysser midnatt (end='00:00' eller end < start)
export function isOvernightShift(start: string, end: string): boolean {
  const s = start.slice(0, 5)
  const e = end.slice(0, 5)
  return e === '00:00' || e < s
}

// Formaterer tidsrom som 'HH:MM–HH:MM'
export function formatShiftRange(start: string, end: string): string {
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`
}

// Beregner vakt-varighet i timer (håndterer overnight)
export function shiftDurationHours(start: string, end: string): number {
  const [sh, sm] = start.slice(0, 5).split(':').map(Number)
  const [eh, em] = end.slice(0, 5).split(':').map(Number)
  const startMin = sh * 60 + sm
  let endMin = eh * 60 + em
  // Krysser midnatt kun hvis end er STRICTLY mindre enn start.
  // Hvis end === start, returner 0 (samme tid = ingen varighet, ikke 24 t).
  if (endMin < startMin) endMin += 24 * 60
  return (endMin - startMin) / 60
}

// Legger til N dager til en ISO date-string
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// Returnerer "Fullt" eller "X ledig" / "X ledige"
export function formatCapacity(claimed: number, capacity: number): string {
  if (claimed >= capacity) return 'Fullt'
  const free = capacity - claimed
  return free === 1 ? '1 ledig' : `${free} ledige`
}

// Status: 'empty' (0 påmeldte), 'partial' (mellom 0 og full), 'full'
export function shiftFillStatus(claimed: number, capacity: number): 'empty' | 'partial' | 'full' {
  if (claimed === 0) return 'empty'
  if (claimed >= capacity) return 'full'
  return 'partial'
}

// Grupperer en sortert liste med shifts per dato
export function groupShiftsByDate(shifts: ShiftWithClaims[]): Map<string, ShiftWithClaims[]> {
  const grouped = new Map<string, ShiftWithClaims[]>()
  for (const s of shifts) {
    const list = grouped.get(s.shift_date) ?? []
    list.push(s)
    grouped.set(s.shift_date, list)
  }
  return grouped
}

// Sortering: dato + starttid
export function sortShifts<T extends EventShift>(shifts: T[]): T[] {
  return [...shifts].sort((a, b) => {
    if (a.shift_date !== b.shift_date) return a.shift_date.localeCompare(b.shift_date)
    return a.start_time.localeCompare(b.start_time)
  })
}

// Sjekker om en signup_deadline er passert
export function isDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

// Returnerer kampene som starter innenfor en vakts tidsrom (håndterer overnight)
export function matchesDuringShift(matches: Match[] | null | undefined, shift: EventShift): Match[] {
  if (!matches || matches.length === 0) return []
  const start = shift.start_time.slice(0, 5)
  const end = shift.end_time.slice(0, 5)
  const overnight = isOvernightShift(start, end)

  let inRange: Match[]
  if (!overnight) {
    inRange = matches.filter(m => m.date === shift.shift_date && m.time >= start && m.time <= end)
  } else {
    const nextDate = addDays(shift.shift_date, 1)
    const sameDay = matches.filter(m => m.date === shift.shift_date && m.time >= start)
    const nextDay = end === '00:00'
      ? []
      : matches.filter(m => m.date === nextDate && m.time <= end)
    inRange = [...sameDay, ...nextDay]
  }
  return inRange.sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  )
}

// Formatér påmeldte som lesbar liste — "Du, Anna og Per er påmeldt"
// "Du" sorteres alltid først. Bruker fornavn for kompakthet.
// Mer enn 3 navn: "Du, Anna og 2 andre er påmeldt"
export function formatClaimedByList(
  claims: Array<{ user_id: string; profile: { full_name: string | null } | null }> | null | undefined,
  currentUserId?: string,
): string | null {
  if (!claims || claims.length === 0) return null

  const sorted = [...claims].sort((a, b) => {
    if (a.user_id === currentUserId) return -1
    if (b.user_id === currentUserId) return 1
    return (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? '')
  })

  const labels = sorted.map(c =>
    c.user_id === currentUserId
      ? 'Du'
      : (c.profile?.full_name?.split(' ')[0] ?? 'Anonym')
  )

  if (labels.length === 1) return `${labels[0]} er påmeldt`
  if (labels.length === 2) return `${labels[0]} og ${labels[1]} er påmeldt`
  if (labels.length === 3) return `${labels[0]}, ${labels[1]} og ${labels[2]} er påmeldt`
  const others = labels.length - 2
  return `${labels[0]}, ${labels[1]} og ${others} andre er påmeldt`
}

// Rolle-ikon mapping (utvides ved behov)
export function roleIcon(role: string): string {
  const r = role.toLowerCase()
  if (r.includes('renhold')) return '🧽'
  if (r.includes('host') || r.includes('serv')) return '🍽️'
  if (r.includes('vakt') || r.includes('parker')) return '🚧'
  if (r.includes('bar')) return '🍺'
  return '📋'
}
