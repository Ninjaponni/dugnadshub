'use client'

import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import zonesGeoJson from '@/lib/map/zones-data'

// Farger: Rød=ingen, Gul=delvis, Grønn=fullt/ferdig, Lilla=hentet
const COLORS = {
  empty: '#EF4444',
  partial: '#F59E0B',
  full: '#22C55E',
  completed: '#22C55E',
  picked_up: '#8B5CF6',
  mine: '#007AFF',
}

interface ZoneLayerProps {
  zones: ZoneWithStatus[]
  selectedZoneId?: string | null
  userId?: string | null
}

// Rendrer sonepolygoner med fargekoding basert på status
export default function ZoneLayer({ zones, selectedZoneId, userId }: ZoneLayerProps) {
  // IDer for soner som har assignment (tilhører aktiv hendelse)
  const activeZoneIds = useMemo(
    () => new Set(zones.filter((z) => z.assignment_id).map((z) => z.id)),
    [zones]
  )
  const hasActiveEvent = activeZoneIds.size > 0

  const geoJsonWithStatus = useMemo(() => {
    const features = zonesGeoJson.features
      // Skjul soner som ikke er med i hendelsen (når det finnes en hendelse)
      .filter((feature) => !hasActiveEvent || activeZoneIds.has(feature.properties?.id as string))
      .map((feature) => {
      const zoneId = feature.properties?.id
      const zone = zones.find((z) => z.id === zoneId)
      const claimCount = zone?.claims?.length || 0
      const collectorsNeeded = zone?.collectors_needed || 2
      const isMine = userId ? zone?.claims?.some((c) => c.user_id === userId) || false : false
      const isCompleted = zone?.status === 'completed' || zone?.status === 'picked_up'

      // Bestem farge basert på claims vs needed
      let colorKey = 'empty'
      if (isCompleted) {
        colorKey = zone?.status === 'picked_up' ? 'picked_up' : 'completed'
      } else if (claimCount >= collectorsNeeded) {
        colorKey = 'full'
      } else if (claimCount > 0) {
        colorKey = 'partial'
      }

      return {
        ...feature,
        properties: {
          ...feature.properties,
          colorKey,
          isMine,
          isCompleted: zone?.status === 'completed',
          isPickedUp: zone?.status === 'picked_up',
          isSelected: zoneId === selectedZoneId,
          claimCount,
          collectorsNeeded,
        },
      }
    })

    return { type: 'FeatureCollection' as const, features }
  }, [zones, selectedZoneId, userId])

  return (
    <Source id="zones" type="geojson" data={geoJsonWithStatus as unknown as GeoJSON.FeatureCollection}>
      {/* Fyll — fargekoding */}
      <Layer
        id="zone-fill"
        type="fill"
        paint={{
          'fill-color': [
            'match',
            ['get', 'colorKey'],
            'empty', COLORS.empty,
            'partial', COLORS.partial,
            'full', COLORS.full,
            'completed', COLORS.completed,
            'picked_up', COLORS.picked_up,
            COLORS.empty,
          ] as unknown as string,
          'fill-opacity': [
            'case',
            ['get', 'isMine'], 0.35,
            0.2,
          ] as unknown as number,
        }}
      />

      {/* Kanter — standard */}
      <Layer
        id="zone-line"
        type="line"
        paint={{
          'line-color': [
            'case',
            ['get', 'isMine'], COLORS.mine,
            ['match',
              ['get', 'colorKey'],
              'empty', COLORS.empty,
              'partial', COLORS.partial,
              'full', COLORS.full,
              'completed', COLORS.completed,
              'picked_up', COLORS.picked_up,
              COLORS.empty,
            ],
          ] as unknown as string,
          'line-width': [
            'case',
            ['get', 'isMine'], 3,
            ['get', 'isSelected'], 2.5,
            1.5,
          ] as unknown as number,
          'line-opacity': 0.9,
        }}
      />

      {/* Blå glow for brukerens soner */}
      <Layer
        id="zone-mine-glow"
        type="line"
        filter={['==', ['get', 'isMine'], true]}
        paint={{
          'line-color': COLORS.mine,
          'line-width': 8,
          'line-opacity': 0.2,
          'line-blur': 6,
        }}
      />

      {/* Glow for valgt sone (klikket) */}
      <Layer
        id="zone-selected-glow"
        type="line"
        filter={['all', ['==', ['get', 'isSelected'], true], ['!=', ['get', 'isMine'], true]]}
        paint={{
          'line-color': '#007AFF',
          'line-width': 5,
          'line-opacity': 0.25,
          'line-blur': 4,
        }}
      />
    </Source>
  )
}
