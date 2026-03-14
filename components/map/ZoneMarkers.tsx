'use client'

import { Marker } from 'react-map-gl/mapbox'
import { Check } from 'lucide-react'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import zonesGeoJson from '@/lib/map/zones-data'

interface ZoneMarkersProps {
  zones: ZoneWithStatus[]
  userId: string | null
}

// Beregner senterpunkt av en polygon
function getPolygonCenter(coordinates: number[][][]): [number, number] {
  const ring = coordinates[0]
  let sumLng = 0, sumLat = 0
  for (const [lng, lat] of ring) {
    sumLng += lng
    sumLat += lat
  }
  return [sumLng / ring.length, sumLat / ring.length]
}

// Viser "Du"-merke på brukerens soner og hake på ferdige soner
export default function ZoneMarkers({ zones, userId }: ZoneMarkersProps) {
  return (
    <>
      {zones.map((zone) => {
        const isMine = userId ? zone.claims?.some((c) => c.user_id === userId) : false
        const isCompleted = zone.status === 'completed'
        const isPickedUp = zone.status === 'picked_up'

        if (!isMine && !isCompleted && !isPickedUp) return null

        // Finn polygon-senteret fra GeoJSON
        const feature = zonesGeoJson.features.find((f) => f.properties?.id === zone.id)
        if (!feature) return null
        const [lng, lat] = getPolygonCenter(feature.geometry.coordinates as number[][][])

        return (
          <Marker key={zone.id} longitude={lng} latitude={lat} anchor="center">
            {isCompleted || isPickedUp ? (
              // Grønn hake for ferdige soner
              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md border-2 border-white">
                <Check size={16} className="text-white" strokeWidth={3} />
              </div>
            ) : isMine ? (
              // "Du"-merke for brukerens soner
              <div className="px-2 py-0.5 rounded-full bg-accent text-white text-[11px] font-bold shadow-md border-2 border-white">
                DU
              </div>
            ) : null}
          </Marker>
        )
      })}
    </>
  )
}
