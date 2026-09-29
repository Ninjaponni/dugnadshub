'use client'

import { Marker } from 'react-map-gl/mapbox'
import { Check } from 'lucide-react'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import zonesGeoJson from '@/lib/map/combined-zones-data'
import { isHelpOpen } from '@/lib/map/zone-colors'

interface ZoneMarkersProps {
  zones: ZoneWithStatus[]
  userId: string | null
  // HTML-markører sluker trykk, så "Hjelp ønskes"-pillen må åpne arket selv
  onZoneClick?: (zone: ZoneWithStatus) => void
}

// Beregner senterpunkt av Polygon eller MultiPolygon
function getGeometryCenter(geometry: { type: string; coordinates: number[][][] | number[][][][] }): [number, number] {
  let allPoints: number[][] = []

  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates as number[][][][]) {
      allPoints = allPoints.concat(polygon[0])
    }
  } else {
    allPoints = (geometry.coordinates as number[][][])[0]
  }

  let sumLng = 0, sumLat = 0
  for (const [lng, lat] of allPoints) {
    sumLng += lng
    sumLat += lat
  }
  return [sumLng / allPoints.length, sumLat / allPoints.length]
}

// Viser "Du"-merke på brukerens soner, hake på ferdige soner og
// "Hjelp ønskes"-pille på soner med åpen hjelpeforespørsel. Maks én markør per sone.
export default function ZoneMarkers({ zones, userId, onZoneClick }: ZoneMarkersProps) {
  return (
    <>
      {zones.map((zone) => {
        const isMine = userId ? zone.claims?.some((c) => c.user_id === userId) : false
        const isCompleted = zone.status === 'completed'
        const isPickedUp = zone.status === 'picked_up'

        // Aldri sann for ferdige soner, så pille og hake vises aldri samtidig
        const helpOpen = isHelpOpen(zone)

        if (!isMine && !isCompleted && !isPickedUp && !helpOpen) return null

        // Plast-soner har geometri i DB (zone.geometry), permanente soner i static fil
        let geometry: { type: string; coordinates: number[][][] | number[][][][] } | null = null
        if (zone.zone_type === 'plast' && zone.geometry) {
          geometry = zone.geometry as unknown as { type: string; coordinates: number[][][] | number[][][][] }
        } else {
          const feature = zonesGeoJson.features.find((f) => f.properties?.id === zone.id)
          if (feature) geometry = feature.geometry
        }
        if (!geometry) return null
        const [lng, lat] = getGeometryCenter(geometry)

        return (
          <Marker key={zone.id} longitude={lng} latitude={lat} anchor="center">
            {isCompleted || isPickedUp ? (
              // Grønn hake for ferdige soner
              <div className="w-7 h-7 rounded-full bg-success flex items-center justify-center shadow-md border-2 border-white">
                <Check size={16} className="text-white" strokeWidth={3} />
              </div>
            ) : isMine ? (
              // "Du"-merke for brukerens soner. Oransje prikk = venter på en ekstra hånd.
              <div className="relative px-2 py-0.5 rounded-full bg-accent text-white text-[11px] font-bold shadow-md border-2 border-white">
                DU
                {helpOpen && (
                  <span
                    aria-label="Venter på en ekstra hånd"
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-zone-help border border-white"
                  />
                )}
              </div>
            ) : helpOpen ? (
              // Pulsen (next-beacon) er av når brukeren har valgt redusert bevegelse
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onZoneClick?.(zone) }}
                className="relative isolate px-2.5 py-1 rounded-full bg-zone-help text-white text-[11px] font-bold shadow-md border-2 border-white"
              >
                <span aria-hidden className="next-beacon absolute inset-0 -z-10 rounded-full bg-zone-help/50" />
                Hjelp ønskes
              </button>
            ) : null}
          </Marker>
        )
      })}
    </>
  )
}
