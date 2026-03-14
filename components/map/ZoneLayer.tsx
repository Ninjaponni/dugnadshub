'use client'

import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import { ZONE_COLORS, ZONE_OPACITY } from '@/lib/map/config'
import zonesGeoJson from '@/lib/map/zones-data'

interface ZoneLayerProps {
  zones: ZoneWithStatus[]
  selectedZoneId?: string | null
}

// Rendrer sonepolygoner med fargekoding basert på status
export default function ZoneLayer({ zones, selectedZoneId }: ZoneLayerProps) {
  // Kombiner GeoJSON med sanntids-status
  const geoJsonWithStatus = useMemo(() => {
    const features = zonesGeoJson.features.map((feature) => {
      const zoneId = feature.properties?.id
      const zone = zones.find((z) => z.id === zoneId)
      const status = zone?.status || 'available'
      const claimCount = zone?.claims?.length || 0
      const collectorsNeeded = zone?.collectors_needed || 2

      return {
        ...feature,
        properties: {
          ...feature.properties,
          status,
          claimCount,
          collectorsNeeded,
          isSelected: zoneId === selectedZoneId,
        },
      }
    })

    return { type: 'FeatureCollection' as const, features }
  }, [zones, selectedZoneId])

  return (
    <Source id="zones" type="geojson" data={geoJsonWithStatus as unknown as GeoJSON.FeatureCollection}>
      {/* Fyll — fargekoding per status */}
      <Layer
        id="zone-fill"
        type="fill"
        paint={{
          'fill-color': [
            'match',
            ['get', 'status'],
            'available', ZONE_COLORS.available,
            'claimed', ZONE_COLORS.claimed,
            'in_progress', ZONE_COLORS.in_progress,
            'completed', ZONE_COLORS.completed,
            'picked_up', ZONE_COLORS.picked_up,
            ZONE_COLORS.available,
          ] as unknown as string,
          'fill-opacity': [
            'match',
            ['get', 'status'],
            'available', ZONE_OPACITY.available,
            'claimed', ZONE_OPACITY.claimed,
            'in_progress', ZONE_OPACITY.in_progress,
            'completed', ZONE_OPACITY.completed,
            'picked_up', ZONE_OPACITY.picked_up,
            0.25,
          ] as unknown as number,
        }}
      />
      {/* Kanter */}
      <Layer
        id="zone-line"
        type="line"
        paint={{
          'line-color': [
            'match',
            ['get', 'status'],
            'available', ZONE_COLORS.available,
            'claimed', ZONE_COLORS.claimed,
            'in_progress', ZONE_COLORS.in_progress,
            'completed', ZONE_COLORS.completed,
            'picked_up', ZONE_COLORS.picked_up,
            ZONE_COLORS.available,
          ] as unknown as string,
          'line-width': [
            'case',
            ['get', 'isSelected'], 3,
            1.5,
          ] as unknown as number,
          'line-opacity': 0.8,
        }}
      />
      {/* Glow for valgt sone */}
      <Layer
        id="zone-selected-glow"
        type="line"
        filter={['==', ['get', 'isSelected'], true]}
        paint={{
          'line-color': '#007AFF',
          'line-width': 6,
          'line-opacity': 0.3,
          'line-blur': 4,
        }}
      />
    </Source>
  )
}
