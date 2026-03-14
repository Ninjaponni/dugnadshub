'use client'

import { useRef, useCallback, useState } from 'react'
import Map, { NavigationControl, GeolocateControl, type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import ZoneLayer from './ZoneLayer'
import ZoneMarkers from './ZoneMarkers'
import DropPointMarkers from './DropPointMarkers'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import { MAP_CONFIG } from '@/lib/map/config'

interface DugnadMapProps {
  zones: ZoneWithStatus[]
  onZoneClick: (zone: ZoneWithStatus) => void
  selectedZoneId?: string | null
  userId?: string | null
  activeArea?: 'NORD' | 'SOR' | null
}

// Fullskjermskart med sonepolygoner og oppsamlingspunkter
export default function DugnadMap({ zones, onZoneClick, selectedZoneId, userId, activeArea }: DugnadMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const handleZoneClick = useCallback(
    (zoneId: string) => {
      const zone = zones.find((z) => z.id === zoneId)
      if (zone) onZoneClick(zone)
    },
    [zones, onZoneClick]
  )

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{
        longitude: MAP_CONFIG.center[0],
        latitude: MAP_CONFIG.center[1],
        zoom: MAP_CONFIG.zoom,
      }}
      minZoom={MAP_CONFIG.minZoom}
      maxZoom={MAP_CONFIG.maxZoom}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_CONFIG.style}
      onLoad={() => setMapLoaded(true)}
      interactiveLayerIds={mapLoaded ? ['zone-fill'] : []}
      onClick={(e) => {
        const feature = e.features?.[0]
        if (feature?.properties?.id) {
          handleZoneClick(feature.properties.id as string)
        }
      }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <GeolocateControl
        position="top-right"
        trackUserLocation
        showUserHeading
        positionOptions={{ enableHighAccuracy: true }}
      />

      {mapLoaded && (
        <>
          <ZoneLayer zones={zones} selectedZoneId={selectedZoneId} userId={userId} />
          <DropPointMarkers activeArea={activeArea} />
          <ZoneMarkers zones={zones} userId={userId || null} />
        </>
      )}
    </Map>
  )
}
