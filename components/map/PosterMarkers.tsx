'use client'

import { Marker } from 'react-map-gl/mapbox'
import { StickyNote } from 'lucide-react'
import posterPointsGeoJson from '@/lib/map/poster-points-data'

interface PosterMarkersProps {
  activeArea?: 'NORD' | 'SOR' | null
}

// Viser plakatlokasjoner — kun synlig for lapper-hendelser
export default function PosterMarkers({ activeArea }: PosterMarkersProps) {
  const features = posterPointsGeoJson.features.filter(
    (p) => !activeArea || p.properties.area === activeArea
  )

  return (
    <>
      {features.map((p) => (
        <Marker
          key={p.properties.id}
          longitude={p.geometry.coordinates[0]}
          latitude={p.geometry.coordinates[1]}
          anchor="center"
        >
          <div
            className="w-6 h-6 rounded bg-amber-500 shadow-md flex items-center justify-center border border-amber-600"
            title={p.properties.name}
          >
            <StickyNote size={12} className="text-white" />
          </div>
        </Marker>
      ))}
    </>
  )
}
