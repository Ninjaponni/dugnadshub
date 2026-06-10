import type { DugnadEvent, EventStatus, EventType, EventArea } from '@/lib/supabase/types'

// Delte typer og etiketter for hendelses-admin — brukes av både
// page.tsx (mobil + skjema) og DesktopEventCard.tsx (lg+-kortene).

// Sonestatus-teller per hendelse
export interface ZoneStats {
  total: number
  available: number
  claimed: number
  completed: number
}

// Hendelse med sonestatus
export interface EventWithZones extends DugnadEvent {
  zoneStats: ZoneStats
}

export const statusLabels: Record<EventStatus, string> = {
  upcoming: 'Kommende',
  active: 'Aktiv',
  completed: 'Fullført',
}

export const statusColors: Record<EventStatus, string> = {
  upcoming: 'bg-teal/10 text-teal',
  active: 'bg-success/10 text-success',
  completed: 'bg-surface-low text-text-secondary',
}

export const typeLabels: Record<EventType, string> = {
  bottle_collection: 'Flaskeinnsamling',
  lapper: 'Lappeutdeling',
  lottery: 'Lotteri',
  baking: 'Bakesalg',
  plast: 'Plastdugnad',
  arrangement: 'Arrangement (vakter)',
  other: 'Annet',
}

export const areaLabels: Record<EventArea, string> = {
  nord: 'Nord',
  sor: 'Sør',
  begge: 'Begge',
}
