// Per-route metadata for desktop topbar. Mapped via usePathname.
export type RouteMeta = {
  title: string
  sub?: string
  fullBleed?: boolean
}

export const ROUTE_META: Record<string, RouteMeta> = {
  '/hjem': { title: 'God dag', sub: 'Her er det som skjer i korpset akkurat nå.' },
  '/kart': { title: 'Kart', fullBleed: true },
  '/sjafor': { title: 'Henting', sub: 'Sjåfør-oversikt og rute' },
  '/vakter': { title: 'Vakter' },
  '/tur': { title: 'Korpstur', sub: 'Lillehammerfestivalen · 12.–14. juni' },
  '/merker': { title: 'Merker' },
  '/profil': { title: 'Min profil', sub: 'Tillerbyen Skolekorps' },
  '/admin/hendelser': { title: 'Hendelser', sub: 'Opprett og styr dugnader og arrangementer' },
  '/admin/medlemmer': { title: 'Medlemmer' },
  '/admin/varsler': { title: 'Varsler', sub: 'Send push til medlemmer' },
  '/admin/oversikt': { title: 'Oversikt' },
}

// Slår opp metadata. Faller tilbake på lengste matching prefix for dynamiske ruter (f.eks. /arrangement/[id]).
export function getRouteMeta(pathname: string): RouteMeta {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname]
  if (pathname.startsWith('/arrangement/')) return { title: 'Vakter' }
  return { title: 'Dugnadshub' }
}
