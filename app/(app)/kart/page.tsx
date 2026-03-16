'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeZones, type ZoneWithStatus } from '@/lib/hooks/useRealtimeZones'
import { useActiveEvent } from '@/lib/hooks/useEvent'
import ZoneClaimSheet from '@/components/features/ZoneClaimSheet'
import MapLegend from '@/components/map/MapLegend'
import type { ZoneArea, DugnadEvent } from '@/lib/supabase/types'
import zonesGeoJson from '@/lib/map/combined-zones-data'

const DugnadMap = dynamic(() => import('@/components/map/DugnadMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-bg">
      <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  ),
})

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

// Wrapper med Suspense for useSearchParams
export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-bg">
        <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    }>
      <MapPageContent />
    </Suspense>
  )
}

function MapPageContent() {
  const searchParams = useSearchParams()
  const focusZoneId = searchParams.get('sone')
  const overrideEventId = searchParams.get('event')
  const showAll = searchParams.get('alle') === '1'

  const { event: autoEvent, loading: eventLoading } = useActiveEvent()

  // Bruk override-event fra URL, ellers den automatiske (nærmeste)
  const [overrideEvent, setOverrideEvent] = useState<DugnadEvent | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!overrideEventId) return
    supabaseRef.current
      .from('events')
      .select('*')
      .eq('id', overrideEventId)
      .single()
      .then(({ data }) => {
        if (data) setOverrideEvent(data as unknown as DugnadEvent)
      })
  }, [overrideEventId])

  const event = overrideEventId ? overrideEvent : autoEvent
  const effectiveEventId = showAll ? null : (event?.id || null)

  const { zones, loading: zonesLoading, refetch } = useRealtimeZones(effectiveEventId)
  const [selectedZone, setSelectedZone] = useState<ZoneWithStatus | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null)
  const [initialZoom, setInitialZoom] = useState<number | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lng: number; lat: number; zoom: number } | null>(null)

  useEffect(() => {
    supabaseRef.current.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  // Når soner er lastet og vi har en fokus-sone, åpne den og sentrer kartet
  useEffect(() => {
    if (!focusZoneId || zonesLoading || zones.length === 0) return

    const zone = zones.find((z) => z.id === focusZoneId)
    if (zone) {
      setSelectedZone(zone)

      // Finn polygon-senter for kart-sentrering
      const feature = zonesGeoJson.features.find((f) => f.properties?.id === focusZoneId)
      if (feature) {
        const [lng, lat] = getGeometryCenter(feature.geometry)
        setInitialCenter([lng, lat])
        setInitialZoom(15)
      }
    }
  }, [focusZoneId, zones, zonesLoading])

  // Bestem aktivt område fra hendelsens soner
  const activeArea = useMemo<ZoneArea | null>(() => {
    if (!event || showAll) return null
    const assignedZones = zones.filter((z) => z.assignment_id)
    if (assignedZones.length === 0) return null
    const areas = new Set(assignedZones.map((z) => z.area))
    if (areas.size === 1) return assignedZones[0].area
    return null
  }, [event, zones])

  const assignedZones = zones.filter((z) => z.assignment_id)
  const availableCount = assignedZones.filter((z) => z.claims.length === 0).length
  const partialCount = assignedZones.filter((z) => z.claims.length > 0 && z.claims.length < z.collectors_needed && z.status !== 'completed' && z.status !== 'picked_up').length
  const fullCount = assignedZones.filter((z) => z.claims.length >= z.collectors_needed && z.status !== 'completed' && z.status !== 'picked_up').length
  const doneCount = assignedZones.filter((z) => z.status === 'completed').length
  const pickedUpCount = assignedZones.filter((z) => z.status === 'picked_up').length

  return (
    <div className="fixed inset-0 z-0">
      <DugnadMap
        zones={zones}
        onZoneClick={setSelectedZone}
        selectedZoneId={selectedZone?.id}
        userId={userId}
        activeArea={activeArea}
        eventType={event?.type || null}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        flyTarget={flyTarget}
        onFlyComplete={() => setFlyTarget(null)}
      />

      <MapLegend />

      {!eventLoading && (
        <div className="absolute top-14 left-4 right-16 z-10 safe-top">
          <div className="glass rounded-xl px-3 py-2 shadow-lg">
            {event ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-accent uppercase tracking-wide">
                    {event.status === 'active' ? 'Pågår nå' : 'Kommende'}
                  </p>
                </div>
                <p className="text-sm font-semibold mb-1.5">{event.title}</p>
                <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary">
                  {availableCount > 0 && <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#EF4444' }} />
                    {availableCount}
                  </span>}
                  {partialCount > 0 && <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
                    {partialCount}
                  </span>}
                  {fullCount > 0 && <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#007AFF' }} />
                    {fullCount}
                  </span>}
                  {doneCount > 0 && <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22C55E' }} />
                    {doneCount}
                  </span>}
                  {pickedUpCount > 0 && <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
                    {pickedUpCount}
                  </span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary text-center">
                Ingen kommende hendelser
              </p>
            )}
          </div>
        </div>
      )}

      <ZoneClaimSheet
        zone={selectedZone}
        eventId={event?.id || null}
        userId={userId}
        onClose={() => setSelectedZone(null)}
        onAction={() => {
          refetch()
          setSelectedZone(null)
        }}
        onFlyTo={(lng, lat, zoom) => {
          setFlyTarget({ lng, lat, zoom: zoom || 16 })
        }}
      />
    </div>
  )
}
