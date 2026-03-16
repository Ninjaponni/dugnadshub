'use client'

import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import zonesGeoJson from '@/lib/map/zones-data'

// Fargekoder for sonestatus
// Rød=ledig, Gul=delvis tatt, Blå=fullt bemannet, Grønn=ferdigplukket, Lilla=hentet
const COLORS = {
  empty: '#EF4444',      // Rød — ingen har tatt
  partial: '#F59E0B',    // Gul — noen plukkere, ikke nok
  full: '#007AFF',       // Blå — alle plasser fylt, klar for plukking
  completed: '#22C55E',  // Grønn — ferdigplukket, venter på henting
  picked_up: '#8B5CF6',  // Lilla — sjåfør har hentet
  mine_border: '#007AFF', // Blå kant for din sone
}

interface ZoneLayerProps {
  zones: ZoneWithStatus[]
  selectedZoneId?: string | null
  userId?: string | null
}

export default function ZoneLayer({ zones, selectedZoneId, userId }: ZoneLayerProps) {
  const activeZoneIds = useMemo(
    () => new Set(zones.filter((z) => z.assignment_id).map((z) => z.id)),
    [zones]
  )
  const hasActiveEvent = activeZoneIds.size > 0

  const geoJsonWithStatus = useMemo(() => {
    const features = zonesGeoJson.features
      .filter((feature) => !hasActiveEvent || activeZoneIds.has(feature.properties?.id as string))
      .map((feature) => {
      const zoneId = feature.properties?.id
      const zone = zones.find((z) => z.id === zoneId)
      const claimCount = zone?.claims?.length || 0
      const collectorsNeeded = zone?.collectors_needed || 2
      const isMine = userId ? zone?.claims?.some((c) => c.user_id === userId) || false : false

      // Fargerekkefølge: ledig → delvis → fullt → ferdig → hentet
      let colorKey = 'empty'
      if (zone?.status === 'picked_up') {
        colorKey = 'picked_up'
      } else if (zone?.status === 'completed') {
        colorKey = 'completed'
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
          isSelected: zoneId === selectedZoneId,
        },
      }
    })

    return { type: 'FeatureCollection' as const, features }
  }, [zones, selectedZoneId, userId, activeZoneIds, hasActiveEvent])

  return (
    <Source id="zones" type="geojson" data={geoJsonWithStatus as unknown as GeoJSON.FeatureCollection}>
      {/* Fyll */}
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

      {/* Kanter */}
      <Layer
        id="zone-line"
        type="line"
        paint={{
          'line-color': [
            'case',
            ['get', 'isMine'], COLORS.mine_border,
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

      {/* Glow for din sone */}
      <Layer
        id="zone-mine-glow"
        type="line"
        filter={['==', ['get', 'isMine'], true]}
        paint={{
          'line-color': COLORS.mine_border,
          'line-width': 8,
          'line-opacity': 0.2,
          'line-blur': 6,
        }}
      />

      {/* Glow for valgt sone */}
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
