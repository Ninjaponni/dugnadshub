import type { ZoneArea } from '@/lib/supabase/types'

// Baser for flaskeinnsamling. Bor i egen datafil (uten Mapbox-imports) slik at
// kart-siden kan importere dem uten å dra mapbox-gl inn i initial-bundlen —
// BaseMarker importerer react-map-gl, og en statisk import derfra koblet ut
// hele dynamic()-splitten.
export const bases = [
  {
    id: 'base-nord',
    name: 'Base Nord — Baksiden av Bunnpris, Tonstad',
    area: 'NORD' as ZoneArea,
    coordinates: [10.38978, 63.36167] as [number, number],
  },
  {
    id: 'base-sor',
    name: 'Base Sør — Hårstad Skole',
    area: 'SOR' as ZoneArea,
    coordinates: [10.38261, 63.35125] as [number, number],
  },
]

export type Base = (typeof bases)[number]
