'use client'

import { Marker } from 'react-map-gl/mapbox'
import { Flag } from 'lucide-react'

// Baser for flaskeinnsamling
const bases = [
  {
    id: 'base-nord',
    name: 'Base Nord — Baksiden av Bunnpris, Tonstad',
    area: 'NORD' as const,
    coordinates: [10.38978, 63.36167] as [number, number],
  },
  {
    id: 'base-sor',
    name: 'Base Sør — Hårstad Skole',
    area: 'SOR' as const,
    coordinates: [10.38261, 63.35125] as [number, number],
  },
]

interface BaseMarkerProps {
  activeArea?: 'NORD' | 'SOR' | null
}

// Viser base-markør for flaskeinnsamling — filtrert på aktivt område
export default function BaseMarker({ activeArea }: BaseMarkerProps) {
  const visible = bases.filter((b) => !activeArea || b.area === activeArea)

  return (
    <>
      {visible.map((base) => (
        <Marker
          key={base.id}
          longitude={base.coordinates[0]}
          latitude={base.coordinates[1]}
          anchor="center"
        >
          <div
            className="flex items-center gap-1.5 bg-accent text-white px-2.5 py-1.5 rounded-full shadow-lg text-xs font-semibold whitespace-nowrap"
            title={base.name}
          >
            <Flag size={12} />
            Base
          </div>
        </Marker>
      ))}
    </>
  )
}
