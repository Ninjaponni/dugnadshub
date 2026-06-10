'use client'

import { Marker } from 'react-map-gl/mapbox'
import { Flag } from 'lucide-react'
import { bases } from '@/lib/map/bases'

// Selve base-dataene bor i lib/map/bases.ts (uten Mapbox-imports) så andre
// filer kan importere dem uten å dra mapbox-gl inn i bundlen.
// Re-eksport for eksisterende importører av denne fila.
export { bases }

interface BaseMarkerProps {
  activeArea?: 'NORD' | 'SOR' | null
  onBaseClick?: (base: typeof bases[number]) => void
}

// Viser base-markør for flaskeinnsamling — filtrert på aktivt område
export default function BaseMarker({ activeArea, onBaseClick }: BaseMarkerProps) {
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
          <button
            onClick={(e) => {
              e.stopPropagation()
              onBaseClick?.(base)
            }}
            className="flex items-center gap-1.5 bg-accent text-white px-2.5 py-1.5 rounded-full shadow-lg text-xs font-semibold whitespace-nowrap active:scale-95 transition-transform"
            title={base.name}
          >
            <Flag size={12} />
            Base
          </button>
        </Marker>
      ))}
    </>
  )
}
