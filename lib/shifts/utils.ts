import type { EventShift, ShiftWithClaims } from '@/lib/types/shifts'

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

// Returnerer "X/Y ledig" eller "Fullt"
export function formatCapacity(claimed: number, capacity: number): string {
  if (claimed >= capacity) return 'Fullt'
  return `${capacity - claimed}/${capacity} ledig`
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

// Rolle-ikon mapping (utvides ved behov)
export function roleIcon(role: string): string {
  const r = role.toLowerCase()
  if (r.includes('renhold')) return '🧽'
  if (r.includes('host') || r.includes('serv')) return '🍽️'
  if (r.includes('vakt') || r.includes('parker')) return '🚧'
  if (r.includes('bar')) return '🍺'
  return '📋'
}
