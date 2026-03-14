'use client'

import { Marker } from 'react-map-gl/mapbox'
import { Package } from 'lucide-react'
import dropPointsGeoJson from '@/lib/map/drop-points-data'

interface DropPointMarkersProps {
  activeArea?: 'NORD' | 'SOR' | null
}

// Viser oppsamlingspunkter — filtrert på aktivt område
export default function DropPointMarkers({ activeArea }: DropPointMarkersProps) {
  const features = dropPointsGeoJson.features.filter(
    (dp) => !activeArea || dp.properties.area === activeArea
  )

  return (
    <>
      {features.map((dp) => (
        <Marker
          key={dp.properties.id}
          longitude={dp.geometry.coordinates[0]}
          latitude={dp.geometry.coordinates[1]}
          anchor="center"
        >
          <div
            className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center border border-black/10"
            title={dp.properties.name}
          >
            <Package size={12} className="text-text-secondary" />
          </div>
        </Marker>
      ))}
    </>
  )
}
