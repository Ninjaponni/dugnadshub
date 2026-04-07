'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import Map, { NavigationControl, GeolocateControl, type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import ZoneLayer from './ZoneLayer'
import ZoneMarkers from './ZoneMarkers'
import DropPointMarkers from './DropPointMarkers'
import PosterMarkers from './PosterMarkers'
import BaseMarker from './BaseMarker'
import type { ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import type { EventType } from '@/lib/supabase/types'
import { MAP_CONFIG } from '@/lib/map/config'

interface DugnadMapProps {
  zones: ZoneWithStatus[]
  onZoneClick: (zone: ZoneWithStatus) => void
  selectedZoneId?: string | null
  userId?: string | null
  activeArea?: 'NORD' | 'SOR' | null
  eventType?: EventType | null
  initialCenter?: [number, number] | null
  initialZoom?: number | null
  initialBounds?: [[number, number], [number, number]] | null
  flyTarget?: { lng: number; lat: number; zoom: number } | null
  onFlyComplete?: () => void
  mapStyle?: string
  onBaseClick?: (base: { id: string; name: string; area: 'NORD' | 'SOR'; coordinates: [number, number] }) => void
}

// Fullskjermskart med sonepolygoner og oppsamlingspunkter
export default function DugnadMap({ zones, onZoneClick, selectedZoneId, userId, activeArea, eventType, initialCenter, initialZoom, initialBounds, flyTarget, onFlyComplete, mapStyle, onBaseClick }: DugnadMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [hasFlown, setHasFlown] = useState(false)

  // Fly til fokus-sone eller fit bounds når kartet er lastet
  useEffect(() => {
    if (!mapLoaded || hasFlown) return
    if (initialCenter) {
      mapRef.current?.flyTo({
        center: initialCenter,
        zoom: initialZoom || 15,
        duration: 1200,
      })
      setHasFlown(true)
    } else if (initialBounds) {
      mapRef.current?.fitBounds(initialBounds, {
        padding: { top: 160, bottom: 100, left: 40, right: 40 },
        duration: 1200,
      })
      setHasFlown(true)
    }
  }, [mapLoaded, initialCenter, initialZoom, initialBounds, hasFlown])

  // Fly til oppsamlingspunkt eller annet mål
  useEffect(() => {
    if (!mapLoaded || !flyTarget) return
    mapRef.current?.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: flyTarget.zoom,
      duration: 1000,
    })
    onFlyComplete?.()
  }, [mapLoaded, flyTarget, onFlyComplete])

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
      mapStyle={mapStyle || MAP_CONFIG.style}
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
          {eventType !== 'lapper' && <DropPointMarkers activeArea={activeArea} />}
          {eventType === 'bottle_collection' && <BaseMarker activeArea={activeArea} onBaseClick={onBaseClick} />}
          {eventType === 'lapper' && <PosterMarkers activeArea={activeArea} />}
          <ZoneMarkers zones={zones} userId={userId || null} />
        </>
      )}
    </Map>
  )
}
