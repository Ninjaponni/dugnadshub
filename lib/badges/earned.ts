// Opptjente merker: antall per merke, hvor hvert eksemplar kommer fra (dugnad og
// sone), og ulest-prikken. Delt av merkesiden (mobil og desktop) og BottomNav.
// Rene funksjoner testes i scripts/tester/test-merke-hjelpere.ts, så fila skal
// ikke importere noe med @/-alias.

// Henter dugnad og sone sammen med merket. Krever kolonnen zone_assignment_id
// (scripts/migrate-merke-per-sone.sql).
export const EARNED_BADGE_SELECT =
  'badge_id, awarded_at, event_id, zone_assignment_id, events(title, date), zone_assignments(zones(name))'

export interface RawEarnedBadgeRow {
  badge_id: number
  awarded_at: string
  event_id: string | null
  zone_assignment_id: string | null
  events: { title: string; date: string } | null
  zone_assignments: { zones: { name: string } | null } | null
}

export interface EarnedBadgeRow {
  badge_id: number
  awarded_at: string
  event_title: string | null
  event_date: string | null
  zone_name: string | null
}

export interface BadgeSource {
  eventTitle: string | null
  eventDate: string | null
  zoneName: string | null
  awardedAt: string
}

// Sett antall per merke (badge_id → antall eksemplarer brukeren har sett)
export type SeenCounts = Record<number, number>

// Fra 12.10 kl 00 lagres antall per merke. Eldre rader regnes som sett for merker
// som sto i den gamle lista, så gamle ×N-merker ikke gir falsk prikk.
export const LEGACY_SEEN_CUTOFF = '2026-10-12T00:00:00+02:00'

const seenKey = (userId: string) => `seen_badge_counts_${userId}`
const legacySeenKey = (userId: string) => `seen_badges_${userId}`

export function toEarnedRow(raw: RawEarnedBadgeRow): EarnedBadgeRow {
  return {
    badge_id: raw.badge_id,
    awarded_at: raw.awarded_at,
    event_title: raw.events?.title ?? null,
    event_date: raw.events?.date ?? null,
    zone_name: raw.zone_assignments?.zones?.name ?? null,
  }
}

export function countByBadge(rows: ReadonlyArray<{ badge_id: number }>): Map<number, number> {
  const counts = new Map<number, number>()
  for (const r of rows) counts.set(r.badge_id, (counts.get(r.badge_id) ?? 0) + 1)
  return counts
}

// Kilder per merke, nyeste dugnad først (tildelingsdato når merket ikke har dugnad)
export function sourcesByBadge(rows: ReadonlyArray<EarnedBadgeRow>): Map<number, BadgeSource[]> {
  const map = new Map<number, BadgeSource[]>()
  for (const r of rows) {
    const list = map.get(r.badge_id) ?? []
    list.push({ eventTitle: r.event_title, eventDate: r.event_date, zoneName: r.zone_name, awardedAt: r.awarded_at })
    map.set(r.badge_id, list)
  }
  const key = (s: BadgeSource) => s.eventDate ?? s.awardedAt.slice(0, 10)
  for (const list of map.values()) list.sort((a, b) => key(b).localeCompare(key(a)))
  return map
}

// Lista over dugnader vises bare når minst ett eksemplar er koblet til en dugnad
export function hasEventSources(sources: ReadonlyArray<BadgeSource>): boolean {
  return sources.some(s => s.eventTitle !== null)
}

export function unseenBadgeIds(counts: Map<number, number>, seen: SeenCounts): number[] {
  return [...counts].filter(([id, n]) => n > (seen[id] ?? 0)).map(([id]) => id)
}

export function unseenTotal(counts: Map<number, number>, seen: SeenCounts): number {
  let total = 0
  counts.forEach((n, id) => { total += Math.max(0, n - (seen[id] ?? 0)) })
  return total
}

export function legacySeenCounts(
  rows: ReadonlyArray<{ badge_id: number; awarded_at: string }>,
  legacyIds: ReadonlyArray<number>,
  cutoffIso: string = LEGACY_SEEN_CUTOFF,
): SeenCounts {
  const cutoff = new Date(cutoffIso).getTime()
  const seen: SeenCounts = {}
  for (const id of legacyIds) seen[id] = 1
  const before = countByBadge(rows.filter(r => new Date(r.awarded_at).getTime() < cutoff))
  before.forEach((n, id) => { if (id in seen) seen[id] = Math.max(seen[id], n) })
  return seen
}

// localStorage kan mangle eller kaste (privat modus o.l.): da regnes ingenting som sett
export function loadSeenCounts(
  userId: string,
  rows: ReadonlyArray<{ badge_id: number; awarded_at: string }>,
): SeenCounts {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(seenKey(userId))
    if (raw) return JSON.parse(raw) as SeenCounts
    const legacy = window.localStorage.getItem(legacySeenKey(userId))
    if (legacy) return legacySeenCounts(rows, JSON.parse(legacy) as number[])
  } catch {
    // ignorer, se over
  }
  return {}
}

export function saveSeenCounts(userId: string, counts: Map<number, number>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(seenKey(userId), JSON.stringify(Object.fromEntries(counts)))
  } catch {
    // ignorer: prikken kommer bare tilbake neste gang
  }
}

// "2026-10-12" eller ISO-tidsstempel → "12. okt. 2026"
export function formatBadgeDate(iso: string): string {
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso)
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}
